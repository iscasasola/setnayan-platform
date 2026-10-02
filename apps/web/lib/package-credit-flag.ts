/**
 * Package CREDIT model flag (built 2026-07-26 · ARMED BY DEFAULT 2026-10-02).
 *
 * The credit model — REQUIRED lines, CHOICE lines with per-option price
 * deltas, a spend-anywhere-in-the-catalogue credit pool, per-package
 * expiring/refundable unspent policy, and allowed overspend billed through
 * the existing apply-then-pay rail.
 *
 * ⚖ OWNER, tracker d8 (2026-10-02): *"turn it ON"* — arm by default in code with
 * a kill switch, the same shape as `vendor-free-transport-flag.ts`.
 *
 * WHY IT WAS OFF: it shipped as a LAUNCH flag so that no package booking could
 * price on the new engine before the couple-side UI existed to show what the
 * credit did. That UI now ships (the lock modal's choice lines, the vendor page's
 * credit preview), and the engine is a strict superset of the legacy math —
 * with policy 'expiring' (the DB default) and no choices it reproduces
 * `computeCustomization` to the centavo — so arming it on a plain package is a
 * no-op by construction. Every lock FREEZES the model that priced it
 * (`buildPricingSnapshot`), so flipping this either way never moves an agreed
 * number. No data step or DPO approval is involved.
 *
 * Now the variable is a KILL SWITCH only: unset (production) = ON; `0` /
 * `false` / `off` (any case, surrounding space ignored) = the legacy
 * `computeCustomization` path, for a money rollback without a code deploy.
 *
 * NEXT_PUBLIC_ so the server (lock/booking actions) and any client preview
 * (the customize-and-lock modal) can never disagree about which pricing model
 * is live — a split-brain here would show a couple one number and charge them
 * another.
 */
export function packageCreditEnabled(): boolean {
  const v = (process.env.NEXT_PUBLIC_PACKAGE_CREDIT ?? '').trim().toLowerCase();
  return !(v === '0' || v === 'false' || v === 'off');
}
