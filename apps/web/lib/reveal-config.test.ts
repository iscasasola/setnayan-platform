/**
 * Unit suite for the Reveal Studio config merge/clamp (Node built-in test runner,
 * run via tsx — `pnpm test:unit`; CI runs it in the "unit tests" step).
 *
 * Load-bearing invariant: a persisted out-of-range slider value (admin JSONB on
 * `reveal_studio_config`) must resolve to the clamped bound and NEVER reach a
 * Canvas2D radius. A negative `petalSize` once drove `ctx.ellipse(0,0,p.size,…)`
 * negative in reveal-particles → `IndexSizeError` (DOMException 1), crashing the
 * public couple Save-the-Date page. The clamp in `mergeEffects` / `mergeLook` is
 * the guarantee; this suite asserts it (ranges from app/admin/reveal-studio).
 *
 * Imports the pure `mergeRevealConfig` entry point. The module's only side-channel
 * (`createAdminClient`) is invoked lazily inside the cached fetch fn, never at
 * import, so this loads cleanly under `tsx --test` (same as the other lib tests).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeRevealConfig,
  DEFAULT_EFFECTS_LOOK,
  DEFAULT_VEIL_LOOK,
} from './reveal-config';

test('effects: out-of-range sliders clamp to [0,100]', () => {
  const c = mergeRevealConfig({
    effects: {
      petalSize: -40,
      shadow: 9999,
      butterflySize: -1,
      butterflyCount: 250,
      petalFall: -100,
      butterflySpeed: 1e9,
      petalDensity: -0.5,
    },
  });
  assert.equal(c.effects.petalSize, 0);
  assert.equal(c.effects.shadow, 100);
  assert.equal(c.effects.butterflySize, 0);
  assert.equal(c.effects.butterflyCount, 100);
  assert.equal(c.effects.petalFall, 0);
  assert.equal(c.effects.butterflySpeed, 100);
  assert.equal(c.effects.petalDensity, 0);
});

test('veil: each knob clamps to its studio SliderDef range', () => {
  const c = mergeRevealConfig({
    veil: {
      logoSize: -5, // 2–30
      tilePx: 9999, // 40–400
      feather: 100, // 2–8
      folds: 1, // 4–30
      reaches: 999, // 0–30
      topValance: 200, // 0–70
      logoOpacity: -10, // 0–100
      petalsDensity: -3, // 0–100 (shares the negative-radius hazard)
    },
  });
  assert.equal(c.veil.logoSize, 2);
  assert.equal(c.veil.tilePx, 400);
  assert.equal(c.veil.feather, 8);
  assert.equal(c.veil.folds, 4);
  assert.equal(c.veil.reaches, 30);
  assert.equal(c.veil.topValance, 70);
  assert.equal(c.veil.logoOpacity, 0);
  assert.equal(c.veil.petalsDensity, 0);
});

test('valid in-range values pass through unchanged', () => {
  const c = mergeRevealConfig({
    effects: { petalSize: 50, butterflyCount: 12 },
    veil: { logoSize: 20, tilePx: 120, feather: 4.5, folds: 10 },
  });
  assert.equal(c.effects.petalSize, 50);
  assert.equal(c.effects.butterflyCount, 12);
  assert.equal(c.veil.logoSize, 20);
  assert.equal(c.veil.tilePx, 120);
  assert.equal(c.veil.feather, 4.5);
  assert.equal(c.veil.folds, 10);
});

test('non-finite / missing values fall back to the locked defaults', () => {
  const c = mergeRevealConfig({
    effects: { petalSize: NaN, shadow: Infinity },
    veil: { logoSize: 'oops' as unknown as number },
  });
  assert.equal(c.effects.petalSize, DEFAULT_EFFECTS_LOOK.petalSize);
  assert.equal(c.effects.shadow, DEFAULT_EFFECTS_LOOK.shadow);
  assert.equal(c.veil.logoSize, DEFAULT_VEIL_LOOK.logoSize);
});

test('empty / nullish config yields the full locked defaults', () => {
  const c = mergeRevealConfig(null);
  assert.deepEqual(c.effects, DEFAULT_EFFECTS_LOOK);
  assert.deepEqual(c.veil, DEFAULT_VEIL_LOOK);
});
