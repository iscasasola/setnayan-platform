/**
 * STAFF GET BOTH — the guard on the owner's 2026-08-27 ruling.
 *
 * *"the staff who handles the event will handle the event fully but the vendor
 * owner also has access to oversight all their business."* With 2026-08-26's
 * *"the ones they were given"*, that is exactly two ways in and one way out:
 *
 *   · runs the shop (owner or top team role) → every booking of that shop;
 *   · granted for THIS celebration            → that one celebration;
 *   · on the roster, granted nothing          → refused.
 *
 * ⚖ AND THE SECOND HALF OF THE RULING IS COPY, NOT CODE, WHICH IS WHY IT IS
 * GUARDED HERE TOO. The same widening decides `belongsToThisEvent`, so a shop's
 * staff can now read a keepsake the host restricted to "the people of this
 * celebration". The host is told that where they choose that audience. A rule
 * that widens a private thing silently is the thing this file exists to stop,
 * so the sentence is asserted with the same force as the predicate.
 *
 * ⚠ THE RULE MODULE IS PURE ON PURPOSE. `lib/booked-supplier.ts` is
 * `server-only` and cannot be imported by any node:test in this repo, so the
 * behaviour is pinned on the pure module and the WIRING is pinned on the source.
 *
 * Mutation-checked (occurrence counts printed before → after):
 *  · make `mayActForShopHere` return true unconditionally      → RED
 *  · treat `agent` as a top role                                → RED
 *  · drop `vendor_event_access_grants` from the read            → RED
 *  · drop `.is('revoked_at', null)` from the grant read         → RED
 *  · drop `.eq('event_id', eventId)` from the grant read        → RED
 *  · put back `.eq('user_id', userId)` as the only shop source  → RED
 *  · revert either audience note to "the suppliers who worked it" → RED
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  mayActForShopHere,
  shopsThisAccountMayActFor,
  teamRoleRunsTheShop,
} from '@/lib/who-may-act-for-a-shop';
import { STORY_AUDIENCE_NOTE } from '@/lib/who-can-see-your-story';
import { CHAPTER_AUDIENCE_NOTE } from '@/lib/creator-chapters';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Strip comments FIRST — this change explains itself at length, and the prose
 *  names every table and every clause the assertions below look for. */
const strip = (s: string) =>
  s
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');

const readStripped = (rel: string) => strip(readFileSync(join(WEB, rel), 'utf8'));

const SHOP = 'shop-1';
const OTHER = 'shop-2';

test('the rule has no arm that says yes without a fact', () => {
  assert.equal(
    mayActForShopHere({ vendorProfileId: SHOP, runsTheShop: false, grantedForThisEvent: false }),
    false,
    'a person on a shop roster who was handed nothing is not on this wedding',
  );
  assert.equal(
    mayActForShopHere({ vendorProfileId: SHOP, runsTheShop: true, grantedForThisEvent: false }),
    true,
  );
  assert.equal(
    mayActForShopHere({ vendorProfileId: SHOP, runsTheShop: false, grantedForThisEvent: true }),
    true,
  );
});

test('who runs the shop: admin and the legacy owner value, and nothing else', () => {
  assert.equal(teamRoleRunsTheShop('admin'), true);
  assert.equal(teamRoleRunsTheShop('owner'), true, 'legacy rows still run the shop');
  assert.equal(teamRoleRunsTheShop('agent'), false, 'an agent reaches only what they were given');
  assert.equal(teamRoleRunsTheShop('viewer'), false);
  assert.equal(teamRoleRunsTheShop(null), false);
  assert.equal(teamRoleRunsTheShop('ADMIN'), false, 'an unrecognised role fails closed');
});

test('the owner of the shop reaches every booking of theirs', () => {
  assert.deepEqual(
    shopsThisAccountMayActFor({
      ownedProfileIds: [SHOP],
      teamRows: [],
      grantedProfileIds: [],
    }),
    [SHOP],
  );
});

