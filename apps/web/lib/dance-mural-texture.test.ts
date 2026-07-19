/**
 * Unit suite for the dance-floor mural's PURE parts (Fable dossier §3.7) —
 * palette derivation + cache keying. Load-bearing invariants:
 *   • muralPalette reuses the LED-wall math: boldest swatch → accent1, dark bg
 *     stays dark (tinted, never swapped light), thin/grey palettes fall back
 *     to the mural's own template triple verbatim.
 *   • The cache key is STABLE (same palette + same mark → same key, across
 *     object identities) and DISCRIMINATING (different mark / different
 *     palette → different key) — it is the "rasterize once" contract.
 *
 * The canvas painting + THREE texture halves are browser-only and are NOT
 * exercised here (tsx --test runs in node, no DOM).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DANCE_MURAL_TEMPLATE,
  muralPalette,
  muralCacheKey,
  monogramMuralKey,
} from './dance-mural-texture';
import { ledPaletteFromMoodBoard } from './site-palette';
import type { RolePalette } from './mood-board';
import type { MonogramTextureSource } from './seating-3d';

const HEX6 = /^#[0-9a-f]{6}$/i;

// A colourful mood board: bold crimson dominant, deep teal support.
const COLOURFUL: RolePalette = {
  reception: ['#C1272D', '#1B4B5A', '#F2E8DA'],
  bride: ['#E8B4C0'],
};

// All-grey palette — no swatch clears the chroma floor.
const GREYS: RolePalette = { reception: ['#808080', '#5A5A5A', '#D0D0D0'] };

// ── muralPalette ─────────────────────────────────────────────────────────────

test('null / empty / all-grey palettes fall back to the template triple verbatim', () => {
  assert.deepEqual(muralPalette(null), [...DANCE_MURAL_TEMPLATE]);
  assert.deepEqual(muralPalette(undefined), [...DANCE_MURAL_TEMPLATE]);
  assert.deepEqual(muralPalette({}), [...DANCE_MURAL_TEMPLATE]);
  assert.deepEqual(muralPalette(GREYS), [...DANCE_MURAL_TEMPLATE]);
});

test('colourful palette derives exactly the LED-wall mapping over the mural template', () => {
  const derived = muralPalette(COLOURFUL);
  assert.deepEqual(derived, ledPaletteFromMoodBoard(COLOURFUL, DANCE_MURAL_TEMPLATE));
});

test('accent1 is the boldest (most chromatic) swatch', () => {
  const [, accent1] = muralPalette(COLOURFUL);
  assert.equal(accent1.toLowerCase(), '#c1272d');
});

test('bg keeps the template DARK tone — tinted toward the deepest swatch, never flipped light', () => {
  const [bg] = muralPalette(COLOURFUL);
  assert.match(bg, HEX6);
  // Relative luminance stays low (dark floor). Cheap check: channel mean well
  // under mid-grey.
  const n = parseInt(bg.slice(1), 16);
  const mean = (((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255)) / 3;
  assert.ok(mean < 100, `bg ${bg} should stay dark (mean ${mean})`);
});

test('every derived slot is a #rrggbb hex', () => {
  for (const c of muralPalette(COLOURFUL)) assert.match(c, HEX6);
});

test('derivation is deterministic across calls and object identities', () => {
  const clone: RolePalette = JSON.parse(JSON.stringify(COLOURFUL));
  assert.deepEqual(muralPalette(COLOURFUL), muralPalette(clone));
});

// ── monogramMuralKey ─────────────────────────────────────────────────────────

const SVG_A: MonogramTextureSource = { kind: 'svg', svg: '<svg><circle r="5"/></svg>' };
const SVG_B: MonogramTextureSource = { kind: 'svg', svg: '<svg><rect width="5"/></svg>' };

test('no monogram keys as "none"', () => {
  assert.equal(monogramMuralKey(null), 'none');
  assert.equal(monogramMuralKey(undefined), 'none');
});

test('same svg → same key; different svg → different key', () => {
  assert.equal(monogramMuralKey(SVG_A), monogramMuralKey({ kind: 'svg', svg: SVG_A.svg }));
  assert.notEqual(monogramMuralKey(SVG_A), monogramMuralKey(SVG_B));
});

test('svg and config sources never collide, and configs discriminate', () => {
  const cfgA = { kind: 'config', monogram: { text: 'M&J' } } as unknown as MonogramTextureSource;
  const cfgB = { kind: 'config', monogram: { text: 'A&B' } } as unknown as MonogramTextureSource;
  assert.match(monogramMuralKey(SVG_A), /^svg:/);
  assert.match(monogramMuralKey(cfgA), /^cfg:/);
  assert.notEqual(monogramMuralKey(cfgA), monogramMuralKey(cfgB));
  assert.equal(
    monogramMuralKey(cfgA),
    monogramMuralKey(JSON.parse(JSON.stringify(cfgA)) as MonogramTextureSource),
  );
});

// ── muralCacheKey ────────────────────────────────────────────────────────────

test('cache key = case-normalized triple + monogram identity', () => {
  const key = muralCacheKey(['#AA0000', '#00BB00', '#0000CC'], 'none');
  assert.equal(key, '#aa0000|#00bb00|#0000cc·none');
});

test('cache key is stable for the same inputs and discriminates palette / monogram changes', () => {
  const triple = muralPalette(COLOURFUL);
  const a = muralCacheKey(triple, monogramMuralKey(SVG_A));
  assert.equal(a, muralCacheKey(muralPalette(COLOURFUL), monogramMuralKey(SVG_A)));
  // Different mark, same palette → different key.
  assert.notEqual(a, muralCacheKey(triple, monogramMuralKey(SVG_B)));
  assert.notEqual(a, muralCacheKey(triple, monogramMuralKey(null)));
  // Different palette, same mark → different key.
  assert.notEqual(a, muralCacheKey(muralPalette(null), monogramMuralKey(SVG_A)));
});
