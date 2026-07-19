/**
 * Event-type-adaptive noun for host- and guest-facing copy. Weddings keep
 * "wedding" (byte-identical to the pre-unlock copy); every other event type reads
 * the generic "event". Introduced for the 2026-07-12 "unlock all now" reversal —
 * non-wedding types now render the public website + host-manage it, so copy that
 * hardcoded "wedding" ("your wedding page", "your wedding website") routes through
 * here. Null / legacy `event_type` defaults to "wedding" (every existing event).
 *
 * Pure, dependency-free — safe to import in server components, actions, and the
 * public page alike.
 */
export function eventNoun(eventType: string | null | undefined): 'wedding' | 'event' {
  return eventType && eventType !== 'wedding' ? 'event' : 'wedding';
}

/** Capitalized variant for sentence/title starts ("Wedding invitation"). */
export function eventNounCap(eventType: string | null | undefined): 'Wedding' | 'Event' {
  return eventNoun(eventType) === 'wedding' ? 'Wedding' : 'Event';
}
