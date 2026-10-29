/**
 * ⇅ R4 slice 1 — ONE THUMB ROW ON EVERY GUESTS VIEW, ONE SHOW · GROUP BY · SORT (owner 2026-10-29, Guests prototype v12–v26
 * `renderThumb` / `filterSheet` / `setShow`; the controller's brief: "⇅ = one PickMenu with Show / Group by / Sort
 * sections, one shared filter state kept in the URL, used by the carousel cards, List and Map").
 *
 * What this holds, each as a property (not a phrasing):
 *   1. the state round-trips through the address under its OWN words (`gshow` · `ggroup` · `gsort`) — never the page's
 *      `?group=` (a group id that narrows the server's read) or `?sort=`;
 *   2. each view's ⇅ lists exactly its sections (List: Show · Group by · Sort; Map: Show · Group by; Seats/March: Show),
 *      the current choice of each section marked, Side only where the event has sides;
 *   3. a pick changes only its own section; a key that is not the filter's is handed back to the view (null);
 *   4. Sort re-orders, never drops a row; Importance is the rows' own order;
 *   5. the carousel's count doors and the ⇅'s Show are ONE state; List and Map read ONE Group by;
 *   6. EVERY Guests view draws THE shared `ThumbRow` — List/Map in the screen, Seats/March into the screen's seat.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  NO_GUESTS_FILTER,
  applyGuestsFilterPick,
  guestsFilterIsOn,
  guestsFilterOptions,
  hrefWithGuestsFilter,
  listGroupOf,
  mapGroupOf,
  parseGuestsFilter,
  sortGuestsFor,
  writeGuestsFilter,
} from './guests-filter';
import { stripComments } from './strip-comments';

const read = (rel: string) => stripComments(readFileSync(join(__dirname, '..', rel), 'utf8'));

test('1 · the filter lives in the address under its own words, and a plain list stays bare', () => {
  const f = { show: 'declined' as const, group: 'side' as const, sort: 'table' as const };
  const qs = writeGuestsFilter(new URLSearchParams('part=screen&gview=map&group=S89G-ABC'), f);
  assert.equal(qs.get('gshow'), 'declined');
  assert.equal(qs.get('ggroup'), 'side');
  assert.equal(qs.get('gsort'), 'table');
  // The page's own `?group=` (a group id) and every other word are left alone.
  assert.equal(qs.get('group'), 'S89G-ABC');
  assert.equal(qs.get('gview'), 'map');
  assert.deepEqual(parseGuestsFilter(qs), f);
  assert.deepEqual(parseGuestsFilter({ gshow: 'declined', ggroup: 'side', gsort: 'table' }), f, 'the server’s searchParams read differently');
  // Unknown words are dropped, never guessed; the defaults write nothing.
  assert.deepEqual(parseGuestsFilter({ gshow: 'maybe', ggroup: 'table', gsort: 'recent' }), NO_GUESTS_FILTER);
  assert.equal(writeGuestsFilter(new URLSearchParams(), NO_GUESTS_FILTER).toString(), '');
  // A view switch carries it.
  assert.equal(hrefWithGuestsFilter('/dashboard/e/guests?gview=seats', { ...NO_GUESTS_FILTER, show: 'none' }), '/dashboard/e/guests?gview=seats&gshow=none');
  assert.equal(hrefWithGuestsFilter('/dashboard/e/guests', NO_GUESTS_FILTER), '/dashboard/e/guests');
});

test('2 · each view’s ⇅ lists its own sections, the current choice marked, Side only with sides', () => {
  const groups = (v: Parameters<typeof guestsFilterOptions>[0], sides = true) =>
    [...new Set(guestsFilterOptions(v, NO_GUESTS_FILTER, { hasSides: sides }).map((o) => o.group))];
  assert.deepEqual(groups('list'), ['Show', 'Group by', 'Sort']);
  assert.deepEqual(groups('map'), ['Show', 'Group by']);
  assert.deepEqual(groups('seats'), ['Show']);
  assert.deepEqual(groups('march'), ['Show']);
  const list = guestsFilterOptions('list', { show: 'attending', group: 'group', sort: 'name' }, { hasSides: true });
  assert.deepEqual(list.filter((o) => o.on).map((o) => o.key), ['show:attending', 'group:group', 'sort:name'], 'one ✓ per section');
  // The List keeps all five shipped groupings (Last name included); the Map its four.
  assert.deepEqual(list.filter((o) => o.group === 'Group by').map((o) => o.key), ['group:role', 'group:last_name', 'group:side', 'group:group', 'group:rsvp']);
  const map = guestsFilterOptions('map', NO_GUESTS_FILTER, { hasSides: true });
  assert.deepEqual(map.filter((o) => o.group === 'Group by').map((o) => o.key), ['group:side', 'group:role', 'group:rsvp', 'group:group']);
  assert.ok(map.find((o) => o.key === 'group:side')!.on, 'the Map’s shipped default (Side) is not the one marked');
  for (const v of ['list', 'map'] as const) {
    assert.ok(!guestsFilterOptions(v, NO_GUESTS_FILTER, { hasSides: false }).some((o) => o.key === 'group:side'), `${v} offers Side on a sideless event`);
  }
});

test('3 · a pick changes only its own section; anything else goes back to the view', () => {
  const f = { show: 'none' as const, group: 'rsvp' as const, sort: 'table' as const };
  assert.deepEqual(applyGuestsFilterPick(f, 'show:all'), { ...f, show: null });
  assert.deepEqual(applyGuestsFilterPick(f, 'show:toinvite'), { ...f, show: 'toinvite' });
  assert.deepEqual(applyGuestsFilterPick(f, 'group:side'), { ...f, group: 'side' });
  assert.deepEqual(applyGuestsFilterPick(f, 'sort:importance'), { ...f, sort: 'importance' });
  for (const k of ['select', 'add:people', 'plus:named', 'people', 'guests-excel']) assert.equal(applyGuestsFilterPick(f, k), null, `${k} was eaten by the filter`);
  // One Group by for both: the Map draws the shared choice where it can, else its own default.
  assert.equal(listGroupOf(NO_GUESTS_FILTER), 'role');
  assert.equal(mapGroupOf({ ...NO_GUESTS_FILTER, group: 'rsvp' }, true), 'rsvp');
  assert.equal(mapGroupOf({ ...NO_GUESTS_FILTER, group: 'last_name' }, true), 'side');
  assert.equal(mapGroupOf({ ...NO_GUESTS_FILTER, group: 'side' }, false), 'role');
  assert.equal(guestsFilterIsOn(NO_GUESTS_FILTER, 'list'), false);
  assert.equal(guestsFilterIsOn({ ...NO_GUESTS_FILTER, sort: 'name' }, 'list'), true);
  assert.equal(guestsFilterIsOn({ ...NO_GUESTS_FILTER, sort: 'name' }, 'map'), false, 'the Map’s dot lights for a Sort it does not have');
});

test('4 · Sort re-orders the same rows; Importance is the rows’ own order', () => {
  const g = (id: string, first: string, last: string) => ({ guest_id: id, first_name: first, last_name: last });
  const rows = [g('1', 'Zed', 'Cruz'), g('2', 'Ana', 'Reyes'), g('3', 'Mia', 'Lim'), g('4', 'Ben', 'Tan')];
  const tables: Record<string, string> = { '1': 'Table 10', '3': 'Table 2' };
  assert.equal(sortGuestsFor(rows, 'importance', () => null), rows);
  assert.deepEqual(sortGuestsFor(rows, 'name', () => null).map((r) => r.guest_id), ['2', '4', '3', '1']);
  assert.deepEqual(sortGuestsFor(rows, 'table', (id) => tables[id] ?? null).map((r) => r.guest_id), ['3', '1', '2', '4'], 'Table 2 before Table 10, the unseated last');
  assert.equal(sortGuestsFor(rows, 'table', () => null).length, rows.length);
});

test('5 · the count doors, the ⇅ and the views read ONE state, kept in the address', () => {
  const screen = read('app/dashboard/[eventId]/guests/_components/guests-screen.tsx');
  assert.match(screen, /const replyFilter = filter\.show;/, 'the count doors keep a Show of their own');
  assert.match(screen, /const view: RosterView = listGroupOf\(filter\);/, 'the List keeps a Group by of its own');
  assert.match(screen, /const arrange: MapArrange = mapGroupOf\(filter, hasSides\);/, 'the Map keeps a Group by of its own');
  assert.doesNotMatch(screen, /useState<ReplyFilter|useState<RosterView>|useState<MapArrange>/, 'a second filter state is back');
  assert.match(screen, /writeGuestsFilter\(url\.searchParams, filter\)/, 'the filter does not reach the address');
  assert.match(screen, /sortGuestsFor\(narrowed, filter\.sort,/, 'Sort does not order the list');
  const page = read('app/dashboard/[eventId]/guests/page.tsx');
  assert.match(page, /filter=\{parseGuestsFilter\(search\)\}/, 'a reload loses the filter');
});

test('6 · every Guests view draws THE shared ThumbRow', () => {
  const screen = read('app/dashboard/[eventId]/guests/_components/guests-screen.tsx');
  assert.match(screen, /<ThumbRow\s+name="guests"/, 'List');
  assert.match(screen, /name="guests-map"/, 'Map');
  assert.match(screen, /<GuestsLensContext\.Provider value=\{lens\}>/, 'Seats and March get no lens');
  assert.match(screen, /slot: thumbSlot,\s*ThumbRow,/, 'the lens does not hand the makers THE row');
  assert.match(screen, /data-guests-thumb-slot=\{gview\}/, 'no seat for the makers’ row');
  const seats = read('app/dashboard/[eventId]/seating/_components/seating-editor.tsx');
  const march = read('app/dashboard/[eventId]/launch/_components/details-march.tsx');
  for (const [name, src, view] of [
    ['guests-seats', seats, 'seats'],
    ['guests-march', march, 'march'],
  ] as const) {
    assert.match(src, new RegExp(`useGuestsLens\\('${view}'\\)`), `${view} does not read the lens`);
    assert.match(src, new RegExp(`<lens\\.ThumbRow\\s+name="${name}"`), `${view} does not draw the shared row`);
    // Handed down by the lens, never imported: the maker is also the Maker's lazy piece (its CSS module would follow).
    assert.doesNotMatch(src, /from '@\/components\/thumb-row'/, `${view} imports the row instead of taking the lens’s`);
    assert.match(src, /guestsFilterMenu\(\{\s*view: '(seats|march)',\s*filter: lens\.filter,\s*onFilter: lens\.setFilter,/, `${view}’s ⇅ is not the shared Show`);
    assert.match(src, /lens\.slot,\s*\)\s*: null;/, `${view} draws its row somewhere else`);
  }
  // March's ＋ is the shipped move from the tray — nothing new is written.
  assert.match(march, /run\(planMove\(shown, shownPrinted, \{ kind: 'out', id \}, \{ kind: 'gap', section: o\.section,/);
});
