/**
 * search-or-add.test.ts — SEARCH IS THE ADD on Guests. Owner 2026-10-24, verbatim: *"it is search or add for both
 * guests and suppliers"*; then 2026-10-25, verbatim: *"Yes, remove the + on the guest list. Typing in the search adds;
 * put From People, Import and Scan in the search results and the menu."* Measured on the RENDER (the real
 * `GuestsScreen`, `render-guests-screen.ts`) where a render can say it, else on the code with comments stripped:
 *
 *   1. the thumb row draws NO round ＋ (list and map) — the field is the add;
 *   2. a search with hits STARTS with "Add “…” as a guest" and the other ways in (From your people · Add with details ·
 *      Import a file · Paste many names), before the first hit — and that box is the first result the pin shows;
 *   3. a search with no hit says "Nobody matches “…”. Add them below.", its one add reads the same words, and the same
 *      ways sit under it;
 *   4. the ≡ menu holds the same ways (one list, `ADD_WAYS`, opened by the imported openers), so an empty field has them;
 *   5. Enter with no match still adds (`addTyped`), and the typed Add row runs the SAME `addTyped`;
 *   6. nothing the search draws leaves the page; the phone's last copy (read-only) offers no add and no ways.
 *
 * "Scan" is in the owner's sentence but no scan-a-list way ships — not invented (DECISION_LOG 2026-10-25).
 * The Suppliers half is `vendors/search-or-add.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { guestRow as baseRow, renderGuestsScreen } from './render-guests-screen';
import type { GuestRow } from '@/lib/guests';
import { searchAddLabel, SEARCH_ADD_LABEL_MAX } from '@/components/search-add-row';

const guestRow = (over: Partial<GuestRow> = {}): GuestRow => baseRow({ custom_tags: [], ...over });

const LEAVES = /href="(\/explore|\/v\/|\/dashboard\/search)/;
const count = (html: string, s: string) => html.split(s).length - 1;
const HERE = dirname(fileURLToPath(import.meta.url));
const SCREEN = stripComments(readFileSync(join(HERE, 'guests-screen.tsx'), 'utf8'));
const SHEET = stripComments(readFileSync(join(HERE, 'add-guest-sheet.tsx'), 'utf8'));
const WAYS = ['From your people', 'Import a file'];

test('no round ＋ on the thumb row — list or map; the field is the add', async () => {
  for (const gview of ['list', 'map'] as const) {
    const html = await renderGuestsScreen({ guests: [guestRow({ first_name: 'Ben', last_name: 'Cruz' })], gview });
    assert.ok(html.includes('data-one-thumb-row') || html.includes('data-thumb'), `${gview}: the thumb row is not drawn — re-aim this guard`);
    assert.equal(count(html, 'data-testid="thumb-add"'), 0, `${gview}: the round ＋ is back`);
    assert.equal(count(html, 'data-tour="guests-plus"'), 0, `${gview}: the ＋ tour anchor is back`);
  }
  assert.ok(!/addRound|action=\{copy \? null :/.test(SCREEN), 'the screen hands the thumb row a main verb again');
});

test('a search with hits STARTS with the Add and the other ways, then the hits', async () => {
  const html = await renderGuestsScreen({
    guests: [guestRow({ first_name: 'Maria', last_name: 'Santos' }), guestRow({ first_name: 'Ben', last_name: 'Cruz' })],
    initialQuery: 'Maria',
  });
  assert.ok(html.includes('Santos'), 'the hit is drawn in place');
  assert.equal(count(html, 'data-search-add=""'), 1, 'exactly one Add row while searching');
  assert.ok(html.includes('aria-label="Add “Maria” as a guest"'), 'the row names what it adds');
  assert.ok(!html.includes('data-no-match'), 'a search with hits has no empty block');
  const box = html.indexOf('data-typed-add=""');
  assert.ok(box > -1, 'the typed add box is not drawn');
  // First: the Add, then every way in, all before the first hit.
  const firstHit = html.indexOf('Santos');
  assert.ok(html.indexOf('data-search-add') > box && html.indexOf('data-search-add') < firstHit, 'the Add row is not the first result');
  for (const w of WAYS) {
    const at = html.indexOf(`>${w}<`, box);
    assert.ok(at > box && at < firstHit, `"${w}" is not in the typed results, above the hits`);
  }
  // The pin (lib/search-pin.ts) shows the FIRST [data-search-result] — it must be this box, not a hit under it.
  assert.ok(html.indexOf('data-search-result=""') >= box && html.indexOf('data-search-result=""') < firstHit, 'the pin would skip the Add');
  assert.doesNotMatch(html, LEAVES);
});

test('a search with no hit points at the Add, in the same words', async () => {
  const html = await renderGuestsScreen({ guests: [guestRow({ first_name: 'Ben', last_name: 'Cruz' })], initialQuery: 'Zzyzx' });
  assert.ok(html.includes('data-no-match'), 'the empty block is drawn');
  assert.ok(html.includes('Nobody matches “Zzyzx”. Add them below.'), 'the empty line points at the Add');
  assert.equal(count(html, 'aria-label="Add “Zzyzx” as a guest"'), 1, 'one add, the same words as the row');
  assert.equal(count(html, 'data-search-add=""'), 0, 'no second add beside the empty block');
  // The same ways sit under the Add, inside the box the pin holds above the band.
  const none = html.indexOf('data-search-none=""');
  assert.ok(none > -1 && html.indexOf('aria-label="Add “Zzyzx” as a guest"') > none, 'the Add left the pinned box');
  for (const w of WAYS) assert.ok(html.indexOf(`>${w}<`, none) > none, `"${w}" is not under the no-match Add`);
  assert.doesNotMatch(html, LEAVES);
});

test('the read-only copy offers no add', async () => {
  const html = await renderGuestsScreen({
    guests: [guestRow({ first_name: 'Maria', last_name: 'Santos' })],
    initialQuery: 'Maria',
    copy: { freshness: 'failed', savedAt: Date.now() },
  });
  assert.equal(count(html, 'data-search-add=""'), 0);
  assert.equal(count(html, 'data-typed-ways=""'), 0, 'the read-only copy offers ways to add');
  assert.match(SCREEN, /const addWays: PickOption\[\] = writesOff\s*\? \[\]/, 'the read-only copy’s ≡ offers ways to add');
});

test('a view-only helper (owner 2026-09-28 · 2026-10-26) is offered no add — the same seam as the copy', async () => {
  const html = await renderGuestsScreen({
    guests: [guestRow({ first_name: 'Maria', last_name: 'Santos' })],
    initialQuery: 'Maria',
    viewOnly: true,
  });
  assert.equal(count(html, 'data-search-add=""'), 0, 'a view-only helper is offered “Add … as a guest”');
  assert.equal(count(html, 'data-typed-ways=""'), 0, 'a view-only helper is offered ways to add');
  assert.match(SCREEN, /const writesOff = copy !== null \|\| viewOnly;/, 'view-only no longer joins the copy’s “nothing that writes”');
  // …and the same list for a host still offers them (the seam is the prop, not a blanket hide).
  const host = await renderGuestsScreen({ guests: [guestRow({ first_name: 'Maria', last_name: 'Santos' })], initialQuery: 'Maria' });
  assert.ok(count(host, 'data-typed-ways=""') + count(host, 'data-search-add=""') > 0, 'the host lost the add');
});

test('≡ holds the same ways — ONE list, the imported openers — on the list AND the map', () => {
  for (const w of WAYS) assert.ok(SHEET.includes(`label: '${w}'`), `ADD_WAYS lost "${w}"`);
  assert.match(SCREEN, /ADD_WAYS\.map\(\(w\) =>/, 'the ≡ items are not read from the one list');
  const sort = SCREEN.slice(SCREEN.indexOf('const sortMenu: ThumbMenu'), SCREEN.indexOf('const arrangeMenu: ThumbMenu'));
  const map = SCREEN.slice(SCREEN.indexOf('const arrangeMenu: ThumbMenu'), SCREEN.indexOf('const [picks, setPicks]'));
  for (const [name, menu] of [['Sort', sort], ['Arrange', map]] as const) {
    assert.match(menu, /addWays,?\s*\)/, `${name} ≡ does not list the ways to add`);
    assert.match(menu, /if \(pickedAddWay\(k\)\) return;/, `${name} ≡ does not open a picked way`);
  }
  assert.match(SCREEN, /openAddWay\(k\.slice\(4\) as AddWayKey, eventId,/, 'a picked way is not opened by the shared opener');
  // The opener imports each sheet's own opener — never an event name typed by hand (capture-bar.tsx says why).
  const opener = SHEET.slice(SHEET.indexOf('export function openAddWay('));
  assert.match(opener, /openAddFromPeople\(\)/);
  assert.match(opener, /\/guests\/import`/);
  // 🔍 Owner 2026-10-27: "We do not need this on guests since our search bar provides the same feature" — the two ways are gone.
  assert.doesNotMatch(opener, /openQuickAdd\(\)|\/guests\/quick`/, 'Add with details / Paste many names came back');
  assert.ok(!SHEET.includes("label: 'Add with details'") && !SHEET.includes("label: 'Paste many names'"), 'a removed way is back in ADD_WAYS');
  assert.ok(!/setnayan:/.test(opener.slice(0, opener.indexOf('\n}'))), 'the opener re-dispatches an event name by hand');
});

test('Enter with no match still adds, and the typed Add row runs the same addTyped', () => {
  assert.match(SCREEN, /if \(typedLineIsAFilter\(v, facts, filterLabels\)\) return;\s*addTyped\(v\);/, 'Enter no longer adds');
  assert.match(SCREEN, /const addTypedOrSheet = \(v: string\) => \{\s*if \(addTyped\(v\) === NEEDS_BOTH_NAMES\) openAddGuest\(v\);/);
  assert.match(SCREEN, /<SearchAddRow query=\{q\} as="a guest" onAdd=\{addTypedOrSheet\} \/>/, 'the typed Add row does not add the way Enter does');
  assert.match(SCREEN, /onClick=\{\(\) => addTypedOrSheet\(q\)\}/, 'the no-match Add does not add the way Enter does');
});

test('the Add label fits a phone — a long name is clipped inside its quotes, the "as …" end stays', () => {
  assert.equal(searchAddLabel('Maria', 'a guest'), 'Add “Maria” as a guest');
  const long = searchAddLabel('Seda Vertis North Grand Ballroom and Gardens', 'your own supplier');
  assert.ok(long.length <= SEARCH_ADD_LABEL_MAX, long);
  assert.match(long, /…” as your own supplier$/);
});
