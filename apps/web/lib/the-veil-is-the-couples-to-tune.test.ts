/**
 * 🧵 THE VEIL IS THE COUPLE'S TO TUNE (owner 2026-10-17, verbatim: *"veil customization can be fixed. fold coverage,
 * veil thread count, veil color"* · *"wind speed/randomness"* — DECISION_LOG "THE VEIL IS THE COUPLE'S TO TUNE" and
 * "THE VEIL'S WIND IS THE COUPLE'S TOO").
 *
 *   1. Untouched, the veil is TODAY'S VEIL EXACTLY — every middle choice stores nothing, and the cloth's new knobs at
 *      their house values draw the locked weave, the locked even sway and the measured drape.
 *   2. Every choice reaches the cloth: picked in the Maker → stored in `std_reveal_effects` (the draft's own key) →
 *      resolved → laid over the house look by `tuneRevealLooks` (what the guest page, ▶ and hold-▶ all play) → the
 *      number the cloth reads (`drape` · `weave` · `wind`+`gust`), and the colour into the material.
 *   3. The presets go the way their names say (Light < Medium < Full; Fine sheerer than Dense; Still < Breeze < Gusty).
 *   4. The cloth reads them where it draws (the weave in its alpha texture and rebuild key, the gusts in its wind,
 *      the fold in its lifted valance) and Cover Scene › Style draws the four, Pro ◆, writing the one effects save.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { DEFAULT_VEIL_LOOK, mergeRevealConfig } from './reveal-config-pure';
import { resolveRevealEffects, tuneRevealLooks, type RevealEffects } from './std-reveal-effects';
import {
  VEIL_FOLD_ORDER,
  VEIL_WEAVE_ORDER,
  VEIL_WIND_ORDER,
  liftedValance,
  veilFoldOf,
  veilWeaveOf,
  veilWindOf,
  weaveOf,
  withVeilFold,
  withVeilWeave,
  withVeilWind,
} from './veil-style';

const ROOT = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(ROOT, rel), 'utf8'));
const CLOTH = read('app/[slug]/_components/reveal/veil-reveal.tsx');
const OVERLAY = read('app/[slug]/_components/reveal/reveal-overlay.tsx');
const MAKER = read('app/dashboard/[eventId]/launch/_components/maker-reveal.tsx');

const house = mergeRevealConfig(null);
/** What the guest's veil plays for these stored effects — the stored JSON, resolved, laid over the house look. */
const played = (e: RevealEffects) => {
  const stored = resolveRevealEffects(JSON.parse(JSON.stringify(e)));
  return { look: tuneRevealLooks(house, stored.tune).veil!, stored };
};
const base = resolveRevealEffects(null);

/* ── 1 · untouched = today's veil, exactly ────────────────────────────────── */

test('untouched, every choice is its middle and the veil plays the house look itself', () => {
  assert.equal(veilFoldOf(base), 'medium');
  assert.equal(veilWeaveOf(base), 'medium');
  assert.equal(veilWindOf(base), 'breeze');
  assert.equal(base.veilColor, null, 'the colour is today’s (the Mood Board’s, else ivory) until one is chosen');
  for (const e of [withVeilFold(base, 'medium'), withVeilWeave(base, 'medium'), withVeilWind(base, 'breeze')]) {
    assert.equal('tune' in e, false, 'a middle choice stored something');
    assert.equal(tuneRevealLooks(house, e.tune).veil, house.veil, 'a middle choice changed the house look');
  }
  /* Picking a side and coming back leaves nothing behind. */
  const back = withVeilWind(withVeilWeave(withVeilFold(withVeilFold(withVeilWeave(withVeilWind(base, 'gusty'), 'dense'), 'full'), 'medium'), 'medium'), 'breeze');
  assert.deepEqual(back, base, 'a round trip to the middle left a tune behind');
});

