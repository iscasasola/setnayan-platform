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
 *   • a COVER PHOTO and WHAT'S INCLUDED — owner 2026-09-09, "the cover-photo ·
 *                    title · inclusions requirements stay" (joined 2026-09-11;
 *                    see PUBLISH_REQUIREMENTS). Judged when a card GOES live.
 *   • (the EXCLUSIVE was here until the owner made the gift optional on
 *                    2026-09-09 — see below.)
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

/**
 * The things a card must have before it may face a couple.
 *
 * ⚖ THE SETNAYAN GIFT CAME OUT OF THIS LIST 2026-09-09, ON THE OWNER'S RULING
 * ("exclusive setnayan gift then should be optional"). It was a hard publish
 * requirement — a shop could not publish a card at all without typing one —
 * and compulsory would not have been a feature, it would have been a RATE
 * RISE: the gift is 40% of the booking fee charged ON TOP of it, so
 * fee + 0.4 x fee = 1.4 x fee, taking what a shop pays us from 5% to 7% of
 * the first PHP 100,000, and making the line we sell against 25%-commission
 * rivals with ("we only charge 5% and 1%") untrue. Optional keeps it true and
 * the 7% only ever applies to a shop that chose it.
 *
 * ⚖ THE COVER PHOTO AND "WHAT'S INCLUDED" JOINED IT 2026-09-11 (H2), on the
 * owner's own ruling of 2026-09-09: *"the cover-photo · title · inclusions
 * requirements stay"* — they are what a card needs to be legible; the gift is
 * not. The goal, in the build plan's words: a couple never meets a card that
 * is only a price and a category word. (The title needs no entry here: a blank
 * one is written for the shop — B1, `fill_blank_service_card_title`.)
 *   • cover       — `primary_photo_r2_key`, the 1:1 photo a couple sees first.
 *                   It was already a blocker in card-health.ts and in
 *                   `commitVendorService`, but NOT here, so the list's on/off
 *                   switch and the database let a coverless card go live.
 *   • inclusions  — at least one named line in `vendor_service_inclusions`,
 *                   the card face's "Includes: …" line.
 * The ORDER is the order the maker's first pass asks them in.
 *
 * 🔑 THESE TWO ARE JUDGED WHEN A CARD GOES LIVE, NEVER ON A CARD ALREADY LIVE.
 * A live card missing one is FLAGGED (`liveCardFlags`), never refused an edit
 * and never unpublished — production held two live cards with no inclusions
 * and one with no cover when this landed, and taking them down or locking
 * their editor would punish the owner's own test shops for a rule that did not
 * exist when they were made. The price keeps its stricter rule (a live card
 * may not EMPTY its price) because that one was already there.
 *
 * ⛔ Do NOT put it back without the owner. The trigger in the database is the
 * other half of this rule (see the docblock above) and both moved together in
 * migration 20271205512701; TypeScript alone would have left the shop pressing
 * publish and reading a raw database sentence in a banner.
 */
export const PUBLISH_REQUIREMENTS = ['cover', 'price', 'inclusions'] as const;
export type PublishRequirement = (typeof PUBLISH_REQUIREMENTS)[number];

/**
 * What the gate reads.
 *
 * 🔑 `hasExclusive` WAS REMOVED RATHER THAN LEFT IGNORED, deliberately: an
 * unread field on this type would let a caller keep passing it and believe it
 * still decided something. Deleting it makes the compiler name every call
 * site, which is how all five were found.
 */
