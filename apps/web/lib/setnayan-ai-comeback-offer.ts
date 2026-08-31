/**
 * setnayan-ai-comeback-offer.ts — the "you didn't buy Setnayan AI at sign-up"
 * offer. Pure, no I/O.
 *
 * ⚖ OWNER-LOCKED 2026-08-30, two decisions, and this file is where they meet:
 *   1. The comeback discount is HALF the sign-up discount.
 *   2. Setnayan AI is for ALL of a user's events, each at ITS OWN tier price —
 *      purchasable per event, not one purchase covering everything.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 (1) HALF THE SAVING IS A MIDPOINT, NOT A PERCENTAGE. THIS IS THE WHOLE
 *        POINT OF THIS MODULE.
 *
 *     comebackPricePhp(row) = (retail_price_php + onboarding_price_php) / 2
 *
 * Half of the sign-up SAVING, taken in pesos, lands exactly halfway between the
 * regular price and the sign-up price. That is the definition of the offer, and
 * it is computed from the row's OWN two stored prices — so it follows a reprice
 * instead of going quietly wrong at one.
 *
 * ⚠ WHY NOT A PERCENTAGE, given a literal `20` produces the same four numbers
 * TODAY (measured against prod 2026-08-30 — A/B/C/D all agree). Because the
 * agreement is a coincidence of the current prices, not a property of the rule:
 * the catalogue carries charm endings, so the implied sign-up discounts are
 * 40.02 · 40.03 · 40.04 · 40.20, not a clean 40. Half of those is 20.01–20.10.
 * A hard-coded `20` is therefore ALREADY the wrong rule — it just happens to
 * round to the right peso at these four prices, and stops doing so the first
 * time anybody nudges a price. A latent defect that ships green is exactly the
 * class this repo has paid for before: see the booking-fee `(5%)` literal in
 * lib/booking-fee-lock.server.ts, which was right until the taper and then
 * misstated the fee on every booking over ₱100,000.
 *
 * 🪤 AND NOT THE DIAL EITHER. `platform_settings.onboarding_discount_pct` is
 * **10** in production, not 40 — it is the house rule for rows that carry NO
 * price of their own. Setnayan AI carries its own `onboarding_price_php`, and
 * lib/onboarding-discount.ts says so in as many words ("the planner keeps its
 * own better price"). Half the dial would be 5%, not 20%. Nothing here reads
 * that dial, and nothing here calls `signupPriceFor` — which takes a percentage
 * and would re-open the same door.
 *
 * ⛔ FAILS CLOSED ON A NULL. `SETNAYAN_AI_RENEW` has `onboarding_price_php =
 * NULL`, so it has no implied sign-up discount and therefore no half of one.
 * That MUST mean "no comeback offer" — never 0% off (charge full, silently
 * pretending an offer applied) and never 50% off (a midpoint against zero).
 * Every unusable input returns `null` and every caller treats `null` as NOT
 * ELIGIBLE.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔵 (2) THE OFFER IS SCOPED TO THE USER; THE PRICE AND THE ENTITLEMENT STAY
 *        PER EVENT.
 *
 * The first draft anchored the window on `events.created_at` PER EVENT, which
 * made this a launch-day upsell rather than a comeback: an event that was
 * created a month ago and never bought AI could never be offered anything
 * again, because its own 24h had lapsed long before the user came back. A
 * "comeback" offer that only exists in an event's first day is not the thing
 * the name describes.
 *
 * So the WINDOW is one per USER, anchored on their earliest event — "when you
 * started planning with us" — and inside it, EVERY event that user owns and has
 * not already bought AI for is offered, each at its own tier's midpoint.
 *
 * 🔒 WHAT DOES **NOT** WIDEN: the ENTITLEMENT. Buying AI on one event unlocks
 * that event and no other (owner 2026-08-01: "it is per event"; the per-USER
 * fan-out `getEventHostAiSubscription()` was deleted that day and must not come
 * back — see lib/setnayan-ai-server.ts). One window, many offers, one purchase
 * per event. An event that already owns AI is dropped from the offer set, so a
 * user who bought on one event is never re-charged for it.
 *
 * 🔒 SERVER-DERIVED ONLY. Eligibility and price depend solely on stored state a
 * client cannot set (`events.created_at`, `events.setnayan_ai_active`, and the
 * two catalog prices). Nothing here accepts a client-supplied window, rate or
 * price — lib/order-charge-authority.ts states the rule, and a discount is a
 * price.
 */

import { roundPesoTiesDown } from './onboarding-family-discount';

