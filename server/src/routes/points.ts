import { Router } from 'express';
import { db } from '../db.ts';
import { requireParent, requireUser } from '../auth.ts';
import { HttpError, id, int, str } from '../validate.ts';
import { addLedgerEntry, balanceOf, pendingPointsOf, reservedPointsOf } from '../points.ts';

export const pointsRouter = Router();

/** Kids may only ever read their own numbers. */
function assertMayView(req: Parameters<typeof requireUser>[0], kidId: number): void {
  const me = req.user!;
  if (me.role === 'kid' && me.id !== kidId) throw new HttpError(403, 'forbidden');
}

/** Balance plus the two "in flight" figures the kid's dashboard shows. */
pointsRouter.get('/balance/:kidId', requireUser, (req, res) => {
  const kidId = id(req.params.kidId, 'kidId');
  assertMayView(req, kidId);
  const balance = balanceOf(kidId);
  const reserved = reservedPointsOf(kidId);
  res.json({
    kidId,
    balance,
    pending: pendingPointsOf(kidId),
    reserved,
    available: balance - reserved,
  });
});

/** Full point history for one kid — the "where did my points go" screen. */
pointsRouter.get('/ledger/:kidId', requireUser, (req, res) => {
  const kidId = id(req.params.kidId, 'kidId');
  assertMayView(req, kidId);
  const rows = db
    .prepare(
      `SELECT l.*, u.name AS created_by_name
       FROM ledger l LEFT JOIN users u ON u.id = l.created_by
       WHERE l.kid_id = ? ORDER BY l.created_at DESC, l.id DESC LIMIT 300`,
    )
    .all(kidId);
  res.json({ entries: rows });
});

/**
 * Manual correction by a parent — a bonus, or fixing a mistake. Recorded in the
 * ledger like everything else, with a mandatory reason so it is never a mystery.
 */
pointsRouter.post('/adjust', requireParent, (req, res) => {
  const kidId = id(req.body?.kidId, 'kidId');
  const kid = db.prepare("SELECT 1 FROM users WHERE id = ? AND role = 'kid'").get(kidId);
  if (!kid) throw new HttpError(404, 'kid_not_found');

  const delta = int(req.body?.delta, 'delta', { min: -1_000_000, max: 1_000_000 });
  if (delta === 0) throw new HttpError(400, 'invalid_field');
  const reason = str(req.body?.reason, 'reason', { max: 200 });

  addLedgerEntry({ kidId, delta, reason, refType: 'adjustment', refId: null, createdBy: req.user!.id });
  res.status(201).json({ balance: balanceOf(kidId) });
});

/** Parent home screen: pending counts plus a per-kid summary. */
pointsRouter.get('/overview', requireParent, (_req, res) => {
  const kids = db
    .prepare("SELECT id, name, avatar, color FROM users WHERE role = 'kid' AND active = 1 ORDER BY name")
    .all() as Array<{ id: number; name: string; avatar: string; color: string }>;

  const weekEarned = db.prepare<[number], { total: number }>(
    `SELECT COALESCE(SUM(delta), 0) AS total FROM ledger
     WHERE kid_id = ? AND delta > 0 AND created_at >= datetime('now', '-7 days')`,
  );

  res.json({
    pendingSubmissions: (
      db.prepare("SELECT COUNT(*) AS n FROM submissions WHERE status = 'pending'").get() as {
        n: number;
      }
    ).n,
    pendingRedemptions: (
      db.prepare("SELECT COUNT(*) AS n FROM redemptions WHERE status = 'pending'").get() as {
        n: number;
      }
    ).n,
    kids: kids.map((kid) => ({
      ...kid,
      balance: balanceOf(kid.id),
      pending: pendingPointsOf(kid.id),
      reserved: reservedPointsOf(kid.id),
      earnedThisWeek: weekEarned.get(kid.id)?.total ?? 0,
    })),
  });
});
