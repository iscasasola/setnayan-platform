/**
 * a-search-that-adds-shows-add.test.ts — SEARCH OR ADD: THE MAGNIFYING GLASS BECOMES ＋, ONLY WHERE A SEARCH CAN ADD.
 *
 * Owner, 18–19 Nov 2026, verbatim: *"so we also do no need an add button because. our text box is search / add
 * feature"* · *"if there is no search and needs to be added the magnifying glass icon changes to add"* · *"if ever they
 * search but they want to add. they tap that search icon to become add icon"* · *"perfect search and add bar is good.
 * tap the magnifying glass to convert it to add."* · *"not all search bar converts to add. just only those that needs
 * conversion"* · colour: *"if we are adding the text goes red as well / search is black / Private is blue"* ·
 * the morph: *"search to add OK"*.
 *
 *   1 · no match → ＋ (`data-mode=add`); a match → 🔍; an empty box → 🔍 (rendered through the real ThumbRow);
 *   2 · a tap on 🔍 while there are matches → ＋; as ＋ the tap adds; on an empty box it is still tap-and-type;
 *   3 · the field keeps the cursor after an icon tap (the press is refused its default, pointer and mouse);
 *   4 · a row WITHOUT `onAdd` never shows ＋ — the plain magnifier, no mode; the shared SearchBox the same;
 *   5 · no list that adopted Search-or-add still seats a separate ＋ Add beside it, unless it is listed as KEPT;
 *   6 · every way the removed buttons opened is still reachable — each `ADD_WAYS` entry, Clients' sheet, "Add your own";
 *   7 · add = red (`--color-mulberry`) icon AND typed words; search = ink; no other red, and never the private blue;
 *   8 · the morph is the drawing's: one svg, ring · bar1 · bar2, ① Quick ② Quick ③ Move on Settle, back the exact
 *       reverse, by transitions on `data-mode` (no keyframes), reduced motion = at once;
 *   9 · as ＋, Enter adds what was typed.
 *
 * Sabotage — RUN 2026-11-19, eleven ways, each red then restored: `if (!matches) return 'add'` → `'search'` (1) ·
 * `return words ? held : false` → `return held` (2 — clearing no longer lets go) · → `return words` (2 — a no-match
 * holds) · `return asked ? 'add' : 'search'` → always `'search'` (2) ·
 * `onPointerDown={holdFocus}` removed from the icon (3) · `{adds ? (` → `{true ? (` in thumb-row.tsx (4) · an `action=`
 * seat put back on the Guests List row (5) · `<TypedWays …>` dropped from Guests' empty-field box (6) · the add colour
 * changed to `--color-danger` (7) · the typed words' red `color` removed (7 — this one stayed GREEN on the first run:
 * `/color: …/` was matching inside `caret-color:`; every colour assert now refuses a leading `-`) · bar1's `rotate`
 * delay dropped (8) · `adds?.onAdd(` removed from the Enter handler (9).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type * as RowMod from '@/components/thumb-row';
import type * as AddMod from '@/components/search-add';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  Mod._extensions['.css'] = (m: { exports: unknown }) => {
    m.exports = new Proxy({}, { get: (_t, k) => (k === '__esModule' ? false : String(k)) });
  };
}
const { ThumbRow } = require('@/components/thumb-row') as typeof RowMod;
const { searchAddMode, searchAddPress, searchAddHeld, pressOnTouchEnd, searchAddDrag, SEARCH_ADD_DRAG_PX } = require('@/components/search-add') as typeof AddMod;
const { holdFocus } = require('@/components/clear-field') as { holdFocus: (e: { preventDefault: () => void }) => void };

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const CSS = read('components/search-add.module.css');
const PART = read('components/search-add.tsx');
const ROW = read('components/thumb-row.tsx');
const BOX = read('app/_components/search-box.tsx');
const GUESTS = read('app/dashboard/[eventId]/guests/_components/guests-screen.tsx');
const GUEST_SHEET = read('app/dashboard/[eventId]/guests/_components/add-guest-sheet.tsx');
const GUEST_DOORS = read('app/dashboard/[eventId]/guests/_components/capture-bar.tsx');
const FIND = read('app/dashboard/[eventId]/vendors/_components/find-thumb-row.tsx');
const CLIENTS_PAGE = read('app/vendor-dashboard/customers/page.tsx');
const CLIENTS_SEARCH = read('app/vendor-dashboard/customers/_components/clients-search.tsx');
const CLIENTS_ADD = read('app/vendor-dashboard/customers/_components/outside-client-add.tsx');

const row = (field: Record<string, unknown>) => renderToStaticMarkup(createElement(ThumbRow, { name: 't', field: { placeholder: 'Search guests', ...field } as never }));
const modeOf = (html: string) => /data-search-add-icon=""[^>]*data-mode="(\w+)"/.exec(html)?.[1] ?? null;
/** The body of the CSS rule whose selector is exactly `sel`. */
function rule(sel: string): string {
  const at = CSS.indexOf(`${sel} {`);
  assert.ok(at >= 0, `search-add.module.css has no rule “${sel}”`);
  return CSS.slice(CSS.indexOf('{', at) + 1, CSS.indexOf('}', at));
}
function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(n) && !/\.test\.tsx?$/.test(n)) out.push(p);
  }
  return out;
}