/** How long after the user's FIRST event the comeback window stays open. */
export const COMEBACK_OFFER_WINDOW_HOURS = 24;

/**
 * The two stored prices a comeback price is derived from — one catalog row's
 * own pair. Deliberately NOT a percentage and NOT a single "regular price":
 * the midpoint cannot be computed from one number, and a signature that took
 * one would have to get the other from somewhere, which is how a rate gets
 * hard-coded.
 */
export type ComebackPriceInput = {
  retailPhp: number | null | undefined;
  onboardingPhp: number | null | undefined;
};

/**
 * The comeback price in whole pesos — the MIDPOINT between a row's regular and
 * sign-up prices — or `null` when the row cannot produce an honest one.
 *
 * `null` (⇒ NOT ELIGIBLE, never a fallback price) when:
 *   • the regular price is missing / non-finite / ≤ 0 — nothing to discount;
 *   • the sign-up price is NULL / non-finite / ≤ 0 — no implied discount, so no
 *     half of one (this is `SETNAYAN_AI_RENEW` today);
 *   • the sign-up price is ≥ the regular price — there is no saving to halve,
 *     and an INVERTED pair would put the "discount" ABOVE retail, charging
 *     somebody more for coming back.
 *
 * 💰 WHOLE PESOS, TIES DOWN — the house rule, shared with `signupPriceFor` via
 * `roundPesoTiesDown` rather than re-typed here, so the two discount mechanics
 * in this app can never round apart. At the live catalogue every saving is even
 * (₱1,000 · ₱600 · ₱360 · ₱80), so every midpoint is already an exact peso and
 * this rounds nothing; it binds only on an odd future saving, and it binds in
 * the customer's favour.
 */
export function comebackPricePhp(row: ComebackPriceInput): number | null {
  const retail = row.retailPhp;
  const onboarding = row.onboardingPhp;
  if (typeof retail !== 'number' || !Number.isFinite(retail) || retail <= 0) return null;
  if (typeof onboarding !== 'number' || !Number.isFinite(onboarding) || onboarding <= 0) {
    return null;
  }
  // No saving (or an inverted pair) ⇒ no offer. `>=` not `>`: at equality the
  // midpoint IS the regular price, which is an "offer" that saves nothing.
  if (onboarding >= retail) return null;
  return roundPesoTiesDown((retail + onboarding) / 2);
}

/**
 * Centavos sibling of {@link comebackPricePhp}, for the charge path. Derived
 * from the peso answer ×100 rather than re-derived in centavos, so the shown
 * price and the charged price cannot round apart.
 */
export function comebackPriceCentavos(row: ComebackPriceInput): number | null {
  const php = comebackPricePhp(row);
  return php == null ? null : Math.round(php * 100);
}

/**
 * The peso saving a comeback price represents, for COPY ONLY. Never feed this
 * back into a price.
 */
export function comebackSavingPhp(row: ComebackPriceInput): number | null {
  const php = comebackPricePhp(row);
  if (php == null) return null;
  return (row.retailPhp as number) - php;
}

/* ── (2) Scope: one window per user, one offer per unowned event ───────────── */

/** One of a user's events, as the offer needs to see it. */
export type ComebackScopeEvent = {
  eventId: string;
  createdAt: string | Date | null | undefined;
  setnayanAiActive: boolean | null | undefined;
};

export type ComebackWindow = {
  active: boolean;
  expiresAt: Date;
};

/** A parsed date, or null — never an Invalid Date, which compares false silently. */
function parseDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * The user's anchor: the earliest `created_at` across ALL the events they own.
 * `null` when not one of them carries a usable timestamp — callers must read
 * that as "no window", never as "open forever".
 */
export function userComebackAnchor(
  events: readonly ComebackScopeEvent[] | null | undefined,
): Date | null {
  let earliest: Date | null = null;
  for (const ev of events ?? []) {
    const created = parseDate(ev.createdAt);
    if (created && (earliest === null || created.getTime() < earliest.getTime())) {
      earliest = created;
    }
  }
  return earliest;
}

/**
 * The user's ONE comeback window, or `null` when it cannot be computed.
 *
 * ⚠ Takes the user's WHOLE event set, not one event, precisely so a second
 * event cannot mint a second window. That was the per-event defect.
 */
export function resolveUserComebackWindow(
  events: readonly ComebackScopeEvent[] | null | undefined,
  now: Date = new Date(),
): ComebackWindow | null {
  const anchor = userComebackAnchor(events);
  if (!anchor) return null;
  const expiresAt = new Date(
    anchor.getTime() + COMEBACK_OFFER_WINDOW_HOURS * 60 * 60 * 1000,
  );
  return { active: now.getTime() < expiresAt.getTime(), expiresAt };
}

