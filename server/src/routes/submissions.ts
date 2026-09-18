import { Router } from 'express';
import { db } from '../db.ts';
import { requireParent, requireUser } from '../auth.ts';
import { HttpError, id, optStr, str } from '../validate.ts';
import { addLedgerEntry } from '../points.ts';
import { lockForKid } from '../deeds.ts';
import type { ReviewStatus } from '../types.ts';

export const submissionsRouter = Router();

interface SubmissionRow {
  id: number;
  kid_id: number;
  deed_title: string;
  points: number;
  status: ReviewStatus;
}

/**
 * Submissions list. A kid sees only their own; parents see everyone's and can
 * filter by status (the pending queue is the parent's main screen).
 */
submissionsRouter.get('/', requireUser, (req, res) => {
  const me = req.user!;
  const where: string[] = [];
  const params: unknown[] = [];

  if (me.role === 'kid') {
    where.push('s.kid_id = ?');
    params.push(me.id);
  } else if (req.query.kidId) {
    where.push('s.kid_id = ?');
    params.push(id(req.query.kidId, 'kidId'));
  }

  const status = req.query.status;
  if (typeof status === 'string' && ['pending', 'approved', 'rejected'].includes(status)) {
    where.push('s.status = ?');
    params.push(status);
  }

  const rows = db
    .prepare(
      `SELECT s.*, k.name AS kid_name, k.avatar AS kid_avatar, k.color AS kid_color,
              r.name AS reviewer_name
       FROM submissions s
       JOIN users k ON k.id = s.kid_id
       LEFT JOIN users r ON r.id = s.reviewed_by
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY CASE s.status WHEN 'pending' THEN 0 ELSE 1 END, s.created_at DESC
       LIMIT 500`,
    )
    .all(...params);

  res.json({ submissions: rows });
});

/**
 * A kid reports a deed they have done. Parents may file on a kid's behalf
 * (for younger kids), but it still lands in the pending queue for a decision.
 */
submissionsRouter.post('/', requireUser, (req, res) => {
  const me = req.user!;
  const kidId = me.role === 'kid' ? me.id : id(req.body?.kidId, 'kidId');

  if (me.role === 'parent') {
    const kid = db.prepare("SELECT 1 FROM users WHERE id = ? AND role = 'kid'").get(kidId);
    if (!kid) throw new HttpError(404, 'kid_not_found');
  }

  const deedId = id(req.body?.deedId, 'deedId');
  const deed = db.prepare('SELECT * FROM deeds WHERE id = ? AND active = 1').get(deedId) as
    | { id: number; title_lv: string; icon: string; points: number; max_per_day: number }
    | undefined;
  if (!deed) throw new HttpError(404, 'deed_not_found');

  /*
   * The kid's screen already greys out a deed that is out of hours or done for
   * the day, but that decision was made when the list was fetched — an app left
   * open past 10:00, or a second phone, would still hold a live-looking tile.
   * The rule is settled here, at the moment it actually matters.
   *
   * No await runs between this check and the insert, so nothing can slip a
   * second submission in between and beat the daily cap.
   */
  const locked = lockForKid(deed, kidId);
  if (locked === 'window') throw new HttpError(409, 'outside_time_window');
  if (locked === 'limit') throw new HttpError(409, 'daily_limit_reached');

  const note = optStr(req.body?.note, 'note', 300);
  const info = db
    .prepare(
      `INSERT INTO submissions (kid_id, deed_id, deed_title, deed_icon, points, note)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(kidId, deed.id, deed.title_lv, deed.icon, deed.points, note);

  res
    .status(201)
    .json({ submission: db.prepare('SELECT * FROM submissions WHERE id = ?').get(info.lastInsertRowid) });
});

/**
 * Parent approves or rejects. Approving writes the ledger entry and the status
 * in one transaction, and only a *pending* row can be reviewed — that guard is
 * what stops a double-tap from crediting the points twice.
 */
submissionsRouter.post('/:id/review', requireParent, (req, res) => {
  const subId = id(req.params.id, 'id');
  const decision = str(req.body?.decision, 'decision', { max: 10 });
  if (decision !== 'approve' && decision !== 'reject') throw new HttpError(400, 'invalid_decision');
  const reviewNote = optStr(req.body?.note, 'note', 300);
  const reviewerId = req.user!.id;

  const apply = db.transaction(() => {
    const row = db.prepare('SELECT * FROM submissions WHERE id = ?').get(subId) as
      | SubmissionRow
      | undefined;
    if (!row) throw new HttpError(404, 'not_found');
    if (row.status !== 'pending') throw new HttpError(409, 'already_reviewed');

    db.prepare(
      `UPDATE submissions SET status = ?, reviewed_at = datetime('now'), reviewed_by = ?,
              review_note = ? WHERE id = ? AND status = 'pending'`,
    ).run(decision === 'approve' ? 'approved' : 'rejected', reviewerId, reviewNote, subId);

    if (decision === 'approve') {
      addLedgerEntry({
        kidId: row.kid_id,
        delta: row.points,
        reason: row.deed_title,
        refType: 'submission',
        refId: row.id,
        createdBy: reviewerId,
      });
    }
  });
  apply();

  res.json({ submission: db.prepare('SELECT * FROM submissions WHERE id = ?').get(subId) });
});

/** A kid can withdraw their own request while it is still pending. */
submissionsRouter.delete('/:id', requireUser, (req, res) => {
  const subId = id(req.params.id, 'id');
  const me = req.user!;
  const row = db.prepare('SELECT * FROM submissions WHERE id = ?').get(subId) as
    | SubmissionRow
    | undefined;
  if (!row) throw new HttpError(404, 'not_found');
  if (me.role === 'kid' && row.kid_id !== me.id) throw new HttpError(403, 'forbidden');
  if (row.status !== 'pending') throw new HttpError(409, 'already_reviewed');

  db.prepare("DELETE FROM submissions WHERE id = ? AND status = 'pending'").run(subId);
  res.json({ ok: true });
});
