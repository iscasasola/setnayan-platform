/**
 * THE PUBLISH GATE — the one place that answers "may this service card go live?"
 *
 * ── WHY THIS FILE EXISTS ───────────────────────────────────────────────────
 * The answer used to be written in FIVE places that could not see each other:
 * the wizard's `canPublish`, the canvas maker's card-health blockers,
 * `toggleVendorServiceActive`, `commitVendorService`, and the `save_vendor_service`
 * RPC. They already disagreed — the wizard required a cover photo the server
 * never asked for. Two copies of a permission rule always drift, and the copy
 * on the screen is the optimistic one, so a vendor is told "publish" and the
 * save bounces. Every consumer now asks THIS function.
 *
 * ── WHAT IT REQUIRES, AND WHY ──────────────────────────────────────────────
 *   • a PRICE      — owner-drawn 2026-08-28 ("Publish stays shut until the price
 *                    is in"). A shop's declared figure is what a couple's budget
 *                    can be matched against; a card carrying no number has
 *                    nothing to match, so it is a card nobody finds.
 *   • the EXCLUSIVE — the shipped gate, unchanged, moved here so it stops being
 *                    written twice.
 *
 * ⚠ THIS REVERSES A DOCUMENTED DECISION, deliberately and on the record.
 * `card-health.ts` previously argued a missing price was a HINT because "the
 * listing is a menu and 'quote on request' is a real answer". That was an
 * engineering rationale, not an owner lock (nothing in DECISION_LOG.md ever
 * settled it), and the owner has now ruled the other way. A price no longer
 * competes with a quote — the quoted figure is still the real one, and the card
 * still says "final price by quote"; what a shop must now declare is a STARTING
 * number so the card can be reached at all.
 *
 * ⛔ THE METER MEASURES COMPLETENESS, NEVER THE SIZE OF THE PRICE. Nothing here
 * reads how big the number is, and nothing downstream may. The moment a bigger
 * figure buys a better score or a better position, we are selling placement.
 *
 * 🔒 THIS MODULE IS NOT THE FENCE. It is the sentence a person reads. The fence
 * is the database trigger `enforce_service_publish_gate` (migration
 * 20271181449362): `vendor_services` carries a PERMISSIVE `FOR ALL` policy on
 * "this row is yours" and `authenticated` holds UPDATE on all 40 columns, so a
 * shop can PATCH `is_active` straight through PostgREST and never meet any
 * TypeScript in this repo. Keep the two in step — the db test
 * `service-publish-gate.db.test.ts` fails if the trigger stops refusing.
 *
 * Pure and synchronous: no I/O, no React, no `server-only`, so the maker's
 * client bundle and the server actions can both import it.
 */

/** The things a card must have before it may face a couple. */
export const PUBLISH_REQUIREMENTS = ['price', 'exclusive'] as const;
export type PublishRequirement = (typeof PUBLISH_REQUIREMENTS)[number];

/** What the gate reads. Deliberately two booleans — see `priceIsSet`. */
export type PublishFacts = {
  /** A real starting figure in the card's own basis. See `priceIsSet`. */
  hasPrice: boolean;
  /** A non-blank Setnayan Exclusive. */
  hasExclusive: boolean;
};

/**
 * ONE definition of "this card has a price", used by the server (which holds a
 * parsed integer) and by the maker's live form snapshot (which holds whatever
 * was typed a second ago).
 *
 * 🪤 ZERO IS NOT A PRICE. `parseInt0OrNull` accepts a typed `0` and stores it,
 * so `starting_price_php` can legally be 0 — and the maker's old `hasPrice`
 * reported TRUE for it. That is the drift this function exists to kill: the
 * card would have shown "₱0 flat", the meter would have said the card was
 * complete, and the couple would have read a free wedding.
 */
export function priceIsSet(value: number | null | undefined): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/** Same rule for the Exclusive, so "blank" means the same thing everywhere. */
export function exclusiveIsSet(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * The sentence the SERVER hands back when it refuses a publish. Whole
 * sentences, because they surface alone in a banner with no other context.
 */
export const PUBLISH_REFUSAL_MESSAGE: Record<PublishRequirement, string> = {
  price:
    'Set a starting price before you publish this card — it is how couples ' +
    'planning a budget find you. You can still save it as a draft.',
  exclusive: 'A Setnayan Exclusive perk is required to publish this service.',
};

/**
 * The line the MAKER shows on the card itself, where the vendor is standing in
 * front of the field that fixes it. Shorter, and it names the field.
 */
export const PUBLISH_COACH_MESSAGE: Record<PublishRequirement, string> = {
  price:
    'Set your price — required to publish. It is how a couple’s budget finds ' +
    'this card; the real figure is still quoted in the inquiry.',
  exclusive: 'Setnayan Exclusive: required to publish.',
};

/**
 * Everything this card is still missing before it may go live, in the order a
 * vendor should be asked for it. Empty = publishable.
 */
export function unmetPublishRequirements(facts: PublishFacts): PublishRequirement[] {
  const unmet: PublishRequirement[] = [];
  if (!facts.hasPrice) unmet.push('price');
  if (!facts.hasExclusive) unmet.push('exclusive');
  return unmet;
}

/** True when nothing is missing. */
export function canPublishService(facts: PublishFacts): boolean {
  return unmetPublishRequirements(facts).length === 0;
}
