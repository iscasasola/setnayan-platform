/**
 * 🎂 THE CAKE MAKER — the shop's options (set ONCE per shop on Shop › Specialized tools › Cake Maker), the couple's
 * estimate, and the design's words (DECISION_LOG 2026-11-21 "THE CAKE MAKER LIVES IN THE CHAT, NOT ON SERVICE CARDS",
 * "CAKE MAKER v5 APPROVED", v6 = the build reference).
 *
 *   · `CakeShopOptions` — what the shop makes and each pick's extra. Stored as ONE jsonb row per shop
 *     (`vendor_cake_makers.options`), checked by `sanitizeCakeShopOptions`, which refuses and never repairs.
 *   · `cakeOfferOf` — the options as the catalog ids the couple may pick (`lib/cake-config.ts` `CakeOffer`).
 *   · `cakeDesignOf` — the one price of the shop's cake card plus one line per priced pick. That line list IS the quote
 *     the supplier opens prefilled (Make a quote). No money is invented: every extra is the shop's own typed figure,
 *     ≥ ₱0, and with no cake card price the estimate is null ("the shop quotes the price"), never a guessed number.
 *
 * Pure: no React, no database.
 */
import { formatCount } from './format-number';
import {
  CAKE_ACCENTS,
  CAKE_ARRANGEMENTS,
  CAKE_FINISHES,
  CAKE_FLOWING,
  CAKE_MAX_COLOURS,
  CAKE_MAX_TIERS,
  CAKE_MESSAGE_MAX,
  CAKE_MONOGRAM_SPOTS,
  CAKE_SHAPES,
  CAKE_TOPPERS,
  CUPCAKE_PLACEMENTS,
  type CakeAccent,
  type CakeArrangement,
  type CakeConfig,
  type CakeFinish,
  type CakeFlowing,
  type CakeOffer,
  type CakeShape,
  type CakeTopper,
} from '@/lib/cake-config';
import { formatCentavosPhp } from '@/lib/vendor-packages';

export { CAKE_MAX_TIERS };

/** The cake kinds — the shops whose chat gets "Design a cake", and whose Cake Maker tile is suggested. */
export const CAKE_KINDS: ReadonlySet<string> = new Set(['wedding_cake', 'cake']);
export function isCakeKind(kind: string | null | undefined): boolean {
  return !!kind && CAKE_KINDS.has(kind);
}

export const CAKE_OPTIONS_VERSION = 3;
export const CAKE_OPTIONS_MAX_BYTES = 16_384;
export const CAKE_LABEL_MAX = 60;
export const CAKE_FLAVOURS_MAX = 12;
export const CAKE_SHOP_COLOURS_MAX = 12;
export const CUPCAKE_PACKS_MAX = 6;
export const CUPCAKE_PACK_MAX_COUNT = 500;
export const CAKE_SERVES_MAX = 5000;
/** Bounds a typo only — it prices nothing. */
const EXTRA_MAX_CENTAVOS = 100_000_000;

export type CakePriced<T extends string> = { id: T; extraCentavos: number };
export type CakeSize = { count: number; extraCentavos: number; serves: number | null };
export type CakeFlavour = { ref: string; label: string; extraCentavos: number };
export type CakePack = { count: number; priceCentavos: number };

