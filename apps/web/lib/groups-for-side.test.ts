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

test('the + popup and its create both use the side rule', () => {
  const chip = read('app', 'dashboard', '[eventId]', 'guests', '_components', 'chip-editors.tsx');
  assert.match(chip, /const available = groupsForSide\(groups, guest\.side\)/, 'the + offers every group again');
  assert.match(chip, /quickCreateGroup\(eventId, label, teamSideForNewGroup\(guest\.side\)\)/, 'a group made from the + lands on no side');
  const action = read('app', 'dashboard', '[eventId]', 'guests', 'quick-add-actions.ts');
  assert.match(action, /const teamSide = rawSide === 'bride' \|\| rawSide === 'groom' \? rawSide : 'both';/, 'the create ignores the side, or trusts any value');
});

test('the update bar reserves its height, so the last guest row can scroll clear of it', () => {
  // Owner 2026-09-21: "i cannot see the bottom of the guest list."
  const bar = read('app', '_components', 'stale-tab-notice.tsx');
  assert.match(bar, /body\.style\.paddingBottom = `\$\{base \+ el\.getBoundingClientRect\(\)\.height\}px`/, 'the bar reserves no room');
  assert.match(bar, /body\.style\.paddingBottom = before;/, 'the reserved room is never given back');
  assert.match(bar, /ref=\{bar\}/, 'the measured element is not the bar');
});

test('the list ends with half a screen of room, so the last guest reaches the middle', () => {
  // Owner 2026-09-21: "make the last guest row scroll up to the middle of the screen for safety."
  const page = read('app', 'dashboard', '[eventId]', 'guests', 'page.tsx');
  const list = page.indexOf('<GuestListMultiselect');
  const runout = page.indexOf('<div aria-hidden className="h-[50dvh]" data-roster-runout />');
  assert.ok(list > -1 && runout > list, 'the roster has no run-out after the list');
  assert.equal(page.split('data-roster-runout').length - 1, 1, 'expected exactly one run-out');
});
