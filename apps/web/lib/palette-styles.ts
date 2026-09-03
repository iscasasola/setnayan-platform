/**
 * The mood-board palette-style engine — pure, deterministic, OKLCH.
 *
 * Given the couple's five majors and a palette style, derives every role's
 * attire colours and the venue's dressing colours, ordered so a guest at the
 * back of the room can tell rank from colour alone (the SIX-RANK VISIBILITY
 * LADDER — see `rankPrimaries`).
 *
 * Ported from the prototype's `spec/palette-styles.mjs` — a translation, not
 * a reinterpretation. Every constant, predicate and the ladder algorithm
 * itself are unchanged from that file; the OKLCH primitives moved to
 * `./color-space` (see that file's docblock for the CIELAB/OKLCH boundary)
 * and the naming picked up TypeScript types.
 *
 * ⚠ THREE FIXES CARRIED OVER FROM THE NEWER `atelier-board.html` PROTOTYPE,
 * NOT PRESENT IN `spec/palette-styles.mjs` — that file's header calls itself
 * "FINAL derivation", but the fuzz harness this port also carries
 * (`palette-styles-fuzz-never-throws-or-duplicates.test.ts`) requires all
 * three to pass, and diffing the two prototype copies line-for-line found no
 * other behavioural difference between them:
 *   1. `rankPrimaries`'s REDUCED RESULT tier — an all-bridal-white palette
 *      (no wearable colour exists for a non-bride role) now falls back to
 *      the couple's own majors with the gates waived, reported via
 *      `__meta.reduced`, instead of throwing. `spec/palette-styles.mjs`
 *      throws on all 4 of the fuzz harness's named all-pale trios in Simple
 *      style; this fixed version throws on none.
 *   2. `ceremony` dedupes its two swatches (`[...new Set(venue.ceremony)]`).
 *   3. Exempt roles (bride/groom) dedupe their two swatches likewise.
 * (2) and (3) close the exact "no role holds a duplicate swatch" gap the
 * fuzz harness checks for; `spec/palette-styles.mjs` does not close it.
 *
 * Verified by `palette-styles-rank-ordering-is-monotonic.test.ts` (97 ordered
 * pairs, 0 failures — the six-rank invariant), `palette-styles-fuzz-never-
 * throws-or-duplicates.test.ts`, `palette-styles-touched-roles-are-never-
 * written.test.ts`, `palette-styles-warm-arc-guard-reads-the-emitted-hue
 * .test.ts` and `palette-styles-attire-library-namer-parity.test.ts`.
 */

import { hexOfOklch, maxOklchChroma, oklchDistance, oklchOfHex, type Oklch } from './color-space';

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/**
 * SIGNED circular hue delta in (-180, 180]. Kept local (not shared with
 * `color-space.ts`'s `hueDeltaDeg`) and verbatim from the prototype so this
 * port cannot introduce even a floating-point-level divergence in hue
 * arithmetic the ladder depends on.
 */
const hueDelta = (a: number, b: number): number => ((((a - b) % 360) + 540) % 360) - 180;
const hueDist = (a: number, b: number): number => Math.abs(hueDelta(a, b));

/* ── types ────────────────────────────────────────────────────────────── */

export type PaletteStyle = 'simple' | 'depth' | 'complex';

/** Every role the visibility ladder or the venue derivation can touch. */
export type RoleKey =
  | 'bride'
  | 'groom'
  | 'parents_immediate_family'
  | 'principal_sponsors'
  | 'muslim_principals'
  | 'maid_of_honor'
  | 'best_man'
  | 'bridesmaids'
  | 'groomsmen'
  | 'wedding_party'
  | 'secondary_sponsors'
  | 'bearers_flower_girl'
  | 'guest'
  | 'officiants'
  | 'ceremony'
  | 'reception';

/** The five couple-picked colours, always exactly five — see `normalizeMajors`. */
export type Slots = readonly [string, string, string, string, string];

export type RoomDressing = {
  linens: string;
  chairs: string;
  florals: string;
  lighting_warmth: string;
};
export type Venue = { ceremony: [string, string]; room_dressing: RoomDressing };

type LibraryEntry = Oklch & { name: string; lib: true };
/** `lib` is optional, not `boolean`, because `pickForRole`'s no-candidate
 *  fallback (`[sourceOf(slots, roleKey)]`) seeds the pool with a bare `Oklch`
 *  — exactly what the prototype does, where an absent `.lib` reads as falsy. */
type Candidate = Oklch & { lib?: boolean };

export type BoardWarning = { key: string; code: string };
export type BoardMeta = {
  vmax: number;
  levels: number;
  collapsed: number[];
  /** Ranks whose wearability gates had to be waived to avoid crashing the
   *  whole board — see `rankPrimaries`'s "REDUCED RESULT" tier. Reported,
   *  never hidden. */
  reduced: number[];
  groups: number[][];
  separable: number[][];
  coupleV: number;
  coupleUnderRank2: boolean;
  warnings: BoardWarning[];
};
export type Board = Partial<Record<RoleKey, string[]>> & {
  room_dressing?: RoomDressing;
  __meta: BoardMeta;
};

type RankEntry = { c: Candidate | null; v: number };
type Band = { lo: number; hi: number };
export type Ladder = {
  primaries: Map<number, RankEntry>;
  bands: Map<number, Band>;
  vmax: number;
  levels: number;
  groups: number[][];
  collapsed: number[];
  reduced: number[];
  guestFloor: number;
};
type DeriveRoleCtx = {
  venue?: Venue;
  room?: Oklch[];
  ladder?: Ladder;
  warn?: (key: string, code: string) => void;
};

