/**
 * Locked QR shared helpers (My Shop → Locked QR).
 *
 * The DB foundation (table `vendor_locked_qr_tokens` + the atomic, race-safe
 * `vendor_claim_locked_qr()` RPC) lives in migration 20270414692373. This module
 * is the app-side glue: the couple-facing claim URL the QR encodes, and the
 * schedule-row shape the generator serializes into the token's `schedule_json`
 * (read verbatim by the claim RPC to freeze the payment plan).
 */

import type { AmountKind, DueAnchor } from '@/lib/vendor-service-payment-schedules';

/**
 * One installment template row stored on the token. The claim RPC computes each
 * `amount_php` (percent-of-total or fixed) and `due_date` (on_lock / before_event
 * ± offset) from these at claim time — so the shape here MUST match what
 * vendor_claim_locked_qr() reads: seq, label, amount_kind, amount_value,
 * due_anchor, due_offset_days.
 */
export type LockScheduleRow = {
  seq: number;
  label: string;
  amount_kind: AmountKind;
  /** Whole-number percent (0–100) for 'percent'; whole pesos for 'fixed'. */
  amount_value: number;
  due_anchor: DueAnchor;
  due_offset_days: number;
};

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
    const kind: AmountKind = o.amount_kind === 'fixed' ? 'fixed' : 'percent';
    const anchor: DueAnchor = o.due_anchor === 'before_event' ? 'before_event' : 'on_lock';
    const value = Number(o.amount_value);
    if (!Number.isFinite(value) || value < 0) continue;
    const offset = Number(o.due_offset_days);
    out.push({
      seq: out.length + 1,
      label: String(o.label ?? '').trim().slice(0, 80) || `Payment ${out.length + 1}`,
      amount_kind: kind,
      amount_value: kind === 'percent' ? Math.min(value, 100) : value,
      due_anchor: anchor,
      due_offset_days: Number.isFinite(offset) && offset >= 0 ? Math.min(offset, 3650) : 0,
    });
    if (out.length >= max) break;
  }
  return out;
}
