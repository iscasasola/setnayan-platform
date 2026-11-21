/**
 * 🎂 cake-config — THE one catalog for the Cake Maker (controller rulings 2026-11-21: "avatar-maker pattern",
 * "up to 10 layers", "real vs display tiers", "cupcakes add-on"). Pure — no React, no three.js — so the same
 * catalog, sanitizer and figure model are read by:
 *   · the supplier's "Your cake options" (which looks the shop offers — every control is driven off this catalog),
 *   · the server sanitizer that refuses a design before anything is stored (`sanitizeCakeConfig`),
 *   · ONE `<CakeFigure>` (2D and the lazy 3D turntable), through `cakeFigureSpec` — both views read that one model.
 *
 * Catalogs are append-only: a stored design must never dangle. A value not in these tables does not exist anywhere.
 * No money lives here — every extra is the supplier's own typed figure on a package line (`price_delta_centavos`).
 */

export const CAKE_CONFIG_VERSION = 1;
/** The stored design is small: refuse anything bigger before parsing it further. */
export const CAKE_CONFIG_MAX_BYTES = 4096;
export const CAKE_MAX_TIERS = 10;
export const CAKE_MAX_COLOURS = 3;
export const CAKE_INSTRUCTIONS_MAX = 600;
export const CAKE_MESSAGE_MAX = 60;

export const CAKE_ARRANGEMENTS = [
  { id: 'stacked', label: 'Stacked' },
  { id: 'floating', label: 'Floating' },
  { id: 'pillars', label: 'Pillars' },
  { id: 'offset', label: 'Offset' },
  { id: 'side', label: 'Side by side' },
] as const;
export type CakeArrangement = (typeof CAKE_ARRANGEMENTS)[number]['id'];

export const CAKE_FINISHES = [
  { id: 'buttercream', label: 'Buttercream' },
  { id: 'fondant', label: 'Fondant' },
  { id: 'semi_naked', label: 'Semi-naked' },
] as const;
export type CakeFinish = (typeof CAKE_FINISHES)[number]['id'];

/** What one layer can wear. 'none' is the plain layer and always exists. */
export const CAKE_ACCENTS = [
  { id: 'none', label: 'Plain' },
  { id: 'ribbon', label: 'Ribbon' },
  { id: 'flowers', label: 'Flowers' },
  { id: 'drip', label: 'Drip' },
  { id: 'pearls', label: 'Pearls' },
  { id: 'gold_leaf', label: 'Gold leaf' },
  { id: 'ruffles', label: 'Ruffles' },
] as const;
export type CakeAccent = (typeof CAKE_ACCENTS)[number]['id'];

/** One accent that runs across layers, top to bottom. */
export const CAKE_FLOWING = [
  { id: 'none', label: 'None' },
  { id: 'floral_cascade', label: 'Floral cascade' },
  { id: 'ribbon_cascade', label: 'Ribbon cascade' },
  { id: 'pearl_strand', label: 'Pearl strand' },
] as const;
export type CakeFlowing = (typeof CAKE_FLOWING)[number]['id'];

export const CAKE_TOPPERS = [
  { id: 'none', label: 'None' },
  { id: 'names', label: 'Names' },
  { id: 'flowers', label: 'Fresh flowers' },
  { id: 'figurine', label: 'Figurine' },
] as const;
export type CakeTopper = (typeof CAKE_TOPPERS)[number]['id'];

/** Where the event's shipped monogram sits when the shop offers it. */
export const CAKE_MONOGRAM_SPOTS = [
  { id: 'front', label: 'On a layer' },
  { id: 'topper', label: 'As the topper' },
  { id: 'board', label: 'On the cake board' },
] as const;
export type CakeMonogramSpot = (typeof CAKE_MONOGRAM_SPOTS)[number]['id'];

export const CUPCAKE_PLACEMENTS = [
  { id: 'base', label: 'Around the base' },
  { id: 'tower', label: 'Cupcake tower' },
] as const;
export type CupcakePlacement = (typeof CUPCAKE_PLACEMENTS)[number]['id'];

