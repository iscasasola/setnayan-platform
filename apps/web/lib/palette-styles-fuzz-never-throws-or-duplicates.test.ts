import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveBoard, PEOPLE_KEYS, type PaletteStyle } from './palette-styles';

/**
 * Fuzzes the engine over random palettes, ported from the prototype's
 * `spec/fuzz-palettes.mjs`. A deterministic RNG (mulberry32, fixed seed) so
 * this test sees the exact same 600 palettes on every run — a flaky fuzz
 * test is worse than no fuzz test, because a red run stops being a signal.
 *
 * Two invariants, over 600 random palettes x 3 styles = 1800 boards, plus
 * four hand-picked all-pale trios that the random corpus is unlikely to hit
 * on its own (an all-pale theme is where the ladder has the least headroom):
 *   1. `deriveBoard` never throws.
 *   2. No RANKED ROLE's colour array holds the same hex twice.
 *
 * 🔑 `reception` and `room_dressing` are deliberately EXCLUDED from (2):
 * `reception` is the couple's five majors verbatim, un-deduped by design
 * (`normalizeMajors`'s clamp-to-last padding means a 3- or 4-major palette
 * legitimately repeats a hex there — see `normalizeMajors`), and
 * `room_dressing`'s fields are single hexes, not arrays, so "duplicate
 * within the array" doesn't apply. `ceremony` and every `PEOPLE_KEYS` role
 * ARE checked — that is the actual "who's wearing what" surface the
 * duplicate-swatch invariant protects.
 */

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STYLES: PaletteStyle[] = ['simple', 'depth', 'complex'];
const N = 600;

function buildCorpus(): string[][] {
  const rnd = mulberry32(20260903);
  const hex2 = (v: number): string => Math.round(v).toString(16).padStart(2, '0');
  const randHex = (): string => '#' + hex2(rnd() * 255) + hex2(rnd() * 255) + hex2(rnd() * 255);
  // bias a third of the corpus pale — that is where the reported prototype
  // defect (an unfloored Simple rank with nothing to offer) actually lived.
  const randPaleHex = (): string => '#' + hex2(200 + rnd() * 55) + hex2(200 + rnd() * 55) + hex2(200 + rnd() * 55);
  const palettes: string[][] = [];
  for (let i = 0; i < N; i++) {
    const n = 3 + Math.floor(rnd() * 3); // 3..5 majors
    const pale = i % 3 === 0;
    palettes.push(Array.from({ length: n }, () => (pale ? randPaleHex() : randHex())));
  }
  return palettes;
}

const ALL_PALE_TRIOS: string[][] = [
  ['#FAF7F2', '#FFFFF0', '#FFFFFF'], // Cream, Ivory, White
  ['#FAF7F2', '#F2E8D5', '#E7E2DA'],
  ['#FFFFF0', '#FBFBF3', '#F3ECE0'],
  ['#FFFFFF', '#FFFFFF', '#FFFFFF'],
];

test('deriveBoard never throws over 1800 randomly-generated palettes, and no role holds a duplicate swatch', () => {
  const palettes = buildCorpus();
  const throwSamples: string[] = [];
  const dupSamples: string[] = [];
  let boards = 0;
  let throws = 0;
  let dupRoles = 0;

  for (const majors of palettes) {
    for (const style of STYLES) {
      boards++;
      let board;
      try {
        board = deriveBoard(majors, style);
      } catch (e) {
        throws++;
        if (throwSamples.length < 5) throwSamples.push(`${style} [${majors.join(' ')}]: ${(e as Error).message}`);
        continue;
      }
      for (const key of ['ceremony' as const, ...PEOPLE_KEYS]) {
        const colors = board[key];
        if (!colors) continue;
        const upper = colors.map((h) => h.toUpperCase());
        if (new Set(upper).size < upper.length) {
          dupRoles++;
          if (dupSamples.length < 5) dupSamples.push(`${style}/${key} [${majors.join(' ')}]: ${colors.join(',')}`);
        }
      }
    }
  }

  assert.equal(boards, N * STYLES.length);
  assert.deepEqual(throwSamples, [], `${throws} of ${boards} boards threw`);
  assert.deepEqual(dupSamples, [], `${dupRoles} roles held a duplicate swatch`);
});

test('all-pale trios (no headroom for the ladder) always derive without throwing', () => {
  const failures: string[] = [];
  for (const trio of ALL_PALE_TRIOS) {
    for (const style of STYLES) {
      try {
        deriveBoard(trio, style);
      } catch (e) {
        failures.push(`${style} [${trio.join(' ')}]: ${(e as Error).message}`);
      }
    }
  }
  assert.deepEqual(failures, []);
});
