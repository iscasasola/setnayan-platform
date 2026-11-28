/**
 * 👗 GUIDED FABRIC PHOTOS → SLIDER STARTS (plan step B14, data side; INTEGRATION-PLAN v189 "6.4c").
 *   1 · Three generated photo sets (satin, mikado, chiffon) land near their type's values, and in the right order.
 *   2 · Every photo can be skipped: a skipped or unreadable photo suggests nothing; a skin-coloured cloth says nothing.
 *   3 · The readings become offsets from the type (the shop sheet's tune), within ±1; an exact match stores nothing.
 *   4 · No network and no AI: the module imports nothing but types.
 * Run: cd apps/web && npx tsx --test lib/gown-swatch/guide.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gownTuneFromPhotos, sheerFromHand, shineFromTilted, type GownPhoto } from './guide';

const W = 64, H = 64;
/** A photo of one tone, with a share of its centre pixels lifted to a highlight. */
function photo(tone: readonly [number, number, number], highlight = 0, highShare = 0): GownPhoto {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const lifted = (i * 7919) % 1000 < highShare * 1000;
    const t = lifted ? [highlight, highlight, highlight] : tone;
    data.set([t[0]!, t[1]!, t[2]!, 255], i * 4);
  }
  return { data, width: W, height: H };
}
const mix = (a: readonly number[], b: readonly number[], k: number) => [0, 1, 2].map((i) => Math.round(a[i]! * (1 - k) + b[i]! * k)) as [number, number, number];
const IVORY = [235, 228, 212] as const, HAND = [196, 150, 120] as const;
// The type values the generated sets should land near (fabric-types-research.md seeds).
const SETS = {
  satin: { sheen: 0.75, sheer: 0, tilted: photo([180, 176, 166], 240, 0.04), over: photo(IVORY), flat: photo(IVORY) },
  mikado: { sheen: 0.55, sheer: 0, tilted: photo([180, 176, 166], 222, 0.04), over: photo(IVORY), flat: photo(IVORY) },
  chiffon: { sheen: 0.25, sheer: 0.7, tilted: photo([200, 196, 188], 214, 0.04), over: photo(mix(IVORY, HAND, 0.7)), flat: photo(IVORY) },
};

test('1 · the generated satin, mikado and chiffon sets land near their type values, in order', () => {
  const read = Object.fromEntries(Object.entries(SETS).map(([k, s]) => [k, { shine: shineFromTilted(s.tilted)!, sheer: sheerFromHand(s.over, s.flat, HAND)! }]));
  for (const [k, s] of Object.entries(SETS)) {
    assert.ok(Math.abs(read[k]!.shine - s.sheen) <= 0.15, `${k} shine ${read[k]!.shine} not near ${s.sheen}`);
    assert.ok(Math.abs(read[k]!.sheer - s.sheer) <= 0.1, `${k} see-through ${read[k]!.sheer} not near ${s.sheer}`);
  }
  assert.ok(read.satin!.shine > read.mikado!.shine && read.mikado!.shine > read.chiffon!.shine, 'shine is out of order');
});

test('2 · every photo can be skipped; nothing readable suggests nothing', () => {
  assert.equal(shineFromTilted({ data: new Uint8ClampedArray(0), width: 0, height: 0 }), null);
  assert.equal(sheerFromHand(photo(IVORY), { data: new Uint8ClampedArray(0), width: 0, height: 0 }), null);
  assert.equal(sheerFromHand(photo(HAND), photo(HAND), HAND), null, 'a skin-coloured cloth claimed a see-through reading');
  assert.deepEqual(gownTuneFromPhotos({ sheen: 0.75, sheer: 0, stiff: 0.55 }, {}), {});
});

test('3 · readings become offsets from the type, within ±1; an exact match stores nothing', () => {
  const t = gownTuneFromPhotos({ sheen: 0.3, sheer: 0.1, stiff: 0.3 }, { shine: 0.9, sheer: 0.1, bend: 'stands' });
  assert.deepEqual(t, { shine: 0.6, body: 0.5 });
  const far = gownTuneFromPhotos({ sheen: 0, sheer: 0, stiff: 1 }, { shine: 1, bend: 'falls' });
  assert.ok(Object.values(far).every((v) => v! >= -1 && v! <= 1));
});

test('4 · no network and no AI: nothing is imported but types', () => {
  const src = readFileSync(join(__dirname, 'guide.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
  assert.deepEqual(src.match(/^import .*$/gm) ?? [], ["import type { GownFabricTune } from '../gown-maker';"]);
  assert.doesNotMatch(src, /fetch\(|XMLHttpRequest|anthropic|claude/i);
});
