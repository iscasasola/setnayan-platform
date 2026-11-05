import { setupPricePhp } from '@/lib/onboarding-discount';

/**
 * welcome-discount.ts — the WEBSITE-ONLY welcome price, decided in ONE place.
 *
 * ⚖ OWNER, 2026-10-28 (DECISION_LOG "ONE PRICE EVERYWHERE"), verbatim:
 * *"we make the price in app store and website same"* · *"1. yes we follow apple
 * prices as our price. 2. onboarding -40%"* · *"but only via website"* · *"paid
 * via gcash/bank transfer"*.
 *
 * ── WHAT IT IS ───────────────────────────────────────────────────────────────
 * A couple's FIRST purchase — per ACCOUNT, any catalogue product — costs the
 * set-up price: the SAME house dial (`platform_settings.onboarding_discount_pct`,
 * 40 today) and the SAME per-row overrides (`onboarding_price_php`), through the
 * SAME function (`setupPricePhp`, cheaper wins). No second percentage exists.
 *
 * ── WHERE IT NEVER IS ────────────────────────────────────────────────────────
 * The App Store / Play Store shell. Apple's anti-steering rule: the app may not
 * mention, show or point to a cheaper price elsewhere. That part is ON whatever
 * the switch says — `decideWelcome` returns `app` for the store shell before it
 * looks at anything else. Held by `the-welcome-price-never-reaches-the-app.test.ts`.
 *
 * PURE. No I/O: the drawer's quote, the checkout's charge and the onboarding
 * bill all ask the same functions, so a screen cannot quote a welcome figure
 * the charge will not honour.
 */

/** Why a buyer is NOT on the welcome price — said in the fault log, never on screen. */
export type WelcomeRefusal =
  /** The owner's switch is off (`WELCOME_DISCOUNT_ENABLED`). */
  | 'off'
  /** The App Store / Play Store shell — never, whatever the switch says. */
  | 'app'
  /** This account has already made a purchase. */
  | 'not_first'
  /** The order history could not be read — the regular price stands. */
  | 'read_error';

export type WelcomeDecision =
  | { kind: 'welcome'; pct: number }
  | { kind: 'regular'; why: WelcomeRefusal };

/**
 * The ONE decision. Order matters and is load-bearing: the store shell is
 * refused FIRST, so no switch state, read result or percentage can ever put a
 * welcome price inside the app.
 *
 * `paidOrders` — how many purchases this account has already made (see
 * `countsAsPurchase`), or `null` when the read failed. An account that does not
 * exist yet (an anonymous visitor on the create flow) has made none: pass 0.
 */
export function decideWelcome(input: {
  enabled: boolean;
  storeShell: boolean;
  paidOrders: number | null;
  pct: number;
}): WelcomeDecision {
  if (input.storeShell) return { kind: 'regular', why: 'app' };
  if (!input.enabled) return { kind: 'regular', why: 'off' };
  if (input.paidOrders === null) return { kind: 'regular', why: 'read_error' };
  if (input.paidOrders > 0) return { kind: 'regular', why: 'not_first' };
  return { kind: 'welcome', pct: input.pct };
}

/**
 * Order statuses that never were a purchase: a `draft` was never sent, a
 * `cancelled` bill was withdrawn before anyone paid it. Every other status —
 * `submitted` / `awaiting_payment` (a bill out for payment, which may itself be
 * the welcome bill), `paid` / `fulfilled`, and `refunded` / `lapsed` (it WAS
 * bought) — spends the welcome. Counting a refund stops buy → refund → rebuy at
 * the welcome price again.
 */
export const NOT_A_PURCHASE_STATUSES: readonly string[] = ['draft', 'cancelled'];

/**
 * Does this `orders` row count as the account having bought something?
 *
 * ⚠ A ₱0 ROW IS NOT A PURCHASE. The event-commit path writes `fulfilled` ₱0
 * orders for the FREE Papic grant, and the comp paths write ₱0 `paid` orders —
 * counting either would spend every new couple's welcome before they ever
 * reached a price.
 */
export function countsAsPurchase(row: {
  status: string | null;
  requested_total_php: number | string | null;
  comp_grant_id?: string | null;
}): boolean {
  if (row.comp_grant_id) return false;
  if (!row.status || NOT_A_PURCHASE_STATUSES.includes(row.status)) return false;
  const php = Number(row.requested_total_php ?? 0);
  return Number.isFinite(php) && php > 0;
}

/**
 * The welcome price of a line whose REGULAR charge the authority already
 * resolved — the shipped set-up rule, applied to that figure. `explicitPhp` is
 * the row's deliberate override (`onboarding_price_php`, or Setnayan AI's
 * per-type sign-up price); cheaper wins; never above the regular price.
 *
 * 💰 ROUNDING IS THE SHIPPED ONE: `setupPricePhp` rounds to the CENTAVO
 * (₱2,499 × 60 % = ₱1,499.40). Returned in whole centavos.
 */
export function welcomeCentavos(
  regularCentavos: bigint | number,
  explicitPhp: number | null | undefined,
  pct: number,
): number {
  const regularPhp = Number(regularCentavos) / 100;
  const php = setupPricePhp(regularPhp, explicitPhp, pct);
  return Math.round(php * 100);
}

/**
 * Charge sources the welcome may apply to. `setnayan_ai_comeback` is NOT one:
 * that figure is already a discount (half the sign-up saving), and the welcome
 * never stacks on another discount — the comeback offer stands as it is.
 */
export const WELCOME_ELIGIBLE_SOURCES: ReadonlySet<string> = new Set([
  'retail_catalog',
  'package_catalog',
  'setnayan_ai_event_type',
  'hub_parts',
]);

/**
 * May the CREATE FLOW (the onboarding services basket) charge the set-up price?
 *
 *   switch OFF → yes, exactly as it shipped (the house dial during set-up);
 *   switch ON  → only when this is the account's welcome purchase.
 *
 * The store shell never reaches the services step (it is dropped by
 * `isStoreShellRequest` on every onboarding page), so `app` cannot arise here —
 * but if it ever did, it is refused rather than discounted.
 */
export function setupPriceAppliesAtCreate(enabled: boolean, decision: WelcomeDecision): boolean {
  if (decision.kind === 'regular' && decision.why === 'app') return false;
  if (!enabled) return true;
  return decision.kind === 'welcome';
}
