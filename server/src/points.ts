import { db } from './db.ts';

const balanceStmt = db.prepare<[number], { total: number }>(
  'SELECT COALESCE(SUM(delta), 0) AS total FROM ledger WHERE kid_id = ?',
);

/** A kid's current balance. Always derived from the ledger, never cached. */
export function balanceOf(kidId: number): number {
  return balanceStmt.get(kidId)?.total ?? 0;
}

/** Points a kid has pending approval — shown as "coming soon", not spendable. */
export function pendingPointsOf(kidId: number): number {
  const row = db
    .prepare<[number], { total: number }>(
      "SELECT COALESCE(SUM(points), 0) AS total FROM submissions WHERE kid_id = ? AND status = 'pending'",
    )
    .get(kidId);
  return row?.total ?? 0;
}

/** Points locked in redemption requests awaiting a parent's decision. */
export function reservedPointsOf(kidId: number): number {
  const row = db
    .prepare<[number], { total: number }>(
      "SELECT COALESCE(SUM(cost), 0) AS total FROM redemptions WHERE kid_id = ? AND status = 'pending'",
    )
    .get(kidId);
  return row?.total ?? 0;
}

const insertLedger = db.prepare(
  `INSERT INTO ledger (kid_id, delta, reason, ref_type, ref_id, created_by)
   VALUES (?, ?, ?, ?, ?, ?)`,
);

export function addLedgerEntry(entry: {
  kidId: number;
  delta: number;
  reason: string;
  refType: 'submission' | 'redemption' | 'adjustment';
  refId: number | null;
  createdBy: number;
}): void {
  insertLedger.run(
    entry.kidId,
    entry.delta,
    entry.reason,
    entry.refType,
    entry.refId,
    entry.createdBy,
  );
}
