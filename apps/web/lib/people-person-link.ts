/**
 * people-person-link.ts — the address that opens ONE person's card on the People page.
 *
 * Owner, 22 Oct 2026 ("follow your recommendation"): people are part of the
 * shell's search ("search the place you're standing in", 2026-09-23 — Discover
 * reads "Search events, people, suppliers"), and a person result opens that
 * person's CARD on the People page — deep-linkable, and Back returns to the
 * results. Both halves live here, so the link the search writes and the card
 * the page opens cannot drift apart: `a-person-result-opens-their-card.test.ts`
 * builds the link with `personHref` and resolves it with `personCardKey`.
 *
 * 🔑 THE HANDLE IS A PUBLIC ID, NEVER A user_id — the account's
 * `users.public_id` (S89U-…), the handle the People search already hands the
 * browser, or the person node's `people.public_id` (S89P-…) for somebody on
 * your list with no account. See `RosterPerson.publicId`.
 */
import type { PeopleRoster } from '@/lib/people-roster';

export const PEOPLE_PATH = '/dashboard/people';
export const PERSON_PARAM = 'person';

/** A canonical public id of a person: an account (U) or a person node (P). */
export function isPersonPublicId(raw: string | null | undefined): raw is string {
  return typeof raw === 'string' && /^S89[UP]-[0-9A-Z]{10}$/.test(raw);
}

/** The People page with this person's card open. No id → the People page itself, never a guess. */
export function personHref(publicId: string | null | undefined): string {
  return isPersonPublicId(publicId) ? `${PEOPLE_PATH}?${PERSON_PARAM}=${encodeURIComponent(publicId)}` : PEOPLE_PATH;
}

/** Which roster card `?person=<id>` opens — a connection carrying that id, else none. */
export function personCardKey(roster: Pick<PeopleRoster, 'people'>, publicId: string | null | undefined): string | null {
  if (!isPersonPublicId(publicId)) return null;
  return roster.people.find((p) => p.kind === 'connection' && p.publicId === publicId)?.key ?? null;
}