export type PublishFacts = {
  /** A real starting figure in the card's own basis. See `priceIsSet`. */
  hasPrice: boolean;
  /** A cover photo is set. See `coverIsSet`. */
  hasCover: boolean;
  /** At least one named "what's included" line. See `inclusionsAreSet`. */
  hasInclusions: boolean;
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

/**
 * ONE definition of "this card has a cover": a non-blank stored reference.
 * The database trigger tests exactly this (`NULLIF(btrim(...), '')`).
 */
export function coverIsSet(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * ONE definition of "this card says what is included": at least one line with
 * a non-blank label. Blank rows are what an untouched editor posts, and the
 * save path already drops them — so they must not count here either, or the
 * gate would pass a card whose "Includes:" line renders empty.
 */
export function inclusionsAreSet(labels: readonly (string | null | undefined)[]): boolean {
  return labels.some((l) => typeof l === 'string' && l.trim().length > 0);
}

/**
 * Same rule for the Exclusive, so "blank" means the same thing everywhere.
 *
 * ⚠ THIS NO LONGER GATES ANYTHING. Since 2026-09-09 the gift is optional, so
 * this answers only "does this card SAY it includes one" — which is what
 * decides whether the card wears the badge (`service-card-face.tsx`) and what
 * the health sheet reports. It is not a publish condition and must not become
 * one again without the owner.
 */
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
  // ⚠ These two are ALSO the database's sentences, byte for byte
  // (`enforce_service_publish_gate`, `save_vendor_service`, migration
  // 20271222415682) — a raw PostgREST refusal must read the same as ours.
  cover:
    'Add a cover photo before you publish this card — it is the first thing ' +
    'a couple sees. You can still save it as a draft.',
  inclusions:
    'Add what is included before you publish this card — a couple needs to ' +
    'see what the price gets them. You can still save it as a draft.',
};

/**
 * The line the MAKER shows on the card itself, where the vendor is standing in
 * front of the field that fixes it. Shorter, and it names the field.
 */
export const PUBLISH_COACH_MESSAGE: Record<PublishRequirement, string> = {
  price:
    'Set your price — required to publish. It is how a couple’s budget finds ' +
    'this card; the real figure is still quoted in the inquiry.',
  cover: 'Add a cover photo — required to publish.',
  inclusions:
    'Add what’s included — required to publish. It is how a couple sees what ' +
    'the price gets them.',
};

/**
 * The line a LIVE card shows for a requirement it went live without (it was
 * published before the requirement existed). A flag, not a refusal: the card
 * stays live and every edit still saves. See `liveCardFlags`.
 */
export const LIVE_CARD_FLAG_MESSAGE: Record<PublishRequirement, string> = {
  price: 'This card is live without a starting price — couples planning a budget cannot find it.',
  cover: 'This card is live without a cover photo — couples see an empty tile. Add one.',
  inclusions:
    'This card is live without what’s included — couples see only a price. Add what they get.',
};

/**
 * Everything this card is still missing before it may go live, in the order a
 * vendor should be asked for it. Empty = publishable.
 */
export function unmetPublishRequirements(facts: PublishFacts): PublishRequirement[] {
  const unmet: PublishRequirement[] = [];
  if (!facts.hasCover) unmet.push('cover');
  if (!facts.hasPrice) unmet.push('price');
  if (!facts.hasInclusions) unmet.push('inclusions');
  return unmet;
}

/**
 * The requirements a card that is ALREADY LIVE is still held to on an edit.
 * Only the price — the rule that stood before H2 (a live card may not empty
 * its price; the trigger has always judged a price change). The cover and
 * "what's included" are judged when a card GOES live, and flagged on one that
 * already is.
 */
export const LIVE_CARD_KEEPS: readonly PublishRequirement[] = ['price'];

/** What still blocks an edit of a card that is already live. */
export function unmetForALiveCard(facts: PublishFacts): PublishRequirement[] {
  return unmetPublishRequirements(facts).filter((r) => LIVE_CARD_KEEPS.includes(r));
}

/**
 * What a LIVE card is missing that it is NOT refused for — shown to its shop as
 * a flag (`LIVE_CARD_FLAG_MESSAGE`). Never a reason to unpublish it.
 */
export function liveCardFlags(facts: PublishFacts): PublishRequirement[] {
  return unmetPublishRequirements(facts).filter((r) => !LIVE_CARD_KEEPS.includes(r));
}

/** True when nothing is missing. */
export function canPublishService(facts: PublishFacts): boolean {
  return unmetPublishRequirements(facts).length === 0;
}
