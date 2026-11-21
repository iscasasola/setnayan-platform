/**
 * 🎂 THE CAKE MAKER — pure rules (DECISION_LOG 2026-11-21 "CAKE MAKER — APPROVED TO BUILD" + the controller's v2
 * rulings: 10 layers · real vs display tiers · per-tier accents · arrangement · flowing accent · monogram · cupcakes).
 *
 * ── RULE 0: EVERY CHOICE IS A SHIPPED PACKAGE LINE ─────────────────────────────────────────────────────────────────
 * The cake's options live on the card's OWN ★ Customization package as ordinary `vendor_package_items` +
 * `vendor_package_item_options` rows — the Standard option at +₱0, extras in `price_delta_centavos` (never below ₱0).
 * The only new storage on a line is the part tag (`cake_part`) and, on an option, the catalog key (`look_key`) that
 * says which look (lib/cake-config.ts) or how many tiers it is. Nothing here prices anything: the estimate is the
 * shipped `choiceTotals`, the same call the Book sheet and `lockPackage` make.
 *
 * ── THE LINES (approved choice-line model) ─────────────────────────────────────────────────────────────────────────
 *   Real tiers      1–10 · the one price pays for the Standard count; each real tier above it adds the shop's extra
 *   Display tiers   0–9 behind the shop's switch · each adds the shop's display-tier extra
 *   Flavour · tier k   one line per possible real tier (k = 1…10), the list written once · an extra charged per tier
 *   Accent · tier k    one line per possible tier · Plain is Standard
 *   Arrangement · Finish · Flowing accent · Topper · Monogram (Off / On) · Colours (Choose 1–3)
 *   Cupcakes (None / the shop's packs at its typed price) · Cupcake flavour · Cupcake display (base / tower)
 * Lines for tiers the couple did not pick stay on their Standard ₱0 option — they never charge.
 */
import { formatCentavosPhp, type VendorPackageItemRow, type VendorPackageWithItems } from './vendor-packages';
import type { DraftItem, DraftOption } from './package-authoring';
import { choiceTotals, type ChoiceSelection } from './package-choice-tree';
import { packageCreditEnabled } from './package-credit-flag';
import {
  CAKE_ACCENTS,
  CAKE_ARRANGEMENTS,
  CAKE_FINISHES,
  CAKE_FLOWING,
  CAKE_MAX_TIERS,
  CAKE_TOPPERS,
  CUPCAKE_PLACEMENTS,
  type CakeAccent,
  type CakeArrangement,
  type CakeConfig,
  type CakeFinish,
  type CakeFlowing,
  type CakeOffer,
  type CakeTopper,
} from './cake-config';

export { CAKE_MAX_TIERS };

/* ──────────────────────────────────────────────────────────────────────── */
/* Which cards are cakes (ruling 10: cakes only)                            */
/* ──────────────────────────────────────────────────────────────────────── */

export const CAKE_KINDS: ReadonlySet<string> = new Set(['wedding_cake', 'cake']);

export function isCakeKind(kind: string | null | undefined): boolean {
  return CAKE_KINDS.has(String(kind ?? '').trim());
}

/* ──────────────────────────────────────────────────────────────────────── */
/* The parts — the DB CHECK holds exactly these (cake-maker.test.ts pins it) */
/* ──────────────────────────────────────────────────────────────────────── */

export const CAKE_PARTS = [
  'real_tiers',
  'display_tiers',
  'flavour',
  'accent',
  'arrangement',
  'finish',
  'flowing',
  'topper',
  'monogram',
  'colours',
  'cupcakes',
  'cupcake_flavour',
  'cupcake_display',
] as const;
export type CakePart = (typeof CAKE_PARTS)[number];

export function isCakePart(v: unknown): v is CakePart {
  return typeof v === 'string' && (CAKE_PARTS as readonly string[]).includes(v);
}

export const CAKE_COLOURS_MAX = 3;
export const CAKE_MESSAGE_LETTERS = 40;
export const CAKE_MESSAGE_LETTERS_MAX = 60;
export const CAKE_LABEL_MAX = 60;
export const CAKE_CHOICES_MAX = 12;
export const CUPCAKE_PACKS_MAX = 6;
export const CUPCAKE_PACK_MAX_COUNT = 500;

export const CAKE_MESSAGE_FORM_KEY = 'cake_message';
export const CAKE_MESSAGE_PROMPT = 'Message on the cake';

export const CAKE_LINE_NAME: Record<Exclude<CakePart, 'flavour' | 'accent'>, string> = {
  real_tiers: 'Real tiers',
  display_tiers: 'Display tiers',
  arrangement: 'Arrangement',
  finish: 'Finish',
  flowing: 'Flowing accent',
  topper: 'Topper',
  monogram: 'Monogram',
  colours: 'Colours',
  cupcakes: 'Cupcakes',
  cupcake_flavour: 'Cupcake flavour',
  cupcake_display: 'Cupcake display',
};

export const tierLabel = (n: number) => (n === 1 ? '1 tier' : `${n} tiers`);
export const displayTierLabel = (n: number) => (n === 0 ? 'No display tiers' : n === 1 ? '1 display tier' : `${n} display tiers`);
/** "Bottom tier" · "Tier 2" · … — bottom first. */
export const tierRowName = (index: number) => (index === 0 ? 'Bottom tier' : `Tier ${index + 1}`);
export const flavourLineName = (index: number) => `Flavour · ${index === 0 ? 'bottom tier' : `tier ${index + 1}`}`;
export const accentLineName = (index: number) => `Accent · ${index === 0 ? 'bottom tier' : `tier ${index + 1}`}`;

