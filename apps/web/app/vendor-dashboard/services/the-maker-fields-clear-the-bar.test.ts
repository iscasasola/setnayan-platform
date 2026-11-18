/**
 * the-maker-fields-clear-the-bar.test.ts — 🧰 WALK STEP 3, FAULT 4 (2026-11-16): at 390 the maker's Cancel · Create row
 * left a ~60 px window in Today's New service sheet, so fields sat hidden under it while typing.
 *
 * Measured in `/dev/card-maker-lab?host=today` at 390 × 844 (build-sessions/shots-service-card-fixes): the sheet opened
 * at half height (top 405 px) with the row fixed at 714 px — the fields had the strip between the pinned "What you
 * offer" row and the bar. After: the sheet is the screen (714 px above the bar), and every field typed into — a new
 * "What's included" line included — stops above the bar at 375 and 390, on the page and in the sheet.
 *
 *   1 · on a phone Today's New service sheet IS the screen (`full`; ruling 2026-11-10 "a form rises full screen");
 *   2 · the box that scrolls the maker — the page, or the sheet's body — keeps a bottom scroll-padding at least as
 *       tall as the space the fixed row takes at the foot of the screen, so a focused field stops above it;
 *   3 · the phone's preview is not pinned over the fields by this build (it stays one tap away, cut 3).
 *
 * Sabotage: drop `full` → test 1 red; type a number into the scroll-padding again, or drop the row's height from
 * the token → test 2 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = process.cwd().endsWith('apps/web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const HOST = stripComments(read('app/vendor-dashboard/_components/setup-offer-fold.tsx'));
const SHEET = stripComments(read('app/_components/sheet.tsx'));
const CSS = read('app/globals.css');
const MAKER = stripComments(read('app/vendor-dashboard/services/_components/canvas-maker.tsx'));

test('1 · on a phone Today’s New service sheet is the whole screen', () => {
  const tag = /<Sheet\b[^\n]*title="New service"[^\n]*/.exec(HOST);
  assert.ok(tag, 'the New service sheet was not found');
  assert.match(tag![0].replace(/=\{[^}]*\}|="[^"]*"/g, ''), /\sfull(?:\s|>)/, 'the New service sheet opens at half height again — the bar covers the fields');
  /* …and `full` really is the screen on a phone (read from the Sheet, never typed here). */
  const fulls = [...SHEET.matchAll(/\bfull:\s*'([^']+)'/g)].map((m) => m[1]!);
  assert.ok(fulls.length >= 2, 'anti-vacuity: the Sheet’s full geometries were not found');
  for (const f of fulls) assert.match(f, /max-(?:lg|tab):h-\[100dvh\]/, `a full sheet is not the screen on a phone: ${f}`);
  /* The Sheet may stay drawn only while its mirrored close plays (`present`, ported from #7686); once shut it still returns null. */
  assert.match(SHEET, /if \(!open(?: && !present)?\) return null;[\s\S]*\$\{full \? ` \$\{at\.full\}`/, 'the Sheet no longer applies `full`');
});

test('2 · the page and the sheet body keep the fields above the fixed Cancel · Create row — by the row’s own token', () => {
  const rule = /html:has\(\[data-card-maker\]\),\s*\[data-sheet-panel\] > \.overflow-y-auto:has\(\[data-card-maker\]\)\s*\{\s*scroll-padding-bottom:\s*var\(--sn-thumb-clear\);\s*\}/.exec(CSS);
  assert.ok(rule, 'the scroll-padding rule for the maker’s two scrolling boxes is gone, or types its own number again');
  /* The token: the row's lift (its own `bottom`) + the row's height + a gap — one definition, in :root. */
  const defs = [...CSS.matchAll(/--sn-thumb-clear:\s*([^;]+);/g)].map((m) => m[1]!.trim());
  assert.equal(defs.length, 1, 'the clearance is defined more than once (or not at all)');
  const ROW = read('app/vendor-dashboard/_components/supplier-thumb-row.module.css');
  const lift = /\.lower \{[^}]*?\bbottom: calc\((var\(--sn-ride-h[^;]+)\);/.exec(ROW)?.[1];
  assert.ok(lift, 'anti-vacuity: the row’s own `bottom` was not read');
  assert.ok(defs[0]!.startsWith(`calc(${lift}`), `the clearance does not start from the row’s own lift (${lift})`);
  assert.match(defs[0]!, /\+ var\(--sn-thumb-row-h\)/, 'the clearance leaves out the row’s height');
  assert.match(ROW, /min-height: var\(--sn-thumb-row-h\);/, 'the row no longer reads the height token — the two can drift apart');
  /* Measured 2026-11-16 at 390 × 844: the row stood 714 → 780 px, 130 px from the bottom edge (a 64 px lift + 66 px). */
  const rowH = Number(/--sn-thumb-row-h:\s*(\d+)px;/.exec(CSS)?.[1]);
  assert.ok(64 + rowH + 16 >= 844 - 714, 'the clearance is shorter than the measured row');
  assert.match(MAKER, /<SupplierThumbRow name="maker"/, 'anti-vacuity: the maker no longer draws the row');
});

test('3 · the phone’s preview is not pinned over the fields (one tap away)', () => {
  assert.match(MAKER, /const \[peekOpen, setPeekOpen\] = useState\(false\);/, 'the phone preview opens by default again');
  const peek = MAKER.slice(MAKER.indexOf('data-maker-card-peek='), MAKER.indexOf('data-maker-split='));
  assert.ok(peek.length > 50, 'anti-vacuity: the phone preview was not found');
  assert.doesNotMatch(peek.slice(0, 400), /\bsticky\b|\bfixed\b/, 'the phone preview is pinned over the fields again');
});
