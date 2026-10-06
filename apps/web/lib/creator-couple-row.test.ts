/**
 * GUARD — THE EVENT'S CREATOR IS THEIR OWN COUPLE ROW, AND IS CALLED "HOST"
 * (owner 2026-10-04). The database half is executed by
 * tests/db/the-creator-is-their-couple-row.db.test.ts; this file holds the
 * app half, each as a property rather than a phrasing:
 *
 *   1. creatorCoupleRowId — bride/groom → that seeded row; helper / no answer → none.
 *   2. offersThisIsMe — only a host holding no row, only a live unlinked couple
 *      row no other account owns.
 *   3. accessWordFor — the creator reads "Host"; a chosen co-host "Co-host".
 *   4. Wiring: onboarding attaches the creator to the row it seeded (guarded
 *      to an unlinked membership); the card's one "This is me" form rides the
 *      release door into `claim_my_couple_row`; no surface prints the creator
 *      through the level label alone.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { creatorCoupleRowId, offersThisIsMe } from './creator-couple-row';
import { accessTag, accessWordFor, accessNote, creatorGuestIds, guestAccessState } from './guest-access';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...p: string[]) => stripComments(readFileSync(join(WEB, ...p), 'utf8'));

test('① the creator holds the row they said they are — and nobody else is guessed', () => {
  const seeded = { bride: 'b-row', groom: 'g-row' };
  assert.equal(creatorCoupleRowId('groom', seeded), 'g-row');
  assert.equal(creatorCoupleRowId('bride', seeded), 'b-row');
  assert.equal(creatorCoupleRowId('helper', seeded), null, 'a helper is not the bride or groom');
  assert.equal(creatorCoupleRowId(null, seeded), null, 'no answer → no row');
  assert.equal(creatorCoupleRowId('groom', { bride: 'b-row', groom: null }), null, 'a seed that failed → nothing');
});

test('② "This is me" is offered only to a host holding no row, on a free couple row', () => {
  const yes = {
    viewerIsCreator: true,
    viewerHoldsARow: false,
    rowIsCouple: true,
    rowIsLinked: false,
    rowPassedAway: false,
    rowOwnedByAnotherAccount: false,
  };
  assert.equal(offersThisIsMe(yes), true);
  for (const [k, v] of [
    ['viewerIsCreator', false],
    ['viewerHoldsARow', true],
    ['rowIsCouple', false],
    ['rowIsLinked', true],
    ['rowPassedAway', true],
    ['rowOwnedByAnotherAccount', true],
  ] as const) {
    assert.equal(offersThisIsMe({ ...yes, [k]: v }), false, `offered although ${k} = ${v}`);
  }
});

test('③ the creator reads "Host", a chosen co-host reads "Co-host"', () => {
  const creator = guestAccessState({ seat: null, guestRole: 'groom', isCreator: true });
  assert.equal(accessWordFor(creator), 'Host');
  assert.equal(accessTag(creator), 'Host');
  assert.doesNotMatch(accessNote(creator, 'Ice'), /co-host/i, 'the creator note calls them a co-host');
  const cohost = guestAccessState({
    seat: { role_subtype: 'co_host', user_id: 'u', removed_at: null },
    guestRole: 'guest',
    isCreator: false,
  });
  assert.equal(accessWordFor(cohost), 'Co-host');
  assert.equal(accessTag(cohost), 'Co-host');
});

test('③b the creator\'s row is the one their MEMBERSHIP holds, even with no person of theirs', () => {
  // A name-only row linked by "This is me": no person record of theirs.
  const viaMembership = creatorGuestIds({ creators: [{ user_id: 'u1', guest_id: 'g-row' }], rowsOfCreatorPersons: [] });
  assert.ok(viaMembership.has('g-row'), 'a membership-only link is not recognised as the creator\'s row');
  const state = guestAccessState({ seat: null, guestRole: 'groom', isCreator: viaMembership.has('g-row') });
  assert.equal(state.lock, 'creator');
  assert.equal(accessWordFor(state), 'Host');
  // The older person signal still counts; an unlinked creator adds nothing.
  const viaPerson = creatorGuestIds({ creators: [{ user_id: 'u1', guest_id: null }], rowsOfCreatorPersons: ['p-row'] });
  assert.deepEqual([...viaPerson], ['p-row']);
  // Both readers of "is this the creator's row" ask the one rule.
  const server = read('lib', 'guest-access.server.ts');
  assert.match(server, /select\('user_id, guest_id'\)/, 'loadGuestAccessMap no longer reads the creator\'s linked row');
  assert.match(server, /creatorGuestIds\(/, 'loadGuestAccessMap decides the creator\'s row by its own rule again');
  const setter = read('app', 'dashboard', '[eventId]', 'guests', '[guestId]', 'access-actions.ts');
  assert.match(setter, /creatorGuestIds\(/, 'setGuestAccess decides the creator\'s row by its own rule again');
});

test('④ wiring: onboarding links the creator, the card offers one "This is me", every word goes through accessWordFor', () => {
  const onboarding = read('app', 'onboarding', 'wedding', 'actions.ts');
  const link = onboarding.slice(onboarding.indexOf('creatorCoupleRowId('));
  assert.ok(onboarding.includes('creatorCoupleRowId(payload.role'), 'onboarding no longer asks which row the creator is');
  assert.match(
    link.slice(0, 600),
    /from\('event_members'\)\s*\.update\(\{ guest_id: creatorRowId[\s\S]*?\.is\('guest_id', null\)/,
    'the creator link no longer writes the membership, or no longer only fills an empty one',
  );
  for (const role of ['bride', 'groom']) {
    assert.match(
      onboarding,
      new RegExp(`defaultInvitedToForRole\\('${role}'\\),\\s*custom_tags: \\[\\],\\s*\\}\\)\\.select\\('guest_id'\\)\\.single\\(\\)`),
      `the ${role} seed no longer reports which row it became`,
    );
  }

  const card = read('app', 'dashboard', '[eventId]', 'guests', '_components', 'guest-card-body.tsx');
  const forms = card.match(/name="this_is_me"/g) ?? [];
  assert.equal(forms.length, 1, `the card draws ${forms.length} "This is me" forms — exactly one`);
  assert.match(card, /\{offersThisIsMe \? \(\s*<form action=\{releaseAction\}/, '"This is me" is not gated on offersThisIsMe or not on the release door');
  assert.doesNotMatch(card, /ACCESS_LEVEL_LABEL\[access/, 'the card prints the creator through the level label again ("Co-host")');
  assert.doesNotMatch(card, /'creator' \? 'creator'/, 'the card says "Co-host · creator" again');

  const actions = read('app', 'dashboard', '[eventId]', 'guests', '[guestId]', 'actions.ts');
  assert.match(actions, /formData\.get\('this_is_me'\) === '1'\) return thisIsMe\(/, 'the release door no longer routes "This is me"');
  assert.match(actions, /rpc\('claim_my_couple_row'/, '"This is me" no longer goes through the database check');

  const data = read('app', 'dashboard', '[eventId]', 'guests', '_components', 'guest-card-data.ts');
  assert.match(data, /offersThisIsMe\(\{/, 'the card loader no longer decides "This is me" by the one rule');

  for (const p of [
    ['app', 'dashboard', '[eventId]', 'guests', '_components', 'guest-access-cell.tsx'],
    ['app', 'dashboard', '[eventId]', 'guests', '_components', 'guest-access-control.tsx'],
  ]) {
    assert.match(read(...p), /\baccessWordFor\(/, `${p.at(-1)} prints access without the creator's word`);
  }
  const people = read('lib', 'people-with-access.ts');
  assert.match(people, /roleWord: h\.isCreator \? CREATOR_WORD : 'Co-host'/, 'People with access calls the creator a Co-host again');
  // A wrong "This is me" is undoable: Unlink on the creator's own row lets go
  // of the row and KEEPS the membership (never deletes the creator's event).
  const unlink = read('lib', 'seat-unlink.ts');
  const creatorBranch = unlink.slice(unlink.indexOf("binding.joined_via === 'created_event'"));
  assert.ok(unlink.includes("binding.joined_via === 'created_event'"), 'Unlink no longer recognises the creator\'s own row');
  assert.match(creatorBranch.slice(0, 500), /\.update\(\{ guest_id: null, role: null \}\)/, 'Unlink on the creator\'s row no longer just lets go of the row');
  assert.doesNotMatch(creatorBranch.slice(0, 500), /\.delete\(\)/, 'Unlink deletes the creator\'s membership');
  const dash = read('app', 'dashboard', '[eventId]', '_components', 'event-dashboard.tsx');
  assert.match(dash, /creatorIds\.has\(m\.user_id\) \? CREATOR_WORD : modRoleLabel\(m\)/, 'the Hosts card calls the creator by their seat word again');
});
