/**
 * event-term-copy.ts — iteration 0053 P4 Unit 3 (the terminology resolver).
 *
 * Pick a keyed wedding/generic copy variant off the resolved Event-Type Profile.
 * The WEDDING path returns the `wedding` string VERBATIM (the byte-identical
 * guarantee — the only way a wedding string changes is an author typo, caught by
 * review); any non-wedding event uses the hand-authored `generic` string (NOT a
 * 'wedding'→eventWord substitution, so generic copy can drop wedding-only beats).
 *
 * Discriminator is `profile.eventType === 'wedding'` (the canonical identity),
 * not `eventWord`, so it can't be surprised by a future eventWord synonym.
 *
 * Pure + client-safe: no Supabase, no cookies, no React cache. Server components
 * resolve the profile and call this; a client component could receive `eventType`
 * as a prop and call it locally (none in this unit needs to).
 */
import type { EventTypeProfile } from './event-type-profile';

export function term(
  profile: Pick<EventTypeProfile, 'eventType'>,
  pair: { wedding: string; generic: string },
): string {
  return profile.eventType === 'wedding' ? pair.wedding : pair.generic;
}
