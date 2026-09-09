/**
 * THE CONTRAST FLOOR FOR THE STORY'S LIGHT — six stages × four palettes.
 *
 * `01_The_Story.md` §4: *"Every colour is contrast-checked before use … A colour
 * taken from a mood board is never trusted to be legible."* A mood board is
 * chosen for napkins, flowers and a venue's walls, against a florist's white
 * page. Nobody picking "Sage" is answering the question "can 11px of body copy
 * sit on this", and three of the four palettes below were picked precisely
 * because their raw swatches CANNOT carry text — a mid-luminance ground where
 * neither black nor white reaches 12:1, a near-white board where the host's own
 * darkest colour is still too pale, and a board that is almost entirely dark.
 *
 * 🔑 THIS TEST CHECKS THE CLAIM, NOT A PROXY. It does not assert that
 * `correctedInk` was called, or that the output differs from the input — both
 * would pass on a loop that nudges in the wrong direction. It computes the WCAG
 * ratio of every rendered pair and compares it to the floor the design states.
 *
 * SABOTAGE-CHECKED, WITH THE COUNTS MEASURED RATHER THAN GUESSED. Of the 72
 * pairs it checks (4 palettes × 6 stages × 3 roles): with the `carryable()`
 * ground correction removed, 11 fall under the floor — worst `#FFFFFF` on
 * `#AD8F2D`, 3.11:1, which is a gold page with white body copy on it. With
 * `correctedInk` returning its input untouched, 58 of 72 fall under. Restored,
 * 0 of 72. The count is printed on every run, passing or failing, because a
 * guard that cannot say how much it measured reads exactly like one that
 * measured nothing.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  NEUTRAL_STORY_COLORS,
  STORY_ACCENT_MIN,
  STORY_INK_MIN,
  STORY_LIGHT_STAGES,
  STORY_MUTED_MIN,
  contrastRatio,
  resolveStoryPalette,
  sanitizeStoryTheme,
  storyLightStages,
} from './story-theme';

/** Four boards. Three of them are illegible as saved — that is the point. */
const PALETTES: Record<string, string[]> = {
  neutral: [...NEUTRAL_STORY_COLORS],
  // Sage & terracotta — an ordinary, mid-luminance Filipino wedding board. Its
  // middle greens sit where NEITHER black nor white reaches 12:1 unaided.
  'sage & terracotta': ['#EFE9DD', '#A8B5A0', '#7C8B72', '#C97B4B', '#4A4438'],
  // A near-white board. The host's own "darkest" is still pale enough that
  // uncorrected body copy on it lands around 2:1.
  'blush & ivory': ['#FDF9F6', '#F5E3E0', '#E8CFC9', '#D9B8B0', '#C8A69C'],
  // A near-black board — the correction has to run in the other direction.
  'midnight & gold': ['#0F1419', '#1C2530', '#2E3B49', '#8A6A2F', '#C9A227'],
};

test('every stage of every palette carries legible body, muted and accent text', () => {
  const failures: string[] = [];
  let checked = 0;

  for (const [name, colors] of Object.entries(PALETTES)) {
    const stages = storyLightStages(colors);
    assert.equal(
      stages.length,
      STORY_LIGHT_STAGES.length,
      `${name}: expected one stage per named stage`,
    );

    for (const s of stages) {
      const pairs: Array<[string, string, number]> = [
        ['body ink', s.ink, STORY_INK_MIN],
        ['muted', s.muted, STORY_MUTED_MIN],
        ['accent-as-text', s.accent, STORY_ACCENT_MIN],
      ];
      for (const [what, fg, min] of pairs) {
        checked += 1;
        const ratio = contrastRatio(fg, s.ground);
        if (ratio < min) {
          failures.push(
            `${name} · ${s.key} · ${what}: ${fg} on ${s.ground} = ${ratio.toFixed(2)}:1 (needs ${min}:1)`,
          );
        }
      }
    }
  }

  // Print the occurrence count either way — a guard that cannot say how much it
  // measured cannot be told apart from a guard that measured nothing.
  console.log(`[story-theme] contrast pairs checked: ${checked}, under floor: ${failures.length}`);
  assert.equal(checked, Object.keys(PALETTES).length * STORY_LIGHT_STAGES.length * 3);
  assert.deepEqual(failures, [], `\n${failures.join('\n')}`);
});

