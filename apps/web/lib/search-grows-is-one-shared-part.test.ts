/**
 * search-grows-is-one-shared-part.test.ts — SEARCH GROWS INTO THE ROW, BUILT ONCE.
 *
 * Owner, 18 Nov 2026 (*"Yes, take it"* on `prototypes/motion_search_grows_2026-11-18.html`; the motion standard § 4 #11
 * + § 9): the search field grows across its row — Move 320 on Spring — and folds back in Quick 200 on Settle; reduced
 * motion: at once. It is ONE shared part (`app/_components/search-grows.ts`), adopted by the ONE row every list's search
 * sits in (`components/thumb-row.tsx`), so a list never writes this move for itself.
 *
 *   1 · the PILL'S REAL WIDTH grows from the icon to the row — never a scaleX (21 Nov 2026, owner: *"animate from just
 *       the icon to the full width search bar"*, Fable's drawing `search_icon_grows_2026-11-21_fable.html`): the 18 Nov
 *       scaleX stretched the 44 px round's radius and ring into an oval. The spring may carry it 8 px past the row, no
 *       more; the magnifier slides on the pill's curve; a round it takes the row from gives way; and AT REST the
 *       magnifier is dead centre in its round (owner, same day: "Search icon is not centered properly");
 *   2 · the timing is the standard's: open Move on Spring, fold Quick on Settle — and faster back than out;
 *   3 · ONE part: the move is defined in one file, and the thumb row calls it; no list re-draws it;
 *   4 · the lists the owner named sit in that row (so they inherit it), and the row's fold is no longer only a cut.
 *
 * Sabotage (each proved red, 18 Nov 2026): the fold given Move (2) ·
 * the `useSearchGrows(` call removed from `thumb-row.tsx` (3) · a second `playSearchGrows` written in
 * `guests-screen.tsx` (3). 21 Nov 2026: a scaleX put back in `searchGrowsFrames` (1) · the overshoot cap removed (1) ·
 * the resting ✕'s `margin: 0` removed from the row's CSS (1).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { stripComments } from './strip-comments';
import { EASE_SETTLE, EASE_SPRING_FALLBACK, EASE_SPRING_LINEAR, MOVE_MS, QUICK_MS } from './motion-table';
import { SEARCH_GIVES_WAY, SEARCH_GROWS_OVERSHOOT_PX, searchGlyphFrames, searchGrowsFrames, searchGrowsTiming } from '../app/_components/search-grows';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const PART = 'app/_components/search-grows.ts';

test('1 · the pill’s real width grows from the icon to the row — never stretched; the icon rests dead centre', () => {
  // The 44 px icon (left 16) takes a 358 px row (left 16).
  const frames = searchGrowsFrames({ left: 16, width: 44 }, { left: 16, width: 358 });
  assert.ok(frames && frames.length === 2);
  assert.deepEqual(frames[0], { transform: 'translateX(0px)', flexBasis: '44px', flexGrow: 0, flexShrink: 0, maxWidth: `${358 + SEARCH_GROWS_OVERSHOOT_PX}px` });
  assert.deepEqual(frames[1], { transform: 'translateX(0px)', flexBasis: '358px', flexGrow: 0, flexShrink: 0, maxWidth: '366px' });
  assert.equal(SEARCH_GROWS_OVERSHOOT_PX, 8, 'the spring may carry the pill 8 px past the row (Fable’s max-width: calc(100% + 8px))');
  for (const f of frames) assert.doesNotMatch(String(f.transform), /scale/, 'the pill is stretched instead of grown');
  // A field after one round (left 52) takes the whole row (left 0): its left edge slides on the same curve.
  const fromSide = searchGrowsFrames({ left: 52, width: 214 }, { left: 0, width: 358 });
  assert.equal(fromSide?.[0]?.transform, 'translateX(52px)');
  // Folding back is the same move from the row to the icon.
  const back = searchGrowsFrames({ left: 16, width: 358 }, { left: 16, width: 44 });
  assert.equal(back?.[0]?.flexBasis, '358px');
  assert.equal(back?.[1]?.flexBasis, '44px');
  // Nothing changed → nothing plays.
  assert.equal(searchGrowsFrames({ left: 10, width: 200 }, { left: 10, width: 200.4 }), null);
  assert.equal(searchGrowsFrames({ left: 0, width: 100 }, { left: 0, width: 0 }), null);
  // The magnifier slides from where it sat to where it sits (12 → 14 at rest is 2 px); a still one plays nothing.
  assert.deepEqual(searchGlyphFrames(12, 14), [{ transform: 'translateX(-2px)' }, { transform: 'translateX(0px)' }]);
  assert.equal(searchGlyphFrames(14, 14.2), null);
  // Show gives way: fades, 6 px right, .9 — and comes back the same way reversed.
  assert.deepEqual(SEARCH_GIVES_WAY, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(6px) scale(0.9)' }]);
  const src = read(PART);
  assert.doesNotMatch(src, /scaleX\(/, 'the part stretches the pill again');
  assert.doesNotMatch(src, /fill:\s*'both'|fill:\s*'forwards'/, 'the part leaves a frame held on the field');
  assert.match(src, /seat\.setAttribute\('data-search-gives-way', ''\)/, 'a round the field takes the row from no longer gives way');
  assert.match(src, /field\.setAttribute\('data-search-words-wait', ''\)/, 'the words no longer wait for the growth');
  // At rest the ✕ takes no width AND pulls nothing, so the magnifier is centred in its 44 px round.
  const css = read('components/thumb-row.module.css');
  assert.match(css, /\[data-thumb-seat='field'\]:not\(:focus-within\):has\(input\[type='search'\]:placeholder-shown\) > \.clearIn,\s*\.row\[data-search-force='rest'\] > \[data-thumb-seat='field'\]:has\(input\[type='search'\]\) > \.clearIn \{ margin: 0; \}/, 'the resting ✕ pulls the magnifier off centre again');
  assert.match(css, /\.row > \[data-search-gives-way\] \{ display: inline-flex !important; position: absolute;/);
  assert.match(css, /\[data-search-words-wait\] \.input::placeholder \{ color: transparent; transition: none; \}/);
});

test('2 · open Move on Spring · fold back Quick on Settle — faster back than out', () => {
  const open = searchGrowsTiming(true);
  const fold = searchGrowsTiming(false);
  assert.equal(open.duration, MOVE_MS);
  assert.ok([EASE_SPRING_LINEAR, EASE_SPRING_FALLBACK].includes(open.easing), `it opens on “${open.easing}” — not the spring`);
  assert.equal(fold.duration, QUICK_MS);
  assert.equal(fold.easing, EASE_SETTLE);
  assert.ok(fold.duration < open.duration, 'it folds back no faster than it opens');
  const src = read(PART);
  assert.doesNotMatch(src, /duration:\s*\d|cubic-bezier\(|\d+ms\b/, 'the part writes a raw time or curve');
  assert.match(src, /if \(typeof field\.animate !== 'function' \|\| motionReduced\(\)\) return;/, 'it plays under “reduce motion”');
});

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

test('3 · ONE part — defined once, called by the one row, re-drawn by no list', () => {
  const files = [...walk(join(WEB, 'app')), ...walk(join(WEB, 'components')), ...walk(join(WEB, 'lib'))];
  assert.ok(files.length > 2000, `anti-vacuity: only ${files.length} files were walked`);
  const defines: string[] = [];
  const calls: string[] = [];
  for (const abs of files) {
    const rel = relative(WEB, abs).split('\\').join('/');
    const src = stripComments(readFileSync(abs, 'utf8'));
    if (/function\s+(?:playSearchGrows|searchGrowsFrames|searchGrowsTiming|useSearchGrows)\b|sn-search-grows/.test(src)) defines.push(rel);
    if (/\buseSearchGrows\(|\bplaySearchGrows\(/.test(src) && rel !== PART) calls.push(rel);
  }
  assert.deepEqual(defines, [PART], `search-grows is written in more than one place: ${defines.join(', ')}`);
  assert.deepEqual(calls, ['components/thumb-row.tsx'], `search-grows is called from: ${calls.join(', ') || 'nowhere'}`);
  const row = read('components/thumb-row.tsx');
  assert.match(row, /import \{ focusSearchNow, holdSearchForKeyboard, playSearchGrows, useSearchGrows \} from '@\/app\/_components\/search-grows';/);
  assert.match(row, /useSearchGrows\(rowRef, riding, \{ field: "\[data-thumb-seat='field'\]", shape: 'data-riding' \}\);/);
  /* The seat and the shape the part is told about are the row's own. */
  assert.match(row, /data-thumb-seat="field"/);
  assert.match(row, /data-riding=\{riding \? '' : undefined\}/);
  assert.match(read('components/thumb-row.module.css'), /\.row\[data-riding\] > \[data-thumb-seat\]:not\(\[data-thumb-seat='field'\]\) \{ display: none; \}/, 'anti-vacuity: the row no longer gives the field the whole row');
});

