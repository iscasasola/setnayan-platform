/**
 * 🃏🧰 THE LOGO MAKER'S CAROUSEL AND TOOLS (owner 2026-10-08, `LOGO_MAKER_REPLOT_2026-10-08_fable.md` L2 · L3 · L4,
 * approved *"approve add ornament"*; the 08 Oct addenda: no chips on the logo, no Play on the logo, *"size across
 * updown and rotate can be finger handled and when we pinch and twist, the sliders auto adjust with it too"*).
 *
 *   L2 · the layers carousel: a held card lands where the finger is (`cardDropIndex` → `moveLayerTo`); Duplicate puts
 *        "<name> copy" straight above its original, nudged, on the rails.
 *   L3 · Hide / Lock: two optional flags on the layer (JSONB — no migration), kept through the sanitiser; a HIDDEN
 *        layer is drawn by no surface (not a `data-logo-layer`, not in the ink box) yet its shapes come back on the
 *        next open; a LOCK is in the file, so locking alone is a change the save gate sees.
 *   L4 · Spacing (room after each letter), Looks (Outline = the edges only · Shadow = a soft offset copy), Split into
 *        letters (each letter exactly where it stood, its own layer, its own start).
 *   The page: the picked layer wears its dashed frame and NOTHING else; one finger moves it, two pinch (Size) and
 *   twist (Rotate) — the slider values themselves; a locked layer is never moved; nothing is sent while a finger is
 *   down, so a gesture is one undo step.
 *
 * SABOTAGE (each seen RED, then restored — see the PR): hidden composed as a drawn layer · the lock left out of the
 * file · `moveLayerTo` off by one · the split's scale ignoring the word's fit · the pinch writing a size the slider
 * does not hold · a locked layer still dragged.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { defaultMotion, LOGO_FRAME, LOGO_MAX_LAYERS, logoInkBox, sanitizeLogoLayers, type LogoLayer } from './logo-layers';
import {
  composeLogoSvg,
  duplicateLayer,
  fitFactor,
  layerShapes,
  layersFromSaved,
  LOGO_COPY_OFFSET,
  LOGO_SPLIT_STEP,
  metaOf,
  moveLayerTo,
  parseLogoSvg,
  splitIntoLetters,
} from './logo-layers-edit';
import { cardDropIndex, LOGO_CARD_HALF_PX } from './logo-maker-layout';
import { letterRun, outlineWords, type OtFace, type OtPath } from './logo-fonts';
import { sanitizeStudioSvg } from './monogram-studio-shared';

const SQ = (n: number) => `<path d="M0 0H${n}V${n}H0Z"/>`;
const layer = (id: string, over: Partial<LogoLayer> = {}): LogoLayer => ({
  id,
  kind: 'image',
  name: id,
  x: LOGO_FRAME / 2,
  y: LOGO_FRAME / 2,
  scale: 0.5,
  color: '#5B4A6B',
  motion: defaultMotion(0),
  body: SQ(100),
  w: 100,
  h: 100,
  ...over,
});
const ids = (ls: readonly { id: string }[]) => ls.map((l) => l.id).join('');
const PAGE = join(__dirname, '../app/dashboard/[eventId]/launch/_components/maker-logo.tsx');
const page = () => stripComments(readFileSync(PAGE, 'utf8'));

/* ── L2 · the carousel ─────────────────────────────────────────────────────── */

test('L2 · a held card lands on the card the finger is over — and the stack moves to match', () => {
  const mids = [33, 107, 181, 255];
  assert.equal(cardDropIndex(mids, 0, 40), 0, 'over its own place: stays');
  assert.equal(cardDropIndex(mids, 0, 107 + LOGO_CARD_HALF_PX - 1), 1);
  assert.equal(cardDropIndex(mids, 0, 107 + LOGO_CARD_HALF_PX), 0, 'past the half: not over that card');
  assert.equal(cardDropIndex(mids, 3, 30), 0);
  assert.equal(cardDropIndex([37, 121], 0, 121 + 36, 37), 1, 'a desk’s column measures by its own half');
  const stack = ['a', 'b', 'c', 'd'].map((id) => ({ id }));
  assert.equal(ids(moveLayerTo(stack, 'a', 3)), 'bcda', 'to the top');
  assert.equal(ids(moveLayerTo(stack, 'd', 0)), 'dabc', 'to the bottom');
  assert.equal(ids(moveLayerTo(stack, 'b', 2)), 'acbd');
  assert.equal(moveLayerTo(stack, 'b', 9), stack, 'out of range: unchanged');
  assert.equal(moveLayerTo(stack, 'zz', 1), stack);
});

