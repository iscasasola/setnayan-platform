/**
 * 🌗 SHADE NEVER CROSSES THE FLOOR (owner 2026-10-06: *"do make sure it can show
 * and make the texts readable"*; `lib/main-ground-shade.ts`).
 *
 * For EVERY shipped theme (its own page paper and ink, `pagePaperAndInk`) and
 * every Shade step, over every moving loop's measured colours, a plain colour
 * at both ends of the range, and a busy frame: the words the step paints keep
 * body contrast at or above `AA_BODY` — the floor `mainGroundLegibility` holds
 * today. And the steps are ordered: Darker veils more ink than Dark, Lighter
 * more paper than Light, As is no more than readability needs (it IS the
 * shipped rule).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { AA_BODY } from './hub-legibility';
import { INVITE_THEMES, type InviteThemeId } from './invite-themes';
import { mainGroundLegibility, pagePaperAndInk } from './adaptive-theme';
import { MAIN_GROUND_SHADES, mainGroundShade, shadeStep, shadeWordVars } from './main-ground-shade';
import { HUB_MAIN_SHADE_AT } from './hub-canvas';
import { STD_REALISTIC_BACKGROUNDS } from './std-backgrounds';

const THEMES = Object.keys(INVITE_THEMES) as InviteThemeId[];
const LOOP_FRAMES = THEMES.flatMap((id) => {
  const m = INVITE_THEMES[id].media;
  return m ? [[m.samples.light, m.samples.dark]] : [];
});
const FRAMES: string[][] = [['#ffffff'], ['#000000'], ['#808080'], ['#ff0000', '#00ff00', '#0000ff', '#ffff00'], ['#f4efe6', '#1e1a12'], ...LOOP_FRAMES];

test('the population is real — themes and loops were measured', () => {
  assert.ok(THEMES.length >= 5, `only ${THEMES.length} themes`);
  assert.ok(LOOP_FRAMES.length >= 3, `only ${LOOP_FRAMES.length} moving loops`);
  assert.deepEqual([...MAIN_GROUND_SHADES], ['darker', 'dark', 'as-is', 'light', 'lighter']);
});

test('every step, every theme, every frame: the words stay at or above AA', () => {
  let checked = 0;
  for (const id of THEMES) {
    const page = pagePaperAndInk(INVITE_THEMES[id]);
    for (const step of MAIN_GROUND_SHADES) {
      for (const frame of FRAMES) {
        const r = mainGroundShade(step, page, frame);
        assert.ok(
          r.bodyContrast >= AA_BODY - 1e-9,
          `${id} · ${step} over ${frame.join(' ')}: ${r.bodyContrast.toFixed(2)}:1 is under the ${AA_BODY}:1 floor`,
        );
        checked++;
      }
    }
  }
  assert.ok(checked > 100, `only ${checked} cases`);
});

test('the steps are ordered, the dark two flip the words, and As is is the shipped rule', () => {
  for (const id of THEMES) {
    const theme = INVITE_THEMES[id];
    const page = pagePaperAndInk(theme);
    for (const frame of FRAMES) {
      const [darker, dark, asIs, light, lighter] = MAIN_GROUND_SHADES.map((s) => mainGroundShade(s, page, frame));
      assert.ok(darker!.opacity >= dark!.opacity, `${id}: Darker veils less than Dark`);
      assert.ok(lighter!.opacity >= light!.opacity, `${id}: Lighter veils less than Light`);
      assert.equal(darker!.text, page.paper, 'Darker must flip the words light');
      assert.equal(lighter!.text, page.ink);
      assert.equal(asIs!.opacity, mainGroundLegibility(theme, frame).scrim, `${id}: As is is not the shipped veil`);
    }
  }
});

/* ── 🎚 the fade bar (owner 2026-10-08: "a line bar … fade to white … fade to black … snap to center") ───────────── */

