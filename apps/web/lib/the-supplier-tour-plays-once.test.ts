/**
 * the-supplier-tour-plays-once.test.ts — 🔦 ONE supplier tour, shown once, on a solid card (walker W1-B14, 16 Nov 2026).
 *
 * The walker's finding: on the supplier dashboard three auto-tours opened one after another (Profile, then Today, then
 * Shop) once the first was skipped, and the tour card was see-through over the page's words. Held as properties:
 *   1–3 · (the page tours themselves were deleted 16 Nov 2026 — `the-supplier-page-tours-are-retired.test.ts`);
 *   2 · `completeTour` records the one tour that finished;
 *   4 · the card's fill is one opaque token, never a glass or scrim token, and it takes no backdrop blur.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

// 1–3 · (16 Nov 2026) the seven supplier page tours these held were DELETED (owner B14 ruling), with
// `toursEndedWith` and `supplierPageToursDue`. Nothing auto-opens after the journey because nothing else exists to —
// held by `lib/the-supplier-page-tours-are-retired.test.ts`. What stays: a finish records the tour that finished.
test('2 · completeTour records the one tour that finished, in one write', () => {
  const src = stripComments(read('lib/tour-actions.ts'));
  const fn = src.slice(src.indexOf('export async function completeTour'), src.indexOf('export async function restartTour'));
  assert.ok(fn.length > 200, 'anti-vacuity: completeTour was not found');
  assert.match(fn, /if \(seen\.includes\(tourKey\)\) return;/);
  assert.match(fn, /tour_seen_keys: \[\.\.\.seen, tourKey\]/);
  assert.doesNotMatch(fn, /toursEndedWith|supplier-page-tours/, 'completeTour still reaches for the retired page tours');
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
