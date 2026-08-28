/**
 * inquiry-mask.ts — vendor inquiry anonymization-until-accept (Glass PR-6b ·
 * spec `Vendor_Inquiry_Anonymization_Spec_2026-07-15`) · PURE primitives.
 *
 * Pre-accept, a vendor sees WHAT THE JOB IS (event type · date · city-level
 * area · guest/budget bands · category · message text) but NOT WHO THE COUPLE
 * IS (no display name, initials, photo, event title, links, contact). Accepting
 * (the flat 1-token burn, ₱200) reveals everything — identity is what the token
 * buys.
 *
 * This module holds the reveal predicate + the neutral placeholder. It is
 * dependency-free (safe to import anywhere + unit-testable). The admin-scoped
 * fact read + region resolution live in `inquiry-mask.server.ts`.
 */

/**
 * The reveal predicate. Identity is revealed IFF the vendor burned the token to
 * accept. `accepted_at` is the burn timestamp — the SAME source of truth the
 * `unlock_vendor_event` accept machinery stamps (chat-actions.ts sets
 * `inquiry_status='accepted', accepted_at=now()` in one write; the accept-gate
 * migration backfilled pre-gate threads to `accepted` with
 * `accepted_at = created_at`). Keying on `accepted_at` (with the enum as a
 * belt-and-braces fallback) means "revealed stays revealed" even if the thread
 * later transitions to a closed state (declined/displaced/withdrawn/expired)
 * after having been accepted.
 */
export function isInquiryRevealed(t: {
  accepted_at?: string | null;
  inquiry_status?: string | null;
}): boolean {
  return t.accepted_at != null || t.inquiry_status === 'accepted';
}

/** "a" vs "an" for a noun, so the placeholder reads naturally. */
function indefiniteArticle(noun: string): 'a' | 'an' {
  return /^[aeiou]/i.test(noun.trim()) ? 'an' : 'a';
}

/**
 * The noun this placeholder uses when it does NOT know the event type — a
 * batched fact read that returned no row, or an event whose type is null.
 *
 * 'host' is this repo's established neutral: `GENERIC_PROFILE` carries it, and
 * `_lib/event-words.ts` states the rule for exactly this case — a hiccup reads
 * "the host", which is "correct-but-plain for every non-wedding type — never
 * wrong". The word it REPLACES is 'couple', which is only ever right by luck.
 */
export const GENERIC_HOST_NOUN = 'host';

/**
 * What a caller passes when the batched fact read had nothing for this event.
 * Exported so the two map-backed surfaces can say "we know nothing" in one
 * obvious way instead of the old `?? {}`, which silently satisfied an optional
 * shape. Every field is explicitly absent.
 */
export const INQUIRY_MASK_UNKNOWN: {
  eventType: string | null;
  city: string | null;
  hostNoun: string | null;
} = { eventType: null, city: null, hostNoun: null };

/**
 * The neutral identity placeholder shown pre-accept in place of the organiser:
 * "A couple planning a {event_type} in {city}". NEVER carries a name, initials,
 * photo, event title, contact, or venue name. `eventType` is the raw event-type
 * slug (normalized to a spaced, lowercase noun for the sentence — every V1
 * event type is a single word, so this matches the canonical demand-radar label
 * without importing it); `city` is an already-resolved city/area label. Degrades
 * gracefully when either is unknown.
 *
 * ── WHY `hostNoun` IS A REQUIRED PARAMETER WITH NO DEFAULT ──────────────────
 * This sentence used to open with the literal "A couple" for all seventeen
 * event types, so a funeral home read "A couple planning a funeral in Manila".
 * The noun has to come from the event-type profile, which needs a database
 * read — and this module is deliberately dependency-free (safe to import
 * anywhere + unit-testable), so the noun is THREADED IN by the caller.
 *
 * It is REQUIRED and has NO DEFAULT on purpose. A default would let a seventh
 * call site be added later that silently keeps saying "couple"; instead such a
 * site is a typecheck failure. `null` is the deliberate "we do not know" value
 * and renders {@link GENERIC_HOST_NOUN} — never a guess at a wedding.
 *
 * ⚠ THE ARTICLE VARIES WITH THE NOUN AND THAT IS NOT COSMETIC. The opener was
 * a hardcoded "A " because "A couple" never had to change. The corporate,
 * gala, tournament and travel profiles all carry the noun 'organizer', which
 * renders "A organizer planning a corporate event". That is the same defect as
 * the "a event"/"a anniversary" one caught one layer up in `articleFor` — and
 * it is caught the same way, by printing the finished sentence for every type
 * rather than by reading the diff. See `inquiry-mask-every-host.test.ts`.
 */
export function inquiryPlaceholderLabel(input: {
  eventType?: string | null;
  city?: string | null;
  /** REQUIRED, NO DEFAULT. `null` = unknown ⇒ {@link GENERIC_HOST_NOUN}. */
  hostNoun: string | null;
}): string {
  const type = input.eventType
    ? input.eventType.replace(/[_-]+/g, ' ').trim().toLowerCase() || null
    : null;
  const city = input.city?.trim() || null;
  // Lowercased because it lands mid-sentence after the article ("A couple",
  // never "A Couple"). Inert on every seeded row — all seventeen are already
  // lower case — but this column is admin-editable, so the shape is enforced
  // here rather than trusted.
  const host = input.hostNoun?.trim().toLowerCase() || GENERIC_HOST_NOUN;
  const article = indefiniteArticle(host);
  // "A couple" · "An organizer". Only the article takes the capital.
  const opener = `${article === 'an' ? 'An' : 'A'} ${host} planning`;
  if (type && city) return `${opener} ${indefiniteArticle(type)} ${type} in ${city}`;
  if (type) return `${opener} ${indefiniteArticle(type)} ${type}`;
  if (city) return `${opener} an event in ${city}`;
  return `${opener} an event`;
}
