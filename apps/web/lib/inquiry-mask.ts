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

/** "a" vs "an" for the event-type noun, so the placeholder reads naturally. */
function indefiniteArticle(noun: string): 'a' | 'an' {
  return /^[aeiou]/i.test(noun.trim()) ? 'an' : 'a';
}

/**
 * The neutral identity placeholder shown pre-accept in place of the couple:
 * "A couple planning a {event_type} in {city}". NEVER carries a name, initials,
 * photo, event title, contact, or venue name. `eventType` is the raw event-type
 * slug (normalized to a spaced, lowercase noun for the sentence — every V1
 * event type is a single word, so this matches the canonical demand-radar label
 * without importing it); `city` is an already-resolved city/area label. Degrades
 * gracefully when either is unknown.
 */
export function inquiryPlaceholderLabel(input: {
  eventType?: string | null;
  city?: string | null;
}): string {
  const type = input.eventType
    ? input.eventType.replace(/[_-]+/g, ' ').trim().toLowerCase() || null
    : null;
  const city = input.city?.trim() || null;
  if (type && city) return `A couple planning ${indefiniteArticle(type)} ${type} in ${city}`;
  if (type) return `A couple planning ${indefiniteArticle(type)} ${type}`;
  if (city) return `A couple planning an event in ${city}`;
  return 'A couple planning an event';
}
