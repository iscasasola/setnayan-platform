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
  assert.match(page, /\{hasSides \? \(\s*<FacetRow label="Side">/, 'the desktop Side filter renders on a sideless event');
  assert.match(page, /hasSides && \(teamRaw === 'bride' \|\| teamRaw === 'groom'\)/, 'a ?team=bride link still filters a sideless event');
  assert.match(page, /!hasSides && sortRaw === 'side'/, 'a ?sort=side link still sorts a sideless event by side');
  assert.match(page, /hasSides \? groupingRaw : groupingRaw\.filter\(\(k\) => k !== 'side'\)/, 'side headings survive on a sideless event');
  assert.match(page, /<AddFromPeopleSheet[\s\S]*?showSides=\{hasSides\}/, 'the people picker asks for a side on a sideless event');
  for (const mount of ['<GuestListMultiselect', '<MobileGuestCarousel', '<GuestMindMap', '<SummaryFacetBar']) {
    const at = page.indexOf(mount);
    assert.ok(at >= 0, `${mount} moved; re-anchor`);
    const props = page.slice(at, page.indexOf('/>', at));
    assert.match(props, /hasSides=\{hasSides\}/, `${mount} is not told whether the event has sides`);
  }
});

test('the roster table gates its Side column, bulk "Assign side…", and the phone side chip', () => {
  const ms = src('_components/guest-list-multiselect.tsx');
  assert.match(ms, /\{hasSides \? \(\s*<ArrangeTh column="side"/, 'the Side column header renders on a sideless event');
  assert.match(ms, /\{hasSides \? \(\s*<td className="px-3 py-2\.5">\s*<SideChipEditor/, 'the Side cell renders on a sideless event');
  assert.match(ms, /\{hasSides \? \(\s*<>\s*<label className="sr-only" htmlFor="bulk-side">/, 'the bulk "Assign side…" renders on a sideless event');
  assert.match(ms, /colSpan=\{hasSides \? 9 : 8\}/, 'a section heading spans a column that is not there');
  assert.match(ms, /colSpan=\{hasSides \? 7 : 6\}/, 'a self-join row spans a column that is not there');
  assert.match(ms, /\{hasSides \? \(\s*<SideChipEditor eventId=\{eventId\} guest=\{guest\}>\s*<RowAvatar/, 'the phone row avatar opens a side editor on a sideless event');
});

test('the phone filter and Assign sheet, the arrange menu, and the mind map have no sides either', () => {
  const car = src('_components/mobile-guest-carousel.tsx');
  assert.match(car, /\{hasSides \? \(\s*<SegRow label="Side">/, 'the phone Side filter renders on a sideless event');
  assert.match(car, /\{hasSides \? \(\s*<SheetChoice\s+label="Side"/, 'the phone Assign sheet offers Side on a sideless event');
  const arr = src('_components/arrange-controls.tsx');
  assert.match(arr, /hasSides \? ARRANGE_COLUMNS : ARRANGE_COLUMNS\.filter\(\(c\) => c\.key !== 'side'\)/);
  const map = src('_components/guest-mind-map.tsx');
  assert.match(map, /for \(const side of hasSides \? BRANCH_SIDE_LAYOUT : \[\]\)/, 'the mind map grows side branches on a sideless event');
});

test('the empty Guest list speaks to any event, not only to a couple', () => {
  const page = src('page.tsx');
  assert.doesNotMatch(page, /the couple[’']s first invite/, 'a birthday is told to add "the couple\'s first invite" again');
  assert.match(page, /No guests yet\. Start by adding your first guest\./);
});