export type CakeShopOptions = {
  v: typeof CAKE_OPTIONS_VERSION;
  /** The tier counts the shop makes, each with its extra and how many it serves. */
  sizes: CakeSize[];
  /** The count in the one price. */
  standardSize: number;
  /** null = the Display tiers switch is off. */
  display: { extraCentavos: number } | null;
  flavours: CakeFlavour[];
  standardFlavour: string | null;
  /** Shapes the shop makes (round is always one, in the price). */
  shapes: CakePriced<CakeShape>[];
  /** null = no Tall · double barrel tier. */
  tall: { extraCentavos: number } | null;
  finishes: CakePriced<CakeFinish>[];
  standardFinish: CakeFinish;
  /** The shop's own colours (shown after the couple's Mood Board). */
  colours: { name: string; hex: string }[];
  /** "Couples pick 1 to N" (1–3). */
  colourPick: number;
  /** Accents for each tier (Plain is always one). */
  accents: CakePriced<CakeAccent>[];
  standardAccent: CakeAccent;
  arrangements: CakePriced<CakeArrangement>[];
  /** Optional flowing accents ("None" is always there, in the price). */
  flowing: CakePriced<Exclude<CakeFlowing, 'none'>>[];
  monogram: { extraCentavos: number } | null;
  /** Optional toppers ("None" is always there, in the price). */
  toppers: CakePriced<Exclude<CakeTopper, 'none'>>[];
  cupcakes: { packs: CakePack[]; tower: boolean } | null;
  /** Longest message on the cake, 0 = no message. */
  messageMax: number;
};

const ids = <T extends { id: string }>(list: readonly T[]) => list.map((x) => x.id) as T['id'][];
const labelOf = (list: readonly { id: string; label: string }[], id: string) => list.find((x) => x.id === id)?.label ?? id;
export const shapeLabel = (id: string) => labelOf(CAKE_SHAPES, id);
export const accentLabel = (id: string) => labelOf(CAKE_ACCENTS, id);
export const arrangementLabel = (id: string) => labelOf(CAKE_ARRANGEMENTS, id);
export const finishLabel = (id: string) => labelOf(CAKE_FINISHES, id);
export const flowingLabel = (id: string) => labelOf(CAKE_FLOWING, id);
export const topperLabel = (id: string) => labelOf(CAKE_TOPPERS, id);
export const monogramSpotLabel = (id: string) => labelOf(CAKE_MONOGRAM_SPOTS, id);
export const placementLabel = (id: string) => labelOf(CUPCAKE_PLACEMENTS, id);
export const tierLabel = (n: number) => (n === 1 ? '1 tier' : `${n} tiers`);
/** Tier names count from the TOP (the drawing's way): Tier 1 is the top; the last says "· bottom". */
export const tierName = (index: number, count: number) => (count > 1 && index === count - 1 ? `Tier ${index + 1} · bottom` : `Tier ${index + 1}`);
export const flavourRefAt = (i: number) => `f${i + 1}`;
export const packRef = (count: number) => `pack:${count}`;
export const packCountOf = (ref: string | null | undefined): number | null => {
  const m = /^pack:(\d{1,3})$/.exec(ref ?? '');
  return m ? Number(m[1]) : null;
};

/** Strip what would break the design message's separators: line breaks, the "·" divider, "(…)". */
export function cleanCakeLabel(raw: string): string {
  return raw.replace(/[\r\n]+/g, ' ').replace(/·/g, '-').replace(/[()]/g, '').replace(/\s+/g, ' ').trim().slice(0, CAKE_LABEL_MAX);
}

/**
 * A fresh Cake Maker: what most cake shops make, with EVERY extra at ₱0 — the shop types its own (no peso figure is
 * chosen here). The flavour words are a starting list the shop renames or removes.
 */
export function cakeShopTemplate(): CakeShopOptions {
  return {
    v: CAKE_OPTIONS_VERSION,
    sizes: [1, 2, 3, 4, 5].map((count) => ({ count, extraCentavos: 0, serves: null })),
    standardSize: 3,
    display: null,
    flavours: ['Vanilla chiffon', 'Chocolate', 'Ube', 'Mocha', 'Red velvet'].map((label, i) => ({ ref: flavourRefAt(i), label, extraCentavos: 0 })),
    standardFlavour: flavourRefAt(0),
    shapes: [{ id: 'round', extraCentavos: 0 }],
    tall: null,
    finishes: [
      { id: 'buttercream', extraCentavos: 0 },
      { id: 'fondant', extraCentavos: 0 },
    ],
    standardFinish: 'buttercream',
    colours: [],
    colourPick: CAKE_MAX_COLOURS,
    accents: [
      { id: 'none', extraCentavos: 0 },
      { id: 'ribbon', extraCentavos: 0 },
    ],
    standardAccent: 'none',
    arrangements: [{ id: 'stacked', extraCentavos: 0 }],
    flowing: [],
    monogram: null,
    toppers: [],
    cupcakes: null,
    messageMax: 40,
  };
}

