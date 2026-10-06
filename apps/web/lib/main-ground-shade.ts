/**
 * lib/main-ground-shade.ts — SHADE ▾ FOR THE MAIN BACKGROUND: Darker · Dark ·
 * As is · Light · Lighter (owner 2026-10-06, verbatim: *"Global background
 * animated background can have it go darker or lighter (do make sure it can
 * show and make the texts readable)"*; DECISION_LOG "THE COVER LOSES ITS FRAME
 * … DARKER ↔ LIGHTER" and "STUDIO › LOOK IS THE GLOBAL LOOK").
 *
 * ONE RULE, THE SHIPPED ONE. A shade is a veil laid over the footage — the page
 * INK for Darker/Dark (the words then flip to the page PAPER, light on dark),
 * the page PAPER for Light/Lighter and As is (the words stay the ink) — and its
 * strength is the shipped measurement, `requiredScrim` (`lib/hub-legibility.ts`),
 * started from the step's own floor instead of zero. So a shade can only ever
 * ADD veil to what readability already needs: no step can take body text under
 * `AA_BODY`, the floor `mainGroundLegibility` holds today (As is IS that rule).
 *
 * Pure. Held by `shade-never-crosses-the-floor.test.ts`.
 *
 * ⚠ NOT YET DRAWN FOR GUESTS. Storing the step on the main background and
 * painting the flipped words on the guest page (`main-ground-layer.tsx`,
 * `adaptiveThemeVars`) is the guest-render half; until it ships the Studio
 * shows no Shade ▾ — a control that changes nothing would be worse than none.
 */
import { AA_BODY, compositeOver, contrastRatio, requiredScrim } from '@/lib/hub-legibility';

export const MAIN_GROUND_SHADES = ['darker', 'dark', 'as-is', 'light', 'lighter'] as const;
export type MainGroundShade = (typeof MAIN_GROUND_SHADES)[number];

export const MAIN_GROUND_SHADE_LABEL: Readonly<Record<MainGroundShade, string>> = {
  darker: 'Darker',
  dark: 'Dark',
  'as-is': 'As is',
  light: 'Light',
  lighter: 'Lighter',
};

/** Each step: which veil, and the least of it the step always lays (readability may need more). */
const STEP: Readonly<Record<MainGroundShade, { veil: 'ink' | 'paper'; floor: number }>> = {
  darker: { veil: 'ink', floor: 0.7 },
  dark: { veil: 'ink', floor: 0.45 },
  'as-is': { veil: 'paper', floor: 0 },
  light: { veil: 'paper', floor: 0.45 },
  lighter: { veil: 'paper', floor: 0.7 },
};

export type ShadeResult = {
  /** The veil's colour (the page's ink or paper) and its strength, 0…1. */
  veil: string;
  opacity: number;
  /** The colour the words take over it — the other of the two. */
  text: string;
  /** The worst body contrast over every measured colour of the footage, with the veil on. */
  bodyContrast: number;
};

/**
 * The veil and the words for one step, over the footage's measured colours
 * (`samples` — a loop's `media.samples`, an upload's measured frame). An
 * unmeasured frame gets the full veil (as `mainGroundLegibility` does).
 */
export function mainGroundShade(step: MainGroundShade, page: { paper: string; ink: string }, samples: readonly string[]): ShadeResult {
  const s = STEP[step];
  const veil = s.veil === 'ink' ? page.ink : page.paper;
  const text = s.veil === 'ink' ? page.paper : page.ink;
  const opacity = samples.length === 0 ? 1 : requiredScrim(text, veil, samples, s.floor, AA_BODY);
  const over = samples.length === 0 ? [veil] : samples.map((c) => compositeOver(veil, opacity, c));
  return { veil, opacity, text, bodyContrast: Math.min(...over.map((c) => contrastRatio(text, c))) };
}
