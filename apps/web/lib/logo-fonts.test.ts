/**
 * 🅻 THE LOGO'S FONTS ARE THE STAGES' FONTS (owner 2026-09-28: *"on the logo.
 * we need to show all fonts as well like in stages"*) — and the two position
 * sliders snap to the centre (*"allow snap to center here"*).
 *
 *   1. ONE LIST: the Logo text layer's Typeface dropdown offers exactly the
 *      stage Font list (`HUB_FONTS`), in the stages' own dropdown (`FontPick`,
 *      the one font dropdown, 2026-09-29) — never a second list;
 *   2. every face on that list can actually be DRAWN in a logo: it has an
 *      outline file, the file is in public/, and it outlines "AM";
 *   3. a saved layer keeps any stage face; a studio-era layer keeps the face it
 *      was drawn in (Cardo Italic; `cinzeldec` → Cinzel Decorative);
 *   4. Across / Up and down: a drag near the middle lands on the exact centre,
 *      outside the band it is left alone, and the keyboard never snaps.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseFont } from 'opentype.js';
import { stripComments } from './strip-comments';
import { HUB_FONT_KEYS, HUB_FONTS } from './hub-fonts';
import {
  LOGO_FONT_OUTLINE,
  LOGO_FONT_OUTLINE_ITALIC,
  LOGO_FONT_VARIATION,
  logoFontOutlineUrl,
  outlineWords,
  pinLogoFaceWeight,
  type OtFace,
} from './logo-fonts';
import { LOGO_FRAME, LOGO_SLIDER_SNAP, sanitizeLogoLayers, snapSliderToCentre } from './logo-layers';

const ROOT = join(__dirname, '..');
const EDITOR = 'app/dashboard/[eventId]/launch/_components/maker-logo.tsx';
const editor = stripComments(readFileSync(join(ROOT, EDITOR), 'utf8'));

test('1 · the Logo offers exactly the stage font list, in the stage dropdown', () => {
  const stage = HUB_FONTS.map((f) => f.key).sort();
  assert.ok(stage.length >= 30, `the stage list is the full catalogue (${stage.length})`);
  assert.deepEqual(Object.keys(LOGO_FONT_OUTLINE).sort(), stage, 'the logo knows every stage font, and no other');
  assert.deepEqual([...HUB_FONT_KEYS].sort(), stage);
  // The editor's Typeface control IS the stage dropdown, fed by the stage list.
  const picker = /<FontPick\s[^>]*?label="Typeface"[\s\S]*?\/>/.exec(editor)?.[0] ?? '';
  assert.ok(picker, 'the Typeface control is the one font dropdown (FontPick)');
  assert.doesNotMatch(picker, /\boptions=/, 'fed by the one shelf list, never a list of its own');
  assert.match(editor, /outlineWords\(face, words, 0, 0, S\)/, 'the editor sets words through outlineWords (never a bare face.getPath)');
  assert.doesNotMatch(editor, /face\.getPath\(/);
  assert.doesNotMatch(editor, /STUDIO_FONTS|<select\b/, 'no second font list, no native select');
});

test('2 · every stage font can be outlined into a logo', () => {
  const missing: string[] = [];
  for (const f of HUB_FONTS) {
    for (const url of [logoFontOutlineUrl(f.key, false), logoFontOutlineUrl(f.key, true)]) {
      const file = join(ROOT, 'public', url);
      if (!existsSync(file)) {
        missing.push(`${f.key} → ${url}`);
        continue;
      }
      const b = readFileSync(file);
      const face = parseFont(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer) as unknown as OtFace;
      pinLogoFaceWeight(face, f.key); // as `textShapes` does, before any outline
      // What the editor does (`textShapes` → `outlineWords`), on a couple's words.
      for (const words of ['AM', 'Ana & Miguel', 'Ñiño']) {
        const bb = outlineWords(face, words, 0, 0, 200).getBoundingBox();
        assert.ok(bb.x2 - bb.x1 > 50 && bb.y2 - bb.y1 > 20, `${f.key} (${url}) outlines "${words}"`);
      }
    }
  }
  assert.deepEqual(missing, [], 'a stage font with no outline file cannot be drawn in a logo');
  console.log(`# outlined ${HUB_FONTS.length} stage fonts (+${Object.keys(LOGO_FONT_OUTLINE_ITALIC).length} italic)`);
});

test('2b · a variable outline file draws at the weight the stage sets — never its hairline default', () => {
  /*
    The ten theme faces (2026-10-04) include three VARIABLE files kept whole
    (their names are reserved, so they may not be instanced). opentype.js draws
    a variable face at its DEFAULT instance — Josefin Sans' is 100, a hairline.
    Every variable outline file must therefore default to 400 or be pinned to it.
  */
  type Axis = { tag: string; defaultValue: number };
  type Parsed = OtFace & { tables: { fvar?: { axes: Axis[] } } };
  const variable: string[] = [];
  for (const f of HUB_FONTS) {
    const b = readFileSync(join(ROOT, 'public', LOGO_FONT_OUTLINE[f.key]));
    const face = parseFont(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer) as unknown as Parsed;
    const wght = face.tables.fvar?.axes.find((a) => a.tag === 'wght');
    if (!wght) {
      assert.equal(LOGO_FONT_VARIATION[f.key], undefined, `${f.key} is static — a pin would do nothing`);
      continue;
    }
    variable.push(f.key);
    const drawn = LOGO_FONT_VARIATION[f.key]?.wght ?? wght.defaultValue;
    assert.equal(drawn, 400, `${f.key}: the logo would draw weight ${drawn}, the stage draws 400`);
  }
  assert.deepEqual(variable.sort(), ['baskerville', 'josefin', 'lora'], 'precondition: the three variable files were found');
  // Non-vacuity: the pin MOVES the outline — Josefin at 400 is wider than at 100.
  const b = readFileSync(join(ROOT, 'public', LOGO_FONT_OUTLINE.josefin));
  const raw = () => parseFont(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer) as unknown as OtFace;
  const hair = raw();
  const pinned = raw();
  pinLogoFaceWeight(pinned, 'josefin');
  for (const words of ['AM', 'Ñiño']) {
    const w = (face: OtFace) => {
      const bb = outlineWords(face, words, 0, 0, 200).getBoundingBox();
      return bb.x2 - bb.x1;
    };
    assert.ok(w(pinned) > w(hair) + 2, `Josefin "${words}" pinned to 400 (${w(pinned)}) is heavier than its 100 default (${w(hair)})`);
  }
});

