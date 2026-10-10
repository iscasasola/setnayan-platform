/**
 * 🔠 THE LOGO ADDS THREE THINGS ONLY (owner 2026-10-06, DECISION_LOG "THE LOGO
 * MAKER IS THE SHIPPED LAYERED EDITOR — REDRAWN AS IT IS, PLUS THREE OF THE
 * OWNER'S OWN UNBUILT ASKS": *"it is not fixed. it just became more
 * confusing"* · *"yes always start from what we already have"*).
 *
 * The three, in the new Maker only:
 *   1 · Colour offers the five main colours (+ Its own on an image) — not the
 *       eight fixed inks; a layer already in another colour keeps it, shown;
 *   2 · a Rotate slider in Size and place — saved, drawn by the editor and the
 *       saved file alike (`layerTransform`);
 *   3 · Out in Motion — saved (`data-out`) and PLAYED by the guest player.
 * And nothing else: no starting designs (a "Monogram" or "Crest" to start
 * from), no ornaments, no split-into-letters, no hide / lock / duplicate, no
 * download. Sabotage any one of those into the editor and this goes red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import {
  LOGO_OUT,
  sanitizeLogoLayers,
  sanitizeLogoMotion,
  type LogoLayer,
} from './logo-layers';
import {
  LOGO_INKS,
  LOGO_OUT_LABEL,
  composeLogoSvg,
  layerTransform,
  logoColourChoices,
} from './logo-layers-edit';

const L = join(__dirname, '../app/dashboard/[eventId]/launch/_components/maker-logo.tsx');
const editor = () => stripComments(readFileSync(L, 'utf8'));
const FIVE = ['#5B4A6B', '#D9C4CF', '#A9834B', '#F7F2EC', '#7A8B6F'];

test('1 · Colour offers the five main colours in the new Maker, the eight inks otherwise', () => {
  assert.deepEqual(logoColourChoices({ five: FIVE }, '#5B4A6B'), FIVE);
  assert.deepEqual(logoColourChoices({ five: FIVE }, '#1E2229'), [...FIVE, '#1E2229'], 'a layer’s own colour must stay on the row');
  assert.deepEqual(logoColourChoices(null, null), [...LOGO_INKS]);
  const src = editor();
  assert.match(src, /label="Its own"/, 'Its own is gone');
  /* 🎨 Since 2026-10-08 the new Maker's Colour opens the Mood Board's ONE picker with the five first
     (owner: "apply that same concept … on any other color rules parts"); the shipped editor keeps its inks. */
  assert.match(src, /<StudioColourField\s+data="logo"[\s\S]{0,300}palette=\{studio\.five\}/, 'the new Maker’s logo colour does not open the one picker with the five');
  assert.match(src, /logoColourChoices\(null, layer\.color\)/, 'the shipped editor lost its inks');
});

test('2 · Rotate is a slider in Size and place, saved and drawn', () => {
  const src = editor();
  const place = src.slice(src.indexOf('label="Size and place"'), src.indexOf("label=\"How it's written\""));
  assert.match(place, /label=\{`Rotate /, 'no Rotate slider in Size and place');
  const [meta] = sanitizeLogoLayers([{ id: 'a1', kind: 'text', name: 'I', x: 500, y: 500, scale: 1, color: '#5B4A6B', rotate: 30, motion: {} }]);
  assert.equal(meta!.rotate, 30);
  assert.equal(sanitizeLogoLayers([{ id: 'a1', kind: 'text', x: 1, y: 1, scale: 1, rotate: 999, motion: {} }])[0]!.rotate, 180);
  assert.match(layerTransform({ w: 100, h: 100, x: 500, y: 500, scale: 1, rotate: 30 }), /rotate\(30\)/);
  assert.doesNotMatch(layerTransform({ w: 100, h: 100, x: 500, y: 500, scale: 1 }), /rotate/, 'an upright layer’s transform changed');
});

test('3 · Out is in Motion, saved, and played', () => {
  assert.deepEqual(LOGO_OUT.map((k) => LOGO_OUT_LABEL[k]), ['None', 'Fade', 'Sink']);
  assert.equal(sanitizeLogoMotion({ in: 'fade', during: 'still', delay: 0, out: 'sink' }).out, 'sink');
  assert.equal(sanitizeLogoMotion({ in: 'fade', out: 'none' }).out, undefined);
  assert.equal(sanitizeLogoMotion({ in: 'fade', out: 'explode' }).out, undefined);
  const layer = { id: 'a1', kind: 'text', name: 'I', x: 500, y: 500, scale: 1, color: '#5B4A6B', body: '<path d="M0 0h10v10z"/>', w: 10, h: 10, motion: { in: 'fade', during: 'still', delay: 0, out: 'fade' } } as LogoLayer;
  assert.match(composeLogoSvg([layer])!, /data-out="fade"/);
  const src = editor();
  /* RE-AIMED 2026-10-09 (Studio › Logo's chrome moved onto the templates): Out is a Form row's dropdown carrying its mark. */
  assert.match(src.slice(src.indexOf('label="Motion"')), /'data-logo-out': ''/, 'no Out row in Motion');
  const player = stripComments(readFileSync(join(__dirname, '../app/_components/layered-logo-player.tsx'), 'utf8'));
  assert.match(player, /getAttribute\('data-out'\)/, 'the player never plays Out');
});

test('nothing else: no starting designs, ornaments, split, hide / lock / duplicate or download', () => {
  const src = editor();
  for (const banned of [/\bCrest\b/, /['"`>]\s*Monogram\s*['"`<]/, /Starting design/i, /Start from/i, /Ornament/i, /Split into letters/i, /Duplicate/i, /Lock (it|layer)/i, /Hide (it|layer)/i, /Download/i]) {
    assert.doesNotMatch(src, banned, `the Logo editor gained ${banned}`);
  }
});

test('▾ Motion\'s In · During · Out are dropdowns, never chip rows (owner 2026-10-07)', () => {
  const src = editor();
  const motion = src.slice(src.indexOf('label="Motion"'), src.indexOf('<LogoSlider', src.indexOf('label="Motion"')));
  assert.ok(motion.length > 0, 'the Motion field moved — re-anchor this test');
  assert.doesNotMatch(motion, /<Chip\b/, 'a Motion choice is a chip row again');
  for (const which of ['In', 'During', 'Out']) {
    /* RE-AIMED 2026-10-09: each is the Form row's dropdown (`ChosenRow`, over the same PickMenu). */
    assert.match(motion, new RegExp(`<ChosenRow\\s+name="${which}"`), `${which} is not a dropdown`);
  }
});
