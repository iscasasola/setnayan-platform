import type { EventTypeProfile } from './event-type-profile';

/**
 * DOES THIS EVENT TYPE HAVE TWO NAMED PEOPLE AT ITS CENTRE? — read from the
 * profile's own `terminology.personA` / `personB` ('bride' / 'groom' on the
 * wedding profile, null on every other seeded type). The one answer the parts
 * that exist BECAUSE there are two of them ask (`resolveWeddingOnlyParts`'s
 * `two_named_people` rule — the love story, the side labels — and the Maker's
 * Details › Love Story item).
 *
 * Its own module, pure and type-only on the profile, so a client-reachable file
 * can ask it without importing `event-type-profile.ts` (which reads the
 * database) — moved verbatim out of `wedding-only-parts.ts`.
 */
export function hasTwoNamedPeople(profile: Pick<EventTypeProfile, 'terminology'>): boolean {
  return Boolean(profile.terminology.personA?.trim() && profile.terminology.personB?.trim());
}