/* ── constants ────────────────────────────────────────────────────────────
 * Every threshold below is labelled by the space it is expressed in. All of
 * them are OKLCH — L in [0, 1], C the OKLCH chroma (typically 0–0.4 inside
 * the sRGB gamut), H in degrees — never CIELAB. See `./color-space` for the
 * boundary between the two spaces this codebase carries.
 */
/** OKLCH chroma below which a colour has no hue anyone would call it by. */
export const NEUTRAL_C = 0.03;
export const NEON_C_MAX = 0.185; // OKLCH chroma ceiling
export const NEON_EDGE_RATIO = 0.97; // fraction of the hue's max achievable chroma
export const NEON_EDGE_MIN_C = 0.13; // OKLCH chroma
export const MUD_HUE: [number, number] = [40, 110]; // degrees
export const MUD_L: [number, number] = [0.35, 0.55]; // OKLCH lightness
export const MUD_C_MAX = 0.09; // OKLCH chroma
export const GEN_L: [number, number] = [0.16, 0.96]; // OKLCH lightness range the engine will place a colour in
export const ATTIRE_L_FLOOR = 0.22; // OKLCH lightness
export const DIVERSITY_DE_MIN = 0.1; // OKLCH ΔE (oklchDistance)
export const RANK_CHROMA_CAP = [0.17, 0.16, 0.15, 0.125, 0.1, 0.085]; // OKLCH chroma, one per rank 1-6
export const CHROMA_GATE_ALPHA = 1.15;
export const CHROMA_GATE_BETA = 0.015; // OKLCH chroma
export const BRIDAL_L_MIN = 0.86; // OKLCH lightness
export const BRIDAL_C_MAX = 0.06; // OKLCH chroma
export const BARONG_LIGHT = { LMin: 0.78, CMax: 0.075 }; // OKLCH
export const BARONG_DARK = { LMax: 0.3, CMax: 0.05 }; // OKLCH
export const CHILD_L_MIN = 0.7; // OKLCH lightness
export const KAPPA = 0.5;
export const MU = 0.5;
export const VISIBILITY_LADDER = [0.88, 0.72, 0.58, 0.45, 0.32, 0.18]; // target visibility fraction per rank 1-6
export const MIN_V_GAP_ABS = 0.05; // visibility units
export const GUEST_V_FLOOR_FRAC = 0.06; // fraction of vmax
/**
 * How near the rank's target a library colour must be to win the pick, as a
 * fraction of the room's headroom. 🛑 A LIBRARY-ALWAYS RULE STARVES THE LADDER:
 * the wearable library is clustered in the pale end of any one hue family, so
 * every rank picked low, dragged the ceiling down with it, and ranks 4-6
 * collapsed onto one colour on a perfectly good burgundy-and-gold palette. The
 * library is the wearability guarantee, not a straitjacket — when it cannot
 * reach the rank, a gamut-clamped tone of the couple's own colour does.
 */
export const LIB_TOL_FRAC = 0.06;
export const HARMONY_TARGETS = [0, 30, 64, 108, 150, 180]; // degrees
// WARM is a WRAP-AROUND arc, not an interval: red and pink sit either side of
// H=0, so a plain [lo,hi] test called a #FFD8DD blush "cool" and let a burgundy
// wedding depart into forest green.
export const WARM_HUE_MAX = 115; // OKLCH hue, degrees
export const WARM_HUE_MIN_WRAP = 340; // OKLCH hue, degrees
export const isWarmHue = (H: number): boolean => {
  const h = ((H % 360) + 360) % 360;
  return h <= WARM_HUE_MAX || h >= WARM_HUE_MIN_WRAP;
};
/**
 * THE WARM-ARC GUARD. Whether a swatch's ACTUAL, MEASURED OKLCH hue sits
 * inside the warm arc — never a hue a caller merely intended to request.
 *
 * 🛑 A GUARD THAT MEASURES THE REQUEST INSTEAD OF THE RESULT is the single
 * most repeated defect class in this codebase. This function takes only the
 * emitted hex, by construction: there is no "requested hue" parameter to
 * check by mistake, so it cannot silently degrade into testing what the
 * engine asked for rather than what it produced. See
 * `palette-styles-warm-arc-guard-reads-the-emitted-hue.test.ts`, which
 * sabotage-tests this directly with a colour whose real hue is outside the
 * arc — the exact case a request-reading guard would have missed.
 */
export function isWithinWarmArc(hex: string): boolean {
  const c = oklchOfHex(hex);
  if (c.C < NEUTRAL_C) return true; // achromatic — no hue to be warm or cool about
  return isWarmHue(c.H);
}
export const MAX_DEPART_WARM = 45; // degrees
export const MAX_DEPART_MIXED = 75; // degrees
export const HUE_FAMILY_DEG = 30; // degrees
export const VENUE_LIFT_L = 0.06; // OKLCH lightness
export const VENUE_CHROMA_CAP = 0.13; // OKLCH chroma
export const BRIDAL_DEFAULT = '#FAF7F2';
export const FORMAL_DARK_DEFAULT = '#1A1A1A';

