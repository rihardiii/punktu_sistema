import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { db } from './db.ts';
import { toPublicUser, type UserRow } from './types.ts';

export const SESSION_COOKIE = 'punkti_session';
const SESSION_DAYS = 30;
const KEY_LEN = 64;

export function hashPin(pin: string, salt = randomBytes(16).toString('hex')) {
  return { hash: scryptSync(pin, salt, KEY_LEN).toString('hex'), salt };
}

export function verifyPin(pin: string, hash: string, salt: string): boolean {
  const candidate = scryptSync(pin, salt, KEY_LEN);
  const expected = Buffer.from(hash, 'hex');
  // Length check first: timingSafeEqual throws on a length mismatch.
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function createSession(userId: number): string {
  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(
    token,
    userId,
    expires,
  );
  return token;
}

export function destroySession(token: string): void {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

/** Drops expired sessions so the table does not grow without bound. */
export function pruneSessions(): void {
  db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
}

const findSession = db.prepare<[string], UserRow>(`
  SELECT u.* FROM sessions s
  JOIN users u ON u.id = s.user_id
  WHERE s.token = ? AND s.expires_at > datetime('now') AND u.active = 1
`);

/** Attaches req.user when a valid session cookie is present. Never rejects. */
export function loadUser(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token === 'string' && token) {
    const row = findSession.get(token);
    if (row) {
      req.user = toPublicUser(row);
      req.sessionToken = token;
    }
  }
  next();
}

export function requireUser(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  next();
}

export function requireParent(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  if (req.user.role !== 'parent') {
    res.status(403).json({ error: 'parent_only' });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  if (!req.user.is_admin) {
    res.status(403).json({ error: 'admin_only' });
    return;
  }
  next();
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: SESSION_DAYS * 86_400_000,
    // Deliberately not `secure`: this app is designed to be served over plain
    // HTTP on a home LAN, where a cert would only get in the family's way.
    secure: false,
  });
}
