import { Router } from 'express';
import { db } from '../db.ts';
import { hashPin, requireAdmin, requireParent, requireUser } from '../auth.ts';
import { toPublicUser, type Role, type UserRow } from '../types.ts';
import { HttpError, bool, id, optStr, pin as vPin, str, username as vUsername } from '../validate.ts';
import { balanceOf } from '../points.ts';

export const usersRouter = Router();

/** Marks any open "I forgot my PIN" request for this user as dealt with. */
function resolvePinRequest(userId: number, resolverId: number): void {
  db.prepare(
    `UPDATE pin_requests SET status = 'resolved', resolved_at = datetime('now'), resolved_by = ?
     WHERE user_id = ? AND status = 'pending'`,
  ).run(resolverId, userId);
}

/**
 * Family list. Parents see everyone; a kid sees only themselves, so one kid
 * cannot browse a sibling's balance.
 */
usersRouter.get('/', requireUser, (req, res) => {
  const me = req.user!;
  const rows = (
    me.role === 'parent'
      ? db.prepare('SELECT * FROM users ORDER BY role DESC, name COLLATE NOCASE').all()
      : db.prepare('SELECT * FROM users WHERE id = ?').all(me.id)
  ) as UserRow[];

  res.json({
    users: rows.map((row) => ({
      ...toPublicUser(row),
      balance: row.role === 'kid' ? balanceOf(row.id) : null,
    })),
  });
});

/**
 * Open "I forgot my PIN" requests. A parent sees the kids'; the admin also
 * sees the other parents', because resetting those is the admin's job alone.
 */
usersRouter.get('/pin-requests', requireParent, (req, res) => {
  const rows = db
    .prepare(
      `SELECT r.id, r.user_id, r.created_at,
              u.name, u.username, u.role, u.avatar, u.color
       FROM pin_requests r JOIN users u ON u.id = r.user_id
       WHERE r.status = 'pending' ${req.user!.is_admin ? '' : "AND u.role = 'kid'"}
       ORDER BY r.created_at`,
    )
    .all();
  res.json({ requests: rows });
});

/** Clears a request without changing the PIN — "I asked them in person". */
usersRouter.post('/pin-requests/:id/dismiss', requireParent, (req, res) => {
  const requestId = id(req.params.id, 'id');
  const row = db
    .prepare(
      `SELECT r.id, u.role FROM pin_requests r JOIN users u ON u.id = r.user_id
       WHERE r.id = ? AND r.status = 'pending'`,
    )
    .get(requestId) as { id: number; role: Role } | undefined;
  if (!row) throw new HttpError(404, 'not_found');
  if (row.role === 'parent' && !req.user!.is_admin) throw new HttpError(403, 'admin_only');

  db.prepare(
    `UPDATE pin_requests SET status = 'dismissed', resolved_at = datetime('now'), resolved_by = ?
     WHERE id = ?`,
  ).run(req.user!.id, requestId);
  res.json({ ok: true });
});

/**
 * Hands the admin role to another parent. Demote-then-promote in one
 * transaction so there is never a moment with two admins, or none.
 */
usersRouter.post('/:id/make-admin', requireAdmin, (req, res) => {
  const userId = id(req.params.id, 'id');
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow | undefined;
  if (!row) throw new HttpError(404, 'not_found');
  if (row.role !== 'parent' || row.active !== 1) throw new HttpError(409, 'active_parent_required');

  db.transaction(() => {
    db.prepare('UPDATE users SET is_admin = 0 WHERE is_admin = 1').run();
    db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(userId);
  })();

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow;
  res.json({ user: toPublicUser(updated) });
});

usersRouter.post('/', requireParent, (req, res) => {
  const name = str(req.body?.name, 'name', { max: 60 });
  const uname = vUsername(req.body?.username);
  const pin = vPin(req.body?.pin);
  const role: Role = req.body?.role === 'parent' ? 'parent' : 'kid';
  const avatar = optStr(req.body?.avatar, 'avatar', 8) || (role === 'parent' ? '👤' : '🧒');
  const color = optStr(req.body?.color, 'color', 16) || '#6C8EF5';

  const taken = db.prepare('SELECT 1 FROM users WHERE username = ?').get(uname);
  if (taken) throw new HttpError(409, 'username_taken');

  const { hash, salt } = hashPin(pin);
  const info = db
    .prepare(
      `INSERT INTO users (username, name, role, pin_hash, pin_salt, avatar, color, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(uname, name, role, hash, salt, avatar, color, req.user!.id);

  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid) as UserRow;
  res.status(201).json({ user: toPublicUser(row) });
});

usersRouter.patch('/:id', requireParent, (req, res) => {
  const userId = id(req.params.id, 'id');
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow | undefined;
  if (!row) throw new HttpError(404, 'not_found');

  const name = req.body?.name === undefined ? row.name : str(req.body.name, 'name', { max: 60 });
  const avatar = req.body?.avatar === undefined ? row.avatar : optStr(req.body.avatar, 'avatar', 8);
  const color = req.body?.color === undefined ? row.color : optStr(req.body.color, 'color', 16);
  const active = bool(req.body?.active, row.active === 1);

  // The admin is the only route back in after a forgotten parent PIN, so the
  // parents who depend on that cannot switch it off. The admin still can.
  if (row.is_admin === 1 && !req.user!.is_admin) throw new HttpError(403, 'admin_only');

  // Never let the last active parent be deactivated — that locks everyone out.
  if (!active && row.role === 'parent') {
    const { n } = db
      .prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'parent' AND active = 1 AND id != ?")
      .get(userId) as { n: number };
    if (n === 0) throw new HttpError(409, 'last_parent');
  }

  db.prepare('UPDATE users SET name = ?, avatar = ?, color = ?, active = ? WHERE id = ?').run(
    name,
    avatar,
    color,
    active ? 1 : 0,
    userId,
  );
  if (!active) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow;
  res.json({ user: toPublicUser(updated) });
});

/** Parents can reset a kid's forgotten PIN without knowing the old one. */
usersRouter.post('/:id/reset-pin', requireParent, (req, res) => {
  const userId = id(req.params.id, 'id');
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow | undefined;
  if (!row) throw new HttpError(404, 'not_found');
  // A parent resetting another parent's PIN would be an account takeover — so
  // only the admin may, and that is the whole reason the admin role exists.
  if (row.role === 'parent' && row.id !== req.user!.id && !req.user!.is_admin) {
    throw new HttpError(403, 'admin_only');
  }

  const { hash, salt } = hashPin(vPin(req.body?.pin));
  db.prepare('UPDATE users SET pin_hash = ?, pin_salt = ? WHERE id = ?').run(hash, salt, userId);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  resolvePinRequest(userId, req.user!.id);
  res.json({ ok: true });
});

/**
 * Deleting a kid also deletes their history (ON DELETE CASCADE). Deactivating
 * is almost always what a parent actually wants, so require an explicit flag.
 */
usersRouter.delete('/:id', requireParent, (req, res) => {
  const userId = id(req.params.id, 'id');
  if (userId === req.user!.id) throw new HttpError(409, 'cannot_delete_self');
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow | undefined;
  if (!row) throw new HttpError(404, 'not_found');
  if (row.is_admin === 1) throw new HttpError(403, 'admin_only');

  if (req.query.purge !== 'true') throw new HttpError(400, 'confirm_purge_required');

  if (row.role === 'parent') {
    const { n } = db
      .prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'parent' AND active = 1 AND id != ?")
      .get(userId) as { n: number };
    if (n === 0) throw new HttpError(409, 'last_parent');
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  res.json({ ok: true });
});