test('the raw boards really are illegible — so the test above is testing something', () => {
  // If a palette's own darkest-on-lightest already cleared 12:1, correcting it
  // would be a no-op and the guard above would pass on an empty promise.
  const rawFailures = Object.entries(PALETTES).filter(([name]) => name !== 'neutral').filter(
    ([, colors]) => {
      const sorted = [...colors].sort();
      const lo = sorted[0] ?? '#000000';
      const hi = sorted[sorted.length - 1] ?? '#FFFFFF';
      return contrastRatio(lo, hi) < STORY_INK_MIN;
    },
  );
  assert.equal(rawFailures.length, 3, 'all three non-neutral boards must start illegible');
});

test('a story with no saved board is offered the neutral paper, not a blank one', () => {
  const r = resolveStoryPalette(sanitizeStoryTheme(null), {});
  assert.equal(r.mode, 'board');
  assert.equal(r.followsBoard, true);
  assert.deepEqual(r.colors, [...NEUTRAL_STORY_COLORS]);
});

test('"follow my mood board" re-reads the board rather than copying it', () => {
  const theme = sanitizeStoryTheme({ mode: 'board' });
  const first = resolveStoryPalette(theme, { reception: ['#112233'] });
  const afterHostEditsBoard = resolveStoryPalette(theme, { reception: ['#445566'] });
  assert.deepEqual(first.colors, ['#112233']);
  assert.deepEqual(afterHostEditsBoard.colors, ['#445566']);
});

test('"make my own" stops following the board', () => {
  const theme = sanitizeStoryTheme({ mode: 'own', colors: ['#112233', '#AABBCC'] });
  const r = resolveStoryPalette(theme, { reception: ['#FF0000'] });
  assert.equal(r.followsBoard, false);
  assert.deepEqual(r.colors, ['#112233', '#AABBCC']);
});

test('"my own colours" with nothing saved falls back to the board, never to blank', () => {
  const theme = sanitizeStoryTheme({ mode: 'own', colors: [] });
  assert.equal(theme.mode, 'board');
});

test('neutral is a choice that does not follow the board', () => {
  const r = resolveStoryPalette(sanitizeStoryTheme({ mode: 'neutral' }), {
    reception: ['#FF0000'],
  });
  assert.equal(r.followsBoard, false);
  assert.deepEqual(r.colors, [...NEUTRAL_STORY_COLORS]);
});

test('a hand-crafted theme cannot smuggle junk or extra slots into the story', () => {
  const theme = sanitizeStoryTheme({
    mode: 'own',
    colors: ['#AABBCC', 'red', '#112233', '#223344', '#334455', '#445566', '#556677', 42],
  });
  assert.equal(theme.mode, 'own');
  assert.equal(theme.colors.length, 5, 'clamped to the reception palette max');
  assert.ok(theme.colors.every((c) => /^#[0-9A-F]{6}$/.test(c)));
});

/**
 * THE COLLAPSE GUARD — one derivation, or this fails.
 *
 * `lib/story-theme.ts` derives the six stages provisionally, because the Story
 * Maker's live preview needed them before the public page's own module existed.
 * A parallel session is building `lib/story-light.ts` with the same six stages,
 * the same three floors and the crossfade this one omits.
 *
 * 🔑 A COMMENT ASKING A FUTURE SESSION TO REMEMBER IS NOT A MECHANISM. The
 * moment that module lands on main, this test fails and says exactly what to do,
 * so the two cannot quietly coexist and drift — which would leave the host's
 * preview showing one set of colours and their published page another.
 *
 * SABOTAGE-CHECKED: creating an empty `lib/story-light.ts` made this test fail
 * with the reconciliation instruction; removing it again restored the pass.
 */
test('the story maker and the public page derive the six stages ONCE', () => {
  const publicModule = join(process.cwd(), 'lib', 'story-light.ts');
  if (!existsSync(publicModule)) return; // not landed yet — nothing to collapse

  const theme = readFileSync(join(process.cwd(), 'lib', 'story-theme.ts'), 'utf8');
  assert.ok(
    /from '\.\/story-light'/.test(theme),
    'lib/story-light.ts has landed, so lib/story-theme.ts must now import its ' +
      'deriveStages() instead of deriving the six stages a second time. Two ' +
      'derivations means the Story Maker preview and the published page can ' +
      'disagree about the same wedding. Delete storyLightStages() here, keep ' +
      'sanitizeStoryTheme / resolveStoryPalette / receptionSlotLabel, and drop ' +
      'the provisional notice at the top of the file.',
  );
});