test('L2 · Duplicate: "<name> copy", straight above its original, nudged, shown and free', () => {
  const ls = [layer('a'), layer('b', { hidden: true, locked: true, name: 'Ring' }), layer('c')];
  const next = duplicateLayer(ls, 'b', 'bcopy');
  assert.equal(ids(next), 'abbcopyc');
  const copy = next[2]!;
  assert.equal(copy.name, 'Ring copy');
  assert.equal(copy.x, 500 + LOGO_COPY_OFFSET);
  assert.equal(copy.y, 500 + LOGO_COPY_OFFSET);
  assert.equal(copy.hidden, undefined, 'the copy is the one being worked on — shown');
  assert.equal(copy.locked, undefined);
  const full = Array.from({ length: LOGO_MAX_LAYERS }, (_, i) => layer(`l${i}`));
  assert.equal(duplicateLayer(full, 'l0', 'x'), full, 'a full logo takes no copy');
});

/* ── L3 · hide and lock ────────────────────────────────────────────────────── */

test('L3 · hidden / locked / spacing / look survive the sanitiser — and nothing else gets in', () => {
  const [img, txt, bad] = sanitizeLogoLayers([
    { id: 'aa', kind: 'image', hidden: true, locked: true, spacing: 9, look: 'outline' },
    { id: 'bb', kind: 'text', text: 'MJ', spacing: 999, look: 'shadow', hidden: 'yes' },
    { id: 'cc', kind: 'text', text: 'MJ', spacing: 0, look: 'neon', locked: 1 },
  ]);
  assert.equal(img!.hidden, true);
  assert.equal(img!.locked, true);
  assert.equal(img!.spacing, undefined, 'spacing is a text layer’s');
  assert.equal(img!.look, undefined, 'a look is a text layer’s');
  assert.equal(txt!.spacing, 50, 'spacing is bounded');
  assert.equal(txt!.look, 'shadow');
  assert.equal(txt!.hidden, undefined, 'only `true` hides');
  assert.equal(bad!.spacing, undefined, 'no spacing is the face’s own');
  assert.equal(bad!.look, undefined);
  assert.equal(bad!.locked, undefined);
});

test('L3 · a HIDDEN layer is drawn by no surface, and comes back exactly on the next open', () => {
  const shown = layer('shown', { x: 300, scale: 0.2 });
  const hidden = layer('hid', { x: 800, scale: 0.2, hidden: true, color: null, body: '<path d="M0 0H50V50H0Z" fill="#123456"/>', w: 50, h: 50 });
  const svg = composeLogoSvg([shown, hidden])!;
  assert.deepEqual([...svg.matchAll(/data-logo-layer="([a-z]+)"/g)].map((m) => m[1]), ['shown'], 'the hidden layer is drawn');
  assert.match(svg, /^<svg[^>]*><defs data-logo-hidden=""><g data-logo-hidden-layer="hid"/, 'the hidden layer is not kept in the leading defs');
  // The ink box (what every surface centres on) is the shown layer's alone.
  const ink = logoInkBox(svg)!;
  assert.ok(ink.x + ink.w < 450, `the ink box reaches the hidden layer (${JSON.stringify(ink)})`);
  // The server's sanitiser keeps it…
  assert.equal(sanitizeStudioSvg(svg)?.includes('data-logo-hidden-layer="hid"'), true, 'the saved file loses the hidden layer');
  // …and the next open reads its shapes back, its own colours and all.
  const back = layersFromSaved(sanitizeLogoLayers([shown, hidden].map(metaOf)), svg);
  assert.equal(ids(back), 'shownhid');
  assert.equal(back[1]!.hidden, true);
  assert.equal(back[1]!.body, '<path d="M0 0H50V50H0Z" fill="#123456"/>');
  // Every layer hidden: nothing drawn, every layer kept.
  const none = composeLogoSvg([{ ...shown, hidden: true }])!;
  assert.doesNotMatch(none, /data-logo-layer=/);
  assert.equal(parseLogoSvg(none).get('shown')?.body, SQ(100), 'an all-hidden logo loses its shapes');
});

