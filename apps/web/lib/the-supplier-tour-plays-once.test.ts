/**
 * the-supplier-tour-plays-once.test.ts — 🔦 ONE supplier tour, shown once, on a solid card (walker W1-B14, 16 Nov 2026).
 *
 * The walker's finding: on the supplier dashboard three auto-tours opened one after another (Profile, then Today, then
 * Shop) once the first was skipped, and the tour card was see-through over the page's words. Held as properties:
 *   1 · finishing or skipping the journey records every supplier page tour WITH it — the dismissal is persisted;
 *   2 · no page tour is due on any record (before the journey it would stack, after it the journey ended it);
 *   3 · `completeTour` writes what `toursEndedWith` names, not the one key it was handed;
 *   4 · the card's fill is one opaque token, never a glass or scrim token, and it takes no backdrop blur.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { SUPPLIER_PAGE_TOURS, SUPPLIER_PAGE_TOURS_AFTER, supplierPageToursDue, toursEndedWith } from '@/lib/supplier-page-tours';
import { TOUR_KEYS } from '@/lib/tours';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

test('1 · skipping (or finishing) the journey ends every page tour with it', () => {
  const ended = toursEndedWith(SUPPLIER_PAGE_TOURS_AFTER);
  assert.ok(ended.includes(SUPPLIER_PAGE_TOURS_AFTER), 'the journey itself is not recorded');
  for (const k of SUPPLIER_PAGE_TOURS) assert.ok(ended.includes(k), `${k} still opens on its page after the journey was skipped`);
  for (const k of ended) assert.ok((TOUR_KEYS as ReadonlyArray<string>).includes(k), `${k} is not a tour key — completeTour would refuse it`);
  // Any other tour records only itself — a page tour's own Skip never ends the journey, nor the setup tour (step 6's ✓).
  assert.deepEqual(toursEndedWith('vendor_shop_v1'), ['vendor_shop_v1']);
  assert.deepEqual(toursEndedWith('vendor_setup_tour_v1'), ['vendor_setup_tour_v1']);
});

test('2 · no page tour auto-opens — not before the journey, not after it, not on a failed read', () => {
  assert.deepEqual(supplierPageToursDue(null), []);
  assert.deepEqual(supplierPageToursDue([]), []);
  // The walker's account: the journey skipped, nothing else on record — Today and Shop used to open next.
  assert.deepEqual(supplierPageToursDue([SUPPLIER_PAGE_TOURS_AFTER]), [], 'Today, then Shop, open after the journey was skipped');
});

test('3 · completeTour persists what the journey ends, in one write', () => {
  const src = stripComments(read('lib/tour-actions.ts'));
  const fn = src.slice(src.indexOf('export async function completeTour'), src.indexOf('export async function restartTour'));
  assert.match(fn, /const add = toursEndedWith\(tourKey\)\.filter\(\(k\) => !seen\.includes\(k\)\);/, 'completeTour records only the key it was handed');
  assert.match(fn, /tour_seen_keys: \[\.\.\.seen, \.\.\.add\]/);
  assert.doesNotMatch(fn, /tour_seen_keys: \[\.\.\.seen, tourKey\]/, 'the page tours are not written with the journey');
});

test('4 · the tour card is solid: one opaque token, no glass, no blur', () => {
  const src = read('app/_components/spotlight-tour.tsx');
  const css = src.slice(src.indexOf('const CSS_TEXT = `'), src.indexOf('`;', src.indexOf('const CSS_TEXT = `')));
  const tip = /\.sn-spot-tip\{([^}]*)\}/.exec(css)?.[1] ?? '';
  assert.ok(tip, 'anti-vacuity: the card rule was not found');
  assert.match(tip, /(?:^|;)background:var\(--sn-spot-card\)/, 'the card is not filled with its solid token');
  assert.match(tip, /(?:^|;)backdrop-filter:none/, 'the card may blur what is under it');
  const fills = tip.split(';').filter((d) => /^background/.test(d.trim()));
  assert.deepEqual(fills, ['background:var(--sn-spot-card)'], 'the card takes a second (see-through) fill');
  assert.doesNotMatch(tip, /(?:^|;)opacity:\s*0?\.\d/, 'the card is drawn half see-through');
  const token = /\[data-sn-spot\]\{--sn-spot-card:var\(--m-paper,(#[0-9a-f]{3,6})\)\}/i.exec(css);
  assert.ok(token, '--sn-spot-card is not the paper');
  // The paper itself is opaque in light and in dark — a hex with no alpha.
  const globals = read('app/globals.css');
  const papers = [...globals.matchAll(/^\s*--m-paper:\s*([^;]+);/gm)].map((m) => m[1]!.trim());
  assert.ok(papers.length >= 2, 'anti-vacuity: the light and dark paper were not found');
  for (const p of papers) assert.match(p, /^#[0-9a-f]{6}$/i, `--m-paper is ${p} — the tour card would show the words under it`);
});