export type CakeOptionsRefusal = { ok: false; problem: string };

const isCentavos = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= EXTRA_MAX_CENTAVOS;
const HEX = /^#[0-9a-f]{6}$/i;

/**
 * The server's check on a shop's options — every refusal is a sentence the supplier reads. Refuses, never repairs: a
 * Standard pick carries no extra, every extra is ≥ ₱0, every id is in the catalog, nothing is listed twice.
 */
export function sanitizeCakeShopOptions(input: unknown): { ok: true; options: CakeShopOptions } | CakeOptionsRefusal {
  const no = (problem: string): CakeOptionsRefusal => ({ ok: false, problem });
  try {
    if (JSON.stringify(input ?? null).length > CAKE_OPTIONS_MAX_BYTES) return no('These options are too large to save.');
  } catch {
    return no('These options could not be read.');
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return no('These options could not be read.');
  const r = input as Record<string, unknown>;
  if (r.v !== CAKE_OPTIONS_VERSION) return no('These options are from an older Cake Maker — reload the page.');

  const priced = <T extends string>(name: string, v: unknown, catalog: readonly T[], opts: { must?: T; standard?: T | null; min?: number } = {}): CakePriced<T>[] | string => {
    if (!Array.isArray(v)) return `${name} could not be read.`;
    const out: CakePriced<T>[] = [];
    for (const x of v as unknown[]) {
      const xx = (x ?? {}) as Record<string, unknown>;
      if (typeof xx.id !== 'string' || !(catalog as readonly string[]).includes(xx.id)) return `${name} has a choice this maker does not know.`;
      if (!isCentavos(xx.extraCentavos)) return `A ${name.toLowerCase()} extra can’t go below ₱0.`;
      if (out.some((o) => o.id === xx.id)) return `${name} has the same choice twice.`;
      out.push({ id: xx.id as T, extraCentavos: xx.extraCentavos });
    }
    if (opts.must && !out.some((o) => o.id === opts.must)) return `${name} keeps its plain choice — it is in the price.`;
    if (opts.standard !== undefined && !out.some((o) => o.id === opts.standard)) return `Pick one ${name.toLowerCase()} as Standard.`;
    const std = opts.standard ?? opts.must;
    if (std && out.some((o) => o.id === std && o.extraCentavos !== 0)) return `The Standard ${name.toLowerCase()} has no extra.`;
    if (opts.must && out.some((o) => o.id === opts.must && o.extraCentavos !== 0)) return `The plain ${name.toLowerCase()} has no extra.`;
    if (opts.min && out.length < opts.min) return `${name} needs at least ${opts.min} choice.`;
    return out;
  };

  if (!Array.isArray(r.sizes) || r.sizes.length < 1) return no('Tick at least one size.');
  const sizes: CakeSize[] = [];
  for (const x of r.sizes as unknown[]) {
    const xx = (x ?? {}) as Record<string, unknown>;
    const count = xx.count;
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > CAKE_MAX_TIERS) return no('A size must be 1 to 10 tiers.');
    if (sizes.some((s) => s.count === count)) return no('A size is listed twice.');
    if (!isCentavos(xx.extraCentavos)) return no('A size extra can’t go below ₱0.');
    const serves = xx.serves ?? null;
    if (serves !== null && (typeof serves !== 'number' || !Number.isInteger(serves) || serves < 1 || serves > CAKE_SERVES_MAX)) return no('“Serves about” must be a whole number of guests.');
    sizes.push({ count, extraCentavos: xx.extraCentavos, serves });
  }
  sizes.sort((a, b) => a.count - b.count);
  const std = sizes.find((s) => s.count === r.standardSize);
  if (!std) return no('Pick the size in your one price (Standard).');
  if (std.extraCentavos !== 0) return no('The Standard size has no extra.');

  let display: CakeShopOptions['display'] = null;
  if (r.display != null) {
    const d = r.display as Record<string, unknown>;
    if (!isCentavos(d.extraCentavos)) return no('The display tier extra can’t go below ₱0.');
    display = { extraCentavos: d.extraCentavos };
  }

  if (!Array.isArray(r.flavours)) return no('Flavours could not be read.');
  const flavours: CakeFlavour[] = [];
  for (const x of r.flavours as unknown[]) {
    const xx = (x ?? {}) as Record<string, unknown>;
    if (typeof xx.ref !== 'string' || !/^f\d{1,3}$/.test(xx.ref) || flavours.some((f) => f.ref === xx.ref)) return no('Flavours could not be read.');
    if (typeof xx.label !== 'string') return no('Flavours could not be read.');
    const label = cleanCakeLabel(xx.label);
    if (!label) return no('Name every flavour — or swipe it away.');
    if (flavours.some((f) => f.label.toLowerCase() === label.toLowerCase())) return no(`“${label}” is listed twice.`);
    if (!isCentavos(xx.extraCentavos)) return no('A flavour extra can’t go below ₱0.');
    flavours.push({ ref: xx.ref, label, extraCentavos: xx.extraCentavos });
  }
  if (flavours.length > CAKE_FLAVOURS_MAX) return no(`Up to ${CAKE_FLAVOURS_MAX} flavours.`);
  let standardFlavour: string | null = null;
  if (flavours.length > 0) {
    const sf = flavours.find((f) => f.ref === r.standardFlavour);
    if (!sf) return no('Pick one flavour as Standard.');
    if (sf.extraCentavos !== 0) return no('The Standard flavour has no extra.');
    standardFlavour = sf.ref;
  }

  const shapes = priced('Shapes', r.shapes, ids(CAKE_SHAPES), { must: 'round' });
  if (typeof shapes === 'string') return no(shapes);
  let tall: CakeShopOptions['tall'] = null;
  if (r.tall != null) {
    const t = r.tall as Record<string, unknown>;
    if (!isCentavos(t.extraCentavos)) return no('The tall tier extra can’t go below ₱0.');
    tall = { extraCentavos: t.extraCentavos };
  }
  const standardFinish = r.standardFinish as CakeFinish;
  const finishes = priced('Finish', r.finishes, ids(CAKE_FINISHES), { standard: standardFinish, min: 1 });
  if (typeof finishes === 'string') return no(finishes);
  const standardAccent = r.standardAccent as CakeAccent;
  const accents = priced('Accents', r.accents, ids(CAKE_ACCENTS), { must: 'none', standard: standardAccent });
  if (typeof accents === 'string') return no(accents);
  const arrangements = priced('Arrangements', r.arrangements, ids(CAKE_ARRANGEMENTS), { must: 'stacked' });
  if (typeof arrangements === 'string') return no(arrangements);
  const flowing = priced('Flowing accents', r.flowing, ids(CAKE_FLOWING).filter((x) => x !== 'none') as Exclude<CakeFlowing, 'none'>[]);
  if (typeof flowing === 'string') return no(flowing);
  const toppers = priced('Toppers', r.toppers, ids(CAKE_TOPPERS).filter((x) => x !== 'none') as Exclude<CakeTopper, 'none'>[]);
  if (typeof toppers === 'string') return no(toppers);

  let monogram: CakeShopOptions['monogram'] = null;
  if (r.monogram != null) {
    const m = r.monogram as Record<string, unknown>;
    if (!isCentavos(m.extraCentavos)) return no('The monogram extra can’t go below ₱0.');
    monogram = { extraCentavos: m.extraCentavos };
  }

  if (!Array.isArray(r.colours) || r.colours.length > CAKE_SHOP_COLOURS_MAX) return no(`Up to ${CAKE_SHOP_COLOURS_MAX} colours of your own.`);
  const colours: CakeShopOptions['colours'] = [];
  for (const c of r.colours as unknown[]) {
    const cc = (c ?? {}) as Record<string, unknown>;
    if (typeof cc.name !== 'string' || typeof cc.hex !== 'string' || !HEX.test(cc.hex)) return no('A colour could not be read.');
    const name = cleanCakeLabel(cc.name);
    if (!name || colours.some((x) => x.name.toLowerCase() === name.toLowerCase())) return no('Name every colour once.');
    colours.push({ name, hex: cc.hex.toUpperCase() });
  }
  const colourPick = r.colourPick;
  if (typeof colourPick !== 'number' || !Number.isInteger(colourPick) || colourPick < 1 || colourPick > CAKE_MAX_COLOURS) return no('Couples pick 1 to 3 colours.');

  let cupcakes: CakeShopOptions['cupcakes'] = null;
  if (r.cupcakes != null) {
    const cc = r.cupcakes as Record<string, unknown>;
    if (!Array.isArray(cc.packs) || cc.packs.length < 1 || cc.packs.length > CUPCAKE_PACKS_MAX) return no('Add at least one cupcake pack — or switch cupcakes off.');
    const packs: CakePack[] = [];
    for (const p of cc.packs as unknown[]) {
      const pp = (p ?? {}) as Record<string, unknown>;
      if (typeof pp.count !== 'number' || !Number.isInteger(pp.count) || pp.count < 1 || pp.count > CUPCAKE_PACK_MAX_COUNT) return no('A cupcake pack must be 1 to 500 cupcakes.');
      if (packs.some((x) => x.count === pp.count)) return no('A cupcake pack size is listed twice.');
      if (!isCentavos(pp.priceCentavos)) return no('A cupcake pack price can’t go below ₱0.');
      packs.push({ count: pp.count, priceCentavos: pp.priceCentavos });
    }
    packs.sort((a, b) => a.count - b.count);
    cupcakes = { packs, tower: cc.tower === true };
  }

  const messageMax = r.messageMax;
  if (typeof messageMax !== 'number' || !Number.isInteger(messageMax) || messageMax < 0 || messageMax > CAKE_MESSAGE_MAX) return no('The longest message is 0 to 60 letters.');

  return {
    ok: true,
    options: {
      v: CAKE_OPTIONS_VERSION,
      sizes,
      standardSize: std.count,
      display,
      flavours,
      standardFlavour,
      shapes,
      tall,
      finishes,
      standardFinish,
      colours,
      colourPick,
      accents,
      standardAccent,
      arrangements,
      flowing,
      monogram,
      toppers,
      cupcakes,
      messageMax,
    },
  };
}