export const ATTIRE_LIBRARY: LibraryEntry[] = (
  [
    ['#FFFFF0', 'Ivory'],
    ['#FAF7F2', 'Cream'],
    ['#F2E8D5', 'Piña Cream'],
    ['#F3ECE0', 'Oyster'],
    ['#E7E2DA', 'Capiz Pearl'],
    ['#E8D6B8', 'Champagne'],
    ['#F4C2C2', 'Blush'],
    ['#D9CBB0', 'Sand'],
    ['#EBD9D1', 'Shell Pink'],
    ['#DCE3DC', 'Pale Eucalyptus'],
    ['#C9BBA8', 'Warm Taupe'],
    ['#C2A878', 'Bamboo Tan'],
    ['#C5A059', 'Champagne Gold'],
    ['#D4AF37', 'Gold'],
    ['#8A6D3B', 'Bronze'],
    ['#C99AA0', 'Dusty Rose'],
    ['#C97B4B', 'Terracotta'],
    ['#9C6B4F', 'Clay'],
    ['#F0B27A', 'Peach'],
    ['#A3B5A0', 'Eucalyptus'],
    ['#8A9A6B', 'Sage'],
    ['#8A8B5C', 'Olive'],
    ['#93B7BE', 'Dusty Blue'],
    ['#6E8AA0', 'Slate Blue'],
    ['#A9A399', 'Stone'],
    ['#9AA0A6', 'Pearl Grey'],
    ['#A98CA6', 'Mauve'],
    ['#7A1F2B', 'Burgundy'],
    ['#5C2A33', 'Wine'],
    ['#1E2540', 'Navy'],
    ['#3B5437', 'Forest'],
    ['#23414A', 'Deep Teal'],
    ['#6B4423', 'Narra Brown'],
    ['#4A2B3F', 'Deep Plum'],
    ['#2A2119', 'Espresso'],
    ['#1E2229', 'Charcoal'],
    ['#B3202C', 'Chinese Red'],
    ['#D9A441', 'Old Gold'],
  ] as const
).map(([hex, name]) => ({ ...oklchOfHex(hex), name, lib: true as const }));

/* ── role tables ──────────────────────────────────────────────────────── */
export const VISIBILITY_RANK: Record<RoleKey, number | null> = {
  bride: 1,
  groom: 1,
  parents_immediate_family: 2,
  principal_sponsors: 3,
  muslim_principals: 3,
  maid_of_honor: 4,
  best_man: 4,
  bridesmaids: 4,
  groomsmen: 4,
  wedding_party: 4,
  secondary_sponsors: 5,
  bearers_flower_girl: 5,
  guest: 6,
  officiants: null,
  ceremony: null,
  reception: null,
};
export const EXEMPT = new Set<RoleKey>(['bride', 'groom', 'officiants']);
/** Index within the rank — fixes the in-rank tone offset. Deterministic order. */
export const IN_RANK_INDEX: Partial<Record<RoleKey, number>> = {
  bride: 0,
  groom: 1,
  parents_immediate_family: 0,
  principal_sponsors: 0,
  muslim_principals: 1,
  maid_of_honor: 0,
  best_man: 1,
  bridesmaids: 2,
  groomsmen: 3,
  wedding_party: 4,
  secondary_sponsors: 0,
  bearers_flower_girl: 1,
  guest: 0,
};
/**
 * ONE SOURCE PER VISUAL LINE, expressed as a PREFERENCE over slots:
 * 0 Dominant · 1 Supporting · 2 Accent · 3 Neutral · 4 Accent 2.
 * The first slot in the list whose chroma clears NEUTRAL_C wins. A line bound
 * to a single hard-coded slot goes achromatic whenever that slot happens to be
 * the theme's cream — which is how a burgundy-and-gold wedding produced a
 * silver entourage.
 */
export const ROLE_SOURCE_PREF: Partial<Record<RoleKey, number[]>> = {
  parents_immediate_family: [4, 2, 1, 0, 3],
  principal_sponsors: [4, 2, 1, 0, 3],
  muslim_principals: [4, 2, 1, 0, 3],
  maid_of_honor: [1, 2, 4, 0, 3],
  best_man: [1, 2, 4, 0, 3],
  bridesmaids: [1, 2, 4, 0, 3],
  groomsmen: [1, 2, 4, 0, 3],
  wedding_party: [1, 2, 4, 0, 3],
  secondary_sponsors: [1, 2, 4, 0, 3],
  bearers_flower_girl: [3, 1, 0, 4, 2],
  guest: [3, 1, 0, 4, 2],
};
export function sourceOf(slots: Slots, roleKey: RoleKey): Oklch {
  const pref = ROLE_SOURCE_PREF[roleKey] ?? [1, 2, 4, 0, 3];
  for (const i of pref) {
    const c = oklchOfHex(slots[i]!); // pref only ever holds 0-4, always a valid slot index
    if (c.C >= NEUTRAL_C) return c;
  }
  return oklchOfHex(slots[pref[0]!]!); // genuinely achromatic theme → achromatic role
}
export const ROLE_COLOR_COUNT: Partial<Record<RoleKey, number>> = {
  ceremony: 2,
  bride: 2,
  groom: 2,
  wedding_party: 3,
  maid_of_honor: 1,
  best_man: 1,
  bridesmaids: 3,
  groomsmen: 3,
  parents_immediate_family: 1,
  muslim_principals: 2,
  principal_sponsors: 2,
  secondary_sponsors: 1,
  bearers_flower_girl: 1,
  officiants: 0,
  guest: 3,
};
/** Array index that MUST hold a barong-legal colour (the ninong / wali slot). */
export const BARONG_SLOT: Partial<Record<RoleKey, number>> = {
  principal_sponsors: 1,
  muslim_principals: 1,
};
export const PEOPLE_KEYS: RoleKey[] = [
  'bride',
  'groom',
  'parents_immediate_family',
  'muslim_principals',
  'maid_of_honor',
  'best_man',
  'bridesmaids',
  'groomsmen',
  'wedding_party',
  'principal_sponsors',
  'secondary_sponsors',
  'bearers_flower_girl',
  'officiants',
  'guest',
];