test('L3 · a LOCK is in the file (so locking alone is a change the save gate sees) — and stops the finger, not the sliders', () => {
  const a = composeLogoSvg([layer('a')])!;
  const b = composeLogoSvg([layer('a', { locked: true })])!;
  assert.notEqual(a, b, 'locking changes nothing the gate compares');
  assert.match(b, /data-logo-layer="a"[^>]*data-locked=""/);
  const src = page();
  assert.match(src, /if \(!p \|\| !l \|\| l\.locked\) return;/, 'a locked layer is still dragged');
  assert.match(src, /if \(l && !l\.locked && s && s\.d > 0\)/, 'a locked layer is still pinched');
});

/* ── the page: no chips, no Play on the logo, the fingers move the slider values ── */

test('the picked layer wears its dashed frame and nothing else; ▶ is in the tools row only', () => {
  const src = page();
  const canvas = src.slice(src.indexOf('data-logo-canvas=""'), src.indexOf('</svg>', src.indexOf('data-logo-canvas=""')));
  assert.match(canvas, /data-logo-selection=""/);
  for (const chip of [/Bring forward/, /Send back/, /aria-label="Lock"/, /data-logo-chip/]) assert.doesNotMatch(src, chip, `a chip on the logo: ${chip}`);
  assert.equal((src.match(/data-logo-play=""/g) ?? []).length, 1, 'a second Play');
  assert.ok(src.indexOf('data-logo-play=""') > src.indexOf('data-logo-tools-row=""'), 'Play is not in the tools row');
});