/* ── The catalog keys an option carries (`look_key`) ── */
export const realKey = (n: number) => `real:${n}`;
export const displayKey = (n: number) => `display:${n}`;
export const flavourKey = (i: number) => `fl:${i + 1}`;
export const packKey = (count: number) => `pack:${count}`;
export const PACK_NONE = 'pack:0';
export const MONOGRAM_OFF = 'off';
export const MONOGRAM_ON = 'on';
const countOf = (key: string | null | undefined, prefix: string): number | null => {
  const m = new RegExp(`^${prefix}:(\\d{1,3})$`).exec(key ?? '');
  return m ? Number(m[1]) : null;
};
export const packCountOf = (key: string | null | undefined) => countOf(key, 'pack');

/* ──────────────────────────────────────────────────────────────────────── */
/* The supplier's model — "Your cake options"                               */
/* ──────────────────────────────────────────────────────────────────────── */

/** A choice the supplier names (flavours). */
export type CakeChoice = { ref: string; label: string; extraCentavos: number; standard: boolean };
/** A choice from the catalog (finish, accents, arrangement, flowing, topper): its look, its extra, Standard or not. */
export type CakeLookChoice<T extends string = string> = { look: T; extraCentavos: number; standard: boolean };

export type CakeOptions = {
  tiers: {
    /** The most real tiers the shop makes, 1–10. */
    maxReal: number;
    /** The real tiers the one price pays for, 1…maxReal. */
    standard: number;
    /** Each real tier above the Standard count adds this. */
    realExtraCentavos: number;
    /** The "Display tiers" switch: null = off. */
    display: { max: number; extraCentavos: number } | null;
  };
  flavours: CakeChoice[] | null;
  finish: CakeLookChoice<CakeFinish>[] | null;
  accents: CakeLookChoice<CakeAccent>[] | null;
  arrangements: CakeLookChoice<CakeArrangement>[] | null;
  flowing: CakeLookChoice<CakeFlowing>[] | null;
  topper: CakeLookChoice<CakeTopper>[] | null;
  /** The event's monogram on the cake: null = not offered; otherwise its extra (≥ ₱0). */
  monogram: { extraCentavos: number } | null;
  colours: { names: string[]; max: number } | null;
  message: { maxLetters: number } | null;
  /** The cupcakes add-on: null = not sold. Packs at the shop's own typed price; flavours reuse the cake list. */
  cupcakes: { packs: { count: number; priceCentavos: number }[]; tower: { extraCentavos: number } | null } | null;
};

const choice = (ref: string, label: string, standard = false): CakeChoice => ({ ref, label, extraCentavos: 0, standard });
const looks = <T extends string>(list: readonly { id: T }[], standard: T, skip: T[] = []): CakeLookChoice<T>[] =>
  list.filter((x) => !skip.includes(x.id)).map((x) => ({ look: x.id, extraCentavos: 0, standard: x.id === standard }));

/** A new cake card opens with every part filled and every extra at ₱0 — the supplier types their own; never guessed. */
export function cakeTemplate(): CakeOptions {
  return {
    tiers: { maxReal: 5, standard: 3, realExtraCentavos: 0, display: null },
    flavours: [
      choice('fl-1', 'Vanilla chiffon', true),
      choice('fl-2', 'Chocolate'),
      choice('fl-3', 'Ube'),
      choice('fl-4', 'Mocha'),
      choice('fl-5', 'Red velvet'),
    ],
    finish: looks(CAKE_FINISHES, 'buttercream'),
    accents: looks(CAKE_ACCENTS, 'none'),
    arrangements: looks(CAKE_ARRANGEMENTS, 'stacked'),
    flowing: looks(CAKE_FLOWING, 'none'),
    topper: looks(CAKE_TOPPERS, 'none'),
    monogram: null,
    colours: { names: ['Dusty rose', 'Sage', 'White', 'Blush', 'Burgundy', 'Lilac'], max: CAKE_COLOURS_MAX },
    message: { maxLetters: CAKE_MESSAGE_LETTERS },
    cupcakes: null,
  };
}

const LOOK_LABEL: Record<string, string> = Object.fromEntries(
  [...CAKE_FINISHES, ...CAKE_ACCENTS, ...CAKE_ARRANGEMENTS, ...CAKE_FLOWING, ...CAKE_TOPPERS, ...CUPCAKE_PLACEMENTS].map((x) => [x.id, x.label]),
);
/** A catalog look's words ("Floral cascade"). Pass the part's own catalog where one id means two things ("none"). */
export const lookLabel = (look: string, catalog?: readonly { id: string; label: string }[]) =>
  catalog?.find((x) => x.id === look)?.label ?? LOOK_LABEL[look] ?? look;

/** Strip what would break the design message's separators: line breaks, the "·" divider, "(…)". */
export function cleanCakeLabel(raw: string): string {
  return raw.replace(/[\r\n]+/g, ' ').replace(/·/g, '-').replace(/[()]/g, '').replace(/\s+/g, ' ').trim().slice(0, CAKE_LABEL_MAX);
}

const isWholeCentavos = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;

function lookListProblem(name: string, list: CakeLookChoice[] | null, catalog: readonly { id: string; label: string }[], plain?: string): string | null {
  if (!list) return null;
  // The plain look ("Plain", "None", "Stacked") is what a design that picks nothing is — it is always the Standard.
  if (plain && !list.some((c) => c.look === plain && c.standard)) return `${name} keeps “${lookLabel(plain, catalog)}” as its Standard.`;
  if (list.length < 2) return `${name} needs at least 2 choices — or swipe it away.`;
  if (list.some((c) => !catalog.some((x) => x.id === c.look))) return `${name} has a choice this maker does not know.`;
  if (new Set(list.map((c) => c.look)).size !== list.length) return `${name} has the same choice twice.`;
  if (list.filter((c) => c.standard).length !== 1) return `Pick one ${name.toLowerCase()} as Standard.`;
  if (list.some((c) => !isWholeCentavos(c.extraCentavos))) return `A ${name.toLowerCase()} extra can’t go below ₱0.`;
  if (list.some((c) => c.standard && c.extraCentavos !== 0)) return `The Standard ${name.toLowerCase()} has no extra.`;
  return null;
}

