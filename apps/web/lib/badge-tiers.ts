/**
 * 🥉🥈🥇 BADGES IMPROVE AS THEIR LADDER GOES UP (owner 2026-10-28: *"badges improve as their ladder goes up."*, then
 * the ladder itself: *"like youtube … 10,50,100,500,1000,5000,10000?"*). The SAME pill at every step; the MATERIAL
 * climbs — one tier per step of `MILESTONE_THRESHOLDS`, in order:
 *
 *   tier1 bronze-tone · tier2 pewter · tier3 gold · tier4 pale steel · tier5 blue · tier6 red · tier7 black + laurel
 *
 * ⚠ NO TIER NAME IS SHOWN — the keys are positional (`tier1` … `tier7`) and the badge shows the number only. A tier is a pure function of the step reached (`tierForStep`), so it upgrades itself the moment the live
 * count crosses a step and steps down with a voided booking. Nothing is stored.
 *
 * 🔑 EVERY TIER READS AT WCAG AA, ON A LIGHT GROUND AND A DARK ONE. The foil is a gradient, so "the text's colour" is
 * every one of its stops: each stop of the lettering, the plain line, and the number in the circle are held to 4.5 : 1
 * against what they sit on (`lib/badge-tiers.test.ts` measures all of them). That is why the light-ground silver is a
 * deep pewter and not the bright prototype silver — the prototype's `#e9ecef` on white measured ~1.2 : 1.
 *
 * PURE — data and one lookup.
 */
import { MILESTONE_THRESHOLDS } from '@/lib/service-card-record';

export type TierKey = 'tier1' | 'tier2' | 'tier3' | 'tier4' | 'tier5' | 'tier6' | 'tier7';

/** One ground's paint for a tier. */
export type TierPaint = {
  /** The pill's ground. */
  bg: string;
  /** The second line ("ON SETNAYAN"). */
  fg: string;
  /** The circle's fill. */
  mk: string;
  /** The number in the circle. */
  mkc: string;
  /** The first line's foil — every stop must read on `bg`. */
  foil: readonly string[];
  /** The edge's foil (decoration, not text). */
  edge: readonly string[];
};

export type Tier = { key: TierKey; step: number; light: TierPaint; dark: TierPaint; laurel: boolean };

const DARK_BG = '#151312';
const DARK_MK = '#24211E';
const DARK_FG = '#F4EFE6';

const GOLD_EDGE = ['#8a6a2c', '#d9b866', '#f6e7b0', '#b88d3b', '#e9cf86', '#8e6b2b', '#e6c97d'] as const;
const SILVER_EDGE = ['#8d9196', '#e9ecef', '#b7bcc2', '#f4f6f8', '#8d9196', '#dfe3e7'] as const;