/* ── predicates ───────────────────────────────────────────────────────── */
export const isNeon = (c: Oklch): boolean =>
  c.C > NEON_C_MAX || (c.C >= NEON_EDGE_MIN_C && c.C > NEON_EDGE_RATIO * maxOklchChroma(c.L, c.H));
// 🛑 MUD IS A DRAB COLOUR, NEVER A NEUTRAL. Without the NEUTRAL_C floor this
// test rejected every mid grey: a pure grey's OKLCH hue is float noise that
// lands at 89.88 deg — inside the mud hue window — so a greyscale theme had no
// wearable candidate at all and the ladder threw.
export const isMud = (c: Oklch): boolean =>
  c.C >= NEUTRAL_C && c.C < MUD_C_MAX && c.H >= MUD_HUE[0] && c.H <= MUD_HUE[1] && c.L >= MUD_L[0] && c.L <= MUD_L[1];
export const isBridal = (c: Oklch): boolean => c.L >= BRIDAL_L_MIN && c.C <= BRIDAL_C_MAX;
export const isBarongLegal = (c: Oklch): boolean =>
  (c.L >= BARONG_LIGHT.LMin && c.C <= BARONG_LIGHT.CMax) || (c.L <= BARONG_DARK.LMax && c.C <= BARONG_DARK.CMax);

export function wearable(c: Oklch, roleKey: RoleKey): boolean {
  if (c.L < ATTIRE_L_FLOOR || c.L > GEN_L[1]) return false;
  if (isNeon(c) || isMud(c)) return false;
  if (roleKey !== 'bride' && isBridal(c)) return false;
  if (roleKey === 'bearers_flower_girl' && c.L < CHILD_L_MIN) return false;
  return true;
}
export const chromaCeiling = (cSrc: number, rank: number): number =>
  // rank is always 1-6 by construction, a valid RANK_CHROMA_CAP index
  cSrc < NEUTRAL_C ? 0 : Math.min(RANK_CHROMA_CAP[rank - 1]!, CHROMA_GATE_ALPHA * cSrc + CHROMA_GATE_BETA);

