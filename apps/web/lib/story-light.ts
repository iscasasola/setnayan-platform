/**
 * THE STORY'S LIGHT — six stages derived from the colours the host already saved.
 *
 * `01_The_Story.md` §1 "The light" + §4 "Colour", `02_The_Story_Maker.md` §5.
 * The public page's ground moves from morning to night as the reader scrolls,
 * and the Story Maker repaints the same six stages live while the host picks.
 * ONE derivation serves both — a second one is how a preview starts lying about
 * the page it previews.
 *
 * ── WHERE THE COLOURS COME FROM ──────────────────────────────────────────────
 * `sanitizeRolePalette(events.role_palette).reception` — the host's saved mood
 * board, 3–5 swatches in the shipped slots (Dominant · Supporting · Accent ·
 * Neutral · Accent 2, `PALETTE_LIMITS.reception.slotLabels`). Nothing here
 * invents a slot name; the board's own labels are the only ones a host has seen.
 *
 * ── 🔴 CORRECTION IS MANDATORY ───────────────────────────────────────────────
 * A colour taken from a mood board is NEVER trusted to be legible. A board is
 * chosen for napkins and flowers, against a florist's white page — nobody
 * picking "Sage" is answering the question "can 11px of copy sit on this".
 * Every ground, ink, muted and accent below is contrast-checked and nudged
 * toward black or white until it passes:
 *
 *     body ink      ≥ 12:1     muted text ≥ 4.6:1     accent-as-text ≥ 4.5:1
 *
 * 🔑 THE GROUND IS CORRECTED FIRST, AND THAT ORDER IS LOAD-BEARING. A
 * mid-luminance ground (say #777) cannot carry 12:1 ink at all — pure black
 * reaches ~5.3:1 on it and pure white ~4.4:1, so no ink exists that passes and
 * an ink-only correction loop would run to its extreme and return an illegible
 * colour while reporting success. So `carryable()` pushes the GROUND toward its
 * own nearer extreme until *some* ink can reach the floor, and only then is the
 * ink nudged. Correcting the ink first is the shape of that bug.
 *
 * ── WHAT THIS FILE DELIBERATELY DOES NOT DO ─────────────────────────────────
 * It does not crossfade. The stages are six discrete, individually-legible
 * settings; how a page moves between two of them (crossfade the GROUND, choose
 * the INK each frame as whichever of the two stages' inks reads better on the
 * ground actually present — NEVER lerp ground and ink together) belongs to the
 * page that scrolls, not to the derivation. Lerping the pair passes through a
 * ~1.05:1 illegible midpoint for a full screen of scrolling, twice per page.
 */

import { relativeLuminance } from './booth-studio';
import { oklchOfHex } from './color-space';
import { PALETTE_LIMITS, sanitizeRolePalette, type RolePalette } from './mood-board';

/** The six stages, in the order the page passes through them. */
export const STORY_LIGHT_STAGES = [
  'before',
  'morning',
  'afternoon',
  'dusk',
  'night',
  'after',
] as const;

export type StoryLightStageKey = (typeof STORY_LIGHT_STAGES)[number];

/** What the host reads beside each stage in the Story Maker's live preview. */
export const STORY_LIGHT_STAGE_LABEL: Record<StoryLightStageKey, string> = {
  before: 'Before',
  morning: 'Morning',
  afternoon: 'Afternoon',
  dusk: 'Dusk',
  night: 'Night',
  after: 'After',
};

/** The contrast floors. Named because they are the whole point of this file. */
export const STORY_INK_MIN = 12;
export const STORY_MUTED_MIN = 4.6;
export const STORY_ACCENT_MIN = 4.5;

/**
 * NEUTRAL — warm paper and ink. Offered in the Story Maker as a real choice,
 * never as the failure state of a missing board (`02` §5): a host who wants a
 * newspaper should be able to say so. These are the shipped Atelier paper and
 * espresso ink, not new values.
 */
const PAPER = '#FBFAF7';
const INK = '#2C2A29';
export const NEUTRAL_STORY_COLORS: readonly string[] = [
  '#EFEBE4',
  '#D8D2C6',
  '#FBFBFA',
  '#3A3733',
  '#B9AE99',
];

export type StoryLightStage = {
  key: StoryLightStageKey;
  label: string;
  /** The page ground for this stage. Already corrected. */
  ground: string;
  /** Body copy on that ground — ≥ STORY_INK_MIN. */
  ink: string;
  /** Secondary copy — ≥ STORY_MUTED_MIN. */
  muted: string;
  /** The accent, used AS TEXT — ≥ STORY_ACCENT_MIN. */
  accent: string;
};

/* ─────────────────────────── colour arithmetic ─────────────────────────── */

const HEX = /^#[0-9A-Fa-f]{6}$/;

function rgb(hex: string): [number, number, number] {
  const h = hex.slice(1);
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function hex(r: number, g: number, b: number): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0').toUpperCase();
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** `t = 0` is `a`, `t = 1` is `b`. Plain sRGB mix — this is a wash over a
 *  ground, not a perceptual interpolation, and the result is contrast-checked
 *  afterwards either way. */
export function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = rgb(a);
  const [br, bg, bb] = rgb(b);
  const k = Math.max(0, Math.min(1, t));
  return hex(ar + (br - ar) * k, ag + (bg - ag) * k, ab + (bb - ab) * k);
}

