import { test, expect } from '@playwright/test';
import {
  SPATIAL_THEMES,
  SPATIAL_THEME_KEYS,
  INTENSITY_FACTOR,
  computeLayerState,
  journeyTimeAt,
  parseRsvpBackdropConfig,
  sceneWindows,
  smoothstep,
} from '../../lib/spatial-backdrop';

/**
 * Pure-logic spec for the spatial RSVP backdrop math (no page / no server —
 * lib/spatial-backdrop.ts is deliberately React-free so these run as plain
 * node assertions inside the existing Playwright project).
 *
 * These assert the *visual contract* of the effect:
 *  - opacity/scale always within sane render bounds (no popping, no blowups)
 *  - the push-in is monotonic (scroll down never zooms backward mid-scene)
 *  - the two-scene seam always keeps something on screen (no blank flash)
 *  - scene B is fully hidden before the seam (no double-exposure at the top)
 *  - the DB config parser never lets junk reach the renderer
 */

const GRID = Array.from({ length: 101 }, (_, i) => i / 100);

test.describe('spatial backdrop math', () => {
  test('opacity and scale stay within render bounds for every theme/intensity/layer', () => {
    for (const key of SPATIAL_THEME_KEYS) {
      const theme = SPATIAL_THEMES[key];
      const sceneCount = theme.scenes.length;
      for (const intensity of ['subtle', 'standard', 'lavish'] as const) {
        theme.scenes.forEach((scene, sceneIndex) => {
          for (const layer of scene.layers) {
            for (const p of GRID) {
              const s = computeLayerState({
                p,
                sceneIndex,
                sceneCount,
                depth: layer.depth,
                intensity,
              });
              expect(s.opacity).toBeGreaterThanOrEqual(0);
              expect(s.opacity).toBeLessThanOrEqual(1);
              expect(s.scale).toBeGreaterThanOrEqual(0.8);
              expect(s.scale).toBeLessThanOrEqual(2.5);
              expect(Number.isFinite(s.translateYvh)).toBe(true);
            }
          }
        });
      }
    }
  });

  test('first-scene push-in scale is monotonic non-decreasing (scroll never zooms backward)', () => {
    for (const depth of [0.15, 1]) {
      for (const intensity of ['subtle', 'standard', 'lavish'] as const) {
        let prev = -Infinity;
        for (const p of GRID) {
          const s = computeLayerState({ p, sceneIndex: 0, sceneCount: 2, depth, intensity });
          expect(s.scale).toBeGreaterThanOrEqual(prev - 1e-9);
          prev = s.scale;
        }
      }
    }
  });

  test('two-scene seam never goes blank — a far layer is always substantially visible', () => {
    for (const intensity of ['subtle', 'standard', 'lavish'] as const) {
      for (const p of GRID) {
        const a = computeLayerState({ p, sceneIndex: 0, sceneCount: 2, depth: 0.15, intensity });
        const b = computeLayerState({ p, sceneIndex: 1, sceneCount: 2, depth: 0.15, intensity });
        expect(Math.max(a.opacity, b.opacity)).toBeGreaterThanOrEqual(0.45);
      }
    }
  });

  test('scene B is fully hidden before the seam opens', () => {
    for (const p of [0, 0.1, 0.2, 0.3, 0.4, 0.44]) {
      const b = computeLayerState({
        p,
        sceneIndex: 1,
        sceneCount: 2,
        depth: 0.15,
        intensity: 'standard',
      });
      expect(b.opacity).toBe(0);
    }
  });

  test('near layers fall away within their scene (pass-the-camera falloff)', () => {
    const early = computeLayerState({ p: 0.05, sceneIndex: 0, sceneCount: 2, depth: 1, intensity: 'standard' });
    const late = computeLayerState({ p: 0.6, sceneIndex: 0, sceneCount: 2, depth: 1, intensity: 'standard' });
    expect(late.opacity).toBeLessThan(early.opacity);
  });

  test('intensity scales motion: lavish > standard > subtle at the same scroll point', () => {
    const at = (intensity: 'subtle' | 'standard' | 'lavish') =>
      computeLayerState({ p: 0.3, sceneIndex: 0, sceneCount: 2, depth: 1, intensity });
    expect(at('lavish').scale).toBeGreaterThan(at('standard').scale);
    expect(at('standard').scale).toBeGreaterThan(at('subtle').scale);
    expect(INTENSITY_FACTOR.lavish).toBeGreaterThan(INTENSITY_FACTOR.subtle);
  });

  test('scene windows overlap so the seam is a crossfade, not a cut', () => {
    const [a, b] = sceneWindows(2);
    expect(b!.enter).toBeLessThan(a!.exit);
    expect(a!.enter).toBe(0);
    expect(b!.exit).toBe(1);
    // Single-scene themes own the whole track; N>2 stays total (no crash, full coverage).
    expect(sceneWindows(1)).toEqual([{ enter: 0, exit: 1 }]);
    const three = sceneWindows(3);
    expect(three).toHaveLength(3);
    expect(three[0]!.enter).toBe(0);
    expect(three[2]!.exit).toBe(1);
  });

  test('smoothstep is clamped and ordered', () => {
    expect(smoothstep(-1)).toBe(0);
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(1)).toBe(1);
    expect(smoothstep(2)).toBe(1);
    expect(smoothstep(0.5)).toBeCloseTo(0.5, 5);
    expect(smoothstep(0.25)).toBeLessThan(smoothstep(0.75));
  });

  test('config parser is strict on theme, forgiving on intensity, null on junk', () => {
    expect(parseRsvpBackdropConfig(null)).toBeNull();
    expect(parseRsvpBackdropConfig(undefined)).toBeNull();
    expect(parseRsvpBackdropConfig('gilded-dusk')).toBeNull();
    expect(parseRsvpBackdropConfig([])).toBeNull();
    expect(parseRsvpBackdropConfig({})).toBeNull();
    expect(parseRsvpBackdropConfig({ theme: 'not-a-theme', intensity: 'standard' })).toBeNull();
    expect(parseRsvpBackdropConfig({ theme: 'gilded-dusk', intensity: 'standard' })).toEqual({
      theme: 'gilded-dusk',
      intensity: 'standard',
    });
    // Unknown intensity degrades to standard instead of killing the backdrop.
    expect(parseRsvpBackdropConfig({ theme: 'capiz-glow', intensity: 'maximal' })).toEqual({
      theme: 'capiz-glow',
      intensity: 'standard',
    });
  });

  test('journey scrub time: monotonic, clamped, never reaches the exact end', () => {
    const D = 14.5;
    expect(journeyTimeAt(0, D)).toBe(0);
    expect(journeyTimeAt(-1, D)).toBe(0);
    expect(journeyTimeAt(1, D)).toBeCloseTo(D - 0.05, 6);
    expect(journeyTimeAt(2, D)).toBeCloseTo(D - 0.05, 6);
    let prev = -1;
    for (const p of GRID) {
      const t = journeyTimeAt(p, D);
      expect(t).toBeGreaterThanOrEqual(prev);
      expect(t).toBeLessThan(D);
      prev = t;
    }
    // Degenerate durations never produce NaN/negative seeks.
    expect(journeyTimeAt(0.5, 0)).toBe(0);
    expect(journeyTimeAt(0.5, -3)).toBe(0);
    expect(journeyTimeAt(0.5, Number.NaN)).toBe(0);
  });

  test('journey registry entries are well-formed when present', () => {
    for (const key of SPATIAL_THEME_KEYS) {
      const j = SPATIAL_THEMES[key].journey;
      if (!j) continue;
      expect(j.src).toMatch(/^\/spatial\/.+\.mp4$/);
      expect(j.durationS).toBeGreaterThan(1);
    }
  });

  test('every registered theme has 1-2 scenes, valid depths, and webp assets', () => {
    for (const key of SPATIAL_THEME_KEYS) {
      const theme = SPATIAL_THEMES[key];
      expect(theme.scenes.length).toBeGreaterThanOrEqual(1);
      expect(theme.scenes.length).toBeLessThanOrEqual(2);
      for (const scene of theme.scenes) {
        expect(scene.layers.length).toBeGreaterThanOrEqual(1);
        for (const layer of scene.layers) {
          expect(layer.depth).toBeGreaterThan(0);
          expect(layer.depth).toBeLessThanOrEqual(1);
          expect(layer.src).toMatch(/^\/spatial\/.+\.webp$/);
        }
      }
    }
  });
});