test('the cloth’s new knobs at their house values draw the locked veil to the digit', () => {
  assert.equal(DEFAULT_VEIL_LOOK.drape, 15, 'the kept drape’s measured valance (15 hangs ~18 % of the cover)');
  assert.equal(DEFAULT_VEIL_LOOK.weave, 50);
  assert.equal(DEFAULT_VEIL_LOOK.gust, 0);
  assert.deepEqual(weaveOf(50), { ground: '#242424', thread: 'rgba(255,255,255,0.055)', pitch: 12 }, 'the locked weave moved');
  assert.equal(liftedValance(house.veil, true, DEFAULT_VEIL_LOOK.drape), 15, 'the Event Hub drape no longer hangs at 15');
  assert.equal(liftedValance(house.veil, false, DEFAULT_VEIL_LOOK.drape), house.veil.topValance, 'the Save the Date’s valance moved');
  /* The gusts are absent at 0: the sway's clock is the sim's own, and no gust term is added. */
  assert.match(CLOTH, /const tw = gs > 0 \? t \* \(1 \+ 0\.9 \* gs\) : t;/);
  assert.match(CLOTH, /const burst = gs > 0 \? [^;]+ : 1;/);
  assert.match(CLOTH, /\(gs > 0 \? wind \* we \* gs \* [^)]+\)[^:]*: 0\)/);
});

/* ── 2 · every choice reaches the cloth ───────────────────────────────────── */

test('each Fold reaches the drape’s valance, and reads back', () => {
  const at = Object.fromEntries(
    VEIL_FOLD_ORDER.map((f) => {
      const { look, stored } = played(withVeilFold(base, f));
      assert.equal(veilFoldOf(stored), f, `${f} did not read back`);
      return [f, liftedValance(look, true, DEFAULT_VEIL_LOOK.drape)];
    }),
  ) as Record<(typeof VEIL_FOLD_ORDER)[number], number>;
  assert.equal(at.medium, 15);
  assert.ok(at.light < at.medium && at.medium < at.full, `Light ${at.light} · Medium ${at.medium} · Full ${at.full}`);
  /* A chosen fold is the fold wherever the veil lifts — the Maker's ▶ (not a kept drape) shows it too. */
  const full = played(withVeilFold(base, 'full')).look;
  assert.equal(liftedValance(full, false, DEFAULT_VEIL_LOOK.drape), at.full, 'the ▶ preview ignores the chosen fold');
});

test('each Weave reaches the tulle’s texture, and reads back', () => {
  const lum = (hex: string) => parseInt(hex.slice(1, 3), 16);
  const w = Object.fromEntries(
    VEIL_WEAVE_ORDER.map((k) => {
      const { look, stored } = played(withVeilWeave(base, k));
      assert.equal(veilWeaveOf(stored), k, `${k} did not read back`);
      return [k, weaveOf(look.weave)];
    }),
  ) as Record<(typeof VEIL_WEAVE_ORDER)[number], ReturnType<typeof weaveOf>>;
  assert.deepEqual(w.medium, weaveOf(50));
  assert.ok(lum(w.fine.ground) < lum(w.medium.ground) && lum(w.medium.ground) < lum(w.dense.ground), 'Fine is not sheerer than Dense');
  assert.ok(w.fine.pitch > w.medium.pitch && w.medium.pitch > w.dense.pitch, 'Dense threads are not closer set');
});

test('each Wind reaches the sway’s speed and randomness, and reads back', () => {
  const w = Object.fromEntries(
    VEIL_WIND_ORDER.map((k) => {
      const { look, stored } = played(withVeilWind(base, k));
      assert.equal(veilWindOf(stored), k, `${k} did not read back`);
      return [k, { wind: look.wind, gust: look.gust }];
    }),
  ) as Record<(typeof VEIL_WIND_ORDER)[number], { wind: number; gust: number }>;
  assert.deepEqual(w.breeze, { wind: house.veil.wind, gust: 0 }, 'Breeze is not today’s sway');
  assert.deepEqual(w.still, { wind: 0, gust: 0 });
  assert.ok(w.gusty.wind > w.breeze.wind && w.gusty.gust > 0, 'Gusty is neither faster nor random');
});

