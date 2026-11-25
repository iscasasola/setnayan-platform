/**
 * 🎨 EVERY REVEAL DESIGN THE OWNER APPROVED IS OFFERED, AND DRAWN (owner 23 Nov 2026, DECISION_LOG "Approve both" ·
 * "ten reveals approved"; drawing v24 `env2.js` + `drape.js`, v25 `gift3.js`).
 *
 *   · ONE list (`REVEAL_LOOK_OPTIONS`): the classic's seven flap shapes, the gatefold's lilies + six panels, the satin +
 *     six fabrics, the gift box's six linings, nine floors and eight arrangements. The first of each is the reveal as it
 *     already plays, stored as nothing.
 *   · Both choosers read that list (the Maker's Reveal step and the Save the Date's Step 5), and the guest page and the
 *     previews hand the picks to the scene.
 *   · Every choice is drawn by its scene: none falls through to another's picture.
 *   · The classic's flap is 1.34× the screen wide, so no shape ever shows an upright side.
 *   · A couple without Event Pro cannot change a design (`REVEAL_ONLY_EFFECT_KEYS`).
 *
 * Sabotage check (run once by hand): drop 'deckle' from the envelope's outline → red; read `REVEAL_LOOK_OPTIONS` in the
 * Maker but not in Step 5 → red; set FLAP_BL to 1 → red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { REVEAL_LOOK_OPTIONS, resolveRevealEffects, revealLookKnobsFor, revealLooksFull, withRevealLook, DEFAULT_REVEAL_EFFECTS } from '@/lib/std-reveal-effects';
import { FLAP_BL } from './scenes/envelope';

const read = (rel: string) => stripComments(readFileSync(join(process.cwd(), rel), 'utf8'));
const R = 'app/[slug]/_components/reveal';
const keys = (k: keyof typeof REVEAL_LOOK_OPTIONS) => REVEAL_LOOK_OPTIONS[k].choices.map((c) => c[0]);
const labels = (k: keyof typeof REVEAL_LOOK_OPTIONS) => REVEAL_LOOK_OPTIONS[k].choices.map((c) => c[1]);

test('🎨 the approved designs, each list starting with the reveal as it already plays', () => {
  assert.deepEqual(labels('flap'), ['Scalloped', 'Deep V', 'Pointed Euro', 'Rounded', 'Square', 'Double scallop', 'Deckle edge']);
  assert.deepEqual(labels('panel'), ['Sculpted lilies', 'Art deco', 'Botanical line', 'Lace', 'Geometric', 'Monogram field', 'Pressed florals']);
  assert.deepEqual(labels('fabric'), ['Plain satin', 'Chiffon', 'Velvet', 'Linen', 'Organza', 'Tulle', 'Lace']);
  assert.equal(keys('lining').length, 6, 'six linings');
  assert.equal(keys('floor').length, 9, 'nine floors');
  assert.ok(labels('floor').includes('Cotton clouds') && labels('floor').includes('Egyptian cotton'), 'the cotton floors');
  assert.equal(keys('around').length, 8, 'eight arrangements');
  assert.deepEqual(revealLookKnobsFor('envelope-classic').map((k) => k.key), ['flap']);
  assert.deepEqual(revealLookKnobsFor('envelope-gatefold').map((k) => k.key), ['panel']);
  assert.deepEqual(revealLookKnobsFor('fabric').map((k) => k.key), ['fabric']);
  assert.deepEqual(revealLookKnobsFor('gift-box').map((k) => k.key), ['lining', 'floor', 'around']);
  assert.deepEqual(revealLookKnobsFor('veil-sheer'), []);
});

test('💾 a pick is stored sparse: the default as nothing, junk dropped, a real pick kept', () => {
  assert.deepEqual(withRevealLook(DEFAULT_REVEAL_EFFECTS, 'flap', 'scallop'), DEFAULT_REVEAL_EFFECTS, 'the default is stored as something');
  const picked = withRevealLook(withRevealLook(DEFAULT_REVEAL_EFFECTS, 'flap', 'deckle'), 'floor', 'clouds');
  assert.deepEqual(picked.looks, { flap: 'deckle', floor: 'clouds' });
  assert.deepEqual(resolveRevealEffects(JSON.parse(JSON.stringify(picked))).looks, { flap: 'deckle', floor: 'clouds' }, 'a saved pick does not come back');
  assert.equal(resolveRevealEffects({ looks: { flap: 'zigzag', floor: 42 } }).looks, undefined, 'a stored junk pick plays');
  assert.deepEqual(revealLooksFull(undefined), { flap: 'scallop', panel: 'lily', fabric: 'satin', lining: 'lame', floor: 'evening', around: 'flowers' });
  assert.match(read('lib/reveal-access.ts'), /REVEAL_ONLY_EFFECT_KEYS = \[[^\]]*'looks'/, 'a couple without Event Pro can change a design');
});

test('🧭 both choosers read the one list, and every surface hands the picks to the scene', () => {
  assert.match(read('app/dashboard/[eventId]/launch/_components/maker-reveal.tsx'), /<RevealDesignsRow picked=\{picked\} effects=\{effects\} onEffects=\{setEffects\} \/>/, 'the Maker does not offer the designs');
  const row = read('app/dashboard/[eventId]/launch/_components/stage-panel/reveal-designs-row.tsx');
  assert.match(row, /const knobs = revealLookKnobsFor\(picked\);/, 'the Maker\'s designs row does not read the one list');
  assert.match(row, /onPick=\{\(v\) => onEffects\(withRevealLook\(effects, k\.key, v\)\)\}/, 'a Maker pick is not kept');
  const std = read('app/dashboard/[eventId]/_components/reveal-preview-card.tsx');
  assert.match(std, /revealLookKnobsFor\(previewing\)/, 'Step 5 does not offer the designs');
  assert.match(read('app/dashboard/[eventId]/studio/save-the-date/_components/StdBuilderClient.tsx'), /withRevealLook\(e, key, value\)/, 'a Step 5 pick is not kept');
  assert.match(read(`${R}/reveal-overlay.tsx`), /looks=\{eventEffects\?\.looks\}/, 'the guest page does not pass the designs');
  assert.match(read('app/dashboard/[eventId]/_components/reveal-preview.tsx'), /looks=\{effects\?\.looks\}/, 'the preview does not pass the designs');
  assert.match(read(`${R}/scene-reveal.tsx`), /looks: revealLooksFull\(cb\.current\.looks\)/, 'the stage does not hand the designs to the scene');
});

test('🖌 every design is drawn by its scene', () => {
  const env = read(`${R}/scenes/envelope.ts`);
  assert.match(env, /const shape = c\.looks\.flap;/);
  for (const k of ['deepv', 'euro', 'round', 'square', 'double', 'scallop']) assert.match(env, new RegExp(`shape === '${k}'`), `the ${k} flap is not drawn`);
  assert.match(env, /const n2 = Math\.round\(54 \* wide\);/, 'the deckle edge is not drawn');
  assert.match(env, /const design = c\.looks\.panel;/);
  for (const k of ['deco', 'geo', 'botanical', 'lace', 'pressed']) assert.match(env, new RegExp(`\\b${k}\\(x, FW, FH\\)`), `the ${k} panel is not drawn`);
  assert.match(env, /design === 'monogram'\) monogramField\(/, 'the monogram field is not drawn');
  const drape = read(`${R}/scenes/drape.ts`);
  assert.match(drape, /const kind = c\.looks\.fabric;/);
  for (const k of keys('fabric').slice(1)) assert.match(drape, new RegExp(`kind === '${k}'`), `the ${k} fabric is not woven`);
  const gift = read(`${R}/scenes/gift.ts`);
  for (const k of keys('lining')) assert.match(gift, new RegExp(`\\b${k}: \\['#`), `the ${k} lining is not drawn`);
  for (const k of keys('floor').filter((f) => f !== 'evening' && f !== 'clouds_ivory')) assert.match(gift, new RegExp(`fk === '${k}'`), `the ${k} floor is not drawn`);
  assert.match(gift, /fk === 'clouds' \|\| fk === 'clouds_ivory'/, 'the ivory clouds are not drawn');
  for (const k of keys('around').filter((a) => a !== 'none')) assert.match(gift, new RegExp(`ak === '${k}'`), `the ${k} arrangement is not drawn`);
});

test('🖼 the classic flap is larger than the screen (owner: "the upper part must not cut vertically")', () => {
  assert.equal(FLAP_BL, 1.34);
  assert.match(read(`${R}/scenes/envelope.ts`), /w: W \* FLAP_BL,/, 'the front flap is the screen wide again');
});