/**
 * Which of the user's events the offer covers right now: every event they own
 * that has NOT already bought Setnayan AI, while the window is open.
 *
 * 🔒 An event with `setnayan_ai_active === true` is dropped — that is the "not
 * re-charged for an event they already own" half of the owner's decision. Each
 * remaining event is priced from its OWN tier row by the caller; this function
 * decides membership, never money.
 */
export function comebackEligibleEventIds(
  events: readonly ComebackScopeEvent[] | null | undefined,
  now: Date = new Date(),
): string[] {
  if (!resolveUserComebackWindow(events, now)?.active) return [];
  return (events ?? [])
    .filter((ev) => ev.setnayanAiActive !== true)
    .map((ev) => ev.eventId);
}

/**
 * Is ONE of the user's events eligible right now? The question the charge path
 * asks, expressed in terms of the whole set so the window stays user-scoped.
 */
export function isComebackOfferEligible(
  events: readonly ComebackScopeEvent[] | null | undefined,
  eventId: string,
  now: Date = new Date(),
): boolean {
  return comebackEligibleEventIds(events, now).includes(eventId);
}

/* ── (4) Which offer does the Home card show? ───────────────────────────────
 *
 * ⚠ THE DISCOUNT EXPIRING IS NOT THE PRODUCT EXPIRING (owner 2026-08-31: *"sai
 * expired. should show a cta button to purchase still"*). Until now the lapse
 * of the 24h window removed the card from Home altogether, so the couple who
 * most needed a route to Setnayan AI — the one who did not buy in time — was
 * the one left without one.
 *
 * Kept PURE and here, beside the window and price rules it composes, rather
 * than inside the server resolver: the arms are a decision, not a read, and
 * `lib/setnayan-ai-server.ts` imports `server-only` so nothing in it can be
 * unit-tested. The resolver now does the three reads and calls this.
 */

export type SetnayanAiOffer =
  /** Inside the one 24h window: the discounted price, and when it lapses. */
  | { kind: 'comeback'; regularPhp: number; comebackPhp: number; expiresAt: Date }
  /** No discount (never had a window, or it lapsed) — still buyable at list. */
  | { kind: 'full'; regularPhp: number };

export type SetnayanAiOfferInput = {
  /** Every event this event's hosts own, as the comeback offer sees them. */
  events: readonly ComebackScopeEvent[] | null | undefined;
  /** The event whose Home page is being rendered. */
  eventId: string;
  /** This event's tier list price. */
  retailPhp: number;
  /** This event's tier sign-up price — `null` where the row has none. */
  onboardingPhp: number | null;
  now?: Date;
};

/**
 * The offer to show, or `null` for "show no card at all".
 *
 * `null` is reserved for the two cases where there is genuinely nothing to
 * sell: the event ALREADY OWNS Setnayan AI, or its tier has no product (a ₱0 /
 * unusable list price). A lapsed window is NOT one of them — it downgrades the
 * comeback arm to the full arm and keeps selling.
 *
 * ⚖ Fails closed on ABSENCE: an `eventId` missing from its own scope resolves
 * to `null` rather than being treated as unowned, because absent is unknown,
 * not "safe to pitch". The caller maps a refused READ to `null` for the same
 * reason — and the charge path REFUSES outright on that same read, so a blip
 * can never quietly charge list price for a discounted card.
 */
export function decideSetnayanAiOffer(input: SetnayanAiOfferInput): SetnayanAiOffer | null {
  const { events, eventId, retailPhp, onboardingPhp, now = new Date() } = input;

  const thisEvent = (events ?? []).find((ev) => ev.eventId === eventId);
  if (!thisEvent || thisEvent.setnayanAiActive === true) return null;
  if (!(Number.isFinite(retailPhp) && retailPhp > 0)) return null;

  if (isComebackOfferEligible(events, eventId, now)) {
    const comebackPhp = comebackPricePhp({ retailPhp, onboardingPhp });
    const expiresAt = resolveUserComebackWindow(events, now)?.expiresAt;
    // `comebackPhp === null` ⇒ this row has no implied sign-up saving to halve
    // (a NULL onboarding price, tier E, an inverted pair). Fall through to the
    // full arm rather than quoting a markdown that does not exist.
    if (comebackPhp != null && expiresAt) {
      return { kind: 'comeback', regularPhp: retailPhp, comebackPhp, expiresAt };
    }
  }

  return { kind: 'full', regularPhp: retailPhp };
}