/** The lists that adopted Search-or-add. */
const ADOPTED: readonly { file: string; rowStart: string; rowEnd: string }[] = [
  { file: 'app/dashboard/[eventId]/guests/_components/guests-screen.tsx', rowStart: '<ThumbRow\n        name="guests"', rowEnd: '\n      />' },
  { file: 'app/dashboard/[eventId]/vendors/_components/find-thumb-row.tsx', rowStart: '<ThumbRow\n        name="suppliers-find"', rowEnd: '\n      />' },
  { file: 'app/vendor-dashboard/customers/_components/clients-search.tsx', rowStart: '', rowEnd: '' },
];
/** Rows that keep a ＋ beside a search, on purpose — each with its reason. */
const KEPT: Readonly<Record<string, string>> = {
  'guests-map': 'the Map row did NOT adopt Search-or-add (its field only finds a seat on the map; `onAdd` is handed to the List alone) — its ＋ Add guest opens the shipped add sheet',
};

test('1 · no match → ＋; a match → 🔍; an empty box → 🔍', () => {
  assert.equal(searchAddMode({ words: true, matches: false, asked: false }), 'add', 'nothing matches and it still searches');
  assert.equal(searchAddMode({ words: true, matches: true, asked: false }), 'search', 'something matches and it already adds');
  assert.equal(searchAddMode({ words: false, matches: false, asked: false }), 'search', 'an empty box adds');
  assert.equal(searchAddMode({ words: false, matches: false, asked: true }), 'search', 'a cleared box stays ＋');
  const add = () => {};
  assert.equal(modeOf(row({ onAdd: add, query: 'Anabel', matches: false })), 'add');
  assert.equal(modeOf(row({ onAdd: add, query: 'Ana', matches: true })), 'search');
  assert.equal(modeOf(row({ onAdd: add, query: '', matches: false })), 'search');
  assert.ok(row({ onAdd: add, query: 'Anabel', matches: false }).includes('data-search-mode="add"'));
});

test('2 · a tap on 🔍 while there are matches → ＋; as ＋ the tap adds; empty, it is still tap and type', () => {
  assert.equal(searchAddPress('Ana', 'search'), 'ask', 'a tap on 🔍 over words does not ask for the add');
  assert.equal(searchAddMode({ words: true, matches: true, asked: true }), 'add', 'asked for, with matches, it still searches');
  assert.equal(searchAddPress('Ana', 'add'), 'add', 'a tap on ＋ does not add');
  assert.equal(searchAddPress('   ', 'search'), 'focus', 'a tap on an empty search does not put the cursor in it');
  assert.match(PART, /if \(act === 'focus'\) input\.focus\(\{ preventScroll: true \}\);\s*else if \(act === 'ask'\) setHeld\(true\);\s*else add\.onAdd\(typed\);/);
  // The hold rule (owner 19 Nov, as changed): ＋ holds ONLY when they tapped 🔍; a ＋ that came by itself is not held.
  assert.equal(searchAddHeld(false, { words: true }), false, 'a ＋ that came by itself (nothing matched) is held — it must go back to 🔍 when the words match again');
  assert.equal(searchAddHeld(true, { words: true }), true, 'a ＋ they tapped for does not hold while the box has words');
  assert.equal(searchAddHeld(true, { words: false }), false, 'clearing the box does not return it to 🔍');
  // By itself: no match → ＋, the words match again → 🔍. Tapped: ＋ over matches, and it stays.
  const auto = searchAddHeld(false, { words: true });
  assert.equal(searchAddMode({ words: true, matches: false, asked: auto }), 'add');
  assert.equal(searchAddMode({ words: true, matches: true, asked: auto }), 'search', 'after a no-match, words that match again leave it ＋');
  assert.equal(searchAddMode({ words: true, matches: true, asked: searchAddHeld(true, { words: true }) }), 'add', 'a tapped ＋ went back to 🔍 while the words match');
  assert.match(PART, /useEffect\(\(\) => \{\s*setHeld\(\(h\) => searchAddHeld\(h, \{ words \}\)\);\s*\}, \[words\]\);/, 'the hook does not let go of ＋ when the box is cleared');
  assert.doesNotMatch(PART, /setHeld\((?!\(h\) => searchAddHeld|true\))/, 'something other than the tap holds ＋');
  // 👉 Dragged right (Guests redesign pick 1, 20 Nov) is asking for the add too — Enter is then the add outright.
  assert.match(PART, /return \{ mode, asked: mode === 'add' && \(matches \|\| dragged === 'add'\), press, drag, forget \};/, 'as ＋ over matches, Enter is not the add outright');
  assert.match(ROW, /<SearchAddIcon mode=\{searchAdd\.mode\} onPress=\{\(\) => searchAdd\.press\(ownInput\.current\)\}/);
});

