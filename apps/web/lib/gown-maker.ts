/**
 * 👗 gown-maker — the shop side of the Attire Maker: a designer's own price list and how it prices a design (plan step
 * B2; corpus WHATS_NEXT_Gown_Maker_Port_2026-11-27.md § 2.2; prototype v189 `PRICE_ITEMS`, `PRICE_GROUPS`, `HOURS`,
 * `quoteLines`, `renderQuote`, `renderPriceList`; DESIGN-REVIEW-v187 § D add-ons, owner 2026-11-27 "yes to all").
 *
 * Owner rules held here:
 *   · Prices come only from the designer's own list. No amount is typed in code; an unpriced line stays unpriced
 *     (null), never zero. Money is centavos and is formatted only by lib/php.ts.
 *   · Designers see costs; the bride sees the estimate or the quote. `gownDesignOf` returns both halves; the server
 *     (step B3) sends a bride only `forBride` — never a line, a cost, a markup or an hour.
 *   · Add-ons: each one is Priced (her amount) · Included free · On request (no amount) · Not offered (hidden). Which
 *     are free is the designer's choice: every add-on starts Not offered.
 *   · The quote groups its lines as Attire Setup (by stage) → Add-ons.
 *   · Two ways to price (prototype "How you price"): `covers` — the starting price covers the design until its cost
 *     (supplies + labour, with markup) is higher; `extras` — the starting price is locked, what it includes is marked
 *     "In base", every other choice adds its own price.
 *   · v196: each cape type's labour is its own price item ("Cover-ups"; its fabric, edge and strap price on the
 *     fabric, lace, bead and ribbon items); inside layers price by material per metre (tulle on
 *     `net`, organza and chiffon on their fabric items, the hoop per piece). The design's cape choice and per-layer
 *     metres arrive in the contract (lib/gown-config.ts, Builder A); `gownDesignOf` prices them once they do.
 * 🔒 lib/gown-maker.test.ts
 */
import {
  GOWN_CAPES,
  GOWN_SILHOUETTES,
  GOWN_STOCK_FABRICS,
  gownCapeNow,
  type GownBeadKind,
  type GownConfig,
  type GownQuantities,
  type GownSilhouette,
} from './gown-config';
import { GOWN_ADD_ONS, type GownAddOnKey } from './gown-add-ons';
import { formatCentavosPhp } from './php';
import { parseClientRef } from './r2-client-ref';

/** The suppliers the Attire Maker is suggested for (owner Q3, 2026-11-27: custom gown makers only for now). */
export const GOWN_KINDS: ReadonlySet<string> = new Set(['bridal_gown_custom']);
export function isGownKind(kind: string | null | undefined): boolean {
  return typeof kind === 'string' && GOWN_KINDS.has(kind);
}

export const GOWN_OPTIONS_VERSION = 1;
/** The same cap as vendor_gown_makers.options (migration 20271365509280). */
export const GOWN_OPTIONS_MAX_BYTES = 16_384;
const MAX_CENTAVOS = 100_000_000_00;
const MAX_HOURS = 200;
const MAX_MARKUP_PCT = 500;

// ─────────────────────────────────────────────────────────────────────────────
// The price list: [key, label, unit]. The designer fills the amounts (centavos).
// ─────────────────────────────────────────────────────────────────────────────

type Item = { readonly key: string; readonly label: string; readonly unit: GownPriceUnit };
export type GownPriceUnit = 'gown' | 'm' | 'pc' | 'pair' | '100 pcs' | '10 flowers' | 'hour';

const SIL_LABEL = Object.fromEntries(GOWN_SILHOUETTES.map((s) => [s.id, s.label])) as Record<GownSilhouette, string>;