/** The options as the catalog ids a couple may pick — what `sanitizeCakeConfig` checks a design against. */
export function cakeOfferOf(o: CakeShopOptions): CakeOffer {
  return {
    sizes: o.sizes.map((s) => s.count),
    display: !!o.display,
    shapes: o.shapes.map((s) => s.id),
    tall: !!o.tall,
    arrangements: o.arrangements.map((a) => a.id),
    finishes: o.finishes.map((f) => f.id),
    accents: o.accents.map((a) => a.id),
    flowing: o.flowing.map((f) => f.id),
    monogram: !!o.monogram,
    toppers: o.toppers.map((t) => t.id),
    flavourRefs: o.flavours.map((f) => f.ref),
    messageMax: o.messageMax,
    cupcakes: o.cupcakes ? { packRefs: o.cupcakes.packs.map((p) => packRef(p.count)), flavourRefs: o.flavours.map((f) => f.ref), tower: o.cupcakes.tower } : null,
  };
}

export const cupcakeCountOf = (config: CakeConfig) => packCountOf(config.cupcakes?.packRef) ?? 0;
export const flavourLabelOf = (o: CakeShopOptions, ref: string | null | undefined) => (ref ? (o.flavours.find((f) => f.ref === ref)?.label ?? null) : null);
const extraOf = (list: readonly CakePriced<string>[], id: string) => list.find((x) => x.id === id)?.extraCentavos ?? 0;