test('two fingers pinch the SIZE and twist the ROTATE the sliders hold; a gesture is sent once', () => {
  const src = page();
  // The pinch writes the same two values the Size and Rotate sliders read — one source of truth.
  assert.match(src, /update\(g\.id, studioAdds \? \{ scale, rotate: rotate \|\| undefined \} : \{ scale \}\);/, 'the pinch does not write the sliders’ values');
  assert.match(src, /<LogoSlider label="Size"[^>]*value=\{layer\.scale\}/);
  assert.match(src, /value=\{layer\.rotate \?\? 0\}/);
  assert.match(src, /Math\.min\(LOGO_SCALE_MAX, Math\.max\(LOGO_SCALE_MIN, /, 'the pinch leaves the slider’s range');
  // Nothing is scheduled while a finger is down; the lift sends it.
  assert.match(src, /useEffect\(\(\) => \{\s*if \(holding\.current\) return;/, 'a save can land mid-gesture (two undo steps for one pinch)');
  assert.match(src, /const letGo = \(\) => \{[\s\S]{0,200}holding\.current = false;[\s\S]{0,200}later\(\);/, 'the lift does not send the gesture');
});

/* ── L4 · spacing, looks, split ────────────────────────────────────────────── */

test('L4 · Spacing adds room after every letter — set glyph by glyph', () => {
  const path = (x: number): OtPath => {
    const box = { x1: x, y1: -10, x2: x + 8, y2: 0 };
    return { getBoundingBox: () => box, toPathData: () => `M${x} 0`, extend(p) { box.x2 = Math.max(box.x2, p.getBoundingBox().x2); } };
  };
  const face: OtFace = {
    unitsPerEm: 100,
    getPath: () => path(0),
    charToGlyph: () => ({ advanceWidth: 10, getPath: (x: number) => path(x) }),
    getKerningValue: () => 0,
  };
  const tight = letterRun(face, 'AB', 0, 0, 100).map((g) => g.path.getBoundingBox().x1);
  const roomy = letterRun(face, 'AB', 0, 0, 100, 20).map((g) => g.path.getBoundingBox().x1);
  assert.deepEqual(tight, [0, 10]);
  assert.deepEqual(roomy, [0, 30], 'spacing is not hundredths of the size after each letter');
  assert.equal(outlineWords(face, 'AB', 0, 0, 100, 20).getBoundingBox().x2, 38, 'the spaced words are not the spaced letters');
});

test('L4 · Looks: Outline is the edges only, Shadow a soft copy behind — both read back to the plain letters', () => {
  const t = layer('t', { kind: 'text', text: 'M', body: SQ(100), color: '#5B4A6B' });
  assert.match(layerShapes({ ...t, look: 'outline' }), /<path fill="none" stroke="#5B4A6B" stroke-width="3"/);
  assert.match(layerShapes({ ...t, look: 'shadow' }), /^<g data-look-shadow="" transform="translate\(5 5\)"><path fill="#E6D8BE"[^]*<\/g><path fill="#5B4A6B"/);
  assert.equal(layerShapes({ ...layer('i'), look: 'outline' }), layerShapes(layer('i')), 'a look is a text layer’s only');
  for (const look of ['outline', 'shadow'] as const) {
    const svg = composeLogoSvg([{ ...t, look }])!;
    assert.equal(parseLogoSvg(svg).get('t')?.body, SQ(100), `${look}: the letters do not read back plain`);
  }
});

test('L4 · Split into letters: each letter exactly where it stood in the word, its own layer, its own start', () => {
  const word = { w: 400, h: 100 };
  const t = layer('w', { kind: 'text', name: 'Text', text: 'A B', w: 400, h: 100, scale: 0.5, x: 500, y: 400, motion: { in: 'draw', during: 'still', delay: 1 } });
  const cuts = [
    { ch: 'A', body: SQ(80), w: 80, h: 90, cx: 50, cy: 50 },
    { ch: 'B', body: SQ(60), w: 60, h: 100, cx: 350, cy: 50 },
  ];
  let n = 0;
  const next = splitIntoLetters([layer('under'), t], 'w', word, cuts, () => `n${n++}`);
  assert.equal(ids(next), 'undern0n1', 'the word is not replaced by its letters, in place');
  const k = fitFactor(400, 100) * 0.5; // the word's frame units per its own unit
  const [a, b] = [next[1]!, next[2]!];
  assert.equal(a.x, Math.round(500 + (50 - 200) * k));
  assert.equal(b.x, Math.round(500 + (350 - 200) * k));
  assert.equal(a.y, 400);
  // Drawn at the word's size: its own fit × its scale = the word's.
  assert.ok(Math.abs(fitFactor(a.w, a.h) * a.scale - k) < 1e-3, 'the letter is not as big as it was in the word');
  assert.ok(Math.abs(fitFactor(b.w, b.h) * b.scale - k) < 1e-3);
  assert.deepEqual([a.text, b.text, a.name], ['A', 'B', 'A']);
  assert.deepEqual([a.motion.delay, b.motion.delay], [1, Number((1 + LOGO_SPLIT_STEP).toFixed(1))], 'each letter does not follow the one before');
  assert.equal(a.autoDelay, false, 'the steps are the couple’s now — never re-timed by the stack');
  // A turned word turns its letters' places with it.
  const turned = splitIntoLetters([{ ...t, rotate: 90 }], 'w', word, cuts, () => `r${n++}`);
  assert.equal(turned[0]!.x, 500);
  assert.equal(turned[0]!.y, Math.round(400 + (50 - 200) * k));
  // Too many for the logo, or one letter: unchanged.
  const full = [...Array.from({ length: LOGO_MAX_LAYERS - 1 }, (_, i) => layer(`f${i}`)), t];
  assert.equal(splitIntoLetters(full, 'w', word, cuts, () => 'x'), full);
  assert.equal(splitIntoLetters([t], 'w', word, cuts.slice(0, 1), () => 'x').length, 1);
});