test('the colour reaches the material, and the three rows never touch each other', () => {
  const e = withVeilWind(withVeilWeave(withVeilFold({ ...base, veilColor: '#1f2a44' }, 'light'), 'fine'), 'gusty');
  const { stored, look } = played(e);
  assert.equal(stored.veilColor, '#1f2a44', 'the chosen colour did not survive the save');
  assert.equal([veilFoldOf(stored), veilWeaveOf(stored), veilWindOf(stored)].join(), 'light,fine,gusty');
  assert.equal(look.topValance, house.veil.topValance, 'a choice moved a knob it does not own');
  assert.equal(look.folds, house.veil.folds);
  /* The guest's veil paints the couple's colour (else today's) into the material, every frame. */
  assert.match(OVERLAY, /veilColor=\{eventEffects\?\.veilColor \?\? veilColor\}/, 'the guest veil ignores the chosen colour');
  assert.match(OVERLAY, /look=\{looks\.veil\}/, 'the guest veil ignores the tuned look');
  assert.match(CLOTH, /mat\.color\.set\(colorRef\.current \|\| '#f3ece1'\);/);
});

/* ── 4 · the cloth reads them where it draws; the Maker draws the four ───── */

test('the cloth reads each knob where it draws', () => {
  assert.match(CLOTH, /const wv = weaveOf\(cfgRef\.current\.weave\);\s*a\.fillStyle = wv\.ground;/, 'the weave is not the texture’s ground');
  assert.match(CLOTH, /a\.strokeStyle = wv\.thread;/);
  assert.match(CLOTH, /d < S \* 2; d \+= wv\.pitch\)/, 'the weave is not the threads’ pitch');
  assert.match(CLOTH, /const structuralKey = `[^`]*\$\{L\.weave\}[^`]*`;/, 'a Weave change does not rebuild the texture');
  assert.match(CLOTH, /const gs = cfg\.gust \/ 100;/, 'the gusts are not read by the wind');
  assert.match(CLOTH, /clothHvh - 4 \* \(liftedValance\(cfg, keepsOpenRef\.current, DRAPE_VALANCE\) \/ 100\)/, 'the fold is not the lifted valance');
});

test('Cover Scene › Style draws Fold · Weave · Wind · Colour with the Sheer veil, Pro ◆, through the one effects save', () => {
  const part = MAKER.slice(MAKER.indexOf('function RevealStagePart('));
  assert.ok(part.length > 500, 'anti-vacuity: the Opening part is gone');
  assert.match(part, /const veil = picked === 'veil-sheer';/);
  for (const [small, data, w] of [
    ['Fold ◆', 'veil-fold', 'withVeilFold'],
    ['Weave ◆', 'veil-weave', 'withVeilWeave'],
    ['Wind ◆', 'veil-wind', 'withVeilWind'],
  ] as const) {
    const re = new RegExp(`<Dd small="${small}"[^>]*data="${data}"[^>]*onPick=\\{\\(k\\) => setEffects\\(${w}\\(effects, k as Veil\\w+\\)\\)\\} stacked />`);
    assert.match(part, re, `${small} is not the shipped stacked dropdown writing the effects`);
  }
  assert.match(part, /<ColourSheet\s+title="Veil colour"[\s\S]*?onPick=\{\(hex\) => setEffects\(\{ \.\.\.effects, veilColor: hex \}\)\}/, 'the colour is not the one sheet');
  /* Two rows of pills (as the shipped stacked dropdowns pair): Extras · Wind, then Fold · Weave · the colour. */
  assert.equal((part.match(/data-look-row="/g) ?? []).length, 2, 'the opening is not two rows');
  const rowB = part.slice(part.indexOf('data-look-row="veil"'));
  assert.ok(rowB.indexOf('veil-fold') < rowB.indexOf('veil-weave') && rowB.indexOf('veil-weave') < rowB.indexOf('<Swatch'));
  /* The save is the picker's one effects write — the draft, Pro at Apply. */
  assert.match(MAKER, /fd\.set\('patch', JSON\.stringify\(\{ events: \{ std_reveal_effects: next \} \}\)\);/);
});
