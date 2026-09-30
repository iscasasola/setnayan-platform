/**
 * A birthday has no Bride's side (owner 2026-09-30, on his birthday event's
 * Guest list: *"why is there groom and bride's side for a simple event"*).
 *
 * The event-type profile's role set decides whether an event has sides
 * (`eventHasSides`, lib/guest-side-question.ts), never a list of type names.
 * On an event without sides the Guest list shows NO side control: no Side
 * column, no "Assign side…" in the bulk bar, no Side filter (desktop or
 * phone), no side sort or grouping, no Side pills in the people picker, and
 * no side branches on the mind map. `guests.side` is still written
 * (SIDELESS_SIDE), because the column is NOT NULL.
 *
 * Each source check is anchored to the specific control, so removing one gate
 * fails its own assertion (the sabotage: delete the `hasSides ?` in front of a
 * control and the matching test goes red).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '../../../../lib/strip-comments';
import { eventHasSides } from '../../../../lib/guest-side-question';
import { resolveRoleSet } from '../../../../lib/role-sets';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));

test('only a wedding role set has sides — simple, generic (birthday) and null (wake) do not', () => {
  assert.equal(eventHasSides(resolveRoleSet('wedding')), true);
  assert.equal(eventHasSides(resolveRoleSet('simple')), false);
  assert.equal(eventHasSides(resolveRoleSet('generic')), false);
  assert.equal(eventHasSides(resolveRoleSet(null)), false);
});

test('the page derives hasSides from the profile and gates the Side filter, sort and people picker', () => {
  const page = src('page.tsx');
  assert.match(page, /const hasSides = eventHasSides\(resolveRoleSet\(guestRoleSetKey\)\)/);
  // One head at every width (#6192 Fix E): the Side filter is a dropdown in
  // RosterFilters, told by the page whether the event has sides.
  assert.match(page, /<RosterFilters\s+hasSides=\{hasSides\}/, 'the filter row is not told whether the event has sides');
  assert.match(src('_components/roster-controls.tsx'), /\{hasSides \? \(\s*<PickMenu\s+label="Side"/, 'the Side filter renders on a sideless event');
  assert.match(page, /sorts=\{SORT_OPTIONS\.filter\(\(o\) => hasSides \|\| o\.value !== 'side'\)/, 'Sort ▾ offers Side on a sideless event');
  assert.match(page, /hasSides && \(teamRaw === 'bride' \|\| teamRaw === 'groom'\)/, 'a ?team=bride link still filters a sideless event');
  assert.match(page, /!hasSides && sortRaw === 'side'/, 'a ?sort=side link still sorts a sideless event by side');
  assert.match(page, /hasSides \? groupingRaw : groupingRaw\.filter\(\(k\) => k !== 'side'\)/, 'side headings survive on a sideless event');
  assert.match(page, /<AddFromPeopleSheet[\s\S]*?showSides=\{hasSides\}/, 'the people picker asks for a side on a sideless event');
  for (const mount of ['<GuestListMultiselect', '<GuestMindMap', '<SummaryFacetBar']) {
    const at = page.indexOf(mount);
    assert.ok(at >= 0, `${mount} moved; re-anchor`);
    const props = page.slice(at, page.indexOf('/>', at));
    assert.match(props, /hasSides=\{hasSides\}/, `${mount} is not told whether the event has sides`);
  }
});

test('the roster table gates its Side column, bulk "Assign side…", and the phone side chip', () => {
  const ms = src('_components/guest-list-multiselect.tsx');
  // The columns are one list (lib/roster-columns.ts, #6192): a sideless event's
  // list has no Side, so the header, the cell and every colSpan follow it.
  assert.match(src('../../../../lib/roster-columns.ts'), /if \(!opts\.hasSides\) order = order\.filter\(\(c\) => c !== 'side'\)/, 'the Side column is offered on a sideless event');
  assert.match(ms, /defaultRosterColumns\(\{ anyUnsent, checkinOpen, hasSides \}\)/, 'the roster does not pass hasSides to its columns');
  assert.match(ms, /colSpan=\{2 \+ desk\.columns\.length\}/, 'a section heading spans a fixed count, not the drawn columns');
  assert.match(ms, /\.\.\.\(hasSides \? \(\['bride', 'groom', 'both'\] as GuestSide\[\]\) : \[\]\)\.map\(\(s\) => \(\{ key: `side:\$\{s\}`/, 'the bulk ⋯ offers "Set side" on a sideless event');
  assert.match(ms, /\{hasSides \? \(\s*<SideChipEditor eventId=\{eventId\} guest=\{guest\}>\s*<RowAvatar/, 'the phone row avatar opens a side editor on a sideless event');
});

test('the mind map has no sides either', () => {
  // The phone's own carousel and the arrange menu were retired by #6192 (one
  // head at every width); their Side controls are the RosterFilters dropdown
  // and Sort ▾, both gated above.
  const map = src('_components/guest-mind-map.tsx');
  assert.match(map, /for \(const side of hasSides \? BRANCH_SIDE_LAYOUT : \[\]\)/, 'the mind map grows side branches on a sideless event');
});

test('the empty Guest list speaks to any event, not only to a couple', () => {
  const page = src('page.tsx');
  assert.doesNotMatch(page, /the couple[’']s first invite/, 'a birthday is told to add "the couple\'s first invite" again');
  assert.match(page, /No guests yet\. Start by adding your first guest\./);
});