/** The first problem with a set of cake options, as a sentence for the supplier — or null when it can be saved. */
export function cakeOptionsProblem(cake: CakeOptions): string | null {
  const t = cake.tiers;
  if (!Number.isInteger(t.maxReal) || t.maxReal < 1 || t.maxReal > CAKE_MAX_TIERS) return `Real tiers go from 1 to ${CAKE_MAX_TIERS}.`;
  if (!Number.isInteger(t.standard) || t.standard < 1 || t.standard > t.maxReal) return 'The tiers in your price have to be ones you make.';
  if (!isWholeCentavos(t.realExtraCentavos)) return 'The extra for a real tier can’t go below ₱0.';
  if (t.display) {
    if (!Number.isInteger(t.display.max) || t.display.max < 1 || t.display.max > CAKE_MAX_TIERS - 1) return `Display tiers go from 1 to ${CAKE_MAX_TIERS - 1}.`;
    if (!isWholeCentavos(t.display.extraCentavos)) return 'The extra for a display tier can’t go below ₱0.';
  }
  if (cake.flavours) {
    const list = cake.flavours;
    if (list.length < 2) return 'Flavour needs at least 2 choices — or swipe it away.';
    if (list.length > CAKE_CHOICES_MAX) return `Flavour holds at most ${CAKE_CHOICES_MAX} choices.`;
    if (list.some((c) => !cleanCakeLabel(c.label))) return 'Name every flavour.';
    if (list.filter((c) => c.standard).length !== 1) return 'Pick one flavour as Standard.';
    if (list.some((c) => !isWholeCentavos(c.extraCentavos))) return 'A flavour extra can’t go below ₱0.';
    if (list.some((c) => c.standard && c.extraCentavos !== 0)) return 'The Standard flavour has no extra.';
    if (new Set(list.map((c) => cleanCakeLabel(c.label).toLowerCase())).size !== list.length) return 'Two flavours have the same name.';
  }
  const lookProblem =
    lookListProblem('Finish', cake.finish, CAKE_FINISHES) ??
    lookListProblem('Accents', cake.accents, CAKE_ACCENTS, 'none') ??
    lookListProblem('Arrangement', cake.arrangements, CAKE_ARRANGEMENTS, 'stacked') ??
    lookListProblem('Flowing accent', cake.flowing, CAKE_FLOWING, 'none') ??
    lookListProblem('Topper', cake.topper, CAKE_TOPPERS, 'none');
  if (lookProblem) return lookProblem;
  if (cake.monogram && !isWholeCentavos(cake.monogram.extraCentavos)) return 'The monogram extra can’t go below ₱0.';
  if (cake.colours) {
    const names = cake.colours.names.map(cleanCakeLabel).filter(Boolean);
    if (names.length < 2) return 'Colours need at least 2 of your colours — or swipe it away.';
    if (names.length > CAKE_CHOICES_MAX) return `Colours hold at most ${CAKE_CHOICES_MAX} of your colours.`;
    if (new Set(names.map((n) => n.toLowerCase())).size !== names.length) return 'Two of your colours have the same name.';
    if (!Number.isInteger(cake.colours.max) || cake.colours.max < 1 || cake.colours.max > CAKE_COLOURS_MAX) return `Couples pick 1 to ${CAKE_COLOURS_MAX} colours.`;
  }
  if (cake.message) {
    const m = cake.message.maxLetters;
    if (!Number.isInteger(m) || m < 1 || m > CAKE_MESSAGE_LETTERS_MAX) return `A message holds 1 to ${CAKE_MESSAGE_LETTERS_MAX} letters.`;
  }
  if (cake.cupcakes) {
    const p = cake.cupcakes.packs;
    if (p.length < 1) return 'Add at least one cupcake pack — or switch cupcakes off.';
    if (p.length > CUPCAKE_PACKS_MAX) return `Cupcakes hold at most ${CUPCAKE_PACKS_MAX} packs.`;
    if (p.some((x) => !Number.isInteger(x.count) || x.count < 1 || x.count > CUPCAKE_PACK_MAX_COUNT)) return `A pack holds 1 to ${CUPCAKE_PACK_MAX_COUNT} cupcakes.`;
    if (new Set(p.map((x) => x.count)).size !== p.length) return 'Two cupcake packs have the same count.';
    if (p.some((x) => !isWholeCentavos(x.priceCentavos))) return 'A cupcake pack’s price can’t go below ₱0.';
    if (cake.cupcakes.tower && !isWholeCentavos(cake.cupcakes.tower.extraCentavos)) return 'The tower extra can’t go below ₱0.';
  }
  return null;
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Cake options ⇄ package lines                                             */
/* ──────────────────────────────────────────────────────────────────────── */

const opt = (ref: string, label: string, delta: number, isDefault: boolean, lookKey: string): DraftOption => ({
  ref,
  label: cleanCakeLabel(label),
  price_delta_centavos: isDefault ? 0 : delta,
  is_default: isDefault,
  is_available: true,
  lookKey,
});

function line(ref: string, part: CakePart, name: string, canonical: string, options: DraftOption[], pick?: { min: number; max: number }): DraftItem {
  return {
    ref,
    service_description: name,
    canonical_service: canonical,
    // A top-level choice is inside the price; its Standard option is what the one price already pays for.
    is_default_included: true,
    is_required: false,
    replacement_value_centavos: 0,
    options,
    parentRef: null,
    pickMin: pick?.min ?? null,
    pickMax: pick?.max ?? null,
    maxExtraHours: null,
    cakePart: part,
  };
}

const lookOptions = (ref: string, list: CakeLookChoice[], catalog: readonly { id: string; label: string }[]) =>
  list.map((c, i) => opt(`${ref}-o${i + 1}`, lookLabel(c.look, catalog), c.extraCentavos, c.standard, c.look));

/** The cake options as the package lines `savePackage` writes. Call {@link cakeOptionsProblem} first. */
export function cakeOptionsToDraftItems(cake: CakeOptions, canonical: string): DraftItem[] {
  const items: DraftItem[] = [];
  const t = cake.tiers;
  // Real tiers: a count below the Standard is still the one price (extras never go below ₱0, never a discount).
  items.push(
    line(
      'cake-real',
      'real_tiers',
      CAKE_LINE_NAME.real_tiers,
      canonical,
      Array.from({ length: t.maxReal }, (_, i) => i + 1).map((n) =>
        opt(`cake-real-${n}`, tierLabel(n), Math.max(0, n - t.standard) * t.realExtraCentavos, n === t.standard, realKey(n)),
      ),
    ),
  );
  if (t.display) {
    items.push(
      line(
        'cake-display',
        'display_tiers',
        CAKE_LINE_NAME.display_tiers,
        canonical,
        Array.from({ length: t.display.max + 1 }, (_, n) => opt(`cake-display-${n}`, displayTierLabel(n), n * t.display!.extraCentavos, n === 0, displayKey(n))),
      ),
    );
  }
  if (cake.flavours) {
    for (let k = 0; k < t.maxReal; k++) {
      items.push(
        line(
          `cake-fl-${k + 1}`,
          'flavour',
          flavourLineName(k),
          canonical,
          cake.flavours.map((c, i) => opt(`cake-fl-${k + 1}-o${i + 1}`, c.label, c.extraCentavos, c.standard, flavourKey(i))),
        ),
      );
    }
  }
  if (cake.accents) {
    const most = t.maxReal + (t.display?.max ?? 0);
    for (let k = 0; k < Math.min(CAKE_MAX_TIERS, most); k++) {
      items.push(line(`cake-ac-${k + 1}`, 'accent', accentLineName(k), canonical, lookOptions(`cake-ac-${k + 1}`, cake.accents, CAKE_ACCENTS)));
    }
  }
  if (cake.arrangements) items.push(line('cake-arrangement', 'arrangement', CAKE_LINE_NAME.arrangement, canonical, lookOptions('cake-arrangement', cake.arrangements, CAKE_ARRANGEMENTS)));
  if (cake.finish) items.push(line('cake-finish', 'finish', CAKE_LINE_NAME.finish, canonical, lookOptions('cake-finish', cake.finish, CAKE_FINISHES)));
  if (cake.flowing) items.push(line('cake-flowing', 'flowing', CAKE_LINE_NAME.flowing, canonical, lookOptions('cake-flowing', cake.flowing, CAKE_FLOWING)));
  if (cake.topper) items.push(line('cake-topper', 'topper', CAKE_LINE_NAME.topper, canonical, lookOptions('cake-topper', cake.topper, CAKE_TOPPERS)));
  if (cake.monogram) {
    items.push(
      line('cake-monogram', 'monogram', CAKE_LINE_NAME.monogram, canonical, [
        opt('cake-monogram-off', 'No monogram', 0, true, MONOGRAM_OFF),
        opt('cake-monogram-on', 'Our monogram', cake.monogram.extraCentavos, false, MONOGRAM_ON),
      ]),
    );
  }
  if (cake.colours) {
    const names = cake.colours.names.map(cleanCakeLabel).filter(Boolean);
    items.push(
      line(
        'cake-colours',
        'colours',
        CAKE_LINE_NAME.colours,
        canonical,
        names.map((label, i) => opt(`cake-colours-o${i + 1}`, label, 0, i === 0, `col:${i + 1}`)),
        { min: 1, max: Math.min(cake.colours.max, names.length) },
      ),
    );
  }
  if (cake.cupcakes) {
    const packs = [...cake.cupcakes.packs].sort((a, b) => a.count - b.count);
    items.push(
      line('cake-cupcakes', 'cupcakes', CAKE_LINE_NAME.cupcakes, canonical, [
        opt('cake-cupcakes-0', 'No cupcakes', 0, true, PACK_NONE),
        ...packs.map((p) => opt(`cake-cupcakes-${p.count}`, `${p.count} cupcakes`, p.priceCentavos, false, packKey(p.count))),
      ]),
    );
    if (cake.flavours) {
      // The cake's own list, at ₱0 — the pack's price is the cupcakes' price (no second flavour charge).
      items.push(
        line(
          'cake-cupcake-flavour',
          'cupcake_flavour',
          CAKE_LINE_NAME.cupcake_flavour,
          canonical,
          cake.flavours.map((c, i) => opt(`cake-cupcake-flavour-o${i + 1}`, c.label, 0, c.standard, flavourKey(i))),
        ),
      );
    }
    if (cake.cupcakes.tower) {
      items.push(
        line('cake-cupcake-display', 'cupcake_display', CAKE_LINE_NAME.cupcake_display, canonical, [
          opt('cake-cupcake-display-base', lookLabel('base', CUPCAKE_PLACEMENTS), 0, true, 'base'),
          opt('cake-cupcake-display-tower', lookLabel('tower', CUPCAKE_PLACEMENTS), cake.cupcakes.tower.extraCentavos, false, 'tower'),
        ]),
      );
    }
  }
  return items;
}

/** True when these lines are a cake card's options (they carry a real-tiers line). */
export function isCakeDraft(items: ReadonlyArray<DraftItem>): boolean {
  return items.some((i) => i.cakePart === 'real_tiers');
}

/** The stored lines back into "Your cake options" (ruling 9: editable on a saved card). Null = not a cake. */
export function cakeOptionsFromDraftItems(items: ReadonlyArray<DraftItem>, message: { maxLetters: number } | null): CakeOptions | null {
  const of = (part: CakePart) => items.find((i) => i.cakePart === part);
  const real = of('real_tiers');
  if (!real) return null;
  const counts = real.options.map((o) => ({ o, n: countOf(o.lookKey, 'real') })).filter((x): x is { o: DraftOption; n: number } => x.n !== null);
  if (counts.length === 0) return null;
  const maxReal = Math.max(...counts.map((c) => c.n));
  const standard = counts.find((c) => c.o.is_default)?.n ?? 1;
  const above = counts.find((c) => c.n === standard + 1);
  const display = of('display_tiers');
  const displayCounts = (display?.options ?? []).map((o) => ({ o, n: countOf(o.lookKey, 'display') })).filter((x): x is { o: DraftOption; n: number } => x.n !== null);
  const one = displayCounts.find((c) => c.n === 1);
  const backLooks = <T extends string>(l: DraftItem | undefined): CakeLookChoice<T>[] | null =>
    l ? l.options.map((o) => ({ look: (o.lookKey ?? '') as T, extraCentavos: o.is_default ? 0 : o.price_delta_centavos, standard: o.is_default })) : null;
  const fl = of('flavour');
  const colours = of('colours');
  const monogram = of('monogram');
  const cupcakes = of('cupcakes');
  const cupDisplay = of('cupcake_display');
  return {
    tiers: {
      maxReal,
      standard,
      realExtraCentavos: above ? above.o.price_delta_centavos : 0,
      display: displayCounts.length > 1 ? { max: Math.max(...displayCounts.map((c) => c.n)), extraCentavos: one?.o.price_delta_centavos ?? 0 } : null,
    },
    flavours: fl
      ? fl.options.map((o, i) => ({ ref: `fl-${i + 1}`, label: o.label, extraCentavos: o.is_default ? 0 : o.price_delta_centavos, standard: o.is_default }))
      : null,
    finish: backLooks<CakeFinish>(of('finish')),
    accents: backLooks<CakeAccent>(of('accent')),
    arrangements: backLooks<CakeArrangement>(of('arrangement')),
    flowing: backLooks<CakeFlowing>(of('flowing')),
    topper: backLooks<CakeTopper>(of('topper')),
    monogram: monogram ? { extraCentavos: monogram.options.find((o) => o.lookKey === MONOGRAM_ON)?.price_delta_centavos ?? 0 } : null,
    colours: colours ? { names: colours.options.map((o) => o.label), max: Math.max(1, Math.min(CAKE_COLOURS_MAX, colours.pickMax ?? 1)) } : null,
    message,
    cupcakes: cupcakes
      ? {
          packs: cupcakes.options
            .map((o) => ({ count: packCountOf(o.lookKey) ?? 0, priceCentavos: o.price_delta_centavos }))
            .filter((p) => p.count > 0),
          tower: cupDisplay ? { extraCentavos: cupDisplay.options.find((o) => o.lookKey === 'tower')?.price_delta_centavos ?? 0 } : null,
        }
      : null,
  };
}

/** The editor's wire format (one hidden field on the Card Maker's form). */
export const CAKE_OPTIONS_FIELD = 'cake_options';

export function serializeCakeOptions(cake: CakeOptions): string {
  return JSON.stringify({ v: 2, cake });
}

/** Total: never throws. Absent/blank → `{ ok: true, cake: null }`. Anything else is checked by cakeOptionsProblem. */
export function parseCakeOptions(raw: unknown): { ok: true; cake: CakeOptions | null } | { ok: false; message: string } {
  if (raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '')) return { ok: true, cake: null };
  const unreadable = { ok: false as const, message: 'Your cake options could not be read. Open them and save again.' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(raw));
  } catch {
    return unreadable;
  }
  if (String(raw).length > 20_000) return unreadable;
  const c = (parsed as { v?: unknown; cake?: unknown } | null)?.cake as Record<string, unknown> | undefined;
  if (!c || typeof c !== 'object' || (parsed as { v?: unknown }).v !== 2) return unreadable;
  const t = c.tiers as Record<string, unknown> | undefined;
  if (!t || typeof t.maxReal !== 'number' || typeof t.standard !== 'number' || typeof t.realExtraCentavos !== 'number') return unreadable;
  let display: CakeOptions['tiers']['display'] = null;
  if (t.display != null) {
    const d = t.display as Record<string, unknown>;
    if (typeof d.max !== 'number' || typeof d.extraCentavos !== 'number') return unreadable;
    display = { max: d.max, extraCentavos: d.extraCentavos };
  }
  const readLooks = (v: unknown): CakeLookChoice[] | null | 'bad' => {
    if (v == null) return null;
    if (!Array.isArray(v)) return 'bad';
    const out: CakeLookChoice[] = [];
    for (const x of v) {
      const r = (x ?? {}) as Record<string, unknown>;
      if (typeof r.look !== 'string' || typeof r.extraCentavos !== 'number' || typeof r.standard !== 'boolean') return 'bad';
      out.push({ look: r.look, extraCentavos: r.extraCentavos, standard: r.standard });
    }
    return out;
  };
  let flavours: CakeChoice[] | null = null;
  if (c.flavours != null) {
    if (!Array.isArray(c.flavours)) return unreadable;
    flavours = [];
    for (const [i, x] of c.flavours.entries()) {
      const r = (x ?? {}) as Record<string, unknown>;
      if (typeof r.label !== 'string' || typeof r.extraCentavos !== 'number' || typeof r.standard !== 'boolean') return unreadable;
      flavours.push({ ref: typeof r.ref === 'string' && r.ref ? r.ref.slice(0, 40) : `fl-${i + 1}`, label: r.label, extraCentavos: r.extraCentavos, standard: r.standard });
    }
  }
  const finish = readLooks(c.finish);
  const accents = readLooks(c.accents);
  const arrangements = readLooks(c.arrangements);
  const flowing = readLooks(c.flowing);
  const topper = readLooks(c.topper);
  if ([finish, accents, arrangements, flowing, topper].includes('bad')) return unreadable;
  let monogram: CakeOptions['monogram'] = null;
  if (c.monogram != null) {
    const m = c.monogram as Record<string, unknown>;
    if (typeof m.extraCentavos !== 'number') return unreadable;
    monogram = { extraCentavos: m.extraCentavos };
  }
  let colours: CakeOptions['colours'] = null;
  if (c.colours != null) {
    const col = c.colours as Record<string, unknown>;
    if (!Array.isArray(col.names) || col.names.some((n) => typeof n !== 'string') || typeof col.max !== 'number') return unreadable;
    colours = { names: col.names as string[], max: col.max };
  }
  let message: CakeOptions['message'] = null;
  if (c.message != null) {
    const m = c.message as Record<string, unknown>;
    if (typeof m.maxLetters !== 'number') return unreadable;
    message = { maxLetters: m.maxLetters };
  }
  let cupcakes: CakeOptions['cupcakes'] = null;
  if (c.cupcakes != null) {
    const cc = c.cupcakes as Record<string, unknown>;
    if (!Array.isArray(cc.packs)) return unreadable;
    const packs: { count: number; priceCentavos: number }[] = [];
    for (const p of cc.packs) {
      const r = (p ?? {}) as Record<string, unknown>;
      if (typeof r.count !== 'number' || typeof r.priceCentavos !== 'number') return unreadable;
      packs.push({ count: r.count, priceCentavos: r.priceCentavos });
    }
    let tower: { extraCentavos: number } | null = null;
    if (cc.tower != null) {
      const tw = cc.tower as Record<string, unknown>;
      if (typeof tw.extraCentavos !== 'number') return unreadable;
      tower = { extraCentavos: tw.extraCentavos };
    }
    cupcakes = { packs, tower };
  }
  const cake: CakeOptions = {
    tiers: { maxReal: t.maxReal, standard: t.standard, realExtraCentavos: t.realExtraCentavos, display },
    flavours,
    finish: finish as CakeLookChoice<CakeFinish>[] | null,
    accents: accents as CakeLookChoice<CakeAccent>[] | null,
    arrangements: arrangements as CakeLookChoice<CakeArrangement>[] | null,
    flowing: flowing as CakeLookChoice<CakeFlowing>[] | null,
    topper: topper as CakeLookChoice<CakeTopper>[] | null,
    monogram,
    colours,
    message,
    cupcakes,
  };
  const problem = cakeOptionsProblem(cake);
  return problem ? { ok: false, message: problem } : { ok: true, cake };
}

