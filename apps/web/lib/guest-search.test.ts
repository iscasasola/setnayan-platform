/**
 * guest-search.test.ts — THE ONE GUEST MATCHER, AS A TABLE.
 *
 * ⚖ Owner 2026-10-03 (screenshots: "VIP" and "Bestman" found nobody): the
 * search must find a guest by ANY part of them. Each row below is one thing a
 * host types and who must (and must not) come back.
 *
 * 🛡 Sabotaged (see the PR): dropping the squash step turns the "bestman" rows
 * red; dropping `custom_tags` turns "VIP" red; dropping the reply-word rule
 * turns "coming" red (it starts matching the guests who are NOT coming).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guestMatchesSearch, normalizeSearchText, type GuestSearchFacts, type GuestSearchRow } from './guest-search';

function g(over: Partial<GuestSearchRow> = {}): GuestSearchRow {
  return {
    first_name: 'Ana',
    last_name: 'Cruz',
    role: 'guest',
    side: 'bride',
    group_category: 'friends',
    rsvp_status: 'attending',
    custom_tags: [],
    ...over,
  };
}

type Row = [query: string, guest: GuestSearchRow, facts: GuestSearchFacts, expected: boolean];

const ROWS: Row[] = [
  // ── names, every part ──
  ['ana', g(), {}, true],
  ['CRUZ', g(), {}, true],
  ['ana cruz', g(), {}, true],
  ['anacruz', g(), {}, true],
  ['Lourdes', g({ middle_name: 'Lourdes' }), {}, true],
  ['Bing', g({ display_name: 'Bing' }), {}, true],
  ['Dr', g({ name_prefix: 'Dr.' }), {}, true],
  ['jr', g({ name_suffix: 'Jr.' }), {}, true],
  ['José', g({ first_name: 'Jose' }), {}, true],
  ['jose', g({ first_name: 'José' }), {}, true],
  ['maria', g(), {}, false],
  // ── the reply, in every word ──
  ['no reply', g({ rsvp_status: 'pending' }), {}, true],
  ['pending', g({ rsvp_status: 'pending' }), {}, true],
  ['accepted', g({ rsvp_status: 'attending' }), {}, true],
  ['attending', g({ rsvp_status: 'attending' }), {}, true],
  ['coming', g({ rsvp_status: 'attending' }), {}, true],
  ['coming', g({ rsvp_status: 'declined' }), {}, false],
  ['declined', g({ rsvp_status: 'declined' }), {}, true],
  ['not coming', g({ rsvp_status: 'declined' }), {}, true],
  ['not coming', g({ rsvp_status: 'attending' }), {}, false],
  ['no reply', g({ rsvp_status: 'attending' }), {}, false],
  ['maybe', g({ rsvp_status: 'maybe' }), {}, true],
  // ── the role, however it is spelled ──
  ['Best Man', g({ role: 'best_man' }), {}, true],
  ['bestman', g({ role: 'best_man' }), {}, true],
  ['Bestman', g({ role: 'best_man' }), {}, true],
  ['best-man', g({ role: 'best_man' }), {}, true],
  ['bestmen', g({ role: 'best_man' }), {}, true],
  ['bestman', g({ role: 'groomsman' }), {}, false],
  ['best woman', g({ role: 'best_woman' }), {}, true],
  ['maid of honour', g({ role: 'maid_of_honor' }), {}, true],
  ['maidofhonor', g({ role: 'maid_of_honor' }), {}, true],
  ['groomsmen', g({ role: 'groomsman' }), {}, true],
  ['gromsman', g({ role: 'groomsman' }), {}, true],
  ['bridesmaid', g({ role: 'bridesmaid' }), {}, true],
  ['ninong', g({ role: 'principal_sponsor_ninong' }), {}, true],
  ['sponsor', g({ role: 'principal_sponsor_ninang' }), {}, true],
  ['flowergirl', g({ role: 'flower_girl' }), {}, true],
  ['crew', g({ role: 'bridesmaid' }), { roleNames: { bridesmaid: { one: "Bride's Crew", many: "Bride's Crew" } } }, true],
  ['ninang', g({ role: 'guest', extra_roles: ['principal_sponsor_ninang'] }), {}, true],
  // ── VIP: a tag, a role, the VIP family ──
  ['VIP', g({ custom_tags: ['VIP'] }), {}, true],
  ['vip', g({ role: 'vip' }), {}, true],
  ['vip', g({ role: 'bride_parents' }), {}, true],
  ['vip', g(), {}, false],
  // ── group and side ──
  ['katropa', g(), { groupLabels: ['Katropa', 'Team Groom'] }, true],
  ['team groom', g(), { groupLabels: ['Katropa', 'Team Groom'] }, true],
  ['friends', g({ group_category: 'friends' }), {}, true],
  ["bride's side", g({ side: 'bride' }), {}, true],
  ['bride side', g({ side: 'bride' }), {}, true],
  ['groom side', g({ side: 'bride' }), {}, false],
  ['both', g({ side: 'both' }), { hasSides: false }, false],
  // ── the table ──
  ['table 9', g(), { tableLabel: '9' }, true],
  ['Table 9', g(), { tableLabel: 'Table 9' }, true],
  ['sweetheart', g(), { tableLabel: 'Sweetheart Table' }, true],
  ['table 9', g(), { tableLabel: '10' }, false],
  // ── every RSVP answer ──
  ['vegetarian', g({ meal_preference: 'vegetarian' }), {}, true],
  ['peanut', g({ dietary_restrictions: 'No peanuts please' }), {}, true],
  ['Ben', g({ plus_one_name: 'Ben Lim' }), {}, true],
  ['can’t wait', g({ guest_note: "Can't wait!" }), {}, true],
  ['perfect', g(), { songRequests: ['Perfect Ed Sheeran'] }, true],
  ['sheeran', g(), { songRequests: ['Perfect Ed Sheeran'] }, true],
  ['halal', g(), { answers: ['Halal only'] }, true],
  // ── empty is everyone ──
  ['', g(), {}, true],
  ['   ', g(), {}, true],
];

test('the one guest matcher answers every row of the table', () => {
  const wrong: string[] = [];
  for (const [query, guest, facts, expected] of ROWS) {
    const got = guestMatchesSearch(query, guest, facts);
    if (got !== expected) wrong.push(`"${query}" on ${JSON.stringify(guest)} ${JSON.stringify(facts)} → ${got}, want ${expected}`);
  }
  assert.deepEqual(wrong, []);
});

test('normalizing reads accents, British spelling and apostrophes the same way', () => {
  assert.equal(normalizeSearchText("  Bride’s  Side "), 'brides side');
  assert.equal(normalizeSearchText('Maid of Honour'), 'maid of honor');
  assert.equal(normalizeSearchText('Peñafrancia'), 'penafrancia');
});