/* ── majors ───────────────────────────────────────────────────────────── */
export function normalizeMajors(majors: readonly string[] | null | undefined): Slots {
  const src = (majors ?? []).filter((h) => /^#[0-9A-Fa-f]{6}$/.test(h)).map((h) => h.toUpperCase());
  if (src.length === 0) throw new Error('normalizeMajors: at least one major is required');
  const out = src.slice(0, 5);
  while (out.length < 5) out.push(out[out.length - 1]!); // clamp-to-last: out.length >= 1, never undefined
  return out as unknown as Slots;
}
export const anchorMajor = (slots: Slots): Oklch =>
  slots.map(oklchOfHex).reduce((best, c) => (c.C > best.C ? c : best));
export const isAllWarm = (slots: Slots): boolean =>
  slots
    .map(oklchOfHex)
    .filter((c) => c.C >= NEUTRAL_C)
    .every((c) => isWarmHue(c.H));

/* ── venue ────────────────────────────────────────────────────────────── */
export function deriveVenue(slots: Slots, style: PaletteStyle): Venue {
  const dressed: RoomDressing = { linens: slots[1], chairs: slots[2], florals: slots[0], lighting_warmth: slots[0] };
  if (style === 'simple') return { ceremony: [slots[0], slots[1]], room_dressing: dressed };
  const tone = (hex: string): string => {
    const c = oklchOfHex(hex);
    const L = clamp(c.L + VENUE_LIFT_L, GEN_L[0], GEN_L[1]);
    return hexOfOklch(L, Math.min(c.C, VENUE_CHROMA_CAP), c.H);
  };
  return {
    ceremony: [tone(slots[0]), tone(slots[1])],
    room_dressing: {
      linens: tone(dressed.linens),
      chairs: tone(dressed.chairs),
      florals: tone(dressed.florals),
      lighting_warmth: tone(dressed.lighting_warmth),
    },
  };
}
export function roomReference(venue: Venue): Oklch[] {
  const hexes = [
    ...venue.ceremony,
    venue.room_dressing.linens,
    venue.room_dressing.chairs,
    venue.room_dressing.florals,
    venue.room_dressing.lighting_warmth,
  ];
  return [...new Set(hexes)].map(oklchOfHex);
}

/* ── visibility ───────────────────────────────────────────────────────── */
export function visibility(c: Oklch, room: Oklch[]): number {
  const meanC = room.reduce((s, r) => s + r.C, 0) / room.length;
  let best: { dL: number; dC: number } | null = null;
  let bestSep = Infinity;
  for (const s of room) {
    const dL = Math.abs(c.L - s.L);
    const dC = Math.hypot(c.a - s.a, c.b - s.b);
    const sep = Math.hypot(dL, KAPPA * dC);
    if (sep < bestSep) {
      bestSep = sep;
      best = { dL, dC };
    }
  }
  return best!.dL + KAPPA * best!.dC + MU * Math.max(0, c.C - meanC);
}
let VMAX_CACHE = new Map<string, number>();
export function vMax(room: Oklch[]): number {
  const key = room.map((r) => r.hex).join('|');
  const cached = VMAX_CACHE.get(key);
  if (cached !== undefined) return cached;
  let best = 0;
  for (let L = GEN_L[0]; L <= GEN_L[1] + 1e-9; L += 0.04) {
    for (let H = 0; H < 360; H += 15) {
      const mc = maxOklchChroma(L, H);
      for (const f of [0, 0.25, 0.5, 0.75, 1]) {
        const c = oklchOfHex(hexOfOklch(L, mc * f, H));
        if (!wearable(c, 'guest')) continue;
        const v = visibility(c, room);
        if (v > best) best = v;
      }
    }
  }
  VMAX_CACHE.set(key, best);
  return best;
}
/** How many perceptibly-distinct ranks this room can carry. */
export const rankLevels = (vmax: number): number =>
  Math.max(2, Math.min(6, Math.floor((vmax * (VISIBILITY_LADDER[0]! - VISIBILITY_LADDER[5]!)) / MIN_V_GAP_ABS) + 1));
export const COLLAPSE_ORDER: [number, number][] = [
  [4, 5],
  [2, 3],
];
/** rank (1..6) -> group index (0..levels-1) and each group's ladder fraction. */
export function rankGroups(levels: number): { ranks: number[]; frac: number }[] {
  const groups: number[][] = [[1], [2], [3], [4], [5], [6]];
  let i = 0;
  while (groups.length > levels && i < COLLAPSE_ORDER.length) {
    const [a, b] = COLLAPSE_ORDER[i++]!; // i < COLLAPSE_ORDER.length, checked above
    const ai = groups.findIndex((g) => g.includes(a));
    const bi = groups.findIndex((g) => g.includes(b));
    if (ai !== bi) {
      groups[ai] = [...groups[ai]!, ...groups[bi]!];
      groups.splice(bi, 1);
    }
  }
  return groups.map((g) => ({ ranks: g, frac: g.reduce((s, r) => s + VISIBILITY_LADDER[r - 1]!, 0) / g.length }));
}

/* ── candidates ───────────────────────────────────────────────────────── */
export function candidates(slots: Slots, style: PaletteStyle, rank: number, roleKey: RoleKey): Candidate[] {
  const src = sourceOf(slots, roleKey);
  const anchor = anchorMajor(slots);
  const cap = chromaCeiling(src.C, rank);
  const out: Candidate[] = [];
  const push = (hex: string, lib: boolean): void => {
    const c = oklchOfHex(hex);
    if (wearable(c, roleKey)) out.push({ ...c, lib: !!lib });
  };

  if (style === 'simple') {
    for (const h of slots) push(h, false);
    return dedupe(out);
  }

  // hue set: the source's own hue, plus (complex only) the harmony departures
  const warmOnly = isAllWarm(slots);
  const inWarm = isWarmHue;
  const hues = [src.H];
  if (style === 'complex' && anchor.C >= NEUTRAL_C && src.C >= NEUTRAL_C) {
    const maxDepart = warmOnly ? MAX_DEPART_WARM : MAX_DEPART_MIXED;
    const reach = maxDepart * VISIBILITY_LADDER[rank - 1]!; // rank is always 1-6
    for (const t of HARMONY_TARGETS) {
      if (t === 0 || t > maxDepart + 1e-9) continue;
      const d = Math.min(t, reach);
      // 🛑 A DEPARTURE MAY NOT LEAVE THE THEME'S TEMPERATURE. Anchoring on a
      // gold at H≈90 and turning +20° lands on yellow-green: a green entourage
      // at a burgundy-and-gold wedding. Warm themes stay warm.
      for (const H of [anchor.H + d, anchor.H - d]) if (!warmOnly || inWarm(H)) hues.push(H);
    }
  }
  for (const H of hues) {
    for (let dL = -0.4; dL <= 0.34 + 1e-9; dL += 0.02) {
      const L = clamp(src.L + dL, GEN_L[0], GEN_L[1]);
      push(hexOfOklch(L, Math.min(cap, maxOklchChroma(L, H)), H), false);
    }
  }
  // library entries inside the style's hue reach and under the rank's chroma gate
  const reachDeg = style === 'complex' ? (warmOnly ? MAX_DEPART_WARM : MAX_DEPART_MIXED) : HUE_FAMILY_DEG;
  const centre = style === 'complex' && anchor.C >= NEUTRAL_C ? anchor.H : src.H;
  for (const e of ATTIRE_LIBRARY) {
    if (cap === 0) {
      if (e.C >= NEUTRAL_C) continue; // grey theme → grey library only
    } else if (e.C > cap + 1e-9 || hueDist(e.H, centre) > reachDeg) continue;
    if (style === 'complex' && warmOnly && e.C >= NEUTRAL_C && !inWarm(e.H)) continue;
    push(e.hex, true);
  }
  return dedupe(out);
}
const dedupe = (arr: Candidate[]): Candidate[] => {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const c of arr) {
    if (seen.has(c.hex)) continue;
    seen.add(c.hex);
    out.push(c);
  }
  return out;
};

/* ── the ladder ───────────────────────────────────────────────────────── */
/** Representative source key per rank — used only to pick the rank primary. */
const REP_KEY: Record<number, RoleKey> = {
  2: 'parents_immediate_family',
  3: 'principal_sponsors',
  4: 'wedding_party',
  5: 'secondary_sponsors',
  6: 'guest',
};
/** Where each role sits inside its rank's band (0 = quiet edge, 1 = loud edge). */
export const IN_RANK_F = [0.5, 0.35, 0.65, 0.25, 0.75];
export const EXTRA_F = 0.14;
/** Derived but NOT bound by the ladder — see RANK_EXEMPT rationale in the spec. */
export const RANK_EXEMPT = new Set<RoleKey>(['bearers_flower_girl']);

