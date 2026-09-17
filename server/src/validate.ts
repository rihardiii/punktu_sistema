/** Small validation helpers — every one throws HttpError, caught by the error middleware. */

// Plain field assignment rather than TS parameter properties: Node runs these
// .ts files with strip-only type stripping, which rejects parameter properties.
export class HttpError extends Error {
  status: number;
  code: string;
  detail: string | undefined;

  constructor(status: number, code: string, detail?: string) {
    super(code);
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

export function badRequest(code: string, detail?: string): never {
  throw new HttpError(400, code, detail);
}

export function str(value: unknown, field: string, { max = 200, min = 1 } = {}): string {
  if (typeof value !== 'string') badRequest('invalid_field', field);
  const trimmed = value.trim();
  if (trimmed.length < min) badRequest('field_required', field);
  if (trimmed.length > max) badRequest('field_too_long', field);
  return trimmed;
}

export function optStr(value: unknown, field: string, max = 500): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') badRequest('invalid_field', field);
  const trimmed = value.trim();
  if (trimmed.length > max) badRequest('field_too_long', field);
  return trimmed;
}

export function int(value: unknown, field: string, { min = 1, max = 1_000_000 } = {}): number {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isInteger(n)) badRequest('invalid_field', field);
  if (n < min || n > max) badRequest('out_of_range', field);
  return n;
}

export function id(value: unknown, field: string): number {
  return int(value, field, { min: 1, max: Number.MAX_SAFE_INTEGER });
}

/**
 * Booleans arrive in three shapes: a real `true`, the `0`/`1` that SQLite hands
 * back to the client, and the `"true"`/`"false"` of a query string. All three
 * mean the same thing, so accept all three rather than making every caller
 * remember which one this particular column round-trips as.
 */
export function bool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null) return fallback;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  badRequest('invalid_field', 'boolean');
}

/** Usernames are typed by kids, so keep them simple and unambiguous. */
export function username(value: unknown): string {
  const raw = str(value, 'username', { max: 32, min: 2 }).toLowerCase();
  if (!/^[a-z0-9._-]+$/.test(raw)) badRequest('invalid_username');
  return raw;
}

/** PIN: digits only, 4–10 long. Long enough for parents, easy for a 6-year-old. */
export function pin(value: unknown): string {
  if (typeof value !== 'string') badRequest('invalid_pin');
  if (!/^\d{4,10}$/.test(value)) badRequest('invalid_pin');
  return value;
}