test('a shop admin reaches it without any per-event paperwork', () => {
  assert.deepEqual(
    shopsThisAccountMayActFor({
      ownedProfileIds: [],
      teamRows: [{ vendorProfileId: SHOP, role: 'admin' }],
      grantedProfileIds: [],
    }),
    [SHOP],
  );
});

test('a second shooter with no grant is still turned away', () => {
  assert.deepEqual(
    shopsThisAccountMayActFor({
      ownedProfileIds: [],
      teamRows: [{ vendorProfileId: SHOP, role: 'agent' }],
      grantedProfileIds: [],
    }),
    [],
    'this is the whole of "the ones they were given" — a roster is not a wedding',
  );
});

test('the same second shooter, handed THIS celebration, walks in', () => {
  assert.deepEqual(
    shopsThisAccountMayActFor({
      ownedProfileIds: [],
      teamRows: [{ vendorProfileId: SHOP, role: 'agent' }],
      grantedProfileIds: [SHOP],
    }),
    [SHOP],
  );
});

test('a grant reaches only the shop it names', () => {
  assert.deepEqual(
    shopsThisAccountMayActFor({
      ownedProfileIds: [],
      teamRows: [
        { vendorProfileId: SHOP, role: 'viewer' },
        { vendorProfileId: OTHER, role: 'viewer' },
      ],
      grantedProfileIds: [OTHER],
    }),
    [OTHER],
  );
});

test('the read resolves all three facts, and the grant read carries the event', () => {
  const src = readStripped('lib/booked-supplier.ts');

  assert.ok(
    src.includes('shopsThisAccountMayActFor('),
    'the read stopped going through the shared rule — two answers to one question is how ' +
      'the doorway and the lock screen drifted apart in the first place',
  );
  assert.ok(
    src.includes("from('vendor_team_members')"),
    'the team read is gone — a shop admin is back to being a stranger at their own booking',
  );
  assert.ok(
    src.includes("from('vendor_event_access_grants')"),
    'the grant read is gone — "the ones they were given" can no longer be given',
  );

  // The grant read is one statement; both filters must live inside it.
  const grantRead = src.slice(src.indexOf("from('vendor_event_access_grants')"));
  const grantStatement = grantRead.slice(0, grantRead.indexOf(']'));
  assert.ok(
    grantStatement.includes("eq('event_id', eventId)"),
    'the grant read stopped naming the event — a grant for ONE celebration would open every one',
  );
  assert.ok(
    grantStatement.includes("is('revoked_at', null)"),
    'a revoked grant must close in the same instant it is revoked',
  );
});

test('the shop set is no longer the registered owner and nobody else', () => {
  const src = readStripped('lib/booked-supplier.ts');
  assert.ok(
    !/select\('vendor_profile_id, business_name'\)\s*\.eq\('user_id', userId\)/.test(src),
    'the owner-only narrowing is back — this is exactly the query that turned a ' +
      "photographer's second shooter away from their own shop's wedding",
  );
});

test('the host is told, where they choose the audience, that staff come with the shop', () => {
  for (const [where, note] of [
    ['the celebration story', STORY_AUDIENCE_NOTE.event],
    ['a Storyteller chapter', CHAPTER_AUDIENCE_NOTE.event],
  ] as const) {
    assert.ok(
      /shops you booked/.test(note),
      `${where}: the note stopped naming the shops the host booked`,
    );
    assert.ok(
      /staff/.test(note),
      `${where}: the note stopped saying the shop's staff come with it — the ruling ` +
        'widens who reads something private, so the widening has to be visible to the ' +
        'person it affects',
    );
    assert.ok(
      !/suppliers who worked it/.test(note),
      `${where}: the old wording is back, and it hides the staff arm`,
    );
  }
});

test('the two audience notes still describe the SAME set of people', () => {
  // They are worded alike on purpose — "a person meeting this choice twice in one
  // product should not have to work out whether the two mean the same thing".
  const audience = (note: string) => note.split('. ')[0];
  assert.equal(
    audience(STORY_AUDIENCE_NOTE.event),
    audience(CHAPTER_AUDIENCE_NOTE.event),
    'the story and the chapter now promise different audiences for the same choice',
  );
});
