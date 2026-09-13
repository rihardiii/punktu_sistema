import { Router } from 'express';
import { db } from '../db.ts';
import { requireParent, requireUser } from '../auth.ts';
import { HttpError, id, optStr, str } from '../validate.ts';
import { addLedgerEntry, balanceOf, reservedPointsOf } from '../points.ts';
import type { ReviewStatus } from '../types.ts';

export const redemptionsRouter = Router();

interface RedemptionRow {
  id: number;
  kid_id: number;
  reward_title: string;
  cost: number;
  status: ReviewStatus;
}

redemptionsRouter.get('/', requireUser, (req, res) => {
  const me = req.user!;
  const where: string[] = [];
  const params: unknown[] = [];

  if (me.role === 'kid') {
    where.push('r.kid_id = ?');
    params.push(me.id);
  } else if (req.query.kidId) {
    where.push('r.kid_id = ?');
    params.push(id(req.query.kidId, 'kidId'));
  }

  const status = req.query.status;
  if (typeof status === 'string' && ['pending', 'approved', 'rejected'].includes(status)) {
    where.push('r.status = ?');
    params.push(status);
  }

  const rows = db
    .prepare(
      `SELECT r.*, k.name AS kid_name, k.avatar AS kid_avatar, k.color AS kid_color,
              p.name AS reviewer_name
       FROM redemptions r
       JOIN users k ON k.id = r.kid_id
       LEFT JOIN users p ON p.id = r.reviewed_by
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END, r.created_at DESC
       LIMIT 500`,
    )
    .all(...params);

  res.json({ redemptions: rows });
});

/**
 * A kid asks to spend points. Points are not deducted here — they are only
 * *reserved*, so a kid cannot queue up three requests they can't all afford.
 * The deduction happens on approval.
 */
redemptionsRouter.post('/', requireUser, (req, res) => {
  const me = req.user!;
  const kidId = me.role === 'kid' ? me.id : id(req.body?.kidId, 'kidId');

  if (me.role === 'parent') {
    const kid = db.prepare("SELECT 1 FROM users WHERE id = ? AND role = 'kid'").get(kidId);
    if (!kid) throw new HttpError(404, 'kid_not_found');
  }

  const rewardId = id(req.body?.rewardId, 'rewardId');
  const reward = db.prepare('SELECT * FROM rewards WHERE id = ? AND active = 1').get(rewardId) as
    | { id: number; title_lv: string; icon: string; cost: number }
    | undefined;
  if (!reward) throw new HttpError(404, 'reward_not_found');

  const available = balanceOf(kidId) - reservedPointsOf(kidId);
  if (available < reward.cost) throw new HttpError(409, 'insufficient_points');

  const info = db
    .prepare(
      `INSERT INTO redemptions (kid_id, reward_id, reward_title, reward_icon, cost, note)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(kidId, reward.id, reward.title_lv, reward.icon, reward.cost, optStr(req.body?.note, 'note', 300));

  res
    .status(201)
    .json({ redemption: db.prepare('SELECT * FROM redemptions WHERE id = ?').get(info.lastInsertRowid) });
});

/**
 * Parent decides. Approving deducts the points; the balance is re-checked
 * inside the transaction because it may have moved since the kid asked.
 */
redemptionsRouter.post('/:id/review', requireParent, (req, res) => {
  const redId = id(req.params.id, 'id');
  const decision = str(req.body?.decision, 'decision', { max: 10 });
  if (decision !== 'approve' && decision !== 'reject') throw new HttpError(400, 'invalid_decision');
  const reviewNote = optStr(req.body?.note, 'note', 300);
  const reviewerId = req.user!.id;

  const apply = db.transaction(() => {
    const row = db.prepare('SELECT * FROM redemptions WHERE id = ?').get(redId) as
      | RedemptionRow
      | undefined;
    if (!row) throw new HttpError(404, 'not_found');
    if (row.status !== 'pending') throw new HttpError(409, 'already_reviewed');

    if (decision === 'approve' && balanceOf(row.kid_id) < row.cost) {
      throw new HttpError(409, 'insufficient_points');
    }

    db.prepare(
      `UPDATE redemptions SET status = ?, reviewed_at = datetime('now'), reviewed_by = ?,
              review_note = ? WHERE id = ? AND status = 'pending'`,
    ).run(decision === 'approve' ? 'approved' : 'rejected', reviewerId, reviewNote, redId);

    if (decision === 'approve') {
      addLedgerEntry({
        kidId: row.kid_id,
        delta: -row.cost,
        reason: row.reward_title,
        refType: 'redemption',
        refId: row.id,
        createdBy: reviewerId,
      });
    }
  });
  apply();

  res.json({ redemption: db.prepare('SELECT * FROM redemptions WHERE id = ?').get(redId) });
});

/** A kid can take back a wish while it is still pending, freeing the reserve. */
redemptionsRouter.delete('/:id', requireUser, (req, res) => {
  const redId = id(req.params.id, 'id');
  const me = req.user!;
  const row = db.prepare('SELECT * FROM redemptions WHERE id = ?').get(redId) as
    | RedemptionRow
    | undefined;
  if (!row) throw new HttpError(404, 'not_found');
  if (me.role === 'kid' && row.kid_id !== me.id) throw new HttpError(403, 'forbidden');
  if (row.status !== 'pending') throw new HttpError(409, 'already_reviewed');

  db.prepare("DELETE FROM redemptions WHERE id = ? AND status = 'pending'").run(redId);
  res.json({ ok: true });
});
