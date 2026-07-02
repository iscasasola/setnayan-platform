/**
 * Locked QR shared helpers (My Shop → Locked QR).
 *
 * The DB foundation (table `vendor_locked_qr_tokens` + the atomic, race-safe
 * `vendor_claim_locked_qr()` RPC) lives in migration 20270414692373. This module
 * is the app-side glue: the couple-facing claim URL the QR encodes, and the
 * schedule-row shape the generator serializes into the token's `schedule_json`
 * (read verbatim by the claim RPC to freeze the payment plan).
 */

/**
 * One installment row stored on the token, in the "Name · Date · Amount" shape.
 * Every installment is a FIXED peso `amount_value` due on an ABSOLUTE calendar
 * `due_date` the vendor picks. Row 1 (seq 1) is the downpayment. The claim RPC
 * (20270427212060) reads these verbatim to freeze the payment plan; it still
 * falls back to the legacy on_lock/before_event anchor fields for tokens issued
 * before this shape, so older tokens keep resolving.
 */
export type LockScheduleRow = {
  seq: number;
  label: string;
  /** Whole pesos owed for this installment. */
  amount_value: number;
  /** Absolute due date, ISO YYYY-MM-DD, or null when unset. */
  due_date: string | null;
};

/** Matches an ISO calendar date (YYYY-MM-DD). */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The single-use, couple-facing URL the Locked QR encodes. */
export function buildVendorLockUrl(token: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com';
  return `${appUrl.replace(/\/$/, '')}/vendor/lock/${token}`;
}

/**
 * Coerce arbitrary parsed JSON into a clean, bounded LockScheduleRow[] — used by
 * the issuance action so a hand-crafted payload can't store junk on the token.
 * Clamps to at most `max` rows, re-sequences from 1, and drops malformed rows.
 */
export function sanitizeLockSchedule(
  raw: unknown,
  max = 12,
): LockScheduleRow[] {
  if (!Array.isArray(raw)) return [];
  const out: LockScheduleRow[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const value = Number(o.amount_value);
    if (!Number.isFinite(value) || value < 0) continue;
    const rawDate = typeof o.due_date === 'string' ? o.due_date : '';
    out.push({
      seq: out.length + 1,
      label: String(o.label ?? '').trim().slice(0, 80) || `Payment ${out.length + 1}`,
      amount_value: value,
      due_date: ISO_DATE_RE.test(rawDate) ? rawDate : null,
    });
    if (out.length >= max) break;
  }
  return out;
}
