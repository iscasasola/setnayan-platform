/**
 * map-arranges-by-four.test.ts — THE MAP HAS ITS OWN ARRANGE: By side · By role ·
 * By RSVP · By group, never Last name (Maker PR 4f · G38). Owner 2026-10-07:
 * *"sort on map is different, we already have those choices: By side/role/RSVP/
 * Group"* · *"so sorting here is different"*. Side nests each side's groups.
 *
 * SABOTAGE (seen red): add `last_name` to MAP_ARRANGE.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import type { GuestRow } from '@/lib/guests';
import { MAP_ARRANGE, mapTree, ROSTER_VIEWS, type RosterFacts } from '@/lib/guest-roster-view';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCREEN = stripComments(readFileSync(join(HERE, 'guests-screen.tsx'), 'utf8'));

const g = (id: string, p: Partial<GuestRow>): GuestRow =>
  ({ guest_id: id, first_name: id, last_name: 'X', role: 'guest', side: 'bride', rsvp_status: 'attending', extra_roles: [], invitation_sent_at: '2026-09-01', entry_source: null, passed_away: false, ...p }) as GuestRow;

test('the four arrangements, in the owner’s words — and the list keeps its own five', () => {
  assert.deepEqual(MAP_ARRANGE.map((o) => o.label), ['By side', 'By role', 'By RSVP', 'By group']);
  assert.ok(!MAP_ARRANGE.some((o) => /last/i.test(o.key) || /last/i.test(o.label)), 'Last name is on the map');
  assert.deepEqual(ROSTER_VIEWS.map((o) => o.label), ['Role', 'Last name', 'Side', 'Group', 'RSVP']);
});

test('By side nests each side’s groups; the others are one level (executed)', () => {
  const roster = [
    g('maria', { role: 'bride', side: 'bride' }),
    g('ana', { side: 'bride' }),
    g('ben', { side: 'groom', rsvp_status: 'pending' }),
  ];
  const facts: RosterFacts = { hasSides: true, groupsOf: (id) => (id === 'ana' ? ['Choir'] : []), tableOf: () => null };
  const side = mapTree(roster, 'side', facts);
  // The shipped one side order (lib/guests SIDE_ORDER — owner 2026-09-20), never a second.
  assert.deepEqual(side.map((b) => b.label), ["Groom's side", "Bride's side"]);
  assert.ok(side[1]!.kids.some((k) => k.label === 'Choir'), 'a side does not nest its groups');
  const rsvp = mapTree(roster, 'rsvp', facts);
  assert.ok(rsvp.every((b) => b.kids.length === 0), 'By RSVP grew a second level');
  assert.equal(rsvp[0]!.label, 'Bride & Groom', 'the celebrants do not lead the map');
});

test('the map’s thumb row draws the arrange dropdown, not the list’s Sort', () => {
  const row = SCREEN.slice(SCREEN.indexOf('data-thumb="map"'), SCREEN.indexOf('data-thumb="map"') + 400);
  assert.match(row, /arrangePick/);
  assert.doesNotMatch(row, /sortPick|thumb-expand|thumb-select/, 'the map carries the list’s controls (no expand/select on the canvas)');
  assert.match(SCREEN, /label="Arrange the map by"[\s\S]{0,120}options=\{arranges\.map/);
});