export type CakeTierKind = 'real' | 'display';
export type CakeTierConfig = {
  kind: CakeTierKind;
  /** The shop's flavour option id — real tiers only. */
  flavourRef: string | null;
  accent: CakeAccent;
};
export type CakeColour = { hex: string; name: string };
export type CakeCupcakes = { packRef: string; flavourRef: string | null; match: boolean; placement: CupcakePlacement };

export type CakeConfig = {
  v: typeof CAKE_CONFIG_VERSION;
  /** Bottom first. 1–10. */
  tiers: CakeTierConfig[];
  /** The tier that is cut on the day — always a real tier. */
  cuttingTier: number;
  arrangement: CakeArrangement;
  finish: CakeFinish;
  colours: CakeColour[];
  flowing: CakeFlowing;
  monogram: CakeMonogramSpot | null;
  topper: CakeTopper;
  message: string;
  instructions: string;
  /** ONE pinned inspiration photo — a `moodboard_library_assets.asset_id`, never a copy. */
  inspirationRef: string | null;
  cupcakes: CakeCupcakes | null;
};

/** What one shop offers on one card — read from its own package lines. Every list holds catalog ids only. */
export type CakeOffer = {
  maxRealTiers: number;
  /** 0 = the shop's Display tiers switch is off. */
  maxDisplayTiers: number;
  arrangements: CakeArrangement[];
  finishes: CakeFinish[];
  accents: CakeAccent[];
  flowing: CakeFlowing[];
  monogram: boolean;
  toppers: CakeTopper[];
  flavourRefs: string[];
  messageMax: number;
  /** null = the shop does not sell cupcakes. */
  cupcakes: { packRefs: string[]; flavourRefs: string[]; tower: boolean } | null;
};

export type CakeConfigRefusal =
  | 'too_big'
  | 'not_a_design'
  | 'tiers'
  | 'no_real_tier'
  | 'cutting_tier_display'
  | 'display_not_offered'
  | 'not_offered'
  | 'colours'
  | 'text';

export const CAKE_CONFIG_REFUSAL_WORDS: Record<CakeConfigRefusal, string> = {
  too_big: 'This design is too large to send.',
  not_a_design: 'This design could not be read.',
  tiers: 'Pick between 1 and 10 tiers.',
  no_real_tier: 'At least one tier must be real cake.',
  cutting_tier_display: 'The cutting tier must be real cake.',
  display_not_offered: 'This shop does not make display tiers.',
  not_offered: 'Something in this design is no longer offered — pick again.',
  colours: 'Pick up to 3 colours.',
  text: 'A message or instruction is too long.',
};

const ids = <T extends { id: string }>(list: readonly T[]) => list.map((x) => x.id) as T['id'][];
const isOneOf = <T extends string>(v: unknown, list: readonly T[]): v is T => typeof v === 'string' && (list as readonly string[]).includes(v);
const HEX = /^#[0-9a-f]{6}$/i;

/** Everything in the catalog — the lab and a fresh card read it. */
export function fullCakeOffer(): CakeOffer {
  return {
    maxRealTiers: CAKE_MAX_TIERS,
    maxDisplayTiers: CAKE_MAX_TIERS - 1,
    arrangements: ids(CAKE_ARRANGEMENTS),
    finishes: ids(CAKE_FINISHES),
    accents: ids(CAKE_ACCENTS),
    flowing: ids(CAKE_FLOWING),
    monogram: true,
    toppers: ids(CAKE_TOPPERS),
    flavourRefs: [],
    messageMax: 40,
    cupcakes: null,
  };
}

/**
 * The server's check. Refuses — never repairs — anything structural: 0 or > 10 tiers, no real tier, a display
 * cutting tier, display tiers from a shop without them, a look this shop does not offer. A flavour on a display
 * tier is dropped (flavour applies to real tiers only) — that is the one silent tidy, because it changes no price.
 */