/* ──────────────────────────────────────────────────────────────────────── */
/* A stored card, read as a cake — what the couple may pick                 */
/* ──────────────────────────────────────────────────────────────────────── */

export type CakeCard = {
  real: VendorPackageItemRow;
  display: VendorPackageItemRow | null;
  /** Bottom first, one per possible real tier. */
  flavourLines: VendorPackageItemRow[];
  /** Bottom first, one per possible tier. */
  accentLines: VendorPackageItemRow[];
  arrangement: VendorPackageItemRow | null;
  finish: VendorPackageItemRow | null;
  flowing: VendorPackageItemRow | null;
  topper: VendorPackageItemRow | null;
  monogram: VendorPackageItemRow | null;
  colours: VendorPackageItemRow | null;
  cupcakes: VendorPackageItemRow | null;
  cupcakeFlavour: VendorPackageItemRow | null;
  cupcakeDisplay: VendorPackageItemRow | null;
};

const available = (item: VendorPackageItemRow | undefined | null) => (item?.options ?? []).filter((o) => o.is_available);
const keysOf = (item: VendorPackageItemRow | null) => available(item).map((o) => o.look_key ?? '').filter(Boolean);

/** The package read as a cake, or null when it is not one. */
export function readCakeCard(pkg: VendorPackageWithItems): CakeCard | null {
  const items = pkg.items.filter((i) => !i.parent_option_id);
  const one = (part: CakePart) => items.find((i) => i.cake_part === part) ?? null;
  const many = (part: CakePart) => items.filter((i) => i.cake_part === part).sort((a, b) => a.display_order - b.display_order);
  const real = one('real_tiers');
  if (!real || available(real).length === 0) return null;
  return {
    real,
    display: one('display_tiers'),
    flavourLines: many('flavour'),
    accentLines: many('accent'),
    arrangement: one('arrangement'),
    finish: one('finish'),
    flowing: one('flowing'),
    topper: one('topper'),
    monogram: one('monogram'),
    colours: one('colours'),
    cupcakes: one('cupcakes'),
    cupcakeFlavour: one('cupcake_flavour'),
    cupcakeDisplay: one('cupcake_display'),
  };
}