/** WCAG contrast ratio, 1..21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** The extreme a foreground should be nudged toward on this ground. */
function extremeFor(ground: string): string {
  return relativeLuminance(ground) > 0.4 ? '#000000' : '#FFFFFF';
}

/**
 * Push the GROUND toward its own nearer extreme until the best possible ink can
 * reach `min`. Returns the ground unchanged when it already can — the common
 * case for a real board, whose neutrals are usually near-paper already.
 */
function carryable(ground: string, min: number): string {
  const toward = relativeLuminance(ground) > 0.4 ? '#FFFFFF' : '#000000';
  let g = ground;
  for (let i = 0; i <= 40; i += 1) {
    if (Math.max(contrastRatio(g, '#000000'), contrastRatio(g, '#FFFFFF')) >= min) return g;
    g = mixHex(ground, toward, (i + 1) / 40);
  }
  return toward;
}

/**
 * Nudge `fg` toward black or white (whichever the ground calls for) in fixed
 * steps until it clears `min` on `ground`. Terminates: the caller has already
 * made the ground carryable, so the extreme itself passes.
 */
export function correctedInk(fg: string, ground: string, min: number): string {
  if (contrastRatio(fg, ground) >= min) return fg;
  const target = extremeFor(ground);
  for (let i = 1; i <= 50; i += 1) {
    const c = mixHex(fg, target, i / 50);
    if (contrastRatio(c, ground) >= min) return c;
  }
  return target;
}

/* ─────────────────────────── the derivation ─────────────────────────── */

/**
 * The six grounds, PORTED from `prototypes/story-maker.html`'s `stages()` — the
 * prototype is the design, so this is its arithmetic, not a fresh one:
 *
 *     before    lerp(light, white, .45)      morning  lerp(light, white, .20)
 *     afternoon lerp(second, light, .5)      dusk     lerp(dark, mid, .3)
 *     night     lerp(dark, black, .55)       after    lerp(light, mid, .18)
 *
 * over the host's colours sorted by luminance, lightest first. It is not a plain
 * light→dark ramp and should not be simplified into one: `after` is deliberately
 * the light colour pulled a little toward the middle — the morning after is not
 * the morning before, and drawing them identically loses the only thing the last
 * stage has to say.
 *
 * ⚠ ONE DELIBERATE DEPARTURE FROM THE PROTOTYPE, and it is in the documents, not
 * in a preference: the prototype paints each cell's text with a binary
 * `lum(bg) > .42 ? dark : light`. `01` §4 requires every colour to be checked and
 * corrected against a stated floor, so the inks below go through `correctedInk`
 * instead. The grounds are the prototype's exactly.
 */
function pick(sorted: string[], i: number, fallback: string): string {
  return sorted[i] ?? fallback;
}

export function storyLightStages(colors: readonly string[]): StoryLightStage[] {
  const clean = colors.filter((c) => HEX.test(c)).map((c) => c.toUpperCase());
  const source = clean.length > 0 ? clean : [...NEUTRAL_STORY_COLORS];

  const cs = [...source].sort((a, b) => relativeLuminance(b) - relativeLuminance(a));
  const light = pick(cs, 0, PAPER);
  const second = pick(cs, 1, light);
  const mid = pick(cs, 2, second);
  const dark = pick(cs, cs.length - 1, INK);

  // The accent is the most chromatic colour on the board — the one the host
  // would point at. Ties fall to the earlier slot, which is the more dominant.
  const accentSource = source.reduce((best, c) =>
    oklchOfHex(c).C > oklchOfHex(best).C ? c : best,
  );

  const rawGround: Record<StoryLightStageKey, string> = {
    before: mixHex(light, '#FFFFFF', 0.45),
    morning: mixHex(light, '#FFFFFF', 0.2),
    afternoon: mixHex(second, light, 0.5),
    dusk: mixHex(dark, mid, 0.3),
    night: mixHex(dark, '#000000', 0.55),
    after: mixHex(light, mid, 0.18),
  };

  return STORY_LIGHT_STAGES.map((key) => {
    const ground = carryable(rawGround[key], STORY_INK_MIN);
    // Start the ink from the far end of the host's own board, so their colours
    // survive correction wherever they can. On a light ground that is their
    // darkest; on a dark one, their lightest.
    const inkSource = relativeLuminance(ground) > 0.4 ? dark : light;
    const ink = correctedInk(inkSource, ground, STORY_INK_MIN);
    // Muted is the ink faded back toward the ground, then pulled in again if it
    // faded past the floor. Deriving it from the CORRECTED ink keeps it in the
    // same family as the body copy instead of introducing a third hue.
    const muted = correctedInk(mixHex(ink, ground, 0.42), ground, STORY_MUTED_MIN);
    const accent = correctedInk(accentSource, ground, STORY_ACCENT_MIN);
    return { key, label: STORY_LIGHT_STAGE_LABEL[key], ground, ink, muted, accent };
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
