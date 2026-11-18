/**
 * search-grows-is-one-shared-part.test.ts — SEARCH GROWS INTO THE ROW, BUILT ONCE.
 *
 * Owner, 18 Nov 2026 (*"Yes, take it"* on `prototypes/motion_search_grows_2026-11-18.html`; the motion standard § 4 #11
 * + § 9): the search field grows across its row — Move 320 on Spring — and folds back in Quick 200 on Settle; reduced
 * motion: at once. It is ONE shared part (`app/_components/search-grows.ts`), adopted by the ONE row every list's search
 * sits in (`components/thumb-row.tsx`), so a list never writes this move for itself.
 *
 *   1 · the move is transform only: from the box the field had to the box it has (a translate and a scaleX);
 *   2 · the timing is the standard's: open Move on Spring, fold Quick on Settle — and faster back than out;
 *   3 · ONE part: the move is defined in one file, and the thumb row calls it; no list re-draws it;
 *   4 · the lists the owner named sit in that row (so they inherit it), and the row's fold is no longer only a cut.
 *
 * Sabotage (each proved red, 18 Nov 2026): `width` animated in `searchGrowsFrames` (1) · the fold given Move (2) ·
 * the `useSearchGrows(` call removed from `thumb-row.tsx` (3) · a second `playSearchGrows` written in
 * `guests-screen.tsx` (3).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { stripComments } from './strip-comments';
import { EASE_SETTLE, EASE_SPRING_FALLBACK, EASE_SPRING_LINEAR, MOVE_MS, QUICK_MS } from './motion-table';
import { searchGrowsFrames, searchGrowsTiming } from '../app/_components/search-grows';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const PART = 'app/_components/search-grows.ts';

test('1 · the move is transform only — from the box the field had to the box it has', () => {
  // A field at 60 % of a 358 px row, after one round (left 52), takes the whole row (left 0).
  const frames = searchGrowsFrames({ left: 52, width: 214 }, { left: 0, width: 358 });
  assert.ok(frames && frames.length === 2);
  for (const f of frames) assert.deepEqual(Object.keys(f), ['transform'], 'the grow animates something other than transform');
  // Centre moves from 159 to 179 (−20 px); the width is 214 / 358 of the row.
  const m = /^translateX\((-?[\d.]+)px\) scaleX\(([\d.]+)\)$/.exec(String(frames[0]!.transform));
  assert.ok(m, `the first frame is “${frames[0]!.transform}”`);
  assert.equal(Number(m[1]), -20);
  assert.ok(Math.abs(Number(m[2]) - 214 / 358) < 1e-9);
  assert.equal(frames[1]!.transform, 'translateX(0px) scaleX(1)', 'it does not end in its own place');
  // Folding back is the same move from the row to the box.
  const back = searchGrowsFrames({ left: 0, width: 358 }, { left: 52, width: 214 });
  assert.ok(back && /^translateX\(20px\) scaleX\(1\.67/.test(String(back[0]!.transform)));
  // Nothing changed → nothing plays.
  assert.equal(searchGrowsFrames({ left: 10, width: 200 }, { left: 10, width: 200.4 }), null);
  assert.equal(searchGrowsFrames({ left: 0, width: 100 }, { left: 0, width: 0 }), null);
  const src = read(PART);
  assert.doesNotMatch(src, /\b(?:width|height|left|top|maxHeight|maxWidth)\s*:\s*[`'"\d]/, 'the part animates a layout property');
  assert.doesNotMatch(src, /fill:\s*'both'|fill:\s*'forwards'/, 'the part leaves a transform held on the field');
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
  assert.match(row, /import \{ useSearchGrows \} from '@\/app\/_components\/search-grows';/);
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
  assert.match(clients, /<ThumbRow\s+name="customers"\s+field=\{\{\s*node: \(\s*<SearchBox\s+placeholder="Search clients"/);
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
