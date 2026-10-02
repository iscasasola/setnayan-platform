/**
 * lib/thread-calls-rule.ts — who may start an in-thread voice/video call with
 * a couple. Pure (no I/O, no `server-only`) so the rule is tested directly;
 * `lib/thread-calls-gate.ts` reads the tier and asks this.
 *
 * ⚖ OWNER 2026-10-02 (tracker d10): *"video calls with couples: paid suppliers
 * only, starting now"*. Calls were ruled a paid capability on 2026-07-13, but
 * the gate rode the shared VENDOR_TIER_FEATURE_GATE — which is off in
 * production and would also switch on every other plan limit (Theft Watch,
 * payment links, branches, Pro website picks…). The controller's decision:
 * calls get their OWN switch, ON by default, and the shared one is untouched.
 *
 *   · unset (production today) → paid only: `canUseCalls(tier)` (Solo and up);
 *     Free and Verified are refused.
 *   · `VENDOR_CALLS_PAID_ONLY` = 0 / false / off (any case) → open to every
 *     supplier again — a rollback without a code deploy.
 */
import { canUseCalls } from './vendor-tier-caps';

export function callsArePaidOnly(): boolean {
  const v = (process.env.VENDOR_CALLS_PAID_ONLY ?? '').trim().toLowerCase();
  return !(v === '0' || v === 'false' || v === 'off');
}

/** May a supplier on `tier` (already promotion-resolved) start calls? */
export function threadCallsAllowed(tier: string | null | undefined): boolean {
  if (!callsArePaidOnly()) return true;
  return canUseCalls(tier);
}