/**
 * Rank primaries, assigned rank 1 → 6 under a DESCENDING CEILING.
 * THE CEILING IS A HARD CONSTRAINT AND IS NEVER RELAXED; the target is an
 * objective. That is what makes the monotonic invariant unconditional.
 */
export function rankPrimaries(
  slots: Slots,
  style: PaletteStyle,
  room: Oklch[],
  opts: { coupleV?: number } = {},
): Ladder {
  const vmax = vMax(room);
  const groups = rankGroups(rankLevels(vmax));
  const strict = style !== 'simple';
  const gap = strict ? MIN_V_GAP_ABS : 0;
  const guestFloor = GUEST_V_FLOOR_FRAC * vmax;

  const out = new Map<number, RankEntry>();
  const collapsed: number[] = [];
  const reduced: number[] = []; // ranks whose wearability gates had to be waived — reported, never hidden
  let ceiling = Infinity;
  let prev: Candidate | null = null;
  const coupleV = opts.coupleV;
  for (const g of groups) {
    const rank = g.ranks[0]!; // every group has at least one rank by construction
    const target = g.frac * vmax;
    if (rank === 1) {
      // EXEMPT — pinned, measured, never searched
      out.set(1, { c: null, v: coupleV ?? Infinity });
      // The couple only caps the ladder when they are genuinely the most
      // visible people in the room. When they are not, the board says so
      // (__meta.coupleUnderRank2) instead of dragging everyone else down.
      ceiling = coupleV != null && coupleV > target ? coupleV : Infinity;
      continue;
    }
    const pool = candidates(slots, style, rank, REP_KEY[rank]!).filter(
      (c) => visibility(c, room) <= ceiling - gap + 1e-12 && visibility(c, room) >= guestFloor,
    );
    const div: Candidate[] = prev ? pool.filter((c) => oklchDistance(c, prev!) >= DIVERSITY_DE_MIN) : pool;
    const base: Candidate[] = div.length ? div : pool;
    // 🔑 THE LADDER FILTERS; THE LIBRARY PICKS.
    const tol = LIB_TOL_FRAC * vmax;
    const lib: Candidate[] = base.filter((c) => c.lib && Math.abs(visibility(c, room) - target) <= tol);
    let from: Candidate[] = lib.length ? lib : base;
    if (!from.length && !prev) {
      // INTEGRATION FIX 2026-09-03 — reachable ONLY where this code used to
      // THROW (so it can alter no verified fixture output, re-measured: 0
      // diffs over 9 sets × 3 styles). The board OPENS on a low-contrast trio
      // the spec's nine fixtures never covered: in Simple every major can sit
      // below the guest floor, and with no rank above to collapse onto the
      // ladder had nothing. Simple has nothing but the majors to offer, so
      // retry THIS rank unfloored rather than crash the whole board.
      from = candidates(slots, style, rank, REP_KEY[rank]!).filter((c) => visibility(c, room) <= ceiling - gap + 1e-12);
    }
    if (!from.length && !prev) {
      // REDUCED RESULT, never a throw. When even the unfloored retry finds
      // nothing, no major passes the wearability gates at all (an all-bridal
      // palette rejects every candidate for a non-bride). The honest answer
      // is the couple's own colours with the gates waived and the reduction
      // SAID: the rank is recorded in `reduced`, `deriveBoard` carries it out
      // in `__meta`, and the UI states it where the roles render. Downstream
      // ranks then collapse onto this pick as normal.
      from = [...new Map(slots.map((h) => { const c = oklchOfHex(h); return [c.hex, c] as const; })).values()];
      reduced.push(rank);
    }
    if (!from.length) {
      // the room cannot separate this rank — COLLAPSE, never compress. `prev`
      // is always set here: the tier above guarantees `from` is non-empty
      // the first time a non-couple rank is processed, so every later rank
      // reaching this branch already has a primary to collapse onto.
      for (const r of g.ranks) {
        out.set(r, { c: prev, v: ceiling });
        collapsed.push(r);
      }
      continue;
    }
    const pick: Candidate = from.reduce((best: Candidate, c: Candidate) => {
      const d = Math.abs(visibility(c, room) - target);
      const bd = Math.abs(visibility(best, room) - target);
      if (d < bd - 1e-12) return c;
      if (d > bd + 1e-12) return best;
      return c.hex < best.hex ? c : best; // stable, total tie-break
    });
    const v = visibility(pick, room);
    for (const r of g.ranks) out.set(r, { c: pick, v });
    ceiling = v;
    prev = pick;
  }
  // ACHIEVED bands — DISJOINT by construction. Boundaries are the MIDPOINTS
  // between adjacent rank primaries, so no colour a rank may hold can also be
  // held by an adjacent rank. Bands that merely touch the neighbouring
  // PRIMARY still overlap each other, and a rank-5 role then legitimately
  // out-ranks a rank-4 one while every primary is correctly ordered.
  const bands = new Map<number, Band>();
  const levelsSeen = [...out.keys()].filter((r) => r >= 2).sort((a, b) => a - b);
  const vOf = (r: number): number => out.get(r)!.v;
  for (const r of levelsSeen) {
    const above = levelsSeen.filter((k) => k < r && vOf(k) > vOf(r)).pop();
    const below = levelsSeen.filter((k) => k > r && vOf(k) < vOf(r))[0];
    const hi = above != null ? (vOf(above) + vOf(r)) / 2 : vOf(r) * 1.35 + 1e-6;
    const lo = below != null ? (vOf(below) + vOf(r)) / 2 : guestFloor;
    bands.set(r, { lo, hi });
  }
  return {
    primaries: out,
    bands,
    vmax,
    levels: groups.length,
    groups: groups.map((g) => g.ranks),
    collapsed,
    reduced,
    guestFloor,
  };
}

