/**
 * setnayan-ai-comeback-offer.ts — the one-time, time-boxed "you didn't buy at
 * sign-up" Setnayan AI discount. Pure, no I/O — mirrors
 * lib/onboarding-family-discount.ts's shape so the two discount mechanics in
 * this app compute prices the same way.
 *
 * THE OFFER: an event that has NOT purchased Setnayan AI gets ONE window,
 * starting at `events.created_at` (the same "you started planning" anchor
 * lib/journey.ts already uses), during which the AI unlock is offered at
 * `COMEBACK_OFFER_DISCOUNT_PCT` off. Outside that window, or once the event
 * owns AI, the offer is simply not eligible — the regular price stands,
 * unchanged, at `/studio/setnayan-ai`.
 *
 * 🔒 SERVER-DERIVED ONLY. Eligibility depends solely on stored event state
 * (`created_at`, `setnayan_ai_active`) that a client cannot set. Nothing here
 * takes a client-supplied "am I still in my window" flag — see SEC-7's rule
 * in lib/order-charge-authority.ts: nothing the customer can edit may set a
 * price.
 */

import { signupPriceFor } from './onboarding-family-discount';

/** How much the comeback offer takes off the regular price. */
export const COMEBACK_OFFER_DISCOUNT_PCT = 20;

/** How long after `events.created_at` the offer stays open. */
export const COMEBACK_OFFER_WINDOW_HOURS = 24;

export type ComebackWindow = {
  active: boolean;
  expiresAt: Date;
};

/**
 * The offer's window for one event, or `null` when it cannot be computed
 * (no/unparseable `created_at`) — callers must treat `null` as "not
 * eligible", never as "eligible forever".
 */
export function resolveComebackWindow(
  createdAt: string | Date | null | undefined,
  now: Date = new Date(),
): ComebackWindow | null {
  if (!createdAt) return null;
  const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(created.getTime())) return null;
  const expiresAt = new Date(
    created.getTime() + COMEBACK_OFFER_WINDOW_HOURS * 60 * 60 * 1000,
  );
  return { active: now.getTime() < expiresAt.getTime(), expiresAt };
}

/**
 * Is THIS event eligible for the comeback offer right now? False once the
 * event owns Setnayan AI (a couple who bought it never sees a "buy" price
 * again, comeback or otherwise) or once the 24h window has lapsed.
 */
export function isComebackOfferEligible(
  event:
    | { setnayan_ai_active?: boolean | null; created_at?: string | Date | null }
    | null
    | undefined,
  now: Date = new Date(),
): boolean {
  if (!event) return false;
  if (event.setnayan_ai_active === true) return false;
  return Boolean(resolveComebackWindow(event.created_at, now)?.active);
}

/**
 * The comeback price in PHP for a given regular price. Reuses
 * `signupPriceFor`'s whole-peso, ties-down rounding so every discounted price
 * in this app rounds the same way. `null` when the regular price is unusable
 * — callers must not fall back to a guessed number.
 */
export function comebackPricePhp(regularPhp: number): number | null {
  return signupPriceFor(regularPhp, COMEBACK_OFFER_DISCOUNT_PCT);
}

/**
 * Centavos sibling of {@link comebackPricePhp}, for the charge path. Catalog
 * prices are always whole pesos in this app, so the peso rounding and the
 * ×100 conversion never disagree.
 */
export function comebackPriceCentavos(regularCentavos: number): number | null {
  if (!Number.isFinite(regularCentavos) || regularCentavos < 0) return null;
  const php = comebackPricePhp(regularCentavos / 100);
  return php == null ? null : Math.round(php * 100);
}
