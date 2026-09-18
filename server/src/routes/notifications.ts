/**
 * Paziņojumi / notifications — one small endpoint the whole app polls.
 *
 * The app is served over plain HTTP on the family's own LAN, so the browser's
 * push machinery is out of reach: it needs a secure context and a detour
 * through Google's or Mozilla's servers, which is exactly what self-hosting
 * this was meant to avoid. So notifications here are the in-app kind — a badge
 * on a tab and a toast on screen — and this endpoint is what feeds them.
 *
 * It is deliberately cheap: counts for a parent, and for a kid the handful of
 * answers a parent has given them recently. The client remembers which of those
 * it has already shown, so the server needs no per-device read state.
 */

import { Router } from 'express';
import { db } from '../db.ts';
import { requireUser } from '../auth.ts';

export const notificationsRouter = Router();

/** An answered request, as it reaches the kid who filed it. */
interface AnswerEvent {
  /** Stable across polls — the client tracks what it has shown by this. */
  key: string;
  kind: 'deed' | 'reward';
  title: string;
  icon: string;
  status: 'approved' | 'rejected';
  /** Points gained (deed) or spent (reward), always positive. */
  amount: number;
  note: string;
  reviewed_at: string;
}

const countOf = (sql: string): number => (db.prepare(sql).get() as { n: number }).n;

notificationsRouter.get('/', requireUser, (req, res) => {
  const me = req.user!;

  if (me.role === 'parent') {
    res.json({
      pendingSubmissions: countOf("SELECT COUNT(*) AS n FROM submissions WHERE status = 'pending'"),
      pendingRedemptions: countOf("SELECT COUNT(*) AS n FROM redemptions WHERE status = 'pending'"),
      // A plain parent can only act on a kid's forgotten PIN, so badging them
      // for a request only the admin can answer would be nagging.
      pinRequests: countOf(
        `SELECT COUNT(*) AS n FROM pin_requests r JOIN users u ON u.id = r.user_id
          WHERE r.status = 'pending' ${me.is_admin ? '' : "AND u.role = 'kid'"}`,
      ),
      events: [] as AnswerEvent[],
    });
    return;
  }

  /*
   * Two days rather than one: a kid who does not open the app over a weekend
   * should still find out that Friday's request was approved, and the client
   * only ever shows each answer once anyway.
   */
  const events = db
    .prepare(
      `SELECT 'deed' AS kind, id, deed_title AS title, deed_icon AS icon, status,
              points AS amount, review_note AS note, reviewed_at
         FROM submissions
        WHERE kid_id = ? AND status IN ('approved', 'rejected')
          AND reviewed_at >= datetime('now', '-2 days')
        UNION ALL
       SELECT 'reward' AS kind, id, reward_title AS title, reward_icon AS icon, status,
              cost AS amount, review_note AS note, reviewed_at
         FROM redemptions
        WHERE kid_id = ? AND status IN ('approved', 'rejected')
          AND reviewed_at >= datetime('now', '-2 days')
        ORDER BY reviewed_at DESC
        LIMIT 30`,
    )
    .all(me.id, me.id) as Array<Omit<AnswerEvent, 'key'> & { id: number }>;

  res.json({
    pendingSubmissions: 0,
    pendingRedemptions: 0,
    pinRequests: 0,
    events: events.map(({ id, ...event }) => ({ ...event, key: `${event.kind}-${id}` })),
  });
});
