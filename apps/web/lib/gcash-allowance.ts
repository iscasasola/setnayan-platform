/**
 * 💳 WHICH ONE QR A PAYER SEES — GCash or BDO. PURE (no I/O): the /pay page,
 * its action, the checkout action and the tests share this one rule.
 *
 * ⚖ OWNER 2026-11-18, verbatim:
 *   · "we only offer 1 QR Code. The rule is use GCash for the first 100,000
 *     transactions under 1,000 every month. and the rest goes to BDO."
 *   · "just use 100,000 total payments. so, i can still use the 400,000 on
 *     other things" — the allowance is PESOS (₱100,000 of GCash payments to
 *     Setnayan per Manila calendar month), not a count.
 *
 * So: an amount UNDER the line (₱1,000 — exactly ₱1,000 goes to BDO) AND
 * (this month's GCash total + this amount) ≤ the allowance ⇒ GCash. Everything
 * else ⇒ BDO. There is never a choice on screen.
 *
 * 🔑 BOTH NUMBERS ARE ADMIN SETTINGS — `platform_settings.gcash_max_php`
 * (default 1000) and `platform_settings.gcash_allowance_php` (default 100000),
 * edited in Admin › Settings › Payment methods beside the GCash monthly limit.
 * ⚠ NOT `gcash_monthly_cap_php`: that column is the WALLET's own receiving limit
 * (₱500,000, migration 20271028100000) — the owner keeps the ₱400,000 between
 * the two for his own use.
 *
 * ⛔ EVERY UNREADABLE INPUT ⇒ BDO. A null, non-finite or negative line,
 * allowance, month total or amount never widens GCash: BDO always works, and a
 * GCash wallet past its room FAILS the transfer instead of queuing it.
 */

/** The owner's ruled line (2026-11-18). The DB default; never a fallback that widens. */
export const GCASH_MAX_PHP_RULED = 1_000;
/** The owner's ruled monthly allowance in pesos (2026-11-18). The DB default. */
export const GCASH_ALLOWANCE_PHP_RULED = 100_000;

export type PayerRailPick = 'gcash' | 'bdo';

export type GcashGate = {
  /** `platform_settings.gcash_max_php` — GCash only BELOW this. */
  maxPhp: number | null;
  /** `platform_settings.gcash_allowance_php` — pesos per Manila month. */
  allowancePhp: number | null;
  /** GCash payments to Setnayan so far this Manila month, in pesos. */
  usedThisMonthPhp: number | null;
};

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** A read setting made safe: a finite number ≥ 0, else NULL (⇒ BDO). */
export function gcashNumberOrNull(raw: unknown): number | null {
  const n = typeof raw === 'string' ? Number(raw) : raw;
  return finite(n) && n >= 0 ? n : null;
}

/**
 * The ONE rail for a payment of `amountPhp`. `gate` null ⇒ BDO (nothing could
 * be read). Compared in whole centavos so ₱999.99 vs ₱1,000 is exact.
 */
export function pickPayerRail(amountPhp: number | null | undefined, gate: GcashGate | null): PayerRailPick {
  if (!gate || !finite(amountPhp) || amountPhp <= 0) return 'bdo';
  const { maxPhp, allowancePhp, usedThisMonthPhp } = gate;
  if (!finite(maxPhp) || maxPhp <= 0) return 'bdo';
  if (!finite(allowancePhp) || allowancePhp < 0) return 'bdo';
  if (!finite(usedThisMonthPhp) || usedThisMonthPhp < 0) return 'bdo';
  const c = (php: number) => Math.round(php * 100);
  if (c(amountPhp) >= c(maxPhp)) return 'bdo';
  if (c(usedThisMonthPhp) + c(amountPhp) > c(allowancePhp)) return 'bdo';
  return 'gcash';
}

/**
 * Is this a GCash rail? The migrated `'gcash'` account, or one the admin added
 * whose label names GCash — the mirror of `isPayerRail`'s BDO test.
 */
export function isGcashRail(a: { id: string; label: string }): boolean {
  return a.id === 'gcash' || /^gcash\b/i.test(a.label.trim());
}

/**
 * Sum this month's GCash payments from rows. Counts `pending` AND `matched`:
 * a pending GCash payment is money the payer says already landed in the
 * wallet, so leaving it out would let the allowance overshoot. Rejected /
 * resubmit rows are not money. Rows for `excludeOrderId` are skipped so an
 * order never counts against itself.
 */
export function gcashUsedFromRows(
  rows: ReadonlyArray<{ channel: string | null; amount_php: number | string | null; status: string | null; order_id?: string | null }>,
  excludeOrderId?: string | null,
): number {
  let centavos = 0;
  for (const r of rows) {
    if (!r.channel || !isGcashRail({ id: r.channel, label: r.channel })) continue;
    if (r.status !== 'pending' && r.status !== 'matched') continue;
    if (excludeOrderId && r.order_id === excludeOrderId) continue;
    const n = Number(r.amount_php);
    if (Number.isFinite(n) && n > 0) centavos += Math.round(n * 100);
  }
  return centavos / 100;
}

/** The one sentence a payer reads when a GCash receipt is refused. */
export const GCASH_PROOF_REFUSED_MESSAGE =
  'This one is paid to BDO — scan the BDO code on this page. Already sent it by GCash? Message us and we’ll sort it.';