// ─────────────────────────────────────────────────────────────────────────────
// The design: its rows, its estimate, its quote lines
// ─────────────────────────────────────────────────────────────────────────────

/** A couple's own Mood Board colour as the designer lists it (lib/cake-mood-colours.ts). */
/** Where the shop's colour picker starts — a champagne buttercream; the shop changes it before adding. */
export const CAKE_PICKER_START = '#E3CFA6';

export type MoodCakeColour = { hex: string; name: string; slot: string; setByYou: boolean };

export type CakeQuoteLine = { label: string; centavos: number };
export type CakeDesignRow = { label: string; words: string; extraCentavos: number };
export type CakeDesignTier = { name: string; words: string; extraCentavos: number; kind: 'real' | 'display'; cutting: boolean };

export type CakeDesign = {
  /** The shop's cake card the one price comes from, or null when the shop has no priced cake card. */
  cardName: string | null;
  oneCentavos: number | null;
  sizeWords: string;
  tiers: CakeDesignTier[];
  rows: CakeDesignRow[];
  instructions: string;
  /** Every priced pick, one line each — the prefilled quote's lines after the one price. */
  quoteLines: CakeQuoteLine[];
  /** Flavour ref → the shop's words at send time, so the picture draws each sponge. */
  flavourLabels: Record<string, string>;
  extrasCentavos: number;
  /** The one price + the extras; null when there is no one price to add them to. */
  estimateCentavos: number | null;
};