test('3 · the field keeps the cursor after an icon tap', () => {
  const icon = /<button\s+type="button"\s+data-search-add-icon=""[\s\S]*?>/.exec(PART)?.[0] ?? '';
  assert.ok(icon, 'the icon is not a button');
  assert.match(icon, /onPointerDown=\{holdFocus\}/, 'a touch on the icon takes the cursor');
  assert.match(icon, /onMouseDown=\{holdFocus\}/, 'a click on the icon takes the cursor');
  // A finger's press is its touchend (a refused pointerdown may take the click with it) — once, never a click after it.
  assert.match(icon, /onTouchEnd=\{pressOnTouchEnd\(onPress\)\}/, 'a finger on the icon waits for a click that may never come');
  assert.match(icon, /onClick=\{onPress\}/, 'a mouse or the keyboard cannot press the icon');
  const rect = { getBoundingClientRect: () => ({ left: 10, right: 54, top: 10, bottom: 54 }) };
  const touch = (x: number, y: number, cancelable = true) => {
    const seen = { pressed: 0, refused: 0 };
    pressOnTouchEnd(() => void seen.pressed++)({ cancelable, preventDefault: () => void seen.refused++, currentTarget: rect, changedTouches: { length: 1, 0: { clientX: x, clientY: y } } });
    return seen;
  };
  assert.deepEqual(touch(30, 30), { pressed: 1, refused: 1 }, 'a tap on the icon is not ONE press with its click refused');
  assert.deepEqual(touch(30, 30, false), { pressed: 0, refused: 0 }, 'a scroll that began on the icon presses it');
  assert.deepEqual(touch(80, 30), { pressed: 0, refused: 0 }, 'a finger that left the icon presses it');
  let refused = 0;
  holdFocus({ preventDefault: () => void refused++ });
  assert.equal(refused, 1, 'holdFocus does not refuse the press its default (the focus would move)');
  assert.match(GUESTS, /data-empty-ways="" onPointerDown=\{holdFocus\} onMouseDown=\{holdFocus\}/);
  assert.match(CLIENTS_SEARCH, /className=\{styles\.addRow\} onPointerDown=\{holdFocus\} onMouseDown=\{holdFocus\}/);
  assert.match(FIND, /data-find-add-own=""\s+onMouseDown=\{holdFocus\}/);
});

