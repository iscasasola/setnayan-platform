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
import { MAIN_GROUND_SHADES, mainGroundShade } from './main-ground-shade';

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
