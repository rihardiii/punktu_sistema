/**
 * Kad darbu drīkst pieteikt / when a deed may be filed.
 *
 * Two independent rules, both optional and both off by default:
 *   - time windows — "zobus tīra no rīta un vakarā", morning and evening;
 *   - a daily cap   — "istabu uzkopj reizi dienā", once a day.
 *
 * Both are judged by the server clock, never the phone's. The container runs
 * with TZ set to the family's zone, so "today" and "07:00" mean what everyone
 * in the house means by them, whatever a kid has fiddled with in their own
 * device settings.
 */

import { db } from './db.ts';
import { badRequest, int } from './validate.ts';

/** Minutes since local midnight, both ends inclusive: 420–600 is 07:00–10:00. */
export interface TimeWindow {
  start_min: number;
  end_min: number;
}

/** Why a tile is greyed out — '' means the kid can tap it right now. */
export type DeedLock = '' | 'window' | 'limit';

export interface DeedRow {
  id: number;
  max_per_day: number;
  [column: string]: unknown;
}

/** The deed as the client sees it: the row, its windows and today's standing. */
export interface AnnotatedDeed extends DeedRow {
  windows: TimeWindow[];
  /** Filed today and not rejected. 0 for a parent's catalog listing. */
  done_today: number;
  locked: DeedLock;
}

const MAX_WINDOWS = 4;
const MAX_PER_DAY_CEILING = 50;

// --- reading ----------------------------------------------------------------

/** Minutes since midnight on the server's clock. */
export function minutesNow(now = new Date()): number {
  return now.getHours() * 60 + now.getMinutes();
}

/** Windows for a set of deeds, keyed by deed id. Deeds without any are absent. */
function windowsByDeed(): Map<number, TimeWindow[]> {
  const rows = db
    .prepare('SELECT deed_id, start_min, end_min FROM deed_windows ORDER BY deed_id, start_min')
    .all() as Array<{ deed_id: number; start_min: number; end_min: number }>;

  const map = new Map<number, TimeWindow[]>();
  for (const row of rows) {
    const list = map.get(row.deed_id) ?? [];
    list.push({ start_min: row.start_min, end_min: row.end_min });
    map.set(row.deed_id, list);
  }
  return map;
}

/**
 * How many times this kid has filed each deed today. Pending counts: a request
 * still waiting for a parent has used up its slot, or a kid could file the same
 * deed ten times before anyone looked at the first one. Rejected does not —
 * being turned down should not cost the kid the rest of their day.
 */
function doneTodayByDeed(kidId: number): Map<number, number> {
  const rows = db
    .prepare(
      `SELECT deed_id, COUNT(*) AS n FROM submissions
        WHERE kid_id = ? AND deed_id IS NOT NULL
          AND status IN ('pending', 'approved')
          AND date(created_at, 'localtime') = date('now', 'localtime')
        GROUP BY deed_id`,
    )
    .all(kidId) as Array<{ deed_id: number; n: number }>;

  return new Map(rows.map((row) => [row.deed_id, row.n]));
}

/** True when `minute` falls inside any of the windows — or there are none. */
export function withinWindows(windows: TimeWindow[], minute: number): boolean {
  if (windows.length === 0) return true;
  return windows.some((w) => minute >= w.start_min && minute <= w.end_min);
}

export function lockFor(
  deed: { max_per_day: number },
  windows: TimeWindow[],
  doneToday: number,
  minute: number,
): DeedLock {
  // The cap is checked first: once a deed is done for the day, saying so is
  // more use to a kid than telling them to come back at 19:00 and find it
  // locked anyway.
  if (deed.max_per_day > 0 && doneToday >= deed.max_per_day) return 'limit';
  if (!withinWindows(windows, minute)) return 'window';
  return '';
}

/**
 * Attaches windows to every deed, plus — for a kid looking at their own list —
 * today's count and the reason the tile is locked. Only the server can work
 * these out, so the client never has to guess.
 */
export function annotateDeeds(rows: DeedRow[], kidId: number | null): AnnotatedDeed[] {
  const windows = windowsByDeed();
  const done = kidId === null ? new Map<number, number>() : doneTodayByDeed(kidId);
  const minute = minutesNow();

  return rows.map((row) => {
    const mine = windows.get(row.id) ?? [];
    const doneToday = done.get(row.id) ?? 0;
    return {
      ...row,
      windows: mine,
      done_today: doneToday,
      locked: kidId === null ? '' : lockFor(row, mine, doneToday, minute),
    };
  });
}

/** The live rule for one deed, as the submission endpoint needs it. */
export function lockForKid(deed: { id: number; max_per_day: number }, kidId: number): DeedLock {
  const windows = db
    .prepare('SELECT start_min, end_min FROM deed_windows WHERE deed_id = ? ORDER BY start_min')
    .all(deed.id) as TimeWindow[];

  return lockFor(deed, windows, doneTodayByDeed(kidId).get(deed.id) ?? 0, minutesNow());
}

// --- writing ----------------------------------------------------------------

/**
 * Validates the windows a parent sent. Overlapping ranges are refused rather
 * than merged: a parent who typed 07:00–10:00 and 09:00–11:00 has made a
 * mistake, and quietly turning it into 07:00–11:00 hides it from them.
 */
export function parseWindows(value: unknown, field = 'windows'): TimeWindow[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) badRequest('invalid_field', field);
  if (value.length > MAX_WINDOWS) badRequest('too_many_windows', field);

  const parsed = value.map((entry) => {
    const raw = entry as Record<string, unknown> | null;
    if (!raw || typeof raw !== 'object') badRequest('invalid_field', field);
    const start = int(raw.start_min, 'start_min', { min: 0, max: 1439 });
    const end = int(raw.end_min, 'end_min', { min: 0, max: 1439 });
    if (end <= start) badRequest('invalid_time_window', field);
    return { start_min: start, end_min: end };
  });

  const sorted = [...parsed].sort((a, b) => a.start_min - b.start_min);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.start_min <= sorted[i - 1]!.end_min) badRequest('invalid_time_window', field);
  }
  return sorted;
}

export function parseMaxPerDay(value: unknown, fallback: number): number {
  if (value === undefined || value === null) return fallback;
  return int(value, 'max_per_day', { min: 0, max: MAX_PER_DAY_CEILING });
}

const deleteWindows = db.prepare('DELETE FROM deed_windows WHERE deed_id = ?');
const insertWindow = db.prepare(
  'INSERT INTO deed_windows (deed_id, start_min, end_min) VALUES (?, ?, ?)',
);

/** Replaces a deed's windows wholesale — the form always sends the full set. */
export function replaceWindows(deedId: number, windows: TimeWindow[]): void {
  deleteWindows.run(deedId);
  for (const w of windows) insertWindow.run(deedId, w.start_min, w.end_min);
}