/** The materials, bottom of the ladder first — zipped onto `MILESTONE_THRESHOLDS` by position. */
const MATERIALS: Array<Omit<Tier, 'step'>> = [
  {
    key: 'tier1',
    laurel: false,
    light: { bg: '#FFFFFF', fg: '#2B2620', mk: '#F6EEE6', mkc: '#7A4A22', foil: ['#7A4A22', '#8F5A2C', '#6B3F1C'], edge: ['#8c5a2b', '#d9a577', '#7a4a22', '#c58b5a', '#8c5a2b'] },
    dark: { bg: DARK_BG, fg: DARK_FG, mk: DARK_MK, mkc: '#E2AB7C', foil: ['#E2AB7C', '#F2C49A', '#D4955F'], edge: ['#8c5a2b', '#d9a577', '#7a4a22', '#c58b5a', '#8c5a2b'] },
  },
  {
    key: 'tier2',
    laurel: false,
    light: { bg: '#FFFFFF', fg: '#2B2620', mk: '#EEF0F2', mkc: '#4E545B', foil: ['#4E545B', '#666C73', '#575D64'], edge: SILVER_EDGE },
    dark: { bg: DARK_BG, fg: DARK_FG, mk: DARK_MK, mkc: '#D5DADF', foil: ['#C9CED4', '#F4F6F8', '#B7BCC2'], edge: SILVER_EDGE },
  },
  {
    key: 'tier3',
    laurel: false,
    light: { bg: '#FBF7EF', fg: '#2B2620', mk: '#FFFFFF', mkc: '#7F5F20', foil: ['#7F5F20', '#8A6A2C', '#6E5118'], edge: GOLD_EDGE },
    dark: { bg: DARK_BG, fg: DARK_FG, mk: DARK_MK, mkc: '#E9CF86', foil: ['#D9B866', '#F6E7B0', '#E9CF86'], edge: GOLD_EDGE },
  },
  {
    key: 'tier4',
    laurel: false,
    light: { bg: '#F4F6F8', fg: '#1F2328', mk: '#FFFFFF', mkc: '#3E4A55', foil: ['#3E4A55', '#55616C', '#46525D'], edge: ['#7d8790', '#eef2f5', '#a9b3bc', '#ffffff', '#7d8790'] },
    dark: { bg: DARK_BG, fg: DARK_FG, mk: DARK_MK, mkc: '#E4E9EE', foil: ['#DDE3E8', '#FFFFFF', '#C3CCD4'], edge: ['#7d8790', '#eef2f5', '#a9b3bc', '#ffffff', '#7d8790'] },
  },
  {
    key: 'tier5',
    laurel: false,
    light: { bg: '#F3F8FC', fg: '#14212B', mk: '#FFFFFF', mkc: '#1F4E6B', foil: ['#1F4E6B', '#2A6386', '#1B4560'], edge: ['#6fa3c4', '#ffffff', '#a8d4ee', '#e8f6ff', '#6fa3c4'] },
    dark: { bg: DARK_BG, fg: DARK_FG, mk: DARK_MK, mkc: '#A9D8F4', foil: ['#9FD3F2', '#E8F6FF', '#7FC0E6'], edge: ['#6fa3c4', '#ffffff', '#a8d4ee', '#e8f6ff', '#6fa3c4'] },
  },
  {
    key: 'tier6',
    laurel: false,
    light: { bg: '#FFF6F7', fg: '#2A1418', mk: '#FFFFFF', mkc: '#8E1B2E', foil: ['#8E1B2E', '#A3243A', '#7A1626'], edge: ['#7a1626', '#e0566c', '#a3243a', '#f3a6b2', '#7a1626'] },
    dark: { bg: DARK_BG, fg: DARK_FG, mk: DARK_MK, mkc: '#F29AA9', foil: ['#F08A9B', '#F8B9C3', '#EC7A8D'], edge: ['#7a1626', '#e0566c', '#a3243a', '#f3a6b2', '#7a1626'] },
  },
  {
    key: 'tier7',
    laurel: true,
    // The top step is black on every ground — the material IS the black.
    light: { bg: '#0E0E10', fg: '#F4F4F6', mk: '#232327', mkc: '#F4F6F8', foil: ['#E9ECEF', '#FFFFFF', '#C9CED4'], edge: ['#5a5f66', '#ffffff', '#9aa1a9', '#e9ecef', '#5a5f66'] },
    dark: { bg: '#0E0E10', fg: '#F4F4F6', mk: '#232327', mkc: '#F4F6F8', foil: ['#E9ECEF', '#FFFFFF', '#C9CED4'], edge: ['#5a5f66', '#ffffff', '#9aa1a9', '#e9ecef', '#5a5f66'] },
  },
];

/** One tier per step of the shipped ladder. A ladder that grows past the materials reuses the top material. */
export const TIERS: readonly Tier[] = MILESTONE_THRESHOLDS.map((step, i) => ({ ...MATERIALS[Math.min(i, MATERIALS.length - 1)]!, step }));

/** The tier a reached step wears; null for a number that is not a step. */
export function tierForStep(step: number): Tier | null {
  return TIERS.find((t) => t.step === step) ?? null;
}

/** The number for the circle: 1,000 → 1K, 10,000 → 10K — the line beside it says it in full. */
export function stepGlyph(step: number): string {
  return step >= 1000 && step % 1000 === 0 ? `${step / 1000}K` : String(step);
}