test('3 · a saved layer keeps any stage face; a studio-era layer keeps the face it was drawn in', () => {
  const text = (o: Record<string, unknown>) =>
    sanitizeLogoLayers([{ id: 't1', kind: 'text', text: 'AM', x: 500, y: 500, scale: 1, motion: {}, ...o }])[0]!;
  for (const f of HUB_FONTS) {
    const l = text({ font: f.key, italic: false });
    assert.equal(l.font, f.key, `${f.key} survives the save`);
    assert.equal(l.italic, false);
  }
  // Before the stage list, the studio's "Cardo" was Cardo ITALIC — no `italic` saved.
  assert.deepEqual([text({ font: 'cardo' }).font, text({ font: 'cardo' }).italic], ['cardo', true]);
  assert.equal(text({ font: 'cardo', italic: false }).italic, false, 'an upright Cardo stays upright');
  assert.equal(text({ font: 'cinzeldec' }).font, 'cinzeldeco', 'the studio key for Cinzel Decorative');
  assert.equal(text({ font: 'jost', italic: true }).italic, false, 'no italic outlines → upright');
  assert.equal(text({ font: 'comic-sans' }).font, 'cardo', 'a font off the list is refused');
});

test('4 · Across / Up and down snap a drag to the exact centre, and only a drag', () => {
  const band = LOGO_FRAME * LOGO_SLIDER_SNAP; // 30 of 0 … 1000
  assert.equal(snapSliderToCentre(498, 0, LOGO_FRAME), 500, 'near the middle → the TRUE centre');
  assert.equal(snapSliderToCentre(500 - band, 0, LOGO_FRAME), 500, 'at the band’s edge → centre');
  assert.equal(snapSliderToCentre(500 + band, 0, LOGO_FRAME), 500);
  assert.equal(snapSliderToCentre(500 - band - 1, 0, LOGO_FRAME), 500 - band - 1, 'outside the band → unchanged');
  assert.equal(snapSliderToCentre(812, 0, LOGO_FRAME), 812);
  assert.equal(snapSliderToCentre(0.49, 0, 1, 0.03), 0.5, 'any range: its own middle');

  // Both position sliders snap; Size does not.
  for (const label of ['Across', 'Up and down']) {
    assert.match(editor, new RegExp(`<Slider label="${label}"[^>]*\\ssnapCentre\\s`), `${label} snaps to centre`);
  }
  assert.doesNotMatch(/<Slider label="Size"[^>]*>/.exec(editor)?.[0] ?? '', /snapCentre/);
  // The slider: a centre tick, snapping only while a pointer drags, a haptic tap.
  const slider = editor.slice(editor.indexOf('function Slider('));
  assert.match(slider, /data-slider-centre/, 'a tick marks the middle of the track');
  assert.match(slider, /onKeyDown=\{\(\) => \{\s*dragging\.current = false;/, 'a key press is never a drag');
  assert.match(slider, /if \(!snapCentre \|\| !dragging\.current\) \{\s*onChange\(raw\);/, 'the keyboard steps freely');
  assert.match(slider, /snapSliderToCentre\(raw, min, max\)/);
  assert.match(slider, /navigator\.vibrate\(10\)/, 'a light haptic as it lands');
});