/** Every whole position the bar can hold. */
const POSITIONS = Array.from({ length: 201 }, (_, i) => i - 100);

test('🎚 EVERY bar position, every theme, every frame: the words stay at or above AA — the bar never refuses one and never crosses the floor', () => {
  let checked = 0;
  for (const id of THEMES) {
    const page = pagePaperAndInk(INVITE_THEMES[id]);
    for (const at of POSITIONS) {
      for (const frame of FRAMES) {
        const r = mainGroundShade(at, page, frame);
        assert.ok(r.bodyContrast >= AA_BODY - 1e-9, `${id} · ${at} over ${frame.join(' ')}: ${r.bodyContrast.toFixed(2)}:1 is under the ${AA_BODY}:1 floor`);
        // The veil is at least the bar's own value — raised when the words need it, NEVER lowered.
        assert.ok(r.opacity >= Math.abs(at) / 100 - 1e-9, `${id} · ${at}: the veil (${r.opacity}) is under the bar's value`);
        // Left of the centre the veil is the page's ink and the words turn to its paper; at and right of it, the other way.
        assert.equal(r.veil, at < 0 ? page.ink : page.paper, `${id} · ${at}: the wrong veil`);
        assert.equal(r.text, at < 0 ? page.paper : page.ink, `${id} · ${at}: the wrong words`);
        checked++;
      }
    }
  }
  assert.ok(checked >= THEMES.length * 201 * 10, `only ${checked} cases`);
  assert.ok(STD_REALISTIC_BACKGROUNDS.length >= 5 && LOOP_FRAMES.length >= 3, 'anti-vacuity: the scenes or the loops are gone');
});

test('🎚 the words flip for EVERY position left of the centre and for none at or right of it', () => {
  for (const id of THEMES) {
    const page = pagePaperAndInk(INVITE_THEMES[id]);
    for (const at of POSITIONS) {
      const flip = shadeWordVars(mainGroundShade(at, page, ['#f4efe6', '#1e1a12']), page);
      if (at < 0) assert.ok(flip['--color-ink'] && flip['--color-cream'], `${id} · ${at}: an ink veil left the words dark`);
      else assert.deepEqual(flip, {}, `${id} · ${at}: a paper veil flipped the words`);
    }
  }
});

test('🎚 a word stored before the bar lays EXACTLY the veil it always did — at darker −70 · dark −45 · light +45 · lighter +70; the centre is As is', () => {
  assert.deepEqual(HUB_MAIN_SHADE_AT, { darker: -70, dark: -45, 'as-is': 0, light: 45, lighter: 70 });
  // The floors the four words shipped with (0.7 · 0.45 · 0 · 0.45 · 0.7), read back from their positions.
  assert.deepEqual(MAIN_GROUND_SHADES.map((s) => shadeStep(s)), [
    { veil: 'ink', floor: 0.7 },
    { veil: 'ink', floor: 0.45 },
    { veil: 'paper', floor: 0 },
    { veil: 'paper', floor: 0.45 },
    { veil: 'paper', floor: 0.7 },
  ]);
  for (const id of THEMES) {
    const theme = INVITE_THEMES[id];
    const page = pagePaperAndInk(theme);
    for (const frame of FRAMES) {
      for (const word of MAIN_GROUND_SHADES) {
        assert.deepEqual(mainGroundShade(word, page, frame), mainGroundShade(HUB_MAIN_SHADE_AT[word], page, frame), `${id}: “${word}” and its position disagree`);
      }
      assert.equal(mainGroundShade(0, page, frame).opacity, mainGroundLegibility(theme, frame).scrim, `${id}: the centre is not the shipped veil`);
    }
  }
  // Out of range is held at the ends — never a veil over 100 %.
  assert.deepEqual(shadeStep(250), { veil: 'paper', floor: 1 });
  assert.deepEqual(shadeStep(-250), { veil: 'ink', floor: 1 });
});