/** The design, read against the shop's options: its words, its extras, its estimate. */
export function cakeDesignOf(o: CakeShopOptions, config: CakeConfig, card: { name: string; oneCentavos: number } | null): CakeDesign {
  const n = config.tiers.length;
  const quoteLines: CakeQuoteLine[] = [];
  const add = (label: string, centavos: number) => {
    if (centavos > 0) quoteLines.push({ label, centavos });
  };
  const size = o.sizes.find((s) => s.count === n);
  const displayN = config.tiers.filter((t) => t.kind === 'display').length;
  const sizeWords = `${tierLabel(n)}${displayN > 0 ? ` · ${displayN} display` : ''}${size?.serves ? ` · serves about ${size.serves}` : ''}`;
  add(tierLabel(n), size?.extraCentavos ?? 0);

  const tiers: CakeDesignTier[] = config.tiers.map((t, i) => {
    const bits: string[] = [t.kind];
    let extra = 0;
    if (t.kind === 'display') extra += o.display?.extraCentavos ?? 0;
    const flavour = t.kind === 'real' ? o.flavours.find((f) => f.ref === t.flavourRef) : undefined;
    if (flavour) {
      bits.push(flavour.label.toLowerCase());
      extra += flavour.extraCentavos;
    }
    bits.push(shapeLabel(t.shape).toLowerCase());
    extra += extraOf(o.shapes, t.shape);
    if (t.tall) {
      bits.push('tall');
      extra += o.tall?.extraCentavos ?? 0;
    }
    const cutting = i === config.cuttingTier;
    if (cutting) bits.push('cutting');
    const name = tierName(i, n);
    const priced = [
      t.kind === 'display' ? 'display' : null,
      flavour && flavour.extraCentavos > 0 ? flavour.label.toLowerCase() : null,
      t.shape !== 'round' ? shapeLabel(t.shape).toLowerCase() : null,
      t.tall ? 'tall' : null,
    ].filter(Boolean);
    add(`${name} · ${priced.join(' · ') || 'tier'}`, extra);
    return { name, words: bits.join(' · '), extraCentavos: extra, kind: t.kind, cutting };
  });

  const rows: CakeDesignRow[] = [];
  const row = (label: string, words: string, extraCentavos: number, quoteLabel = words) => {
    rows.push({ label, words, extraCentavos });
    add(quoteLabel, extraCentavos);
  };
  row('Arrangement', arrangementLabel(config.arrangement), extraOf(o.arrangements, config.arrangement));
  row('Finish', finishLabel(config.finish), extraOf(o.finishes, config.finish));
  if (config.colours.length) rows.push({ label: 'Colours', words: config.colours.map((c) => c.name).join(' · '), extraCentavos: 0 });
  const accented = config.tiers.filter((t) => t.accent !== 'none');
  if (accented.length) {
    const accentExtra = config.tiers.reduce((a, t) => a + extraOf(o.accents, t.accent), 0);
    const words = `${config.tiers.map((t) => accentLabel(t.accent)).join(' · ')} · top → bottom`;
    row('Accents', words, accentExtra, `Accents · ${[...new Set(accented.map((t) => accentLabel(t.accent).toLowerCase()))].join(', ')}`);
  }
  if (config.flowing !== 'none') {
    const span = config.flowingFrom === 0 && config.flowingTo === n - 1 ? 'top to bottom' : `${tierName(config.flowingFrom, n)} to ${tierName(config.flowingTo, n)}`;
    row('Across', `${flowingLabel(config.flowing)}, ${span}`, extraOf(o.flowing, config.flowing), flowingLabel(config.flowing));
  }
  if (config.monogram) {
    const where = config.monogram === 'front' ? `On ${tierName(config.monogramTier, n)}` : monogramSpotLabel(config.monogram);
    row('Monogram', where, o.monogram?.extraCentavos ?? 0, `Monogram · ${where.toLowerCase()}`);
  }
  if (config.topper !== 'none') row('Topper', topperLabel(config.topper), extraOf(o.toppers, config.topper));
  if (config.message) rows.push({ label: 'Message', words: `“${config.message}”`, extraCentavos: 0 });
  if (config.cupcakes) {
    const count = packCountOf(config.cupcakes.packRef) ?? 0;
    const price = o.cupcakes?.packs.find((p) => p.count === count)?.priceCentavos ?? 0;
    const flavour = config.cupcakes.match ? 'matching' : (flavourLabelOf(o, config.cupcakes.flavourRef)?.toLowerCase() ?? null);
    const words = [formatCount(count), flavour, placementLabel(config.cupcakes.placement).toLowerCase()].filter(Boolean).join(' · ');
    row('Cupcakes', words, price, `Cupcakes · ${formatCount(count)}, ${placementLabel(config.cupcakes.placement).toLowerCase()}`);
  }
  const extrasCentavos = quoteLines.reduce((a, l) => a + l.centavos, 0);
  return {
    cardName: card?.name ?? null,
    oneCentavos: card?.oneCentavos ?? null,
    sizeWords,
    tiers,
    rows,
    instructions: config.instructions,
    quoteLines,
    flavourLabels: Object.fromEntries(o.flavours.filter((f) => config.tiers.some((t) => t.flavourRef === f.ref) || config.cupcakes?.flavourRef === f.ref).map((f) => [f.ref, f.label])),
    extrasCentavos,
    estimateCentavos: card ? card.oneCentavos + extrasCentavos : null,
  };
}