/* ── exempt roles ─────────────────────────────────────────────────────── */
export function exemptColors(slots: Slots, roleKey: RoleKey): string[] {
  // officiants: NOT the couple's colour to choose. Never derived, never
  // auto-filled — the UI shows the key with "follows the church's calendar".
  if (roleKey === 'officiants') return [];
  const anchor = anchorMajor(slots);
  const accent =
    anchor.C < NEUTRAL_C
      ? slots[1]
      : wearable(anchor, 'parents_immediate_family')
        ? anchor.hex
        : hexOfOklch(clamp(anchor.L, 0.3, 0.78), Math.min(anchor.C, RANK_CHROMA_CAP[0]!), anchor.H);
  const bridal = slots
    .map(oklchOfHex)
    .filter(isBridal)
    .sort((a, b) => b.L - a.L)[0];
  if (roleKey === 'bride') return [bridal ? bridal.hex : BRIDAL_DEFAULT, accent];
  const dark = slots
    .map(oklchOfHex)
    .filter((c) => c.L <= 0.34 && c.C <= 0.06)
    .sort((a, b) => a.L - b.L)[0];
  return [dark ? dark.hex : FORMAL_DARK_DEFAULT, accent];
}

export function coupleVisibility(slots: Slots, room: Oklch[]): number {
  // exemptColors('bride'|'groom') always returns a 2-element [swatch, accent] array
  const b = oklchOfHex(exemptColors(slots, 'bride')[0]!);
  const g = oklchOfHex(exemptColors(slots, 'groom')[0]!);
  return Math.max(visibility(b, room), visibility(g, room));
}

/* ── one role ─────────────────────────────────────────────────────────── */
/** Pick n distinct colours for a role, every one INSIDE its rank's band. */
function pickForRole(slots: Slots, style: PaletteStyle, roleKey: RoleKey, room: Oklch[], ladder: Ladder): string[] {
  const rank = VISIBILITY_RANK[roleKey] as number; // non-null: caller already routed officiants/ceremony/reception away
  const band = ladder.bands.get(rank);
  const rankExempt = RANK_EXEMPT.has(roleKey);
  const n = ROLE_COLOR_COUNT[roleKey] as number;
  let pool: Candidate[] = candidates(slots, style, rank, roleKey);
  if (!pool.length) pool = candidates(slots, style, rank, 'guest');
  if (!pool.length) pool = [sourceOf(slots, roleKey)];
  if (!rankExempt && band) {
    const inBand = pool.filter((c) => {
      const v = visibility(c, room);
      return v > band.lo + 1e-12 && v < band.hi - 1e-12;
    });
    // Fall back to the rank primary — which is in the band by construction —
    // rather than leaving the band. Ordering is never traded for taste.
    if (!inBand.length) {
      const p = ladder.primaries.get(rank)!.c!;
      return Array(n).fill(p.hex).slice(0, 1);
    }
    pool = inBand;
  } else {
    pool = pool.filter((c) => visibility(c, room) >= ladder.guestFloor);
  }
  const lo = band && !rankExempt ? band.lo : Math.min(...pool.map((c) => visibility(c, room)));
  const hi = band && !rankExempt ? band.hi : Math.max(...pool.map((c) => visibility(c, room)));
  const i = IN_RANK_INDEX[roleKey] ?? 0;
  const f0 = IN_RANK_F[Math.min(i, IN_RANK_F.length - 1)]!; // index is clamped into range just above
  const at = (f: number): Candidate => {
    const t = lo + (hi - lo) * clamp(f, 0.04, 0.96);
    const tol = LIB_TOL_FRAC * ladder.vmax;
    const lib = pool.filter((c) => c.lib && Math.abs(visibility(c, room) - t) <= tol);
    const from = lib.length ? lib : pool;
    return from.reduce((best, c) => {
      const d = Math.abs(visibility(c, room) - t);
      const bd = Math.abs(visibility(best, room) - t);
      if (d < bd - 1e-12) return c;
      if (d > bd + 1e-12) return best;
      return c.hex < best.hex ? c : best;
    });
  };
  const out: Candidate[] = [];
  const offsets = [0, -EXTRA_F, EXTRA_F, -2 * EXTRA_F, 2 * EXTRA_F, -3 * EXTRA_F];
  for (const o of offsets) {
    if (out.length >= n) break;
    const c = at(f0 + o);
    if (!out.some((x) => x.hex === c.hex)) out.push(c);
  }
  // Widen from the whole pool if the offsets kept landing on the same colour —
  // library entries first, so a filler colour is still one somebody wears.
  const widen = [...pool].sort((a, b) => (a.lib === b.lib ? (a.hex < b.hex ? -1 : 1) : a.lib ? -1 : 1));
  for (const c of widen) {
    if (out.length >= n) break;
    if (!out.some((x) => x.hex === c.hex)) out.push(c);
  }
  return out.slice(0, Math.max(1, n)).map((c) => c.hex);
}