/** One of the couple's own Mood Board colours, named, with the board part it is (lib/cake-mood-colours.ts). */
export type MoodCakeColour = { hex: string; name: string; slot: string; setByYou: boolean };

/** What this card offers, in catalog ids — the sanitizer's whitelist (lib/cake-config.ts). */
export function cakeOfferOf(card: CakeCard, messageMax: number): CakeOffer {
  const counts = (item: VendorPackageItemRow | null, prefix: string) =>
    keysOf(item)
      .map((k) => countOf(k, prefix))
      .filter((n): n is number => n !== null);
  const realCounts = counts(card.real, 'real');
  const packs = keysOf(card.cupcakes).filter((k) => k !== PACK_NONE && packCountOf(k) !== null);
  return {
    maxRealTiers: Math.min(CAKE_MAX_TIERS, Math.max(1, ...realCounts), card.flavourLines.length || CAKE_MAX_TIERS),
    maxDisplayTiers: Math.max(0, ...counts(card.display, 'display')),
    arrangements: keysOf(card.arrangement) as CakeArrangement[],
    finishes: keysOf(card.finish) as CakeFinish[],
    accents: keysOf(card.accentLines[0] ?? null) as CakeAccent[],
    flowing: keysOf(card.flowing) as CakeFlowing[],
    monogram: keysOf(card.monogram).includes(MONOGRAM_ON),
    toppers: keysOf(card.topper) as CakeTopper[],
    flavourRefs: keysOf(card.flavourLines[0] ?? null),
    messageMax,
    cupcakes: packs.length > 0 ? { packRefs: packs, flavourRefs: keysOf(card.cupcakeFlavour), tower: keysOf(card.cupcakeDisplay).includes('tower') } : null,
  };
}

