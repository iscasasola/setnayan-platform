/**
 * a-person-result-opens-their-card.test.ts — a person in the shell's search
 * opens THAT person's card on the People page, and a refused read says so.
 *
 * Owner, 22 Oct 2026 ("follow your recommendation"): people are part of the
 * shell's search, and a person result opens their CARD on the People page —
 * `/dashboard/people?person=<public id>`, deep-linkable, Back returns to the
 * results.
 *
 * 🔑 A PROPERTY, BY ROUND TRIP. The rows are built by the search's own builder
 * (`shellPeopleResults`), each href is parsed the way a browser parses it, and
 * the id it carries is handed to the People page's own resolver
 * (`personCardKey`) — which must name exactly the person the row was for. A
 * link and a card that each "work" on their own but disagree about the id is
 * the failure this exists to catch.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { RosterPerson } from '@/lib/people-roster';
import type { PersonHit } from '@/lib/people-search-query';
import { ON_SETNAYAN, YOUR_PEOPLE, shellPeopleResults } from '@/lib/shell-people-results';
import { PEOPLE_PATH, PERSON_PARAM, isPersonPublicId, personCardKey, personHref } from '@/lib/people-person-link';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const person = (p: Partial<RosterPerson> & Pick<RosterPerson, 'key' | 'name'>): RosterPerson => ({
  kind: 'connection',
  connectionId: `c-${p.key}`,
  dependentId: null,
  relation: null,
  storedRelation: null,
  ask: null,
  sharesAnEvent: null,
  careLabel: null,
  state: 'connected',
  fromEvent: null,
  samahan: [],
  canLabel: true,
  ...p,
});

const ROSTER = {
  connectionsUnavailable: false,
  people: [
    person({ key: 'k-ana', name: 'Ana Reyes', relation: 'parent', publicId: 'S89U-ANA0000001' }),
    person({ key: 'k-anabel', name: 'Anabel Cruz', state: 'waiting_them', publicId: 'S89P-ANABEL0001' }),
    person({ key: 'k-anton', name: 'Anton Sy', state: 'waiting_you', publicId: 'S89U-ANT0000001' }),
    person({ key: 'k-bea', name: 'Bea Lim', publicId: 'S89U-BEA0000001' }),
    // A loved one is not a connection — it has its own page, never a People card.
    { ...person({ key: 'k-alaga', name: 'Ana (baby)', publicId: 'S89U-ALG0000001' }), kind: 'alaga' as const },
  ],
};

const hit = (publicId: string, name: string): PersonHit => ({
  publicId,
  name,
  photoUrl: null,
  fullName: null,
  handle: '@' + name.toLowerCase().split(' ')[0],
  hint: null,
  followable: true,
  following: false,
});

/** What the People page does with an href: read `?person=` back out of it. */
function openedBy(href: string): string | null {
  const url = new URL(href, 'https://setnayan.test');
  assert.equal(url.pathname, PEOPLE_PATH, `a person result leaves the People page: ${href}`);
  return url.searchParams.get(PERSON_PARAM);
}

test('every one of YOUR people the search lists opens their own card — and nobody else\'s', () => {
  const { rows, unavailable } = shellPeopleResults({ query: 'ana', roster: ROSTER, found: { hits: [], failed: false } });
  assert.equal(unavailable, false);
  const mine = rows.filter((r) => r.tag === YOUR_PEOPLE);
  assert.deepEqual(
    mine.map((r) => r.name),
    ['Ana Reyes', 'Anabel Cruz'],
    'the search matched your people by a different rule than the People page does',
  );
  for (const r of mine) {
    const id = openedBy(r.href);
    assert.ok(isPersonPublicId(id), `${r.name}'s link carries no public id`);
    const key = personCardKey(ROSTER, id);
    const expected = ROSTER.people.find((p) => p.name === r.name)!.key;
    assert.equal(key, expected, `${r.name}'s result opens ${key ?? 'no card'}`);
  }
  assert.ok(!rows.some((r) => r.name === 'Ana (baby)'), 'a loved one is listed as a People card');
});

test('somebody ON SETNAYAN opens by their account id — which the page hands to the search\'s own fence', () => {
  const found = { hits: [hit('S89U-NEW0000001', 'Ana Santos')], failed: false };
  const { rows } = shellPeopleResults({ query: 'ana', roster: ROSTER, found });
  const r = rows.find((x) => x.tag === ON_SETNAYAN);
  assert.ok(r, 'a findable person is missing from the results');
  const id = openedBy(r.href);
  assert.equal(id, 'S89U-NEW0000001');
  assert.equal(personCardKey(ROSTER, id), null, 'a stranger opened somebody on your list');
  // Not on your list → the page asks the People search's fence for this one id, never a new query.
  const page = src('app/dashboard/(account)/people/page.tsx');
  assert.match(page, /findPersonByPublicId\(personParam, user\.id\)/, 'the page no longer resolves a stranger through the search fence');
  assert.match(page, /openPerson=\{onList \? personParam : null\}/, 'the page no longer opens the roster card for somebody on your list');
  const search = src('lib/people-search.ts');
  const fence = /export async function findPersonByPublicId[\s\S]*?\n\}/.exec(search)?.[0] ?? '';
  assert.match(fence, /findableHits\(/, 'the id lookup stopped sharing the name search\'s refusals');
  assert.match(fence, /\.eq\('discoverable_by_name', true\)/, 'the id lookup ignores the person\'s own opt-out');
});

test('🔴 a refused read is "could not search", never an empty People section', () => {
  assert.equal(shellPeopleResults({ query: 'ana', roster: null, found: { hits: [], failed: false } }).unavailable, true);
  assert.equal(
    shellPeopleResults({ query: 'ana', roster: { ...ROSTER, connectionsUnavailable: true }, found: { hits: [], failed: false } }).unavailable,
    true,
  );
  assert.equal(shellPeopleResults({ query: 'ana', roster: ROSTER, found: { hits: [], failed: true } }).unavailable, true);
  // And the People page prints a sentence for an unreadable `?person=`, not silence.
  const page = src('app/dashboard/(account)/people/page.tsx');
  assert.match(page, /PERSON_UNREAD/, 'an unreadable person link opens to silence');
});

test('the link is a public id or nothing — never a user_id, never a guess', () => {
  assert.equal(personHref(null), PEOPLE_PATH);
  assert.equal(personHref('3f0c2a1e-0000-4000-8000-000000000000'), PEOPLE_PATH, 'a uuid became a person link');
  assert.equal(personHref('S89U-ABCDEFGHJK'), `${PEOPLE_PATH}?person=S89U-ABCDEFGHJK`);
  assert.equal(personCardKey(ROSTER, 'not-an-id'), null);
});