export function sanitizeCakeConfig(
  input: unknown,
  offer: CakeOffer,
): { ok: true; config: CakeConfig } | { ok: false; reason: CakeConfigRefusal } {
  const raw: unknown = input;
  try {
    if (JSON.stringify(input ?? null).length > CAKE_CONFIG_MAX_BYTES) return { ok: false, reason: 'too_big' };
  } catch {
    return { ok: false, reason: 'not_a_design' };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reason: 'not_a_design' };
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.tiers) || r.tiers.length < 1 || r.tiers.length > CAKE_MAX_TIERS) return { ok: false, reason: 'tiers' };

  const tiers: CakeTierConfig[] = [];
  for (const t of r.tiers as unknown[]) {
    if (!t || typeof t !== 'object') return { ok: false, reason: 'not_a_design' };
    const tt = t as Record<string, unknown>;
    if (tt.kind !== 'real' && tt.kind !== 'display') return { ok: false, reason: 'not_a_design' };
    const accent = tt.accent ?? 'none';
    if (!isOneOf(accent, ids(CAKE_ACCENTS))) return { ok: false, reason: 'not_a_design' };
    if (accent !== 'none' && !offer.accents.includes(accent)) return { ok: false, reason: 'not_offered' };
    let flavourRef: string | null = null;
    if (tt.kind === 'real' && tt.flavourRef != null) {
      if (typeof tt.flavourRef !== 'string' || !offer.flavourRefs.includes(tt.flavourRef)) return { ok: false, reason: 'not_offered' };
      flavourRef = tt.flavourRef;
    }
    tiers.push({ kind: tt.kind, flavourRef, accent });
  }
  const real = tiers.filter((t) => t.kind === 'real').length;
  const display = tiers.length - real;
  if (real === 0) return { ok: false, reason: 'no_real_tier' };
  if (display > 0 && offer.maxDisplayTiers === 0) return { ok: false, reason: 'display_not_offered' };
  if (real > offer.maxRealTiers || display > offer.maxDisplayTiers) return { ok: false, reason: 'tiers' };

  const cutting = r.cuttingTier ?? tiers.findIndex((t) => t.kind === 'real');
  if (typeof cutting !== 'number' || !Number.isInteger(cutting) || cutting < 0 || cutting >= tiers.length) {
    return { ok: false, reason: 'not_a_design' };
  }
  if (tiers[cutting]!.kind !== 'real') return { ok: false, reason: 'cutting_tier_display' };

  const pick = <T extends string>(v: unknown, all: readonly T[], offered: readonly T[], fallback: T): T | null => {
    const x = v ?? fallback;
    if (!isOneOf(x, all)) return null;
    return x === fallback || offered.includes(x) ? x : null;
  };
  const arrangement = pick(r.arrangement, ids(CAKE_ARRANGEMENTS), offer.arrangements, 'stacked');
  const finish = pick(r.finish, ids(CAKE_FINISHES), offer.finishes, offer.finishes[0] ?? 'buttercream');
  const flowing = pick(r.flowing, ids(CAKE_FLOWING), offer.flowing, 'none');
  const topper = pick(r.topper, ids(CAKE_TOPPERS), offer.toppers, 'none');
  if (!arrangement || !finish || !flowing || !topper) return { ok: false, reason: 'not_offered' };

  let monogram: CakeMonogramSpot | null = null;
  if (r.monogram != null) {
    if (!isOneOf(r.monogram, ids(CAKE_MONOGRAM_SPOTS))) return { ok: false, reason: 'not_a_design' };
    if (!offer.monogram) return { ok: false, reason: 'not_offered' };
    monogram = r.monogram;
  }

  const colours: CakeColour[] = [];
  if (r.colours != null) {
    if (!Array.isArray(r.colours) || r.colours.length > CAKE_MAX_COLOURS) return { ok: false, reason: 'colours' };
    for (const c of r.colours as unknown[]) {
      const cc = (c ?? {}) as Record<string, unknown>;
      if (typeof cc.hex !== 'string' || !HEX.test(cc.hex) || typeof cc.name !== 'string' || cc.name.length > 40) {
        return { ok: false, reason: 'colours' };
      }
      colours.push({ hex: cc.hex.toUpperCase(), name: cc.name.trim() });
    }
  }

  const text = (v: unknown, max: number): string | null => {
    if (v == null) return '';
    if (typeof v !== 'string') return null;
    const s = v.trim();
    return s.length > max ? null : s;
  };
  const message = text(r.message, Math.min(offer.messageMax, CAKE_MESSAGE_MAX));
  const instructions = text(r.instructions, CAKE_INSTRUCTIONS_MAX);
  if (message === null || instructions === null) return { ok: false, reason: 'text' };

  let inspirationRef: string | null = null;
  if (r.inspirationRef != null) {
    if (typeof r.inspirationRef !== 'string' || !/^[0-9a-f-]{36}$/i.test(r.inspirationRef)) return { ok: false, reason: 'not_a_design' };
    inspirationRef = r.inspirationRef.toLowerCase();
  }

  let cupcakes: CakeCupcakes | null = null;
  if (r.cupcakes != null) {
    const cc = r.cupcakes as Record<string, unknown>;
    if (!offer.cupcakes) return { ok: false, reason: 'not_offered' };
    if (typeof cc.packRef !== 'string' || !offer.cupcakes.packRefs.includes(cc.packRef)) return { ok: false, reason: 'not_offered' };
    const placement = cc.placement ?? 'base';
    if (!isOneOf(placement, ids(CUPCAKE_PLACEMENTS))) return { ok: false, reason: 'not_a_design' };
    if (placement === 'tower' && !offer.cupcakes.tower) return { ok: false, reason: 'not_offered' };
    const match = cc.match === true;
    let flavourRef: string | null = null;
    if (!match && cc.flavourRef != null) {
      if (typeof cc.flavourRef !== 'string' || !offer.cupcakes.flavourRefs.includes(cc.flavourRef)) return { ok: false, reason: 'not_offered' };
      flavourRef = cc.flavourRef;
    }
    cupcakes = { packRef: cc.packRef, flavourRef, match, placement };
  }

  return {
    ok: true,
    config: {
      v: CAKE_CONFIG_VERSION,
      tiers,
      cuttingTier: cutting,
      arrangement,
      finish,
      colours,
      flowing,
      monogram,
      topper: monogram === 'topper' ? 'none' : topper,
      message,
      instructions,
      inspirationRef,
      cupcakes,
    },
  };
}

