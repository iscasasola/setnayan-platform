/**
 * THE STORY'S THEME — the host's choice of colours, and the stages it makes.
 *
 * `02_The_Story_Maker.md` §5 · `08` step 1.4. The Story Maker's Theme step asks
 * the one question the mood board cannot: *does the story follow you, or does it
 * go its own way from here?* This module answers that, and nothing else.
 *
 * 🔑 THE SIX STAGES ARE NOT DERIVED HERE. They come from `lib/story-light.ts`,
 * which the PUBLIC page paints with. This file held a provisional copy of that
 * derivation for exactly as long as the public module did not exist yet, and a
 * test failed the moment it did — that is why you are reading this instead of
 * two implementations quietly disagreeing about the same wedding. The Story
 * Maker's live preview and the published page now walk the same code, so a
 * preview cannot drift from the page it previews.
 *
 * What genuinely belongs here: the three modes, what each one resolves to, and
 * the board's own slot labels. Those are the host's desk, not the public page.
 */

import {
  MUTED_ALPHA,
  STAGE_NAMES,
  compositeOver,
  deriveStages,
  describe,
  neutralStages,
  type StageName,
} from './story-light';
import { PALETTE_LIMITS, sanitizeRolePalette, type RolePalette } from './mood-board';

/** What the host reads beside each stage in the live preview. Title-cased from
 *  the public module's own tuple, so a stage cannot exist on the page and be
 *  missing from the preview. */
export const STORY_STAGE_LABEL: Record<StageName, string> = {
  before: 'Before',
  morning: 'Morning',
  afternoon: 'Afternoon',
  dusk: 'Dusk',
  night: 'Night',
  after: 'After',
};

/**
 * NEUTRAL — warm paper and ink. Offered as a real choice, never as the failure
 * state of a missing board (`02` §5). These are the swatches SHOWN for the
 * neutral mode; the stages it paints come from `neutralStages()` in the public
 * module, so neutral looks the same in the preview as it does on the page.
 */
export const NEUTRAL_STORY_COLORS: readonly string[] = [
  '#EFEBE4',
  '#D8D2C6',
  '#FBFBFA',
  '#3A3733',
  '#B9AE99',
];

const HEX = /^#[0-9A-Fa-f]{6}$/;

/** One stage as the preview needs it — hex strings for inline styles. */
export type ThemeStage = {
  key: StageName;
  label: string;
  ground: string;
  ink: string;
  /** Secondary copy: the ink composited onto the ground at the page's own
   *  muted alpha, so the preview dims exactly the way the page does. */
  muted: string;
  accent: string;
};

/**
 * The six stages for a set of chosen colours — a thin adapter over the public
 * page's derivation, NOT a second one. Fewer than two usable colours falls to
 * the neutral stages, which is `deriveStages`'s own rule, not a new one.
 */
export function storyThemeStages(colors: readonly string[]): ThemeStage[] {
  const clean = colors.filter((c) => HEX.test(c));
  const stages = clean.length >= 2 ? deriveStages(clean) : neutralStages();
  return stages.map((st, i) => {
    const key = STAGE_NAMES[i] ?? 'morning';
    return {
      key,
      label: STORY_STAGE_LABEL[key],
      ground: describe(st.ground),
      ink: describe(st.ink),
      muted: describe(compositeOver(st.ink, st.ground, MUTED_ALPHA)),
      accent: describe(st.accent),
    };
  });
}

/* ─────────────────────────── the host's choice ─────────────────────────── */

export type StoryThemeMode = 'board' | 'own' | 'neutral';

export type StoryTheme = {
  mode: StoryThemeMode;
  /** Only meaningful for `own` — the host's story-only palette. */
  colors: string[];
};

/** `board` is the resting state: a host who has never opened the Theme step
 *  tracks the mood board, which is what "the colours you already chose" means. */
export const DEFAULT_STORY_THEME: StoryTheme = { mode: 'board', colors: [] };

/**
 * Validate a stored/posted theme. Same shape of contract as
 * `sanitizeRolePalette`: anything unrecognised falls back to the resting state,
 * hexes are upper-cased, and the colour list is clamped to the SAME max the
 * reception palette uses — a story palette that could hold more slots than the
 * board it started from would have nowhere to come back to.
 */
export function sanitizeStoryTheme(raw: unknown): StoryTheme {
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_STORY_THEME };
  const o = raw as Record<string, unknown>;
  const mode: StoryThemeMode =
    o.mode === 'own' || o.mode === 'neutral' || o.mode === 'board'
      ? o.mode
      : DEFAULT_STORY_THEME.mode;
  const colors = Array.isArray(o.colors)
    ? o.colors
        .filter((c): c is string => typeof c === 'string' && HEX.test(c))
        .map((c) => c.toUpperCase())
        .slice(0, PALETTE_LIMITS.reception.max)
    : [];
  // A story that says "my own colours" with none saved has nothing to render,
  // and silently drawing the board underneath it would tell the host their
  // detachment did not take. It falls back to the board and says so by BEING
  // the board — the Theme step re-seeds from the board on entry either way.
  if (mode === 'own' && colors.length === 0) return { ...DEFAULT_STORY_THEME };
  return { mode, colors: mode === 'own' ? colors : [] };
}

/**
 * The colours a story actually paints with, and where they came from.
 *
 * 🔑 `board` RE-READS THE BOARD EVERY TIME. That is the whole promise of the
 * mode — "change the board, the story follows" — so nothing here caches or
 * copies the reception palette into the story. `own` is the mode that stops
 * following, and it stops by holding its own list.
 */
export function resolveStoryPalette(
  theme: StoryTheme,
  rolePalette: RolePalette | unknown,
): { colors: string[]; mode: StoryThemeMode; followsBoard: boolean } {
  if (theme.mode === 'neutral') {
    return { colors: [...NEUTRAL_STORY_COLORS], mode: 'neutral', followsBoard: false };
  }
  if (theme.mode === 'own' && theme.colors.length > 0) {
    return { colors: [...theme.colors], mode: 'own', followsBoard: false };
  }
  const reception = sanitizeRolePalette(rolePalette).reception ?? [];
  // NO SAVED BOARD IS NOT AN ERROR. `01` §4: the neutral fallback is framed as
  // a choice, not a failure — so it renders the same warm paper the neutral
  // MODE does, and the Story Maker says which of the two the host is looking at.
  if (reception.length === 0) {
    return { colors: [...NEUTRAL_STORY_COLORS], mode: 'board', followsBoard: true };
  }
  return { colors: reception, mode: 'board', followsBoard: true };
}

/** The shipped slot labels, for the swatches the Theme step shows. Never
 *  invented names — these are the ones the host saw on their own board. */
export function receptionSlotLabel(index: number): string {
  return PALETTE_LIMITS.reception.slotLabels?.[index] ?? `Colour ${index + 1}`;
}
