/**
 * shell-people-results.ts — the pure half of the shell search's People section:
 * which rows it draws, what each says, and where each one goes.
 *
 * Split from `shell-people-search.ts` (which reads, and is `server-only`) so the
 * one rule worth a test — a person result's link opens THAT person's card — can
 * be round-tripped without a database (`a-person-result-opens-their-card.test.ts`).
 */
import type { PeopleRoster, RosterPerson } from '@/lib/people-roster';
import type { PeopleSearchRead } from '@/lib/people-search';
import type { PersonHit } from '@/lib/people-search-query';
import { RELATION_LABEL } from '@/lib/people-add';
import { rosterNameMatches, rosterQuery } from '@/lib/people-name-match';
import { personHref } from '@/lib/people-person-link';

/** The tag a row wears — the People page's own words for the two halves. */
export const YOUR_PEOPLE = 'Your people';
export const ON_SETNAYAN = 'On Setnayan';

export type ShellPersonRow = {
  /** React key. */
  key: string;
  name: string;
  photoUrl: string | null;
  /** `YOUR_PEOPLE` or `ON_SETNAYAN`. */
  tag: string;
  /** What follows the tag: their label or where things stand / their @tag · why you might know them. */
  detail: string;
  /** `/dashboard/people?person=<public id>` — their card. */
  href: string;
};

export type ShellPeopleResults = {
  rows: ShellPersonRow[];
  /** A read refused — the section says it could not search people; it never claims "none". */
  unavailable: boolean;
};

/** How many of your own people the results page lists before the rest are left to the People page. */
export const MAX_YOUR_PEOPLE = 12;

const STATE_WORD: Record<RosterPerson['state'], string> = {
  connected: 'Connected',
  waiting_them: 'Waiting for them',
  waiting_you: 'Asking you',
  in_your_care: 'In your care',
};

export function shellPeopleResults({
  query,
  roster,
  found,
}: {
  query: string;
  /** `null` = the roster could not be read at all. */
  roster: Pick<PeopleRoster, 'people' | 'connectionsUnavailable'> | null;
  found: PeopleSearchRead;
}): ShellPeopleResults {
  const q = rosterQuery(query);
  const mine = (roster?.people ?? [])
    .filter((p) => p.kind === 'connection' && rosterNameMatches(p.name, q))
    .slice(0, MAX_YOUR_PEOPLE)
    .map(
      (p): ShellPersonRow => ({
        key: `mine:${p.key}`,
        name: p.name,
        photoUrl: null,
        tag: YOUR_PEOPLE,
        detail: p.state === 'connected' && p.relation ? RELATION_LABEL[p.relation] : STATE_WORD[p.state],
        href: personHref(p.publicId),
      }),
    );
  // The name search already drops anybody on your list (its 5th refusal), so nobody appears twice.
  const others = found.hits.map(
    (h: PersonHit): ShellPersonRow => ({
      key: `found:${h.publicId}`,
      name: h.name,
      photoUrl: h.photoUrl,
      tag: ON_SETNAYAN,
      detail: [h.handle, h.hint].filter(Boolean).join(' · '),
      href: personHref(h.publicId),
    }),
  );
  return {
    rows: [...mine, ...others],
    unavailable: roster === null || roster.connectionsUnavailable || found.failed,
  };
}