test('4 · the lists the owner named search in that row — so they inherit it', () => {
  // Guests · the supplier's Clients · the couple's Suppliers (Find). (Bookings has no search to grow: see the PR.)
  assert.match(read('app/dashboard/[eventId]/guests/_components/guests-screen.tsx'), /const field: ThumbField = \{\s*placeholder: 'Search guests',/);
  const clients = read('app/vendor-dashboard/customers/page.tsx');
  // 19 Nov 2026: the Clients search is the add — the row seats `ClientsSearch`, which draws the same shared SearchBox.
  assert.match(clients, /<ThumbRow\s+name="customers"\s+field=\{\{\s*node: \(\s*<ClientsSearch\b/);
  assert.match(read('app/vendor-dashboard/customers/_components/clients-search.tsx'), /<SearchBox\s+placeholder="Search clients"/);
  const find = readdirSync(join(WEB, 'app/dashboard/[eventId]/vendors/_components')).filter((f) => /thumb/i.test(f) && !/test/.test(f));
  assert.ok(find.length > 0, 'anti-vacuity: the couple’s Suppliers thumb row was not found');
  assert.ok(
    find.some((f) => /<ThumbRow\b/.test(read(`app/dashboard/[eventId]/vendors/_components/${f}`))),
    'the couple’s Suppliers search is not in the one thumb row',
  );
  // No list writes a grow of its own.
  for (const rel of ['app/dashboard/[eventId]/guests/_components/guests-screen.tsx', 'app/vendor-dashboard/customers/page.tsx']) {
    assert.doesNotMatch(read(rel), /scaleX\(|searchGrows|search-grows/, `${rel} draws its own search grow`);
  }
});

test('5 · on a phone the grow waits for the row to ride the keyboard — so it is seen above the keys', () => {
  // Owner, 21 Nov 2026: "the keyboard rises as i press the search. can i see it while the keyboard rises?"
  const src = read(PART);
  const hold = src.slice(src.indexOf('export function holdSearchForKeyboard('), src.indexOf('export function focusSearchNow('));
  assert.ok(hold.length > 0, 'anti-vacuity: the hold is gone');
  // Only on a touch screen, only while the keyboard is not up yet, only for a search that rides, never under reduce motion.
  assert.match(hold, /motionReduced\(\)\) return false;/);
  assert.match(hold, /matchMedia\('\(hover: none\) and \(pointer: coarse\)'\)\.matches\) return false;/);
  assert.match(hold, /getAttribute\('data-keyboard'\) === 'open'\) return false;/);
  assert.match(hold, /hasAttribute\('data-rides'\)/);
  // It holds the icon shape — the row's own measuring switch — and lets go on its own: a Rise, or the first letter.
  assert.match(hold, /row\.setAttribute\(HOLD, 'rest'\);/);
  assert.match(hold, /window\.setTimeout\(release, RISE_MS_STANDARD\)/);
  assert.match(hold, /field\.addEventListener\('input', release\)/);
  // The ride releases it, playing the grow from the icon (the hook puts the hold back for its one measure).
  const hook = src.slice(src.indexOf('export function useSearchGrows('), src.indexOf('export function holdSearchForKeyboard('));
  assert.match(hook, /const held = open && row\.getAttribute\(HOLD\) === 'rest';/);
  assert.match(hook, /if \(held\) row\.setAttribute\(HOLD, 'rest'\);/);
  // The row asks for the hold at the tap, and grows at once only when it does not hold. Tap and type is untouched:
  // the focus is the input's own (the hold changes only the SHAPE).
  const row = read('components/thumb-row.tsx');
  assert.match(row, /!holdSearchForKeyboard\(rowRef\.current, seat\)\) playSearchGrows\(rowRef\.current, seat, true, forceShape\('rest'\)\);/);
  assert.doesNotMatch(hold, /\.focus\(/, 'the hold moves the focus (tap and type must stay one synchronous focus)');
});

test('6 · a shipped search box in the seat rests centred too (Clients, People, admin)', () => {
  const css = read('components/thumb-row.module.css');
  assert.match(css, /\.row\[data-search-force='rest'\] > \.fieldNode:has\(input\[type='search'\]\) > \* \{ padding: 0; gap: 0; justify-content: center; \}/);
  assert.match(css, /> \* > :not\(svg, input\[type='search'\], \[data-search-add-icon\]\) \{ display: none; \}/);
  assert.match(read(PART), /field\.querySelector<HTMLElement \| SVGElement>\('\[data-search-add-icon\], svg'\)/, 'the slide moves the whole box, not its magnifier');
});
