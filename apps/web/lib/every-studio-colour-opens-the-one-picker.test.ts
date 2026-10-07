/**
 * 🎨 EVERY STUDIO COLOUR OPENS THE ONE PICKER (owner 2026-10-08, relayed: *"we already have a design
 * for the color palettes and how to pick colors on the moodboard. apply that same concept on the
 * background and on any other color rules parts"* · *"the color suggestions should rely on the
 * moodboard as well. so the mood board colors, then the complementing colors for them"*).
 *
 *   A · the ONE picker is the Mood Board's `ColourPickerSheet` (the Attire colour sheet), and its
 *       suggestions run in the owner's order: Your palette (the five) · Goes with your palette (the
 *       Mood Board's own harmony, `candidatesFor`) · From your photos · Swatches · Custom (+ Use);
 *   B · `pickerSuggestions` is that order's source: the five first, then colours that go with them —
 *       taken from every one of the five, none repeating the five;
 *   C · every Studio colour control mounts it — through `StudioColourField` (which lazy-loads the
 *       sheet) or the sheet itself — and draws no `type="color"` of its own:
 *         Look › Colours (the five main colours) · Info › QR colour · Logo › Colour · Mood Board;
 *   D · the controls drawn by `ColourWell` (Look › Colours › Background · Buttons, and every Stages
 *       well) are RD's to move onto the same sheet (agreed by message 2026-10-08) — reported as a
 *       `todo` until `colour-well.tsx` mounts `ColourPickerSheet`, then asserted.
 *
 * 🛡 Sabotaged once each (2026-10-08), each red alone: the QR's Studio row drawn as its old PickMenu
 * (no `<StudioColourField`) → C; the "Your palette" row moved below Swatches → A; `pickerSuggestions`
 * returning the swatches instead of the harmony → B.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { PICKER_SWATCHES, pickerSuggestions } from './mood-board-studio';
import { candidatesFor } from './palette-recommender';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const D = 'app/dashboard/[eventId]';
const SHEET = `${D}/studio/mood-board/_components/colour-picker-sheet.tsx`;
const FIELD = `${D}/launch/_components/studio-colour-field.tsx`;

test('A · the one picker draws Your palette · Goes with your palette · From your photos · Swatches · Custom, in that order', () => {
  const src = read(SHEET);
  const at = (attr: string) => {
    const i = src.indexOf(attr);
    assert.ok(i > 0, `the picker has no ${attr}`);
    return i;
  };
  const order = ['data-picker-palette', 'data-picker-goes-with', 'data-picker-from-photos', 'data-picker-swatches', 'data-picker-custom'].map(at);
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'the picker’s rows are not in the owner’s order');
  assert.match(src, /const suggest = pickerSuggestions\(palette\);/, 'the picker computes its own suggestions');
  assert.match(src, /<Check aria-hidden className="h-4 w-4" \/> Use/, 'Custom has no ✓ Use');
});

test('B · the suggestions: the Mood Board’s five, then what goes with them — from every one of the five', () => {
  const five = ['#5B4A6B', '#D9C4CF', '#A9834B', '#F7F2EC', '#7A8B6F'];
  const s = pickerSuggestions(five.map((c) => c.toLowerCase()));
  assert.deepEqual(s.palette, five, 'the five are not first, as the Mood Board holds them');
  assert.equal(s.goesWith.length, 8);
  for (const c of s.goesWith) assert.ok(!five.includes(c), `${c} repeats one of the five`);
  const harmony = new Set(candidatesFor(five).map((x) => x.hex.toUpperCase()));
  for (const c of s.goesWith) assert.ok(harmony.has(c), `${c} is not the Mood Board’s own harmony`);
  assert.ok(!s.goesWith.every((c) => (PICKER_SWATCHES as readonly string[]).includes(c)), 'the “goes with” row is just the swatches');
  /* Not all from the first colour: the row answers the whole palette. */
  const fromFirst = new Set(candidatesFor([five[0]!]).map((x) => x.hex.toUpperCase()));
  assert.ok(s.goesWith.some((c) => !fromFirst.has(c)), 'every suggestion comes from the first colour alone');
  assert.deepEqual(pickerSuggestions([]), { palette: [], goesWith: [] }, 'with no Mood Board there is nothing to suggest from');
});

test('C · every Studio colour control mounts the one picker and draws no colour input of its own', () => {
  const field = read(FIELD);
  assert.match(field, /import\(\s*'\.\.\/\.\.\/studio\/mood-board\/_components\/colour-picker-sheet'\)\.then\(\(m\) => m\.ColourPickerSheet\)/, 'StudioColourField does not lazy-load the Mood Board’s picker');
  assert.match(field, /<ColourPickerSheet[\s\S]{0,200}palette=\{palette\}/, 'StudioColourField does not hand the five to the picker');
  const controls: Array<[string, string, RegExp]> = [
    ['Look › Colours (the five main colours)', `${D}/launch/_components/studio-tools.tsx`, /<StudioColourField\s+data=\{`main-\$\{slot\}`\}[\s\S]{0,300}palette=\{colours\}/],
    ['Info › QR colour', `${D}/launch/_components/qr-look-controls.tsx`, /studio \? \([\s\S]{0,400}<StudioColourField\s+data="qr-ink"[\s\S]{0,300}palette=\{inks\}/],
    ['Logo › Colour', `${D}/launch/_components/maker-logo.tsx`, /studio \? \([\s\S]{0,400}<StudioColourField\s+data="logo"[\s\S]{0,300}palette=\{studio\.five\}/],
    ['Mood Board (Palette · Attire)', `${D}/studio/mood-board/_components/mood-board-studio.tsx`, /<ColourPickerSheet[\s\S]{0,200}palette=\{five\}/],
  ];
  for (const [name, file, mounts] of controls) {
    assert.match(read(file), mounts, `${name} does not open the one picker with the Mood Board’s five`);
  }
  for (const file of [`${D}/launch/_components/studio-tools.tsx`, FIELD]) {
    assert.doesNotMatch(read(file), /type="color"/, `${file} draws a colour input of its own`);
  }
});

const WELL = `${D}/website/editor/_components/colour-well.tsx`;
const WELL_DONE = /ColourPickerSheet/.test(read(WELL));
test(
  'D · ColourWell (Look › Colours › Background · Buttons, the Stages wells) opens the one picker',
  WELL_DONE ? {} : { todo: 'RD moves ColourWell onto ColourPickerSheet (agreed 2026-10-08) — asserted once colour-well.tsx mounts it' },
  () => {
    if (!WELL_DONE) return;
    assert.match(read(WELL), /<ColourPickerSheet[\s\S]{0,300}palette=/, 'ColourWell opens the picker without the Mood Board’s five');
  },
);
