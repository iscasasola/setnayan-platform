import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveBoard, isWithinWarmArc, isAllWarm, normalizeMajors, PEOPLE_KEYS, type PaletteStyle } from './palette-styles';

/**
 * THE GUARD BUG THIS FILE EXISTS TO NOT REPEAT: a warm-arc check that tests
 * the hue the engine ASKED FOR (a value computed during candidate
 * generation) instead of the hue the EMITTED colour actually has, once
 * measured back from its hex, passes on a colour that is perceptually
 * outside the arc. In this OKLCH engine those two values coincide by
 * construction — `hexOfOklch(L, C, H)` produces a colour whose measured hue
 * IS `H` — which is exactly why a request-reading guard here would never
 * have fired, and exactly why it must be written to read the result anyway:
 * the moment either side of that engine changes, a request-reading guard
 * goes silently blind.
 *
 * `isWithinWarmArc` (in `./palette-styles`) is written so this bug is
 * structurally impossible: its only parameter is the emitted hex. There is
 * no "requested hue" value in scope to check by mistake.
 */

test('isWithinWarmArc reads the ACTUAL measured hue of the hex it is given', () => {
  // A colour whose real OKLCH hue is outside the warm arc (a forest green,
  // deep in the cool half of the circle) must be flagged, regardless of what
  // any caller "intended" to request.
  assert.equal(isWithinWarmArc('#3B5437'), false, 'forest green must read as outside the warm arc');
  // A colour whose real hue IS inside the arc must pass.
  assert.equal(isWithinWarmArc('#7A1F2B'), true, 'burgundy must read as inside the warm arc');
  assert.equal(isWithinWarmArc('#FFD8DD'), true, 'a blush that wraps through H=0 must still read as warm');
  // Achromatic colours carry no hue to violate the arc with.
  assert.equal(isWithinWarmArc('#808080'), true, 'a pure grey has no hue to be warm or cool about');
});

test('sabotage: a colour whose actual measured hue sits outside the warm arc is caught, proving the guard reads the result, not a request', () => {
  // This IS the sabotage the brief asks for: construct a colour that a
  // request-reading guard could plausibly have waved through (nothing here
  // claims a "requested" hue at all — that's the point) but whose real,
  // measured hue is unambiguously cool. `isWithinWarmArc` must go red on it.
  const coolGreen = '#2E5F3A'; // measured well outside [−20°, 115°]
  assert.equal(isWithinWarmArc(coolGreen), false);
});

const STYLES: PaletteStyle[] = ['simple', 'depth', 'complex'];
const SETS: Record<string, string[]> = {
  crimson_ivory_regal: ['#7A1F2B', '#FAF7F2', '#D4AF37', '#302B1B', '#FFD8DD'],
  vintage_ilustrado: ['#FAF7F2', '#C5A059', '#824A2A', '#817B70', '#ECC499'],
  modern_mono: ['#FFFFFF', '#CCCCCC', '#888888', '#EEEEEE', '#444444'],
  capiz_pina: ['#F2E8D5', '#E7E2DA', '#D9CBB0', '#F3ECE0', '#C9BBA8'],
  magenta_red_seam: ['#FFFFF0', '#B3202C', '#C4177A', '#E7E2DA', '#7A1F2B'],
  three_only: ['#7A1F2B', '#D4AF37', '#FAF7F2'],
  timeless: ['#F3ECE0', '#E8D6B8', '#C5A059', '#8A6D3B', '#FAF7F2'],
};

test('every all-warm fixture derives a board whose people-role swatches never depart the warm arc, in every style', () => {
  const violations: string[] = [];
  for (const [name, majors] of Object.entries(SETS)) {
    const slots = normalizeMajors(majors);
    if (!isAllWarm(slots)) continue; // this guard only applies to all-warm themes
    for (const style of STYLES) {
      const board = deriveBoard(majors, style);
      for (const key of PEOPLE_KEYS) {
        for (const hex of board[key] ?? []) {
          if (!isWithinWarmArc(hex)) violations.push(`${name}/${style}/${key} ${hex}`);
        }
      }
    }
  }
  assert.deepEqual(violations, []);
});
