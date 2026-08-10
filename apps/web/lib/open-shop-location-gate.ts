import { OPEN_SHOP_ERRORS } from './open-shop-validation';

/**
 * Whether "Where you are" is finished — the last step of opening a shop.
 *
 * ── THE RULE, OWNER-LOCKED 2026-08-10 ───────────────────────────────────────
 * *"needs to have a pin on the map before they can continue. so you have to ask
 * them if the pin location is correct. once they confirm, that is when they can
 * only complete the 4 step."*
 *
 * So: **a pin, then a yes, then the city.** All three, in that order.
 *
 * This REVERSES the previous rule, under which the pin was optional and the
 * confirmation was demanded only `if (pinned)`. Two things went wrong under it,
 * both seen in production:
 *   • a shop was created before anyone had read the address the map found, and
 *   • an absent pin was written to the database as 0,0 — open ocean off West
 *     Africa — so the shop silently dropped out of every distance search while
 *     its own dashboard looked perfectly normal.
 *
 * ── WHY THIS IS A FUNCTION AND NOT THREE `if`s IN THE COMPONENT ─────────────
 * It was three `if`s in the component, and the tests that covered it were
 * regexes over the component's source text — they asserted that the string
 * `location_confirmed` appeared somewhere in the file. That kind of test cannot
 * tell a working rule from a broken one; it only notices deletion. Now the rule
 * can be run, so it can be broken on purpose and seen to fail.
 *
 * ── ORDER IS PART OF THE RULE, NOT A DETAIL ────────────────────────────────
 * 🔑 Asking someone to "confirm the address" before anything is on the map names
 * a button that is not on screen yet — an instruction that reads as a dead end.
 * Pin first. The city comes last because it is the one field a person can
 * always fix by typing, so it is the least urgent thing to send them back to.
 */
export function locationStepError(input: {
  /** A pin exists — the form is carrying coordinates. */
  hasPin: boolean;
  /** The vendor answered "yes, that's right" about THIS pin. */
  confirmed: boolean;
  /** Whatever is in the city box, filled by the lookup or typed by hand. */
  city: string;
}): string | null {
  if (!input.hasPin) return OPEN_SHOP_ERRORS.locationPin;
  if (!input.confirmed) return OPEN_SHOP_ERRORS.locationConfirm;
  // The city is what the marketplace actually filters on, and a lookup can land
  // on a province or return nothing at all — which is exactly why the box stays
  // editable rather than being locked to whatever the pin resolved to.
  if (!input.city.trim()) return OPEN_SHOP_ERRORS.locationCity;
  return null;
}