/* ── PUBLIC API ───────────────────────────────────────────────────────── */
export function deriveRole(
  majors: readonly string[],
  style: PaletteStyle,
  roleKey: RoleKey | 'room_dressing',
  ctx?: DeriveRoleCtx,
): string[] | RoomDressing {
  const slots = normalizeMajors(majors);
  const venue = ctx?.venue ?? deriveVenue(slots, style);
  if (roleKey === 'ceremony') return [...new Set(venue.ceremony)];
  if (roleKey === 'room_dressing') return venue.room_dressing;
  if (roleKey === 'reception') return [...slots];
  if (EXEMPT.has(roleKey)) return [...new Set(exemptColors(slots, roleKey))];

  const room = ctx?.room ?? roomReference(venue);
  const ladder = ctx?.ladder ?? rankPrimaries(slots, style, room, { coupleV: coupleVisibility(slots, room) });
  const rank = VISIBILITY_RANK[roleKey] as number; // officiants/ceremony/reception already routed away above
  const n = ROLE_COLOR_COUNT[roleKey] as number;

  let out: string[];
  if (style === 'simple') {
    // SIMPLE never tones. The majors themselves, ordered by visibility, with
    // the rank's own major first. Repetition across ranks is expected and is
    // surfaced in the UI, not hidden.
    const byV = (x: Oklch, y: Oklch): number => visibility(y, room) - visibility(x, room);
    const all = [...new Map(slots.map((h) => [h, oklchOfHex(h)] as const)).values()];
    let pool = all.filter((c) => wearable(c, roleKey)).sort(byV);
    // A role gate no major can satisfy (a flower girl in a theme with no pale
    // colour) is REPORTED, not thrown and not silently widened into a sixth
    // colour: Simple's promise is the couple's five and nothing else.
    if (!pool.length) {
      pool = all.filter((c) => wearable(c, 'guest')).sort(byV);
      ctx?.warn?.(roleKey, 'no-major-fits-this-role');
    }
    if (!pool.length) {
      pool = all.slice().sort(byV);
      ctx?.warn?.(roleKey, 'no-wearable-major');
    }
    const head = ladder.primaries.get(rank)?.c;
    // pool always has >= 1 entry: `all` comes from the 5 (deduped) majors, never empty
    const headHex = head && pool.some((c) => c.hex === head.hex) ? head.hex : pool[0]!.hex;
    out = [
      headHex,
      ...pool
        .filter((c) => c.hex !== headHex)
        .slice(0, n - 1)
        .map((c) => c.hex),
    ];
  } else {
    out = pickForRole(slots, style, roleKey, room, ladder);
  }

  // THE BARONG SLOT. A barong Tagalog exists in a narrow material vocabulary —
  // sheer piña/jusi ivory, cream, beige, champagne, or formal black/navy. A
  // colour outside it is not a garment. This ONE slot may leave the band; index
  // 0 (the ninang / wali-ang-babae slot) is untouched, so the invariant still
  // reads a band-bound colour.
  // SIMPLE never reaches outside the couple's five, so it does not get the
  // barong slot — a Simple board whose sponsor colour is not barong-legal is
  // reported in __meta instead of quietly gaining a sixth colour.
  const barongAt = style === 'simple' ? null : BARONG_SLOT[roleKey];
  if (barongAt != null) {
    const gate = chromaCeiling(sourceOf(slots, roleKey).C, rank);
    const legal = [...candidates(slots, style, rank, roleKey), ...ATTIRE_LIBRARY].filter(
      (c) => isBarongLegal(c) && wearable(c, roleKey) && c.C <= gate + 1e-9,
    );
    if (legal.length) {
      const t = ladder.bands.get(rank)?.lo ?? 0;
      const pick = legal.reduce((best, c) =>
        Math.abs(visibility(c, room) - t) < Math.abs(visibility(best, room) - t) ? c : best,
      );
      while (out.length <= barongAt) out.push(pick.hex);
      out[barongAt] = pick.hex;
    }
  }
  return [...new Set(out)];
}

/**
 * The rank groups the room can actually TELL APART — the ladder's own groups,
 * further merged wherever a rank had to collapse onto the one above it. This
 * is the set the monotonic invariant is asserted over, and the number the UI
 * reports as "this palette tells N levels apart".
 */
export function separableGroups(ladder: Ladder): number[][] {
  const out: number[][] = [];
  for (const ranks of ladder.groups) {
    if (out.length && ranks.some((r) => ladder.collapsed.includes(r))) out[out.length - 1]!.push(...ranks);
    else out.push([...ranks]);
  }
  return out;
}

/** Whole board in one pass. touchedRoles are NEVER written. */
export function deriveBoard(
  majors: readonly string[],
  style: PaletteStyle,
  touchedRoles: ReadonlySet<string> = new Set(),
): Board {
  const slots = normalizeMajors(majors);
  const venue = deriveVenue(slots, style);
  const room = roomReference(venue);
  const ladder = rankPrimaries(slots, style, room, { coupleV: coupleVisibility(slots, room) });
  const warnings: BoardWarning[] = [];
  const ctx: DeriveRoleCtx = { venue, room, ladder, warn: (key, code) => warnings.push({ key, code }) };
  const out: Partial<Board> = {};
  if (!touchedRoles.has('reception')) out.reception = [...slots];
  for (const key of ['ceremony' as const, ...PEOPLE_KEYS]) {
    if (touchedRoles.has(key)) continue;
    out[key] = deriveRole(slots, style, key, ctx) as string[];
  }
  if (!touchedRoles.has('room_dressing')) out.room_dressing = venue.room_dressing;
  out.__meta = {
    vmax: ladder.vmax,
    levels: ladder.levels,
    collapsed: ladder.collapsed,
    reduced: ladder.reduced,
    groups: ladder.groups,
    separable: separableGroups(ladder),
    coupleV: coupleVisibility(slots, room),
    coupleUnderRank2: coupleVisibility(slots, room) < (ladder.primaries.get(2)?.v ?? 0),
    warnings,
  };
  return out as Board;
}