/** "Wedding cake · one price" first, then one line per priced pick — the prefilled quote (v6 §03). */
export function cakeQuoteLines(d: CakeDesign): CakeQuoteLine[] {
  return d.cardName && d.oneCentavos != null ? [{ label: `${d.cardName} · one price`, centavos: d.oneCentavos }, ...d.quoteLines] : d.quoteLines;
}

// ─────────────────────────────────────────────────────────────────────────────
// The chat messages — plain words anywhere; a design names its stored row last
// ─────────────────────────────────────────────────────────────────────────────

/** The head of a design message — the SAME words as `CAKE_DESIGN_HEAD_WORDS` (lib/chat-card-lines.ts, pinned by test). */
export const CAKE_DESIGN_HEAD = '🎂 Cake design · ';
/** The supplier's invite — the SAME words as `CAKE_INVITE_WORDS` (lib/chat-card-lines.ts, pinned by test). */
export const CAKE_INVITE_BODY = '🎂 Design your cake for us — pick the tiers, shape, colours and accents in 3D. We’ll quote from your design.';
export const CAKE_DESIGN_REF = 'Design ref: ';
export const CAKE_DESIGN_UNREADABLE = "We couldn't check your design against the shop's Cake Maker, so nothing was sent. Try again.";

const peso = (c: number) => (c > 0 ? ` (+${formatCentavosPhp(c)})` : '');