/** A fresh design: 3 real tiers, plain, stacked (the drawing starts on 3). */
export function startingCakeConfig(offer: CakeOffer): CakeConfig {
  const n = Math.max(1, Math.min(3, offer.maxRealTiers));
  return {
    v: CAKE_CONFIG_VERSION,
    tiers: Array.from({ length: n }, () => ({ kind: 'real' as const, flavourRef: null, accent: 'none' as const })),
    cuttingTier: 0,
    arrangement: 'stacked',
    finish: offer.finishes[0] ?? 'buttercream',
    colours: [],
    flowing: 'none',
    monogram: null,
    topper: 'none',
    message: '',
    instructions: '',
    inspirationRef: null,
    cupcakes: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// The ONE figure model — 2D and 3D both draw exactly this.
// ─────────────────────────────────────────────────────────────────────────────

export type CakeFigureTier = {
  index: number;
  kind: CakeTierKind;
  /** Radius and height in cake units; the base tier's radius is 1. */
  radius: number;
  height: number;
  /** Bottom of the tier, and its centre across (side-by-side and offset move it). */
  y: number;
  x: number;
  /** Which stand it sits on (side by side = one stand per group). */
  stand: number;
  accent: CakeAccent;
  sponge: string;
  cutting: boolean;
  /** The gap below this tier (floating spacers or pillars), 0 when it rests on the one below. */
  gapBelow: number;
};

export type CakeFigureSpec = {
  tiers: CakeFigureTier[];
  arrangement: CakeArrangement;
  finish: CakeFinish;
  colours: string[];
  topper: { kind: CakeTopper | 'monogram'; onTier: number; y: number } | null;
  flowing: { kind: Exclude<CakeFlowing, 'none'>; fromTier: number; toTier: number } | null;
  monogram: { spot: CakeMonogramSpot; onTier: number } | null;
  message: string;
  cupcakes: { count: number; placement: CupcakePlacement } | null;
  /** The whole figure's extent, for fitting the view. */
  width: number;
  height: number;
};

/** No colour picked → champagne, so an accent is never drawn invisible. */
export const CAKE_RESTING_COLOUR = '#E3CFA6';
const DISPLAY_SPONGE = '#EFEAE2';

const has = (label: string, ...words: string[]) => {
  const l = label.toLowerCase();
  return words.some((w) => l.includes(w));
};
/** The sponge a flavour draws, from the shop's own flavour words; any other word draws vanilla. */
export function spongeOf(label: string | null | undefined): string {
  const l = label ?? '';
  if (has(l, 'red velvet')) return '#A8323A';
  if (has(l, 'choc')) return '#5E3A24';
  if (has(l, 'ube', 'taro')) return '#7B4FA0';
  if (has(l, 'mocha', 'coffee')) return '#A47551';
  if (has(l, 'pandan', 'matcha')) return '#9DBB6E';
  return '#F1DFAE';
}

/**
 * N tiers → a complete N-tier cake: widest at the bottom, the top tier carries the topper, scaled so any count
 * from 1 to 10 fits the same frame. Side by side splits the tiers into two stands (widest first).
 */
export function cakeFigureSpec(config: CakeConfig, flavourLabel: (ref: string) => string | null = () => null, cupcakeCount = 0): CakeFigureSpec {
  const n = Math.max(1, Math.min(CAKE_MAX_TIERS, config.tiers.length));
  const side = config.arrangement === 'side' && n > 1;
  const groups = side ? [Math.ceil(n / 2), Math.floor(n / 2)] : [n];
  const gap = config.arrangement === 'floating' ? 0.16 : config.arrangement === 'pillars' ? 0.32 : 0;
  const tiers: CakeFigureTier[] = [];
  let i = 0;
  let maxTop = 0;
  groups.forEach((count, stand) => {
    const scale = side ? (stand === 0 ? 0.62 : 0.5) : 1;
    const standX = side ? (stand === 0 ? -0.72 : 0.78) : 0;
    const h = Math.min(0.62, 3.4 / Math.max(count, 1)) * scale;
    let y = 0;
    for (let k = 0; k < count; k++, i++) {
      const t = config.tiers[i]!;
      const radius = scale * (count === 1 ? 1 : 1 - 0.58 * (k / (count - 1)));
      const gapBelow = k === 0 ? 0 : gap * scale;
      y += gapBelow;
      const x = standX + (config.arrangement === 'offset' && k > 0 ? (k % 2 === 1 ? 0.12 : -0.12) * scale : 0);
      tiers.push({
        index: i,
        kind: t.kind,
        radius,
        height: h,
        y,
        x,
        stand,
        accent: t.accent,
        sponge: t.kind === 'display' ? DISPLAY_SPONGE : spongeOf(t.flavourRef ? flavourLabel(t.flavourRef) : null),
        cutting: i === config.cuttingTier,
        gapBelow,
      });
      y += h;
    }
    maxTop = Math.max(maxTop, y);
  });
  const top = tiers[tiers.length - 1]!;
  const topperKind = config.monogram === 'topper' ? 'monogram' : config.topper;
  const monogramTier = config.monogram === 'front' ? (tiers.find((t) => t.kind === 'real' && t.index === config.cuttingTier)?.index ?? 0) : top.index;
  return {
    tiers,
    arrangement: config.arrangement,
    finish: config.finish,
    colours: config.colours.length > 0 ? config.colours.map((c) => c.hex) : [CAKE_RESTING_COLOUR],
    topper: topperKind === 'none' ? null : { kind: topperKind, onTier: top.index, y: top.y + top.height },
    flowing: config.flowing === 'none' ? null : { kind: config.flowing, fromTier: top.index, toTier: side ? groups[0]! - 1 : 0 },
    monogram: config.monogram && config.monogram !== 'topper' ? { spot: config.monogram, onTier: monogramTier } : null,
    message: config.message,
    cupcakes: config.cupcakes && cupcakeCount > 0 ? { count: cupcakeCount, placement: config.cupcakes.placement } : null,
    width: (side ? 2.9 : 2.2) + (config.cupcakes?.placement === 'tower' && cupcakeCount > 0 ? 0.7 : 0),
    height: maxTop + (topperKind === 'none' ? 0 : 0.5),
  };
}