export const GOWN_PRICE_ITEMS = [
  // v197: "Fit and flare" (the old A-line block) comes in with Builder A's A6e silhouette list.
  ...GOWN_SILHOUETTES.map((s) => ({ key: `base_${s.id}`, label: s.label, unit: 'gown' as const })),
  ...GOWN_STOCK_FABRICS.map((f) => ({ key: `fab_${f.id}`, label: f.label, unit: 'm' as const })),
  { key: 'lin_satin', label: 'Satin lining', unit: 'm' },
  { key: 'lin_cotton', label: 'Cotton lining', unit: 'm' },
  { key: 'lin_silk', label: 'Silk lining', unit: 'm' },
  { key: 'net', label: 'Petticoat / veil tulle', unit: 'm' },
  { key: 'hoop', label: 'Hoop (crinoline)', unit: 'pc' },
  { key: 'illusion', label: 'Illusion mesh', unit: 'm' },
  { key: 'boning', label: 'Boning', unit: 'm' },
  { key: 'waiststay', label: 'Waist stay', unit: 'pc' },
  { key: 'horsehair', label: 'Horsehair braid', unit: 'm' },
  { key: 'zipper', label: 'Invisible zipper', unit: 'pc' },
  { key: 'button', label: 'Covered button', unit: 'pc' },
  { key: 'eyelet', label: 'Eyelet', unit: 'pc' },
  { key: 'cord', label: 'Lacing cord', unit: 'm' },
  { key: 'lace_motif', label: 'Lace motif (appliqué)', unit: 'pc' },
  { key: 'lace_yard', label: 'Lace by the yard', unit: 'm' },
  { key: 'bead_crystal', label: 'Crystals', unit: '100 pcs' },
  { key: 'bead_pearl', label: 'Pearls', unit: '100 pcs' },
  { key: 'bead_seed', label: 'Seed beads', unit: '100 pcs' },
  { key: 'bead_sequin', label: 'Sequins', unit: '100 pcs' },
  // v200: raised lace, shaped and finished per piece (its lace prices on the lace items); 3D flowers, made and attached
  // per ten; glitter tulle by the metre (a veil, cape or overlay in it, and layers under the skirt). Scattered pearls
  // price on Pearls.
  { key: 'lace_raised', label: 'Raised lace: shaping and finishing', unit: 'pc' },
  { key: 'flowers3d', label: '3D flowers: making and attaching', unit: '10 flowers' },
  { key: 'fab_glitter_tulle', label: 'Glitter tulle fabric', unit: 'm' },
  // v196: one labour line per cape TYPE (its fabric, edge and strap price on the fabric, lace, bead and ribbon items).
  { key: 'cape_neck', label: 'Cape (neck cape): cutting, sewing and finishing', unit: 'pc' },
  { key: 'cape_back', label: 'Cape (back cape): cutting, sewing and finishing', unit: 'pc' },
  { key: 'cape_pair', label: 'Cape (pair of shoulder capes): cutting, sewing and finishing', unit: 'pc' },
  { key: 'cape_side', label: 'Cape (side cape): cutting, sewing and finishing', unit: 'pc' },
  { key: 'cape_capelet', label: 'Cape (capelet): cutting, sewing and finishing', unit: 'pc' },
  { key: 'cape_drape', label: 'Cape (one-shoulder drape): cutting, sewing and finishing', unit: 'pc' },
  // v198: the bodice's own labour lines; the illusion tulle itself prices per metre on the tulle / mesh items.
  { key: 'illu_bodice', label: 'Illusion bodice: sheer tulle panel and fitting', unit: 'pc' },
  { key: 'illu_back', label: 'Illusion back: sheer tulle panel and fitting', unit: 'pc' },
  { key: 'bone_show', label: 'Visible boning: channels and finishing', unit: 'pc' },
  { key: 'flutter', label: 'Flutter cape sleeves: cutting, sewing and finishing', unit: 'pair' },
  // v203: each sleeve style its own labour line (their fabric is the fabric items), detachable bands, and an over-robe.
  { key: 'sl_puff', label: 'Sleeves (puff): cutting, sewing and finishing', unit: 'pair' },
  { key: 'sl_bishop', label: 'Sleeves (bishop): cutting, sewing and finishing', unit: 'pair' },
  { key: 'sl_juliet', label: 'Sleeves (Juliet): cutting, sewing and finishing', unit: 'pair' },
  { key: 'sl_ruffle', label: 'Sleeves (ruffle band): cutting, sewing and finishing', unit: 'pair' },
  { key: 'sl_capesl', label: 'Sleeves (cape sleeves): cutting, sewing and finishing', unit: 'pair' },
  { key: 'sl_detach', label: 'Detachable sleeve bands', unit: 'pair' },
  { key: 'overrobe', label: 'Over-robe: cutting, sewing and finishing', unit: 'pc' },
  { key: 'overlay', label: 'Overlay: cutting, sewing and finishing', unit: 'pc' },
  { key: 'piping', label: 'Piping', unit: 'm' },
  { key: 'fringe', label: 'Fringe', unit: 'm' },
  { key: 'feather', label: 'Feather trim', unit: 'm' },
  // v196: ribbon by the metre — the sash and bow, and the narrow strap a cape needs on a strapless neckline.
  { key: 'ribbon', label: 'Ribbon (sash)', unit: 'm' },
  // v199: straps and a scalloped edge, each its own labour line (narrow straps price on ribbon, wide ones on the fabric).
  { key: 'strap', label: 'Straps: cutting, sewing and attaching', unit: 'pair' },
  { key: 'scallop', label: 'Scalloped edge: shaping and finishing', unit: 'pc' },
  // Owner 2026-11-27: small bows come back as a labour line, per piece, unpriced until the designer prices it.
  { key: 'bow', label: 'Bow (small): making and attaching', unit: 'pc' },
  { key: 'rate', label: 'Labour rate', unit: 'hour' },
] as const satisfies readonly Item[];
export type GownPriceKey = (typeof GOWN_PRICE_ITEMS)[number]['key'];
const PRICE_KEYS: ReadonlySet<string> = new Set(GOWN_PRICE_ITEMS.map((i) => i.key));

/** The price list's groups, in the order the designer reads them (prototype `PRICE_GROUPS`, men's removed; small bows returned as one Trims line, owner 2026-11-27). */
export const GOWN_PRICE_GROUPS: ReadonlyArray<readonly [string, (key: GownPriceKey) => boolean]> = [
  ['Starting prices', (k) => k.startsWith('base_')],
  ['Fabrics', (k) => k.startsWith('fab_')],
  ['Lining and inside', (k) => /^(lin_|net$|hoop$|illusion$|boning$|waiststay$|horsehair$)/.test(k)],
  ['Closures', (k) => /^(zipper|button|eyelet|cord)$/.test(k)],
  ['Lace and beads', (k) => /^(lace_|bead_)/.test(k)],
  // v200: the 3D flowers' own group, after lace and beads (prototype order).
  ['3D flowers', (k) => k === 'flowers3d'],
  ['Trims', (k) => /^(piping|fringe|feather|ribbon|bow)$/.test(k)],
  ['Bodice', (k) => /^(illu_bodice|illu_back|bone_show)$/.test(k)],
  ['Straps and edges', (k) => k === 'strap' || k === 'scallop'],
  // v195: flutter cape sleeves and a skirt overlay, each its own labour line (their fabric is the fabric items).
  ['Sleeves', (k) => k === 'flutter' || k.startsWith('sl_')],
  ['Skirt', (k) => k === 'overlay'],
  // v196: each cape type as part of the gown (the bride's detachable cape is the add-on `cape`; the designer may price
  // either).
  ['Cover-ups', (k) => k.startsWith('cape_') || k === 'overrobe'],
  ['Labour', (k) => k === 'rate'],
];

/** What a starting price includes until the designer says otherwise (prototype `INC_DEFAULT`; extras mode only). */
export const GOWN_IN_BASE_DEFAULT: readonly GownPriceKey[] = ['fab_satin', 'lin_satin', 'zipper'];

/** Workshop time standards, hours (prototype `HOURS`; the designer edits them). Time, not money. */
export const GOWN_HOURS_DEFAULT = {
  sleeve_cap: 2,
  sleeve_long: 3,
  sleeve_butterfly: 8,
  beads100: 1.5,
  motif: 0.4,
  lace_yard: 1.5,
  pleat: 0.15,
  tex: 5,
  darts: 1,
  cutout: 1.5,
  slit: 1,
  train: 3,
  trim_m: 0.3,
  two_piece: 2.5,
} as const;
export type GownHourKey = keyof typeof GOWN_HOURS_DEFAULT;
const HOUR_KEYS = Object.keys(GOWN_HOURS_DEFAULT) as GownHourKey[];

