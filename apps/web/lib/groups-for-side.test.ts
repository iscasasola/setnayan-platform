import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { groupsForSide, teamSideForNewGroup } from '@/lib/groups-for-side';

/**
 * ⚖ Owner 2026-09-21, on a guest's "+ add to group": *"clicking here should
 * popup options of what group the side has. example. bride side, then groups
 * from the bride should show."*
 */

const G = [
  { id: 'b1', team_side: 'bride' as const },
  { id: 'g1', team_side: 'groom' as const },
  { id: 's1', team_side: 'both' as const },
];
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

test('a Bride’s-side guest sees the Bride’s groups and the shared ones — never the Groom’s', () => {
  assert.deepEqual(ids(groupsForSide(G, 'bride')), ['b1', 's1']);
  assert.deepEqual(ids(groupsForSide(G, 'groom')), ['g1', 's1']);
});

test('a guest on both sides belongs to either family, so sees every group', () => {
  assert.deepEqual(ids(groupsForSide(G, 'both')), ['b1', 'g1', 's1']);
  assert.deepEqual(ids(groupsForSide(G, null)), ['b1', 'g1', 's1']);
});

test('a group made from a guest’s own + belongs to their side', () => {
  assert.equal(teamSideForNewGroup('bride'), 'bride');
  assert.equal(teamSideForNewGroup('groom'), 'groom');
  assert.equal(teamSideForNewGroup('both'), 'both');
});

const read = (...p: string[]) => stripComments(readFileSync(join(process.cwd(), ...p), 'utf8'));

test('the create-a-group action uses the side rule', () => {
  // (2026-10-09: the + popup in chip-editors.tsx, which called groupsForSide and
  // teamSideForNewGroup, went with the retired GuestListMultiselect.)
  const action = read('app', 'dashboard', '[eventId]', 'guests', 'quick-add-actions.ts');
  assert.match(action, /const teamSide = rawSide === 'bride' \|\| rawSide === 'groom' \? rawSide : 'both';/, 'the create ignores the side, or trusts any value');
});

test('the update notice sits in the page flow, so the last guest row is never under it', () => {
  // Owner 2026-09-21: "i cannot see the bottom of the guest list." The bar was fixed over the bottom and reserved its
  // height; since the one notice system (owner approved 14 Nov 2026: "No bar fixed to the screen") it is a live notice
  // at the very top, in flow — there is nothing to reserve and nothing can sit under it.
  const bar = read('app', '_components', 'stale-tab-notice.tsx');
  assert.doesNotMatch(bar, /\bfixed\b/, 'the update notice is fixed over the page again');
  assert.match(bar, /<LazyInlineNotice\b/, 'the update notice no longer renders through the one notice system');
});

test('the list ends with half a screen of room, so the last guest reaches the middle', () => {
  // Owner 2026-09-21: "make the last guest row scroll up to the middle of the screen for safety."
  // ⤷ Maker PR 4f: the list is GuestsScreen; the run-out closes its list.
  const page = read('app', 'dashboard', '[eventId]', 'guests', '_components', 'guests-screen.tsx');
  const list = page.indexOf('<GuestRowLine');
  const runout = page.indexOf(`<div aria-hidden style={{ height: '50dvh' }} data-roster-runout="" />`);
  assert.ok(list > -1 && runout > list, 'the roster has no run-out after the list');
  assert.equal(page.split('data-roster-runout').length - 1, 1, 'expected exactly one run-out');
});
