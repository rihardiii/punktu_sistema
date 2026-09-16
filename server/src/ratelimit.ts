/**
 * Wrong-PIN throttle: five failures lock an account for five minutes.
 *
 * Keyed by account, never by IP. The whole family shares one router, so an
 * IP-based lock would shut everybody out the moment one kid fat-fingered their
 * PIN five times in a row.
 *
 * Kept in memory rather than in SQLite on purpose. A restart clearing the
 * counters is the right trade-off here: the server restarting is not an attack,
 * and a family app gains nothing from surviving lockout state across one.
 *
 * The lock is checked *before* the PIN is hashed, which matters for more than
 * guessing: scrypt costs ~80 ms of blocking CPU per attempt, so without this a
 * handful of concurrent login requests would stall the whole single-threaded
 * server for everyone else.
 */

const MAX_FAILURES = 5;
const LOCKOUT_MS = 5 * 60 * 1000;

interface Entry {
  failures: number;
  lockedUntil: number;
}

const entries = new Map<string, Entry>();

/**
 * Seconds remaining on a lockout, or 0 when this key may try again.
 *
 * Callers must only pass keys derived from accounts that actually exist —
 * otherwise anyone could grow this map without bound by posting random
 * usernames. Bounded by the size of the family, it never needs eviction
 * beyond the expiry sweep below.
 */
export function lockoutSeconds(key: string): number {
  const entry = entries.get(key);
  if (!entry) return 0;
  const remaining = entry.lockedUntil - Date.now();
  if (remaining <= 0) return 0;
  return Math.ceil(remaining / 1000);
}

/**
 * Records one failed attempt. Returns the lockout length in seconds when this
 * failure was the one that tripped the limit, otherwise 0.
 */
export function recordFailure(key: string): number {
  const now = Date.now();
  const entry = entries.get(key);

  // A previous lockout that has since expired starts the count from scratch,
  // so five wrong guesses spread over a month never add up to a lock.
  if (!entry || (entry.lockedUntil > 0 && entry.lockedUntil <= now)) {
    entries.set(key, { failures: 1, lockedUntil: 0 });
    return 0;
  }

  entry.failures += 1;
  if (entry.failures >= MAX_FAILURES) {
    entry.lockedUntil = now + LOCKOUT_MS;
    return Math.ceil(LOCKOUT_MS / 1000);
  }
  return 0;
}

/** Called after a correct PIN — the slate is wiped clean. */
export function clearFailures(key: string): void {
  entries.delete(key);
}

/** Drops entries whose lockout has expired, so the map does not creep. */
export function pruneLockouts(): void {
  const now = Date.now();
  for (const [key, entry] of entries) {
    if (entry.lockedUntil > 0 && entry.lockedUntil <= now) entries.delete(key);
  }
}

/** Test seam: forget every recorded failure. */
export function resetAllLockouts(): void {
  entries.clear();
}