export const GOWN_HOUR_LABELS: Record<GownHourKey, string> = {
  sleeve_cap: 'Cap sleeves',
  sleeve_long: 'Long sleeves',
  sleeve_butterfly: 'Butterfly sleeves',
  beads100: 'Beading, per 100 beads',
  motif: 'Appliqué, per motif',
  lace_yard: 'Lace yardage, per m',
  pleat: 'Per pleat',
  tex: 'Pintucks / ruching / smocking',
  darts: 'Darts or seams',
  cutout: 'Per cut-out',
  slit: 'Per slit',
  train: 'Train',
  trim_m: 'Trim, per m',
  two_piece: 'Two-piece: separate top, skirt waistband',
};

// ─────────────────────────────────────────────────────────────────────────────
// Add-ons (DESIGN-REVIEW-v187 § D, owner 2026-11-27). Append-only: a stored list must never dangle.
// ─────────────────────────────────────────────────────────────────────────────

export { GOWN_ADD_ONS, type GownAddOnKey } from './gown-add-ons';
const ADD_ON_KEYS: ReadonlySet<string> = new Set(GOWN_ADD_ONS.map((a) => a.id));

/** Priced (her amount; null = not priced yet) · Included free · On request · Not offered (hidden from the bride). */
export type GownAddOnState =
  | { state: 'priced'; centavos: number | null }
  | { state: 'free' }
  | { state: 'request' }
  | { state: 'none' };

/**
 * An add-on covers the design lines it stands for, so a design is never charged twice: a petticoat add-on is the
 * petticoat's tulle and hoop. Applies whenever the add-on is offered (priced, free or on request).
 */
const ADD_ON_COVERS: Partial<Record<GownAddOnKey, readonly string[]>> = {
  petticoat: ['net', 'hoop'],
};

/** What the bride reads for an offered add-on with no amount. */
export const GOWN_ADD_ON_INCLUDED = 'Included';
export const GOWN_ADD_ON_ASK = 'Ask your designer';

// ─────────────────────────────────────────────────────────────────────────────
// The shop's options (vendor_gown_makers.options)
// ─────────────────────────────────────────────────────────────────────────────

export type GownPricingMode = 'covers' | 'extras';

export type GownShopOptions = {
  v: typeof GOWN_OPTIONS_VERSION;
  mode: GownPricingMode;
  /** Centavos per unit. An absent key is unpriced. */
  prices: Partial<Record<GownPriceKey, number>>;
  /** Extras mode: what each starting price already includes. */
  inBase: GownPriceKey[];
  hours: Record<GownHourKey, number>;
  /** Covers mode: added on the designer's costs, percent. */
  markupPct: number;
  addOns: Record<GownAddOnKey, GownAddOnState>;
};

export function gownShopTemplate(): GownShopOptions {
  return {
    v: GOWN_OPTIONS_VERSION,
    mode: 'covers',
    prices: {},
    inBase: [...GOWN_IN_BASE_DEFAULT],
    hours: { ...GOWN_HOURS_DEFAULT },
    markupPct: 0,
    addOns: Object.fromEntries(GOWN_ADD_ONS.map((a) => [a.id, { state: 'none' }])) as Record<GownAddOnKey, GownAddOnState>,
  };
}

export type GownOptionsRefusal = { ok: false; problem: string };
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isCentavos = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0 && v <= MAX_CENTAVOS;
const inRange = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

/** Check a shop's options before every write. Refuses with a plain reason; never repairs. */
export function sanitizeGownShopOptions(input: unknown): { ok: true; options: GownShopOptions } | GownOptionsRefusal {
  const no = (problem: string): GownOptionsRefusal => ({ ok: false, problem });
  let size = 0;
  try {
    size = new TextEncoder().encode(JSON.stringify(input)).length;
  } catch {
    return no('These options could not be read.');
  }
  if (size > GOWN_OPTIONS_MAX_BYTES) return no('Your price list is too long to save.');
  if (!isObject(input) || input.v !== GOWN_OPTIONS_VERSION) return no('These options are not a gown price list.');
  if (input.mode !== 'covers' && input.mode !== 'extras') return no('Choose how you price.');

  if (!isObject(input.prices)) return no('Your prices could not be read.');
  const prices: Partial<Record<GownPriceKey, number>> = {};
  for (const [k, v] of Object.entries(input.prices)) {
    if (!PRICE_KEYS.has(k)) return no(`"${k}" is not on the price list.`);
    if (v === null || v === undefined) continue;
    if (!isCentavos(v)) return no(`The price for ${GOWN_PRICE_ITEMS.find((i) => i.key === k)!.label} must be more than zero, or left empty.`);
    prices[k as GownPriceKey] = v;
  }

  if (!Array.isArray(input.inBase) || !input.inBase.every((k) => typeof k === 'string' && PRICE_KEYS.has(k) && !k.startsWith('base_') && k !== 'rate')) {
    return no('"In base" can only mark supplies.');
  }
  const inBase = [...new Set(input.inBase as GownPriceKey[])];

  if (!isObject(input.hours)) return no('Your time standards could not be read.');
  const hours = {} as Record<GownHourKey, number>;
  for (const k of HOUR_KEYS) {
    const h = input.hours[k];
    if (!inRange(h, 0, MAX_HOURS)) return no(`${GOWN_HOUR_LABELS[k]}: hours must be between 0 and ${MAX_HOURS}.`);
    hours[k] = h;
  }
  if (Object.keys(input.hours).some((k) => !(HOUR_KEYS as string[]).includes(k))) return no('A time standard is not known.');

  if (!inRange(input.markupPct, 0, MAX_MARKUP_PCT)) return no(`Markup must be between 0 and ${MAX_MARKUP_PCT}%.`);

  if (!isObject(input.addOns)) return no('Your add-ons could not be read.');
  if (Object.keys(input.addOns).some((k) => !ADD_ON_KEYS.has(k))) return no('An add-on is not known.');
  const addOns = {} as Record<GownAddOnKey, GownAddOnState>;
  for (const { id, label } of GOWN_ADD_ONS) {
    const a = input.addOns[id];
    if (!isObject(a)) return no(`${label}: choose Priced, Included, On request or Not offered.`);
    if (a.state === 'priced') {
      if (a.centavos !== null && !isCentavos(a.centavos)) return no(`${label}: the price must be more than zero, or left empty.`);
      addOns[id] = { state: 'priced', centavos: a.centavos as number | null };
    } else if (a.state === 'free' || a.state === 'request' || a.state === 'none') {
      addOns[id] = { state: a.state };
    } else return no(`${label}: choose Priced, Included, On request or Not offered.`);
  }
  return { ok: true, options: { v: GOWN_OPTIONS_VERSION, mode: input.mode, prices, inBase, hours, markupPct: input.markupPct, addOns } };
}