const byKey = (item: VendorPackageItemRow | null, key: string | null | undefined) =>
  key ? available(item).find((o) => o.look_key === key) ?? null : null;
const standardOf = (item: VendorPackageItemRow | null) => {
  const o = available(item);
  return o.find((x) => x.is_default) ?? o[0] ?? null;
};

/**
 * A sanitized design as the SHIPPED selection the pricer and `lockPackage` read. Lines for tiers the couple did not
 * pick stay on their Standard (₱0). The colours line is removed: every colour is ₱0, and the design's colours (the
 * couple's Mood Board ones included) are carried on the design itself, never as a pick.
 * Null when a key on the design no longer has an option on this card.
 */
export function cakeConfigSelection(card: CakeCard, config: CakeConfig): { selection: ChoiceSelection; removedItemIds: string[] } | null {
  const picks: Record<string, string[]> = {};
  const set = (item: VendorPackageItemRow | null, key: string | null | undefined): boolean => {
    if (!item) return key == null || key === 'none' || key === 'stacked' || key === MONOGRAM_OFF || key === PACK_NONE || key === 'base';
    const o = key != null ? byKey(item, key) : standardOf(item);
    if (!o) return false;
    picks[item.item_id] = [o.option_id];
    return true;
  };
  const real = config.tiers.filter((t) => t.kind === 'real');
  const displayCount = config.tiers.length - real.length;
  if (!set(card.real, realKey(real.length))) return null;
  if (card.display ? !set(card.display, displayKey(displayCount)) : displayCount > 0) return null;
  for (const [k, lineRow] of card.flavourLines.entries()) {
    if (!set(lineRow, real[k]?.flavourRef ?? null)) return null;
  }
  for (const [k, lineRow] of card.accentLines.entries()) {
    if (!set(lineRow, config.tiers[k]?.accent ?? 'none')) return null;
  }
  if (!set(card.arrangement, config.arrangement)) return null;
  if (!set(card.finish, config.finish)) return null;
  if (!set(card.flowing, config.flowing)) return null;
  if (!set(card.topper, config.topper)) return null;
  if (!set(card.monogram, config.monogram ? MONOGRAM_ON : MONOGRAM_OFF)) return null;
  if (!set(card.cupcakes, config.cupcakes?.packRef ?? PACK_NONE)) return null;
  if (card.cupcakeFlavour && !set(card.cupcakeFlavour, config.cupcakes?.match ? null : (config.cupcakes?.flavourRef ?? null))) return null;
  if (!set(card.cupcakeDisplay, config.cupcakes?.placement ?? 'base')) return null;
  return { selection: { picks }, removedItemIds: card.colours ? [card.colours.item_id] : [] };
}

