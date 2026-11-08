/**
 * 🏅 THE IMAGE BADGES' PAINTS — the approved corpus art's metals (`prototypes/for_suppliers_2026-11-06`, "ibgrid"),
 * kept as data beside the shipped tier paints (`lib/badge-tiers.ts`): a badge is a picture of a metal, so its colours
 * are art, not theme tokens. Drawn by `app/_components/image-badge.tsx`. PURE.
 */
import type { BadgeFace } from './shop-badge-row';

export type Paint = { face: [string, string]; ink: string; hl: string; rim: string; foilInk?: boolean };

export const RIM: Readonly<Record<string, readonly string[]>> = {
  gold: ['#7A5C22', '#FBEFC4', '#B88D3B', '#EBD08A', '#7A5C22'],
  bronze: ['#4E2A10', '#E8B088', '#8C4F22', '#D08C5A', '#4E2A10'],
  silver: ['#4F555C', '#F7F9FB', '#8E959C', '#DCE0E4', '#4F555C'],
  plat: ['#35404A', '#F4F8FA', '#8A98A4', '#D8E0E6', '#35404A'],
  // Diamond has no corpus face — its rim is the shipped tier's own edge (`lib/badge-tiers.ts`, tier5).
  diamond: ['#6fa3c4', '#ffffff', '#a8d4ee', '#e8f6ff', '#6fa3c4'],
  ruby: ['#4E0A16', '#F7B9C3', '#A0203A', '#DC607A', '#4E0A16'],
  black: ['#8E949A', '#FFFFFF', '#5C6269', '#F0F2F4', '#8E949A'],
};

export const PAINT: Readonly<Record<BadgeFace, Paint>> = {
  navy: { face: ['#335282', '#101C36'], ink: '#FBEFC4', hl: '#000000', rim: 'gold', foilInk: true },
  ivory: { face: ['#FFFEFA', '#ECE1CB'], ink: '#7F5F20', hl: '#FFFFFF', rim: 'gold' },
  gold: { face: ['#FFF9E4', '#E3BF68'], ink: '#5A400E', hl: '#FFFBEA', rim: 'gold' },
  first: { face: ['#FFFCF0', '#EDD08A'], ink: '#6B4D14', hl: '#FFFFFF', rim: 'gold' },
  month: { face: ['#AA2539', '#520A18'], ink: '#FBEFC4', hl: '#000000', rim: 'gold', foilInk: true },
  bronze: { face: ['#F9E8D8', '#D09A70'], ink: '#4A2810', hl: '#FFF3E6', rim: 'bronze' },
  silver: { face: ['#FBFCFD', '#C0C6CC'], ink: '#363C43', hl: '#FFFFFF', rim: 'silver' },
  plat: { face: ['#F5F8FB', '#B2C0CB'], ink: '#1F2A33', hl: '#FFFFFF', rim: 'plat' },
  diamond: { face: ['#F3F8FC', '#A8D4EE'], ink: '#1F4E6B', hl: '#FFFFFF', rim: 'diamond' },
  ruby: { face: ['#CF3552', '#560817'], ink: '#FFE6EA', hl: '#2A0309', rim: 'ruby' },
  black: { face: ['#3E4047', '#08080A'], ink: '#F4F6F8', hl: '#000000', rim: 'black' },
};


/** The foil every gold seal's words are printed in, and the rosette's tails. */
export const FOIL = ['#FBEFC4', '#D9B463', '#F6E4A6', '#B88D3B'] as const;
export const TAIL = ['#B8324A', '#7A1426'] as const;
export const GLOSS = '#fff';
export const SHADE = '#000';