/** The add-ons a bride is offered, in list order. Not offered ones are hidden from her. */
export function gownAddOnsOffered(o: GownShopOptions): GownAddOnKey[] {
  return GOWN_ADD_ONS.map((a) => a.id).filter((id) => o.addOns[id].state !== 'none');
}

// ─────────────────────────────────────────────────────────────────────────────
// Pricing a design
// ─────────────────────────────────────────────────────────────────────────────

/** A shop fabric row's name and per-metre price (vendor_gown_fabrics; null = unpriced). */
export type GownShopFabric = { name: string; pricePerMetreCentavos: number | null };

/** The Attire Setup stages (DESIGN-REVIEW-v187 § A) a line is grouped under, then the add-ons. */
export const GOWN_QUOTE_GROUPS = ['Shape', 'Fabric', 'Bodice', 'Skirt', 'Details', 'Inside', 'Labour', 'Add-ons'] as const;
export type GownQuoteGroup = (typeof GOWN_QUOTE_GROUPS)[number];

export type GownQuoteLine = {
  group: GownQuoteGroup;
  key: string;
  label: string;
  qty: number;
  unit: GownPriceUnit | 'h' | 'item';
  /** Centavos per unit; null = not priced. */
  unitCentavos: number | null;
  /** Centavos; null = not priced. 0 only when the line is included. */
  amountCentavos: number | null;
  included: boolean;
};

export type GownDesignForShop = {
  mode: GownPricingMode;
  lines: GownQuoteLine[];
  suppliesCentavos: number;
  labourCentavos: number;
  /** The starting price for the silhouette; null = not priced. */
  baseCentavos: number | null;
  /** Covers mode: this design's cost with markup. */
  designCentavos: number;
  addOnsCentavos: number;
  /** What the bride sees; null = ask for a quote. */
  totalCentavos: number | null;
  /** Lines left out of the totals because they have no price. */
  unpriced: number;
};

export type GownAddOnForBride = { id: GownAddOnKey; label: string; centavos: number | null; words: string | null };

/** All a bride may hold: no line, no cost, no markup, no hour. */
export type GownDesignForBride = {
  /** Null = "Ask for a quote". */
  estimateCentavos: number | null;
  /** Covers mode: the design still sits within the starting price. */
  withinBase: boolean;
  addOns: GownAddOnForBride[];
};

export type GownDesignPriced = { forShop: GownDesignForShop; forBride: GownDesignForBride };

type DesignPick = Pick<
  GownConfig,
  | 'sil' | 'fabric' | 'fabricRef' | 'accentFabric' | 'accentFabricRef' | 'lining' | 'closure' | 'sleeve' | 'tex' | 'train' | 'darts'
  | 'cape' | 'capeFab' | 'capeLen' | 'capeEdge' | 'capeFasten'
>;

const round2 = (x: number) => Math.round(x * 100) / 100;
const BEAD_LABEL: Record<GownBeadKind, string> = { crystal: 'Crystals', pearl: 'Pearls', seed: 'Seed beads', sequin: 'Sequins' };
const fabricLabel = (id: string) => GOWN_STOCK_FABRICS.find((f) => f.id === id)?.label ?? id;

/**
 * Price one design with the shop's own list (server only). `addOnsChosen` are the add-ons the bride picked; one the
 * shop does not offer is left out (the server refuses it before this is called).
 */