/** The design's total — the SHIPPED `choiceTotals`, with the flag `lockPackage` reads. Null when it does not price. */
export function cakeConfigTotalCentavos(
  pkg: VendorPackageWithItems,
  card: CakeCard,
  config: CakeConfig,
  paxCount: number,
  creditEnabled: boolean = packageCreditEnabled(),
): number | null {
  const sel = cakeConfigSelection(card, config);
  if (!sel) return null;
  return choiceTotals({ pkg, removedItemIds: sel.removedItemIds, selection: sel.selection, creditEnabled, paxCount })?.bookingTotalCentavos ?? null;
}

/** The cupcakes a design asks for (0 = none). */
export const cupcakeCountOf = (config: CakeConfig) => packCountOf(config.cupcakes?.packRef) ?? 0;

/** A flavour key's words on this card ("Ube"). */
export function flavourLabelOn(card: CakeCard, key: string): string | null {
  return byKey(card.flavourLines[0] ?? null, key)?.option_label ?? null;
}

/* ──────────────────────────────────────────────────────────────────────── */
/* The design, as the supplier reads it                                     */
/* ──────────────────────────────────────────────────────────────────────── */

export const CAKE_DESIGN_HEAD = '🎂 Cake design · ';
/** The design's stored row, named on the message's last line so the card reads the row — never re-parses the text. */
export const CAKE_DESIGN_REF = 'Design ref: ';
export const CAKE_DESIGN_UNREADABLE = "We couldn't check your design against the shop's card, so nothing was sent. Reload the page and try again.";

export type CakeDesignLine = { label: string; extraCentavos: number };
export type CakeDesignTier = { name: string; kind: 'real' | 'display'; flavour: CakeDesignLine | null; accent: CakeDesignLine | null; cutting: boolean };

/** The design in words — what the received card and the order print beside the picture. */
export type CakeDesign = {
  cardName: string;
  tiers: CakeDesignTier[];
  realCount: number;
  displayCount: number;
  arrangement: CakeDesignLine | null;
  finish: CakeDesignLine | null;
  flowing: CakeDesignLine | null;
  topper: CakeDesignLine | null;
  monogram: CakeDesignLine | null;
  colours: { name: string; hex: string }[];
  message: string;
  instructions: string;
  cupcakes: { words: string; extraCentavos: number } | null;
  oneCentavos: number;
  estimateCentavos: number;
};

const lineOf = (item: VendorPackageItemRow | null, key: string | null | undefined): CakeDesignLine | null => {
  const o = byKey(item, key);
  return o ? { label: cleanCakeLabel(o.option_label), extraCentavos: o.price_delta_centavos } : null;
};