/** The design as plain lines — the words every chat shows, and the prefilled quote's note. */
export function cakeDesignLines(d: CakeDesign): string[] {
  const lines = [`Tiers: ${d.sizeWords}`, ...d.tiers.map((t) => `${t.name}: ${t.words}${peso(t.extraCentavos)}`)];
  for (const r of d.rows) lines.push(`${r.label}: ${r.words}${peso(r.extraCentavos)}`);
  if (d.instructions) lines.push(`Anything else: ${d.instructions.replace(/[\r\n]+/g, ' ')}`);
  return lines;
}

export function formatCakeDesignBlock(d: CakeDesign, designId: string): string {
  return [
    `${CAKE_DESIGN_HEAD}${d.cardName ?? 'Cake Maker'}`,
    ...cakeDesignLines(d),
    d.estimateCentavos != null
      ? `Estimate: ${formatCentavosPhp(d.estimateCentavos)} — from the one price and the extras picked. The quote decides.`
      : `Extras picked: ${formatCentavosPhp(d.extrasCentavos)} — the shop quotes the price.`,
    `${CAKE_DESIGN_REF}${designId}`,
  ].join('\n');
}

/** The stored row a design message names, or null (a message without a design, or a ref that is not a uuid). */
export function cakeDesignRefOf(body: string | null | undefined): string | null {
  const at = (body ?? '').lastIndexOf(CAKE_DESIGN_REF);
  if (at < 0) return null;
  const m = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s*$/i.exec((body ?? '').slice(at + CAKE_DESIGN_REF.length));
  return m ? m[1]!.toLowerCase() : null;
}

/** The prefilled quote's note — the design's own words. */
export function cakeQuoteNote(d: CakeDesign): string {
  return cakeDesignLines(d).join('\n').slice(0, 500);
}

/** "3 tiers serve about 90 · for your 180 guests, pick 5 or more" — servings beside the couple's own guest count. */
export function servesWords(o: CakeShopOptions, count: number, guests: number | null): string | null {
  const s = o.sizes.find((x) => x.count === count)?.serves;
  if (!s) return null;
  const head = `${tierLabel(count)} ${count === 1 ? 'serves' : 'serve'} about ${formatCount(s)}`;
  if (!guests || guests <= 0) return head;
  if (s >= guests) return `${head} · fits your ${formatCount(guests)} guests`;
  const enough = o.sizes.find((x) => (x.serves ?? 0) >= guests);
  return enough ? `${head} · for your ${formatCount(guests)} guests, pick ${formatCount(enough.count)} or more` : `${head} · your ${formatCount(guests)} guests need more than the biggest size`;
}

/** The extra a pick adds, as the designer shows it: "in the price" or "+₱1,000". */
export function extraWords(centavos: number): string {
  return centavos > 0 ? `+${formatCentavosPhp(centavos)}` : 'in the price';
}