export function gownDesignOf(
  options: GownShopOptions,
  design: DesignPick,
  q: GownQuantities,
  addOnsChosen: readonly GownAddOnKey[],
  fabrics: ReadonlyMap<string, GownShopFabric> = new Map(),
): GownDesignPriced {
  const P = options.prices;
  const extras = options.mode === 'extras';
  const inBase = new Set<string>(extras ? options.inBase : []);
  const chosen = GOWN_ADD_ONS.map((a) => a.id).filter((id) => addOnsChosen.includes(id) && options.addOns[id].state !== 'none');
  const covered = new Set(chosen.flatMap((id) => ADD_ON_COVERS[id] ?? []));
  const lines: GownQuoteLine[] = [];
  const m = q.materials;
  const L = q.labour;

  const supply = (group: GownQuoteGroup, key: string, label: string, qty: number, unit: GownPriceUnit, unitOverride?: number | null) => {
    if (!(qty > 0) || covered.has(key)) return;
    const included = inBase.has(key);
    const unitC = included ? 0 : unitOverride !== undefined ? unitOverride : (P[key as GownPriceKey] ?? null);
    const qtyR = round2(qty);
    lines.push({ group, key, label, qty: qtyR, unit, unitCentavos: unitC, amountCentavos: unitC === null ? null : Math.round(qtyR * unitC), included });
  };

  // Fabric: the outer (the shop's own fabric row, at its own price, when she picked one), then the accent.
  const shopFab = design.fabricRef ? fabrics.get(design.fabricRef) : undefined;
  if (shopFab) supply('Fabric', `shopfab:${design.fabricRef}`, `${shopFab.name} (outer)`, m.outerM, 'm', shopFab.pricePerMetreCentavos);
  else supply('Fabric', `fab_${design.fabric}`, `${fabricLabel(design.fabric)} (outer)`, m.outerM, 'm');
  const accentFab = design.accentFabricRef ? fabrics.get(design.accentFabricRef) : undefined;
  if (accentFab) supply('Bodice', `shopfab:${design.accentFabricRef}`, `${accentFab.name} (accents: sleeves)`, m.accentM, 'm', accentFab.pricePerMetreCentavos);
  else {
    const ak = design.accentFabric ?? design.fabric;
    supply('Bodice', `fab_${ak}`, `${fabricLabel(ak)} (accents: sleeves)`, m.accentM, 'm');
  }
  supply('Fabric', `fab_${design.fabric}`, `${fabricLabel(design.fabric)} for the ruffle`, m.ruffleM, 'm');
  // Bodice: closures.
  supply('Bodice', 'zipper', 'Invisible zipper', m.zippers, 'pc');
  supply('Bodice', 'button', 'Covered buttons', m.buttons, 'pc');
  supply('Bodice', 'eyelet', 'Eyelets', m.eyelets, 'pc');
  supply('Bodice', 'cord', 'Lacing cord', m.cordM, 'm');
  // Details: lace, beads, trims, illusion.
  supply('Details', 'lace_yard', 'Lace by the yard', m.laceYardM, 'm');
  supply('Details', 'lace_motif', 'Lace motifs', m.laceMotifs, 'pc');
  for (const [kind, n] of Object.entries(m.beads) as [GownBeadKind, number][]) supply('Details', `bead_${kind}`, BEAD_LABEL[kind], n / 100, '100 pcs');
  supply('Details', 'piping', 'Piping', m.pipingM, 'm');
  supply('Details', 'fringe', 'Fringe', m.fringeM, 'm');
  supply('Details', 'feather', 'Feather trim', m.featherM, 'm');
  supply('Details', 'illusion', 'Illusion mesh', m.illusionM, 'm');
  // The cape (v196; Builder A's A6f quantities): its own labour line by type, its cloth, and a narrow strap when it hangs
  // from one shoulder of a strapless neckline. A lace, appliqué or beaded edge is already in the lace and bead lines.
  if (L.cape !== 'none') {
    const capeName = GOWN_CAPES.find((c) => c.id === L.cape)?.label ?? 'Cape';
    supply('Details', `cape_${L.cape}`, `Cape (${capeName.toLowerCase()}): cutting, sewing and finishing`, 1, 'pc');
    const fab = gownCapeNow(design).fab;
    if (fab === 'gown') {
      const ak = design.accentFabric ?? design.fabric;
      supply('Details', `fab_${ak}`, `${fabricLabel(ak)} (the cape, accent colour)`, m.capeM, 'm');
    } else supply('Details', `fab_${fab}`, `${fabricLabel(fab)} (the cape)`, m.capeM, 'm');
    supply('Details', 'ribbon', 'Narrow strap for the cape', m.ribbonM, 'm');
  }
  // Skirt.
  supply('Skirt', 'horsehair', 'Horsehair braid', m.horsehairM, 'm');
  // Inside.
  if (design.lining !== 'none') supply('Inside', `lin_${design.lining}`, `${design.lining[0]!.toUpperCase()}${design.lining.slice(1)} lining`, m.liningM, 'm');
  supply('Inside', 'net', 'Petticoat tulle', m.netM, 'm');
  supply('Inside', 'hoop', 'Hoop (crinoline)', m.hoops, 'pc');
  supply('Inside', 'boning', 'Boning', m.boningM, 'm');
  supply('Inside', 'waiststay', 'Waist stay', m.waistStays, 'pc');

  // Labour, at the shop's rate and its own time standards.
  const h = options.hours;
  const rate = P.rate ?? null;
  const labour = (key: string, label: string, hours: number) => {
    if (!(hours > 0)) return;
    const hr = round2(hours);
    lines.push({ group: 'Labour', key, label, qty: hr, unit: 'h', unitCentavos: rate, amountCentavos: rate === null ? null : Math.round(hr * rate), included: false });
  };
  if (L.sleeve === 'cap' || L.sleeve === 'long' || L.sleeve === 'butterfly') {
    labour('h_sleeve', `${{ cap: 'Cap', long: 'Long', butterfly: 'Terno butterfly' }[L.sleeve]} sleeves`, h[`sleeve_${L.sleeve}`]);
  }
  labour('h_beads', 'Hand beading', (L.beads / 100) * h.beads100);
  labour('h_lace', 'Lace appliqué', L.laceMotifs * h.motif + L.laceYardM * h.lace_yard);
  labour('h_pleat', 'Pleating', L.pleats * h.pleat);
  if (L.tex !== 'none') labour('h_tex', { pintuck: 'Pintucks', ruche: 'Ruching', smock: 'Smocking' }[L.tex as 'pintuck' | 'ruche' | 'smock'] ?? 'Fabric technique', h.tex);
  if (L.twoPiece) labour('h_twop', 'Two-piece: separate top, skirt waistband', h.two_piece);
  if (L.darts) labour('h_darts', 'Darts / seams', h.darts);
  labour('h_cut', 'Cut-outs (finished edges)', L.cutouts * h.cutout);
  labour('h_slit', 'Slits', L.slits * h.slit);
  if (L.train !== 'none') labour('h_train', 'Train', h.train);
  labour('h_trim', 'Trims', L.trimM * h.trim_m);

  // Add-ons: her amount on top in both modes (no markup), "Included", or "Ask your designer".
  const forBrideAddOns: GownAddOnForBride[] = [];
  let addOnsC = 0;
  for (const id of chosen) {
    const a = options.addOns[id];
    const label = GOWN_ADD_ONS.find((x) => x.id === id)!.label;
    if (a.state === 'priced') {
      lines.push({ group: 'Add-ons', key: `addon_${id}`, label, qty: 1, unit: 'item', unitCentavos: a.centavos, amountCentavos: a.centavos, included: false });
      if (a.centavos !== null) addOnsC += a.centavos;
      forBrideAddOns.push({ id, label, centavos: a.centavos, words: a.centavos === null ? GOWN_ADD_ON_ASK : null });
    } else if (a.state === 'free') {
      lines.push({ group: 'Add-ons', key: `addon_${id}`, label, qty: 1, unit: 'item', unitCentavos: 0, amountCentavos: 0, included: true });
      forBrideAddOns.push({ id, label, centavos: null, words: GOWN_ADD_ON_INCLUDED });
    } else if (a.state === 'request') {
      lines.push({ group: 'Add-ons', key: `addon_${id}`, label, qty: 1, unit: 'item', unitCentavos: null, amountCentavos: null, included: false });
      forBrideAddOns.push({ id, label, centavos: null, words: GOWN_ADD_ON_ASK });
    }
  }

  // Totals leave unpriced lines out; the shop is told how many.
  let supplies = 0;
  let labourC = 0;
  let unpriced = 0;
  for (const l of lines) {
    if (l.group === 'Add-ons') continue;
    if (l.amountCentavos === null) unpriced++;
    else if (l.group === 'Labour') labourC += l.amountCentavos;
    else supplies += l.amountCentavos;
  }
  unpriced += lines.filter((l) => l.group === 'Add-ons' && l.amountCentavos === null && !l.included && options.addOns[l.key.slice(6) as GownAddOnKey].state === 'priced').length;

  const base = P[`base_${design.sil}` as GownPriceKey] ?? null;
  if (base === null) unpriced++;
  const markup = options.markupPct > 0 ? options.markupPct : 0;
  const designC = Math.round((supplies + labourC) * (1 + markup / 100));
  let total: number | null;
  let withinBase = false;
  if (extras) {
    // The base is locked; each extra adds its own price; no markup on top.
    total = base === null ? null : base + supplies + labourC + addOnsC;
  } else {
    // The starting price covers the design until the design costs more. With no starting price and nothing priced,
    // there is no price to show (prototype: "Price to follow").
    if (base === null && designC === 0) total = null;
    else {
      total = Math.max(base ?? 0, designC) + addOnsC;
      withinBase = base !== null && designC <= base;
    }
  }
  return {
    forShop: {
      mode: options.mode,
      lines,
      suppliesCentavos: supplies,
      labourCentavos: labourC,
      baseCentavos: base,
      designCentavos: designC,
      addOnsCentavos: addOnsC,
      totalCentavos: total,
      unpriced,
    },
    forBride: { estimateCentavos: total, withinBase, addOns: forBrideAddOns },
  };
}