/** The design in the card's own words and prices. Pure — the estimate is passed in from the shipped pricer. */
export function cakeDesignOf(card: CakeCard, config: CakeConfig, opts: { cardName: string; oneCentavos: number; estimateCentavos: number }): CakeDesign {
  let realIndex = 0;
  const tiers: CakeDesignTier[] = config.tiers.map((t, i) => {
    const flavourLine = t.kind === 'real' ? card.flavourLines[realIndex++] ?? null : null;
    return {
      name: tierRowName(i),
      kind: t.kind,
      flavour: t.kind === 'real' ? lineOf(flavourLine, t.flavourRef) ?? (flavourLine ? lineOf(flavourLine, standardOf(flavourLine)?.look_key) : null) : null,
      accent: t.accent !== 'none' ? lineOf(card.accentLines[i] ?? null, t.accent) : null,
      cutting: i === config.cuttingTier,
    };
  });
  const real = config.tiers.filter((t) => t.kind === 'real').length;
  const pack = config.cupcakes ? byKey(card.cupcakes, config.cupcakes.packRef) : null;
  const cupFlavour = config.cupcakes && !config.cupcakes.match ? lineOf(card.cupcakeFlavour, config.cupcakes.flavourRef) : null;
  const tower = config.cupcakes?.placement === 'tower' ? lineOf(card.cupcakeDisplay, 'tower') : null;
  return {
    cardName: cleanCakeLabel(opts.cardName) || 'Cake',
    tiers,
    realCount: real,
    displayCount: config.tiers.length - real,
    arrangement: config.arrangement !== 'stacked' ? lineOf(card.arrangement, config.arrangement) : null,
    finish: lineOf(card.finish, config.finish),
    flowing: config.flowing !== 'none' ? lineOf(card.flowing, config.flowing) : null,
    topper: config.topper !== 'none' ? lineOf(card.topper, config.topper) : null,
    monogram: config.monogram
      ? { label: `On ${config.monogram === 'front' ? 'a layer' : config.monogram === 'topper' ? 'the topper' : 'the cake board'}`, extraCentavos: lineOf(card.monogram, MONOGRAM_ON)?.extraCentavos ?? 0 }
      : null,
    colours: config.colours.map((c) => ({ name: cleanCakeLabel(c.name), hex: c.hex })),
    message: config.message,
    instructions: config.instructions,
    cupcakes: pack
      ? {
          words: [
            cleanCakeLabel(pack.option_label),
            config.cupcakes!.match ? 'matching the cake' : cupFlavour?.label,
            config.cupcakes!.placement === 'tower' ? 'on a tower' : 'around the base',
          ]
            .filter(Boolean)
            .join(' · '),
          extraCentavos: pack.price_delta_centavos + (tower?.extraCentavos ?? 0),
        }
      : null,
    oneCentavos: opts.oneCentavos,
    estimateCentavos: opts.estimateCentavos,
  };
}

const withExtra = (l: CakeDesignLine) => (l.extraCentavos > 0 ? `${l.label} (+${formatCentavosPhp(l.extraCentavos)})` : l.label);

/** "3 real tiers + 1 display" */
export function tiersWords(d: Pick<CakeDesign, 'realCount' | 'displayCount'>): string {
  const real = d.realCount === 1 ? '1 real tier' : `${d.realCount} real tiers`;
  return d.displayCount > 0 ? `${real} + ${d.displayCount} display` : real;
}

/** The design as plain lines — the message text every chat shows, and the prefilled quote's note (ruling 8). */
export function cakeDesignLines(d: CakeDesign): string[] {
  const lines = [`Tiers: ${tiersWords(d)}`];
  const flavours = d.tiers.filter((t) => t.flavour).map((t) => withExtra(t.flavour!));
  if (flavours.length) lines.push(`Flavours, bottom → top: ${flavours.join(' · ')}`);
  const accents = d.tiers.filter((t) => t.accent).map((t) => `${t.name}: ${withExtra(t.accent!)}`);
  if (accents.length) lines.push(`Accents: ${accents.join(' · ')}`);
  if (d.arrangement) lines.push(`Arrangement: ${withExtra(d.arrangement)}`);
  if (d.finish) lines.push(`Finish: ${withExtra(d.finish)}`);
  if (d.flowing) lines.push(`Flowing accent: ${withExtra(d.flowing)}`);
  if (d.colours.length) lines.push(`Colours: ${d.colours.map((c) => c.name).join(' · ')}`);
  if (d.topper) lines.push(`Topper: ${withExtra(d.topper)}`);
  if (d.monogram) lines.push(`Monogram: ${withExtra(d.monogram)}`);
  if (d.message) lines.push(`Message: “${d.message}”`);
  if (d.cupcakes) lines.push(`Cupcakes: ${d.cupcakes.words}${d.cupcakes.extraCentavos > 0 ? ` (+${formatCentavosPhp(d.cupcakes.extraCentavos)})` : ''}`);
  if (d.instructions) lines.push(`Special instructions: ${d.instructions.replace(/[\r\n]+/g, ' ')}`);
  return lines;
}

/** The inquiry message's design block: readable as plain text anywhere, and naming its stored row last. */
export function formatCakeDesignBlock(d: CakeDesign, designId: string): string {
  return [
    `${CAKE_DESIGN_HEAD}${d.cardName}`,
    ...cakeDesignLines(d),
    `One price: ${formatCentavosPhp(d.oneCentavos)}`,
    `Estimate: ${formatCentavosPhp(d.estimateCentavos)} — from the one price and the extras picked. The quote decides.`,
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

/** The prefilled quote's note — the picks in the card's order (ruling 8). */
export function cakeQuoteNote(d: CakeDesign): string {
  return [d.cardName, ...cakeDesignLines(d)].join('\n').slice(0, 500);
}