test('4 · a search WITHOUT onAdd never shows ＋ — the plain magnifier, no mode', () => {
  for (const f of [{}, { query: 'Zzyzx', matches: false }, { query: 'Zzyzx', matches: false, onAdd: undefined }]) {
    const html = row(f);
    assert.ok(!html.includes('data-search-add-icon'), 'a search with nothing to add wears the 🔍 → ＋ icon');
    assert.ok(!html.includes('data-mode='), 'a search with nothing to add has a mode');
    assert.ok(!html.includes('data-search-mode'), 'a search with nothing to add has a mode on its seat');
    assert.match(html, /<svg[^>]*class="[^"]*glyph/, 'anti-vacuity: the plain magnifier is not drawn');
  }
  assert.ok(!row({ kind: 'date', onAdd: () => {}, query: 'x', matches: false }).includes('data-search-add-icon'));
  assert.match(BOX, /\{add \? \(\s*<SearchAddIcon\b[\s\S]{0,260}\) : \(\s*<Search aria-hidden/);
  assert.match(BOX, /useSearchAdd\(add \? \{[^}]*\} : null\)/);
  assert.match(PART, /const ruled: SearchAddMode = add \? searchAddMode\(\{ words, matches, asked: held \}\) : 'search';/);
  // A drag only ever applies to a search handed `onAdd` — without it the mode is the ruled 'search'.
  assert.match(PART, /const mode: SearchAddMode = add && dragged \? dragged : ruled;/);
  // Only the three lists hand it over. (⚠ this scan's pattern is untested — tune it on the first run.)
  const hosts = walk(join(WEB, 'app')).concat(walk(join(WEB, 'components')))
    .filter((f) => {
      const s = stripComments(readFileSync(f, 'utf8'));
      return (/<ThumbRow\b/.test(s) && /\bonAdd: (writesOff|addTyped)/.test(s)) || /<SearchBox\b[\s\S]{0,400}\badd=\{\{/.test(s);
    })
    .map((f) => f.slice(WEB.length + 1))
    .sort();
  assert.deepEqual(hosts, ADOPTED.map((a) => a.file).sort(), 'the lists whose search adds changed — list the new one in ADOPTED, with its add ways');
});

test('5 · no adopted list still seats a separate ＋ Add beside the search — unless it is listed as kept', () => {
  const g = GUESTS.slice(GUESTS.indexOf(ADOPTED[0]!.rowStart));
  const guestsRow = g.slice(0, g.indexOf(ADOPTED[0]!.rowEnd));
  assert.ok(guestsRow.includes('field={field}'), 'the Guests List row moved — re-aim this guard');
  assert.doesNotMatch(guestsRow, /\baction=/, 'Guests › List seats a ＋ Add beside the field that adds');
  assert.doesNotMatch(GUESTS, /const addMenu\b|data-thumb-add-menu/, 'the ＋ Add ▾ menu is back on Guests');
  assert.match(GUESTS, /onAdd: writesOff \|\| gview !== 'list' \? undefined : addTypedOrSheet,\s*query: q,\s*matches: !noMatch,/, 'Guests’ field does not add');
  const f = FIND.slice(FIND.indexOf(ADOPTED[1]!.rowStart));
  const findRow = f.slice(0, f.indexOf(ADOPTED[1]!.rowEnd));
  assert.ok(findRow.includes('onAdd: addTyped,'), 'the Find row does not add');
  assert.doesNotMatch(findRow, /\baction=/, 'Suppliers › Find seats a ＋ beside the field that adds');
  const at = CLIENTS_PAGE.indexOf('<ThumbRow\n            name="customers"');
  const clientsRow = CLIENTS_PAGE.slice(at, CLIENTS_PAGE.indexOf('\n          />', at));
  assert.ok(at > -1 && clientsRow.includes('<ClientsSearch'), 'the Clients row moved — re-aim this guard');
  assert.doesNotMatch(clientsRow, /\baction=/, 'Clients seats a ＋ Add beside the search that adds');
  assert.match(CLIENTS_PAGE, /<OutsideClientAdd\s+trigger=\{false\}/, 'the Clients add sheet draws its own ＋ Add again');
  assert.match(CLIENTS_ADD, /\{trigger \? \(\s*<ActionButton tone="brand" main icon=\{Plus\}/);
  assert.deepEqual(Object.keys(KEPT), ['guests-map']);
  assert.match(GUESTS, /name="guests-map"\s+field=\{field\}\s+right=\{\[arrangeMenu\]\}\s+action=\{writesOff \? null : \{ icon: Plus, label: 'Add guest'/);
  assert.match(GUESTS, /gview !== 'list' \? undefined : addTypedOrSheet/, 'the Map’s field adds AND keeps its ＋');
});

test('6 · every add way the buttons opened is still reachable', () => {
  const ways = [...GUEST_SHEET.matchAll(/\{ key: '(\w+)', label: '([^']+)' \}/g)].map((m) => m[2]!);
  assert.ok(ways.length >= 2, 'anti-vacuity: ADD_WAYS was not read');
  const doors = GUEST_DOORS.slice(GUEST_DOORS.indexOf('export function AddDoors('));
  for (const w of ways) assert.ok(doors.includes(`'${w}'`), `ADD_WAYS “${w}” is not a door AddDoors draws`);
  assert.match(GUESTS, /function TypedWays\([\s\S]{0,400}<AddDoors eventId=\{eventId\} rows \/>/);
  assert.match(GUESTS, /\{fieldOn && !q && gview === 'list' && !selectMode && !writesOff \? \(\s*<div className=\{styles\.emptyWays\} data-empty-ways=""[^>]*>\s*<TypedWays eventId=\{eventId\}/, 'the EMPTY Guests field offers no other way to add');
  assert.match(GUESTS, /onFocus: \(\) => \{\s*loadPeople\(\);\s*setFieldOn\(true\);\s*\},\s*onBlur: \(\) => setFieldOn\(false\),/, 'the empty-field ways never show (or never leave)');
  assert.ok((GUESTS.match(/<TypedWays eventId=\{eventId\}/g) ?? []).length >= 3, 'the typed results or the no-match add lost the other ways');
  assert.match(GUESTS, /const addTypedOrSheet = \(v: string\) => \{\s*if \(addTyped\(v\) === NEEDS_BOTH_NAMES\) openAddGuest\(v\);/);
  assert.match(CLIENTS_SEARCH, /add=\{\{ matches, onAdd: openOutsideClientAdd \}\}/);
  assert.match(CLIENTS_SEARCH, /onClick=\{\(\) => openOutsideClientAdd\(''\)\}>[\s\S]{0,120}Add a booking from outside/);
  assert.match(CLIENTS_PAGE, /<ClientsEmptyAdd \/>/, 'the empty Clients search offers no add');
  assert.match(CLIENTS_ADD, /window\.addEventListener\(OPEN_EVENT, onOpen\);/, 'the sheet does not hear the search');
  assert.match(CLIENTS_ADD, /if \(typed\) setName\(typed\);\s*setOpen\(true\);/, 'the typed name does not ride into the sheet');
  assert.match(CLIENTS_PAGE, /<OutsideClientAdd\s+trigger=\{false\}[\s\S]{0,200}action=\{importExternalClient\}/);
  assert.match(read('app/vendor-dashboard/customers/_components/clients-search.module.css'), /:global\(\[data-supplier-thumb\]\):has\(:global\(input\[data-search-input\]\):focus:placeholder-shown\) > \.emptyAdd \{ display: block; \}/, 'the empty-search add row never shows');
  assert.match(FIND, /const addTyped = \(typed: string\) => \{[\s\S]{0,160}onAdd\(typed\);\s*\};/);
  assert.match(FIND, /data-find-add-own=""\s+onMouseDown=\{holdFocus\}\s+onClick=\{\(\) => addTyped\(''\)\}/, 'the empty Find box lost “Add your own”');
  assert.match(FIND, /const showPanel = open && up && text\.trim\(\) === '';/, 'the empty box only opens when it has a category list');
  assert.match(FIND, /onFocus: \(\) => setOpen\(true\),/);
});

test('7 · add = red icon AND red words (the CTA red); search = ink; no other red, never the private blue', () => {
  assert.match(rule('.icon'), /(?<![-\w])color: rgb\(var\(--color-ink\)\);/, 'the search icon is not ink');
  assert.match(rule(".icon[data-mode='add']"), /(?<![-\w])color: rgb\(var\(--color-mulberry\)\);/, 'the add icon is not the CTA red');
  assert.match(rule(".icon[data-mode='add'] ~ input"), /(?<![-\w])color: rgb\(var\(--color-mulberry\)\);/, 'the words typed while adding are not red');
  assert.match(rule(".icon[data-mode='search'] ~ input"), /(?<![-\w])color: rgb\(var\(--color-ink\)\);/, 'the words typed while searching are not ink');
  assert.match(CSS, /\.mg \* \{[^}]*stroke: currentColor;/, 'the strokes do not take the icon’s colour');
  const colours = [...CSS.matchAll(/--color-[a-z0-9-]+/g)].map((m) => m[0]);
  assert.deepEqual([...new Set(colours)].sort(), ['--color-ink', '--color-mulberry'], 'another colour is in the search-or-add icon');
  assert.doesNotMatch(CSS, /#[0-9a-fA-F]{3,8}\b|--color-private|--color-danger/);
  assert.ok(ROW.indexOf('<SearchAddIcon') < ROW.indexOf('<input'), 'thumb-row: the icon is not before the input');
  assert.ok(BOX.indexOf('<SearchAddIcon') < BOX.indexOf('ref={field}'), 'search-box: the icon is not before the input');
});

test('8 · the morph is the drawing’s — ① ring Quick ② bars Quick ③ turn Move, back the exact reverse, by transitions', () => {
  assert.match(PART, /<circle className=\{`mg-ring \$\{styles\.ring\}`\} cx="12" cy="12" r="6\.5" \/>\s*<line className=\{`mg-bar1 \$\{styles\.bar1\}`\} x1="0" y1="-5" x2="0" y2="5" \/>\s*<line className=\{`mg-bar2 \$\{styles\.bar2\}`\} x1="0" y1="-5" x2="0" y2="5" \/>/);
  assert.equal((PART.match(/<svg\b/g) ?? []).length, 1);
  assert.match(rule('.ring'), /transform-origin: 12px 12px; translate: -1\.5px -1\.5px; scale: 1;/);
  assert.match(rule(".icon[data-mode='add'] .ring"), /translate: 0px 0px; scale: 1\.615; stroke-width: 1\.24;/);
  assert.match(rule('.bar1'), /translate: 17\.55px 17\.55px; rotate: -45deg; stroke-dasharray: 6\.9 20; stroke-dashoffset: -1\.55;/);
  assert.match(rule(".icon[data-mode='add'] .bar1"), /translate: 12px 12px; rotate: 0deg; stroke-dasharray: 10 20; stroke-dashoffset: 0;/);
  assert.match(rule('.bar2'), /opacity: 0; translate: 12px 12px; rotate: 45deg; stroke-dasharray: 0 20; stroke-dashoffset: -5;/);
  assert.match(rule(".icon[data-mode='add'] .bar2"), /opacity: 1; rotate: 90deg; stroke-dasharray: 10 20; stroke-dashoffset: 0;/);
  const Q = 'var\\(--sn-m-quick\\)', M = 'var\\(--sn-m-move\\)', S = 'var\\(--sn-m-settle\\)';
  assert.match(rule(".icon[data-mode='add'] .ring"), new RegExp(`transition: translate ${Q} ${S}, scale ${Q} ${S}, stroke-width ${Q} ${S};`), '① is not the ring, at once, in Quick');
  assert.match(rule(".icon[data-mode='add'] .bar1"), new RegExp(`rotate ${M} ${S} calc\\(${Q} \\* 2\\),\\s*translate ${Q} ${S} ${Q},\\s*stroke-dasharray ${Q} ${S} ${Q},\\s*stroke-dashoffset ${Q} ${S} ${Q};`), '② / ③ are out of step on bar1');
  assert.match(rule(".icon[data-mode='add'] .bar2"), new RegExp(`rotate ${M} ${S} calc\\(${Q} \\* 2\\),\\s*opacity ${Q} ${S} ${Q},\\s*stroke-dasharray ${Q} ${S} ${Q},\\s*stroke-dashoffset ${Q} ${S} ${Q};`), '② / ③ are out of step on bar2');
  assert.match(rule(".icon[data-mode='add']"), new RegExp(`transition: color ${M} ${S} calc\\(${Q} \\* 2\\);`), 'the red does not arrive with the turn');
  assert.match(rule('.bar1'), new RegExp(`rotate ${M} ${S},\\s*translate ${Q} ${S} ${M},\\s*stroke-dasharray ${Q} ${S} ${M},\\s*stroke-dashoffset ${Q} ${S} ${M};`), 'back is not the reverse on bar1');
  assert.match(rule('.bar2'), new RegExp(`rotate ${M} ${S},\\s*opacity ${Q} ${S} ${M},\\s*stroke-dasharray ${Q} ${S} ${M},\\s*stroke-dashoffset ${Q} ${S} ${M};`), 'back is not the reverse on bar2');
  assert.match(rule('.ring'), new RegExp(`translate ${Q} ${S} calc\\(${M} \\+ ${Q}\\),\\s*scale ${Q} ${S} calc\\(${M} \\+ ${Q}\\),\\s*stroke-width ${Q} ${S} calc\\(${M} \\+ ${Q}\\);`), 'back, the ring is not last');
  assert.match(rule('.icon'), new RegExp(`transition: color ${M} ${S};`));
  assert.doesNotMatch(CSS, /@keyframes|animation|infinite/, 'the morph loops or plays on the first drawing');
  assert.doesNotMatch(CSS, /cubic-bezier|\d(ms|s)\b/, 'a raw timing is in the morph');
  assert.match(PART, /data-mode=\{mode\}/);
  const reduced = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/.exec(CSS)?.[1] ?? '';
  for (const sel of ['.icon', '.icon .ring', '.icon .bar1', '.icon .bar2', ".icon[data-mode='add'] .ring", ".icon[data-mode='add'] .bar1", ".icon[data-mode='add'] .bar2", ".icon[data-mode='add'] ~ input"]) assert.ok(reduced.includes(sel), `reduced motion still moves “${sel}”`);
  assert.match(reduced, /\{ transition: none; \}/);
  assert.match(rule('.icon'), /width: 44px; height: 44px; min-width: 44px; min-height: 44px;/);
});

test('9 · as ＋, Enter adds what was typed', () => {
  const fn = /const onAddKeyDown = \(e: KeyboardEvent<HTMLInputElement>\) => \{([\s\S]*?)\n  \};/.exec(ROW)?.[1] ?? '';
  assert.ok(fn, 'the row has no Enter handler for the add');
  assert.match(fn, /const enterAdds = Boolean\(adds\) && searchAdd\.mode === 'add' && e\.key === 'Enter' && !e\.nativeEvent\.isComposing && e\.currentTarget\.value\.trim\(\) !== '';/);
  assert.match(fn, /if \(enterAdds && searchAdd\.asked\) \{\s*e\.preventDefault\(\);\s*adds\?\.onAdd\(e\.currentTarget\.value\.trim\(\)\);\s*return;\s*\}/);
  assert.match(fn, /hostKeyDown\?\.\(e\);\s*if \(enterAdds && !e\.defaultPrevented\) \{\s*e\.preventDefault\(\);\s*adds\?\.onAdd\(e\.currentTarget\.value\.trim\(\)\);/);
  assert.match(ROW, /onKeyDown=\{adds \? onAddKeyDown : field\.input\?\.onKeyDown\}/, 'the input does not hear it');
  assert.ok(ROW.indexOf('{...field.input}') < ROW.indexOf('onKeyDown={adds ? onAddKeyDown'), 'the host’s own onKeyDown overrides the add');
  assert.match(BOX, /if \(add && searchAdd\.mode === 'add' && value\.trim\(\)\) \{\s*add\.onAdd\(value\.trim\(\)\);\s*return;\s*\}/);
});

test('9 · drag the box right to add, back left to search (Guests redesign pick 1, owner 20 Nov 2026)', () => {
  assert.equal(searchAddDrag(SEARCH_ADD_DRAG_PX, 0), 'add', 'a drag right far enough does not switch to add');
  assert.equal(searchAddDrag(-SEARCH_ADD_DRAG_PX, 0), 'search', 'a drag back left does not switch to search');
  assert.equal(searchAddDrag(SEARCH_ADD_DRAG_PX - 1, 0), null, 'a short nudge switches');
  assert.equal(searchAddDrag(SEARCH_ADD_DRAG_PX * 2, SEARCH_ADD_DRAG_PX * 3), null, 'a scroll is taken for a drag');
  // Only a field that opts in is draggable; the ✕ and the icon keep their own presses.
  assert.match(ROW, /const dragAdd = adds && ownField\?\.dragAdd \? ownField\.dragAdd : null;/);
  assert.match(ROW, /if \(\(e\.target as HTMLElement\)\.closest\('button'\)\) return;/, 'a press on the box’s own buttons starts a drag');
  assert.match(ROW, /searchAdd\.forget\(\);/, '✕ does not end an add the box was dragged into');
  assert.match(GUESTS, /dragAdd:\s*writesOff \|\| gview !== 'list'\s*\? undefined/, 'Guests › List does not offer the drag (or a viewer who may not write is offered it)');
  // Never stranded in Add (ship review, 20 Nov): the ✕ stays in every add state, and a box left EMPTY lets go of the drag.
  assert.match(ROW, /\{field\.kind === 'date' \? null : \(\s*<ClearButton/, 'the ✕ is hidden in some state again — an add with words has no way out');
  assert.match(ROW, /ownInput\.current\.value\.trim\(\) === ''[^\n]*searchAdd\.forget\(\);/, 'an emptied box stays in Add with no way back');
});