/** The silhouette's starting-price label ("Starting price: A-line"). */
export const gownBaseLabel = (sil: GownSilhouette) => `Starting price: ${SIL_LABEL[sil]}`;

// ─────────────────────────────────────────────────────────────────────────────
// The chat's words (the design card and the invite card read these; step B8 draws them)
// ─────────────────────────────────────────────────────────────────────────────

export const GOWN_DESIGN_HEAD = '👗 Gown design · ';
export const GOWN_INVITE_BODY = '👗 Design your gown with us. Your measurements first, then the shape, fabric and details in 3D. We’ll quote from your design.';
export const GOWN_DESIGN_REF = 'Design ref: ';
export const GOWN_DESIGN_UNREADABLE = "We couldn't check your design against the shop's Attire Maker, so nothing was sent. Try again.";
export const GOWN_DESIGN_NOT_SENT = 'Your design didn’t go into the chat. It is kept here, so send it again.';

/** The design in a few words for the message ("A-line in satin"); the card draws the rest from the stored row. */
export function gownDesignWords(design: Pick<GownConfig, 'sil' | 'fabric'>): string {
  return `${SIL_LABEL[design.sil] ?? 'Gown'} in ${fabricLabel(design.fabric).toLowerCase()}`;
}

/** The one message a sent design posts. Only the estimate (or "Ask for a quote") — never a cost. */
export function formatGownDesignBlock(design: Pick<GownConfig, 'sil' | 'fabric'>, forBride: GownDesignForBride, designId: string): string {
  return [
    `${GOWN_DESIGN_HEAD}${gownDesignWords(design)}`,
    forBride.estimateCentavos != null ? `Estimate: ${formatCentavosPhp(forBride.estimateCentavos)}. The quote decides.` : 'Ask for a quote: the designer prices this design.',
    `${GOWN_DESIGN_REF}${designId}`,
  ].join('\n');
}

/** The stored row a design message names, or null. */
export function gownDesignRefOf(body: string | null | undefined): string | null {
  const text = body ?? '';
  if (!text.startsWith(GOWN_DESIGN_HEAD)) return null;
  const at = text.lastIndexOf(GOWN_DESIGN_REF);
  if (at < 0) return null;
  const m = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s*$/i.exec(text.slice(at + GOWN_DESIGN_REF.length));
  return m ? m[1]!.toLowerCase() : null;
}

// ── B5 · THE SHOP'S FABRICS, LACE AND LOOKS ─────────────────────────────────────────────────────────────────────────
// One fabric or lace row and one look, as the designer saves them (plan step B5; drawing v196 "Fabrics and lace",
// "Inspirations"; the four sliders are prototype v188 `tune:{shine,sheer,body,tex}`).

/** The four sliders, each saved as an OFFSET from the fabric type's own value, so a later type edit still carries. */
export const GOWN_FABRIC_TUNE = [
  { key: 'shine', label: 'Shine' },
  { key: 'sheer', label: 'See-through' },
  { key: 'body', label: 'Body' },
  { key: 'tex', label: 'Texture' },
] as const;
export type GownFabricTuneKey = (typeof GOWN_FABRIC_TUNE)[number]['key'];
export type GownFabricTune = Partial<Record<GownFabricTuneKey, number>>;

/** A colour a fabric comes in. The hex is the cloth's own colour (product data), not a page colour. */
export type GownFabricColour = { name: string | null; hex: string };

export type GownShopFabricInput = {
  id: string | null;
  kind: 'fabric' | 'lace';
  name: string;
  code: string | null;
  typeId: string;
  colours: GownFabricColour[];
  /** Null = unpriced: a quote line for it stays unpriced. */
  pricePerMetreCentavos: number | null;
  tune: GownFabricTune;
  thumbKey: string | null;
  /** Patterned cloth only. A plain fabric has none, so picking it makes no tile request. */
  tileKey: string | null;
  active: boolean;
};

export type GownShopLookInput = { id: string | null; name: string; photoKey: string | null; config: unknown; active: boolean };
/** A row of the shop's stock list (server → the shop's own panel only; never in a bride's read). */
export type ShopGownStockFabric = GownShopFabricInput & { id: string; thumbUrl: string | null; tileUrl: string | null };
export type ShopGownStockLook = Omit<GownShopLookInput, 'id'> & { id: string; photoUrl: string | null };
/** A fabric type the designer can pick, with its own values (the sliders start there). */
export type GownFabricTypeOption = {
  id: string;
  name: string;
  sheen: number;
  sheer: number;
  stiff: number;
  verified: boolean;
  /** B15: how the bride's Fabric step groups and filters it. */
  family: (typeof GOWN_FABRIC_FAMILIES)[number]['id'];
  usedFor: (typeof GOWN_FABRIC_USES)[number]['id'][];
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX_RE = /^#[0-9a-f]{6}$/i;
const MAX_COLOURS = 24;

/** A photo the shop uploaded must sit in its OWN gown folder of the public media bucket. */
export function gownShopMediaPrefix(vendorProfileId: string): string {
  return `vendors/${vendorProfileId}/gown/`;
}
function shopRef(v: unknown, vendorProfileId: string): string | null | false {
  if (v == null || v === '') return null;
  return parseClientRef(v, { prefixes: [gownShopMediaPrefix(vendorProfileId)] }) ? String(v).trim() : false;
}
const text = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim();
  return t && t.length <= max ? t : null;
};

