import { Router } from 'express';
import { db } from '../db.ts';
import {
  SESSION_COOKIE,
  createSession,
  destroySession,
  hashPin,
  requireUser,
  setSessionCookie,
  verifyPin,
} from '../auth.ts';
import { toPublicUser, type UserRow } from '../types.ts';
import { HttpError, pin as vPin, str, username as vUsername } from '../validate.ts';
import { seedStarterCatalog } from '../seed.ts';

export const authRouter = Router();

function userCount(): number {
  return (db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;
}

/** Whether the app still needs its first parent account. */
authRouter.get('/setup/status', (_req, res) => {
  res.json({ needsSetup: userCount() === 0 });
});

/** First-run: creates the first parent. Only works while no users exist. */
authRouter.post('/setup', (req, res) => {
  if (userCount() > 0) throw new HttpError(409, 'already_set_up');

  const name = str(req.body?.name, 'name', { max: 60 });
  const uname = vUsername(req.body?.username);
  const pin = vPin(req.body?.pin);
  const { hash, salt } = hashPin(pin);

  const info = db
    .prepare(
      `INSERT INTO users (username, name, role, pin_hash, pin_salt, avatar, color)
       VALUES (?, ?, 'parent', ?, ?, ?, ?)`,
    )
    .run(uname, name, hash, salt, '👑', '#6C8EF5');

  const userId = Number(info.lastInsertRowid);
  seedStarterCatalog(userId);

  const token = createSession(userId);
  setSessionCookie(res, token);
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow;
  res.status(201).json({ user: toPublicUser(row) });
});

authRouter.post('/login', (req, res) => {
  const uname = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : '';
  const pin = typeof req.body?.pin === 'string' ? req.body.pin : '';
  const row = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(uname) as
    | UserRow
    | undefined;

  // Same response for "no such user" and "wrong PIN" — don't leak who exists.
  if (!row || !verifyPin(pin, row.pin_hash, row.pin_salt)) {
    throw new HttpError(401, 'bad_credentials');
  }

  const token = createSession(row.id);
  setSessionCookie(res, token);
  res.json({ user: toPublicUser(row) });
});

authRouter.post('/logout', (req, res) => {
  if (req.sessionToken) destroySession(req.sessionToken);
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});

authRouter.get('/me', (req, res) => {
  res.json({ user: req.user ?? null });
});

/** Change your own PIN. Requires the current one. */
authRouter.post('/change-pin', requireUser, (req, res) => {
  const current = typeof req.body?.currentPin === 'string' ? req.body.currentPin : '';
  const next = vPin(req.body?.newPin);
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as UserRow;

  if (!verifyPin(current, row.pin_hash, row.pin_salt)) throw new HttpError(403, 'bad_credentials');

  const { hash, salt } = hashPin(next);
  db.prepare('UPDATE users SET pin_hash = ?, pin_salt = ? WHERE id = ?').run(hash, salt, row.id);
  // Other devices keep working; only PIN material changed.
  res.json({ ok: true });
});

/**
 * Who can log in — names and avatars only, no PIN material. Lets the login
 * screen show tappable family faces instead of asking a kid to type a username.
 */
authRouter.get('/faces', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, username, name, role, avatar, color FROM users
       WHERE active = 1 ORDER BY role DESC, name COLLATE NOCASE`,
    )
    .all();
  res.json({ users: rows });
});
