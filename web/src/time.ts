/**
 * Laika logi / time windows are stored as minutes since midnight, which is what
 * comparisons want, and shown as "07:00", which is what people want. These two
 * functions are the whole conversion, in one place so the editor and the kid's
 * tiles can never drift apart on it.
 */

import type { TimeWindow } from './types.ts';

/** 420 -> "07:00". */
export function toClock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** "07:00" -> 420, or null for the empty or half-typed value of a time input. */
export function fromClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

/** "07:00–10:00 · 19:00–22:30" — a deed's windows on one line. */
export function windowsLabel(windows: TimeWindow[]): string {
  return windows.map((w) => `${toClock(w.start_min)}–${toClock(w.end_min)}`).join(' · ');
}