/** One fabric or lace row from the designer's device, checked. Refused (never thinned) when anything is off. */
export function sanitizeGownShopFabric(
  input: unknown,
  ctx: { vendorProfileId: string; typeIds: ReadonlySet<string> },
): { ok: true; fabric: GownShopFabricInput } | { ok: false; problem: string } {
  const no = (problem: string) => ({ ok: false as const, problem });
  if (!input || typeof input !== 'object') return no('That fabric could not be read.');
  const r = input as Record<string, unknown>;
  const id = r.id == null || r.id === '' ? null : typeof r.id === 'string' && UUID_RE.test(r.id) ? r.id.toLowerCase() : undefined;
  if (id === undefined) return no('That fabric could not be read.');
  if (r.kind !== 'fabric' && r.kind !== 'lace') return no('Choose fabric or lace.');
  const name = text(r.name, 40);
  if (!name) return no('Give it a name (up to 40 letters).');
  const code = r.code == null || r.code === '' ? null : text(r.code, 40);
  if (r.code != null && r.code !== '' && !code) return no('The code is up to 40 letters.');
  if (typeof r.typeId !== 'string' || !ctx.typeIds.has(r.typeId)) return no('Choose what kind of cloth it is.');
  if (!Array.isArray(r.colours) || r.colours.length > MAX_COLOURS) return no(`Up to ${MAX_COLOURS} colours.`);
  const colours: GownFabricColour[] = [];
  for (const c of r.colours) {
    const o = (c ?? {}) as Record<string, unknown>;
    if (typeof o.hex !== 'string' || !HEX_RE.test(o.hex)) return no('A colour could not be read.');
    colours.push({ name: o.name == null || o.name === '' ? null : text(o.name, 30), hex: o.hex.toLowerCase() });
  }
  const price = r.pricePerMetreCentavos;
  if (price != null && !isCentavos(price)) return no('The price per metre must be more than zero, or left empty.');
  const tune: GownFabricTune = {};
  const rawTune = (r.tune ?? {}) as Record<string, unknown>;
  if (typeof rawTune !== 'object' || Array.isArray(rawTune)) return no('The sliders could not be read.');
  for (const k of Object.keys(rawTune)) if (!GOWN_FABRIC_TUNE.some((t) => t.key === k)) return no('The sliders could not be read.');
  for (const { key } of GOWN_FABRIC_TUNE) {
    const v = rawTune[key];
    if (v == null) continue;
    if (typeof v !== 'number' || !Number.isFinite(v) || v < -1 || v > 1) return no('The sliders could not be read.');
    const rounded = Math.round(v * 100) / 100;
    if (rounded !== 0) tune[key] = rounded;
  }
  const thumbKey = shopRef(r.thumbKey, ctx.vendorProfileId);
  const tileKey = shopRef(r.tileKey, ctx.vendorProfileId);
  if (thumbKey === false || tileKey === false) return no('That photo could not be used. Upload it again.');
  return {
    ok: true,
    fabric: { id, kind: r.kind, name, code, typeId: r.typeId, colours, pricePerMetreCentavos: (price as number | null) ?? null, tune, thumbKey, tileKey, active: r.active !== false },
  };
}

/** One look from the designer's device: its name and photo checked here; the design itself by `sanitizeGownConfig`. */
export function sanitizeGownShopLookShell(
  input: unknown,
  vendorProfileId: string,
): { ok: true; look: Omit<GownShopLookInput, 'config'>; config: unknown } | { ok: false; problem: string } {
  const no = (problem: string) => ({ ok: false as const, problem });
  if (!input || typeof input !== 'object') return no('That look could not be read.');
  const r = input as Record<string, unknown>;
  const id = r.id == null || r.id === '' ? null : typeof r.id === 'string' && UUID_RE.test(r.id) ? r.id.toLowerCase() : undefined;
  if (id === undefined) return no('That look could not be read.');
  const name = text(r.name, 60);
  if (!name) return no('Give the look a name (up to 60 letters).');
  const photoKey = shopRef(r.photoKey, vendorProfileId);
  if (photoKey === false) return no('That photo could not be used. Upload it again.');
  return { ok: true, look: { id, name, photoKey, active: r.active !== false }, config: r.config };
}

// ── B5b · THE FABRIC-TYPE REGISTRY (Setnayan admin only, owner Q4) ─────────────────────────────────────────────────
// The bounds are the table's own CHECKs (migration 20271365509280), so a refusal here is said in words before the
// database would refuse it. Hide (active = false), never delete: a shop's fabric may point at the type.

export const GOWN_FABRIC_FAMILIES = [
  { id: 'satins', label: 'Satins' },
  { id: 'structured', label: 'Structured' },
  { id: 'crepes', label: 'Crepes' },
  { id: 'sheers', label: 'Sheers' },
  { id: 'laces', label: 'Laces' },
  { id: 'knits', label: 'Knits' },
  { id: 'suitings', label: 'Suitings' },
  { id: 'handwoven', label: 'Handwoven' },
  { id: 'linings', label: 'Linings' },
] as const;
export const GOWN_FABRIC_STRETCH = [
  { id: 'none', label: 'No stretch' },
  { id: '2way', label: 'Two-way stretch' },
  { id: '4way', label: 'Four-way stretch' },
] as const;
export const GOWN_FABRIC_USES = [
  { id: 'gown_body', label: 'Gown body' },
  { id: 'skirt', label: 'Skirt' },
  { id: 'sleeves_accents', label: 'Sleeves and accents' },
  { id: 'lining', label: 'Lining' },
  { id: 'mens_suit', label: 'Men’s suit' },
  { id: 'barong', label: 'Barong' },
  { id: 'entourage', label: 'Entourage' },
] as const;

