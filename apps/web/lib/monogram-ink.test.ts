/**
 * lib/monogram-ink.test.ts — the uploaded mark's colour policy.
 *
 * The property under guard is NOT "some bytes changed" (a re-encode passes
 * that). It is:
 *   · every PAINTED colour became currentColor, and
 *   · every STRUCTURAL paint keyword survived — `none` keeps a counter hollow,
 *     a gradient ref keeps its gradient, `fill-rule` keeps the shape.
 * A recolour that flooded the holes of an "O" would satisfy a byte-diff and
 * ruin the mark, so each of those is asserted by name and by COUNT.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  markInks,
  repaintMark,
  readMarkInkMode,
  writeMarkInkMode,
  applyMarkInk,
  isMarkInkMode,
  isSafeInk,
} from './monogram-ink';

const SAGE = '#4F6B4A';

const TRACED =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
  '<path d="M0 0h10v10z" fill="#1A1A1A" fill-rule="evenodd"/>' +
  '<path d="M20 0h10v10z" fill="#C5A059" fill-rule="evenodd"/>' +
  '</svg>';

test('markInks lists each distinct colour once, in first-seen order', () => {
  assert.deepEqual(markInks(TRACED), ['#1a1a1a', '#c5a059']);
  // A second path in an already-seen colour must not inflate the count — the
  // number is shown to the couple as "2 colours", so a duplicate would lie.
  const dup = TRACED.replace('</svg>', '<path d="M40 0h5v5z" fill="#1A1A1A"/></svg>');
  assert.deepEqual(markInks(dup), ['#1a1a1a', '#c5a059']);
});

test('markInks reads an inline style, not only an attribute', () => {
  // Illustrator writes style="fill:#1A1A1A". A rule that only read attributes
  // would report ZERO colours here and offer a toggle that did nothing.
  const styled = '<svg viewBox="0 0 10 10"><path d="M0 0h1v1z" style="fill:#1A1A1A;stroke:#C5A059"/></svg>';
  assert.deepEqual(markInks(styled), ['#1a1a1a', '#c5a059']);
});

test('markToCurrentColor repaints every painted colour', () => {
  const out = repaintMark(TRACED, SAGE);
  assert.equal((out.match(/fill="#4F6B4A"/g) ?? []).length, 2);
  assert.deepEqual(markInks(out), ['#4f6b4a'], 'every path now wears the one ink');
});

test('markToCurrentColor preserves fill="none" — the counters stay hollow', () => {
  const hollow = '<svg viewBox="0 0 10 10"><path d="M0 0h1v1z" fill="none" stroke="#1A1A1A"/></svg>';
  const out = repaintMark(hollow, SAGE);
  assert.match(out, /fill="none"/, 'a hollow counter must not be flooded');
  assert.match(out, /stroke="#4F6B4A"/);
});

test('markToCurrentColor preserves a gradient reference', () => {
  const grad = '<svg viewBox="0 0 10 10"><path d="M0 0h1v1z" fill="url(#g)"/></svg>';
  assert.equal(repaintMark(grad, SAGE), grad, 'a gradient ref is not a flat colour');
});

test('markToCurrentColor never touches fill-rule / fill-opacity / stroke-width', () => {
  // These carry no colour. Matching them would change the SHAPE while the
  // change looked like a colour change — the worst kind of silent defect.
  const out = repaintMark(TRACED, SAGE);
  assert.equal((out.match(/fill-rule="evenodd"/g) ?? []).length, 2);
  const widths = '<svg viewBox="0 0 10 10"><path d="M0 0h1v1z" stroke-width="2" fill-opacity="0.5" fill="#111111"/></svg>';
  const o2 = repaintMark(widths, SAGE);
  assert.match(o2, /stroke-width="2"/);
  assert.match(o2, /fill-opacity="0\.5"/);
  assert.match(o2, /fill="#4F6B4A"/);
});

test('the ink mode round-trips on the root tag, and defaults to file', () => {
  assert.equal(readMarkInkMode(TRACED), 'file', 'an unstamped mark is unchanged');
  assert.equal(readMarkInkMode(null), 'file');
  const stamped = writeMarkInkMode(TRACED, 'palette');
  assert.equal(readMarkInkMode(stamped), 'palette');
  // Re-stamping replaces rather than accumulating.
  const restamped = writeMarkInkMode(stamped, 'file');
  assert.equal((restamped.match(/data-ink=/g) ?? []).length, 1);
  assert.equal(readMarkInkMode(restamped), 'file');
});

test('a nested <svg> cannot carry a competing policy', () => {
  const nested = '<svg viewBox="0 0 10 10"><svg data-ink="palette" viewBox="0 0 5 5"></svg></svg>';
  assert.equal(readMarkInkMode(nested), 'file', 'only the ROOT tag states the policy');
});

test('an unknown data-ink value falls back to file rather than throwing', () => {
  const junk = '<svg data-ink="rainbow" viewBox="0 0 10 10"></svg>';
  assert.equal(readMarkInkMode(junk), 'file');
  assert.equal(isMarkInkMode('rainbow'), false);
});

test('applyMarkInk is lossless in both directions', () => {
  const palette = writeMarkInkMode(TRACED, 'palette');
  const painted = applyMarkInk(palette, undefined, SAGE);
  assert.deepEqual(markInks(painted ?? ''), ['#4f6b4a']);
  // The STORED bytes still hold the original colours, so switching back is a
  // read-time decision, never a recovery job.
  assert.deepEqual(markInks(palette), ['#1a1a1a', '#c5a059']);
  assert.equal(applyMarkInk(palette, 'file', SAGE), palette);
  assert.equal(applyMarkInk(null), null);
});

test('NO INK MEANS THE FILE\'S OWN COLOURS — never black, never currentColor', () => {
  /* The defect this contract exists to prevent. v1 rewrote fills to
   * `currentColor` so surfaces would inherit the ink. A data-URI <img> inherits
   * NOTHING, so the mark rendered pure black on the account switcher, album
   * shelf, photos tab and /u/ profile — measured in production as rgb(0,0,0)
   * against a reception colour of rgb(79,107,74).
   *
   * So: a palette-stamped mark with no usable ink must come back BYTE-IDENTICAL
   * to what the couple uploaded. */
  const palette = writeMarkInkMode(TRACED, 'palette');
  for (const bad of [undefined, null, '', 'red', 'currentColor', 'rgb(1,2,3)', '#12', 'javascript:x']) {
    assert.equal(applyMarkInk(palette, undefined, bad as string | null), palette, `ink ${String(bad)} must not repaint`);
  }
  assert.equal(isSafeInk('#4F6B4A'), true);
  assert.equal(isSafeInk('red'), false);
});

test('no render path can emit currentColor', () => {
  /* currentColor is no longer part of the contract at all. If it reappears in
   * output, the inheritance assumption is back and the chips go black again. */
  const palette = writeMarkInkMode(TRACED, 'palette');
  for (const ink of [SAGE, undefined, null]) {
    const out = applyMarkInk(palette, undefined, ink as string | null) ?? '';
    assert.ok(!out.includes('currentColor'), `currentColor leaked with ink=${String(ink)}`);
  }
});