export type GownFabricTypeRow = {
  id: string;
  name: string;
  aliases: string[];
  family: (typeof GOWN_FABRIC_FAMILIES)[number]['id'];
  gsm: number;
  stiff: number;
  sheen: number;
  sheer: number;
  stretch: (typeof GOWN_FABRIC_STRETCH)[number]['id'];
  usedFor: (typeof GOWN_FABRIC_USES)[number]['id'][];
  renderAs: string | null;
  active: boolean;
  sort: number;
  verified: boolean;
};

const TYPE_ID_RE = /^[a-z][a-z0-9_]{1,39}$/;
const unit = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;

/** One registry row from the admin's device, checked against the table's own rules. `known` = the ids that exist. */
export function sanitizeGownFabricType(
  input: unknown,
  known: ReadonlySet<string>,
): { ok: true; type: GownFabricTypeRow } | { ok: false; problem: string } {
  const no = (problem: string) => ({ ok: false as const, problem });
  if (!input || typeof input !== 'object') return no('That fabric type could not be read.');
  const r = input as Record<string, unknown>;
  if (typeof r.id !== 'string' || !TYPE_ID_RE.test(r.id)) return no('The id is 2 to 40 small letters, digits or _, starting with a letter.');
  const name = text(r.name, 60);
  if (!name) return no('Give it a name (up to 60 letters).');
  if (!Array.isArray(r.aliases) || r.aliases.length > 12) return no('Up to 12 other names.');
  const aliases: string[] = [];
  for (const a of r.aliases) {
    const t = text(a, 40);
    if (!t) return no('Another name could not be read.');
    if (!aliases.includes(t)) aliases.push(t);
  }
  if (!GOWN_FABRIC_FAMILIES.some((f) => f.id === r.family)) return no('Choose a family.');
  if (typeof r.gsm !== 'number' || !Number.isInteger(r.gsm) || r.gsm < 5 || r.gsm > 600) return no('Weight is 5 to 600 g/m².');
  if (!unit(r.stiff) || !unit(r.sheen) || !unit(r.sheer)) return no('Stiffness, shine and see-through are each 0 to 1.');
  if (!GOWN_FABRIC_STRETCH.some((s) => s.id === r.stretch)) return no('Choose the stretch.');
  if (!Array.isArray(r.usedFor) || r.usedFor.length < 1 || !r.usedFor.every((u) => GOWN_FABRIC_USES.some((x) => x.id === u))) return no('Choose at least one use.');
  const renderAs = r.renderAs == null || r.renderAs === '' ? null : typeof r.renderAs === 'string' && known.has(r.renderAs) && r.renderAs !== r.id ? r.renderAs : undefined;
  if (renderAs === undefined) return no('“Looks like” must be another type in the list.');
  if (typeof r.sort !== 'number' || !Number.isInteger(r.sort) || Math.abs(r.sort) > 10_000) return no('The order could not be read.');
  const two = (v: number) => Math.round(v * 100) / 100;
  return {
    ok: true,
    type: {
      id: r.id,
      name,
      aliases,
      family: r.family as GownFabricTypeRow['family'],
      gsm: r.gsm,
      stiff: two(r.stiff as number),
      sheen: two(r.sheen as number),
      sheer: two(r.sheer as number),
      stretch: r.stretch as GownFabricTypeRow['stretch'],
      usedFor: [...new Set(r.usedFor as GownFabricTypeRow['usedFor'])],
      renderAs,
      active: r.active !== false,
      sort: r.sort,
      verified: r.verified === true,
    },
  };
}

// ── B15 · THE BRIDE'S FABRIC STEP: GROUPED BY TYPE, ONLY WHAT SUITS THE GARMENT (data side) ─────────────────────────
// Prototype v186 "The Fabric step groups by type and offers only what suits the garment" (INTEGRATION-PLAN v186):
// gown = `usedFor` has gown_body or skirt; accent = sleeves_accents; lining = lining. Headings by family. Men's-only and
// lining-only types are hidden from the bride's gown and accent choices. The designer's own cloths keep their place
// first, each under its type. Builder A wires the step from `fabricGroups` on the `open` read.

export type GownFabricSlot = 'gown' | 'accent' | 'lining';
export const GOWN_FABRIC_SLOT_USES: Record<GownFabricSlot, readonly GownFabricTypeOption['usedFor'][number][]> = {
  gown: ['gown_body', 'skirt'],
  accent: ['sleeves_accents'],
  lining: ['lining'],
};
/** The family order on the bride's step (fabric-types-research.md "Families"). */
export const GOWN_FABRIC_FAMILY_ORDER = GOWN_FABRIC_FAMILIES.map((f) => f.id);

export type GownFabricChoice =
  | { kind: 'designer'; id: string; name: string; typeId: string; lace: boolean }
  | { kind: 'type'; id: string; name: string };
export type GownFabricGroup = { family: GownFabricTypeOption['family']; label: string; choices: GownFabricChoice[] };

export function gownFabricGroups(
  slot: GownFabricSlot,
  types: readonly Pick<GownFabricTypeOption, 'id' | 'name' | 'family' | 'usedFor'>[],
  shopFabrics: readonly { id: string; name: string; typeId: string | null; kind: 'fabric' | 'lace' }[] = [],
): GownFabricGroup[] {
  const uses = GOWN_FABRIC_SLOT_USES[slot];
  const offered = types.filter((t) => t.usedFor.some((u) => uses.includes(u)));
  const byId = new Map(offered.map((t) => [t.id, t]));
  return GOWN_FABRIC_FAMILY_ORDER.flatMap((family) => {
    const inFamily = offered.filter((t) => t.family === family);
    if (!inFamily.length) return [];
    const choices: GownFabricChoice[] = [];
    // ★ The designer's own cloths first, each under its type's family (in the type order).
    for (const t of inFamily) {
      for (const f of shopFabrics) if (f.typeId === t.id && byId.has(f.typeId)) choices.push({ kind: 'designer', id: f.id, name: f.name, typeId: t.id, lace: f.kind === 'lace' });
    }
    for (const t of inFamily) choices.push({ kind: 'type', id: t.id, name: t.name });
    return [{ family, label: GOWN_FABRIC_FAMILIES.find((f) => f.id === family)!.label, choices }];
  });
}
