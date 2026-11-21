/**
 * 🎂 THE CAKE MAKER — pure rules (DECISION_LOG 2026-11-21 "CAKE MAKER — APPROVED TO BUILD"; drawing
 * prototypes/cake_maker_2026-11-21/cake_maker_fable.html).
 *
 * One cake card: the supplier sets the choices once ("Your cake options"), the couple designs their cake on it
 * ("Design your cake"), and the design arrives as one card in the chat and on the order ("A design arrives").
 *
 * ── RULE 0: EVERY CHOICE IS A SHIPPED PACKAGE LINE ─────────────────────────────────────────────────────────────────
 * The cake's options live on the card's OWN ★ Customization package (`vendor_packages.vendor_service_id`) as ordinary
 * `vendor_package_items` + `vendor_package_item_options` rows — Standard option at +₱0, extras in
 * `price_delta_centavos` (never below ₱0), "Choose 1–3" = `pick_min`/`pick_max`. The only new storage is the part tag
 * (`cake_part`), the Design photo (`photo_ref`) and the message cap (`vendor_questions.max_letters`) — migration
 * cake_maker_parts_photos_and_letters, which says what was checked first.
 *
 * ── FLAVOUR "FOR EACH TIER" IS FOLLOW-UP LINES (rulings 2 + 3) ─────────────────────────────────────────────────────
 * The supplier writes the flavour list ONCE. On save it is written under each size as one follow-up line per tier
 * (`parent_option_id` → that size's option): "3 tiers" carries "Flavour · bottom tier", "Flavour · tier 2",
 * "Flavour · tier 3". Each tier is its own line with its own pick, so the SHIPPED pricer charges a flavour extra once
 * for each tier it is picked for — no second pricer, no change to `computePackageCredit` or `lockPackage`.
 *
 * 🚨 NOTHING HERE PRICES ANYTHING. The estimate is `choiceTotals` — the same call the Book sheet and `lockPackage`
 * make. Every ₱ figure in a design message is a number that call returned, formatted.
 *
 * Plain data in, plain data out — no client, no DOM, no clock.
 */
import { formatCentavosPhp, type VendorPackageItemOptionRow, type VendorPackageItemRow, type VendorPackageWithItems } from './vendor-packages';
import type { DraftItem, DraftOption } from './package-authoring';
import { choiceTotals, type ChoiceSelection } from './package-choice-tree';

/* ──────────────────────────────────────────────────────────────────────── */
/* Which cards are cakes (ruling 10: cakes only)                            */
/* ──────────────────────────────────────────────────────────────────────── */

/** The cake kinds: the code taxonomy's `wedding_cake` and the legacy `cake` category. A dessert table is not a cake. */
export const CAKE_KINDS: ReadonlySet<string> = new Set(['wedding_cake', 'cake']);

export function isCakeKind(kind: string | null | undefined): boolean {
  return CAKE_KINDS.has(String(kind ?? '').trim());
}

/* ──────────────────────────────────────────────────────────────────────── */
/* The parts                                                                */
/* ──────────────────────────────────────────────────────────────────────── */

/** The DB CHECK (`vendor_package_items_cake_part_ck`) holds exactly these — `cake-maker.test.ts` pins the two together. */
export const CAKE_PARTS = ['tiers', 'flavour', 'finish', 'colours', 'design', 'topper'] as const;
export type CakePart = (typeof CAKE_PARTS)[number];

export function isCakePart(v: unknown): v is CakePart {
  return typeof v === 'string' && (CAKE_PARTS as readonly string[]).includes(v);
}

export const CAKE_MAX_TIERS = 6;
/** "Choose 1–3": the most colours a couple may pick, across their Mood Board and the shop's list together. */
export const CAKE_COLOURS_MAX = 3;
/** The message's longest answer when the supplier has not changed it ("Up to 40 letters"). */
export const CAKE_MESSAGE_LETTERS = 40;
export const CAKE_MESSAGE_LETTERS_MAX = 80;
export const CAKE_LABEL_MAX = 60;
/** A choice line needs two options (the shipped `choice_needs_two_options`); the editor holds at most this many. */
export const CAKE_CHOICES_MAX = 12;

/** The Form Maker template key of the cake's message question (ruling 5). */
export const CAKE_MESSAGE_FORM_KEY = 'cake_message';
export const CAKE_MESSAGE_PROMPT = 'Message on the cake';

export const CAKE_LINE_NAME: Record<Exclude<CakePart, 'flavour'>, string> = {
  tiers: 'Tiers',
  finish: 'Finish',
  colours: 'Colours',
  design: 'Design',
  topper: 'Topper',
};

export function tierLabel(n: number): string {
  return n === 1 ? '1 tier' : `${n} tiers`;
}

/** "Bottom tier" · "Tier 2" · … — the couple's row names, bottom first (the drawing's order). */
export function tierRowName(index: number): string {
  return index === 0 ? 'Bottom tier' : `Tier ${index + 1}`;
}

/** The stored line name of a tier's flavour line. */
export function flavourLineName(index: number): string {
  return index === 0 ? 'Flavour · bottom tier' : `Flavour · tier ${index + 1}`;
}

/** A size option's tier count, read off the label this module wrote ("3 tiers"). Null = not a size label. */
export function tierCountOf(label: string): number | null {
  const m = /^([1-6]) tiers?$/.exec(label.trim());
  return m ? Number(m[1]) : null;
}

/* ──────────────────────────────────────────────────────────────────────── */
/* The supplier's model — "Your cake options"                               */
/* ──────────────────────────────────────────────────────────────────────── */

export type CakeChoice = {
  /** Stable key while editing. */
  ref: string;
  label: string;
  /** EXTRA over the one price, whole centavos, never below 0. The Standard choice is always 0. */
  extraCentavos: number;
  standard: boolean;
  /** Design only — one photo from the shop's own portfolio (a readPortfolioPicks ref). */
  photoRef?: string | null;
};

export type CakeOptions = {
  tiers: {
    /** The sizes the shop makes, ascending, 1–6. At least two (one size is not a choice). */
    made: number[];
    /** The size the one price pays for — one of `made`. */
    standard: number;
    /** size → its extra in centavos. Missing = 0. The standard size is always 0. */
    extraCentavos: Record<string, number>;
  };
  /** Written once, asked for each tier. Null = the supplier swiped the part away. */
  flavours: CakeChoice[] | null;
  finish: CakeChoice[] | null;
  colours: { names: string[]; max: number } | null;
  design: CakeChoice[] | null;
  topper: CakeChoice[] | null;
  /** The Form Maker text question (ruling 5). Null = no message. */
  message: { maxLetters: number } | null;
};

const choice = (ref: string, label: string, standard = false): CakeChoice => ({ ref, label, extraCentavos: 0, standard });

/**
 * The cake template a new cake card opens with (drawing §01: "opening with the 7 cake lines already filled"). Every
 * extra starts at ₱0 — the supplier types their own; this module never guesses a price.
 */
export function cakeTemplate(): CakeOptions {
  return {
    tiers: { made: [1, 2, 3, 4, 5], standard: 3, extraCentavos: {} },
    flavours: [
      choice('fl-1', 'Vanilla chiffon', true),
      choice('fl-2', 'Chocolate'),
      choice('fl-3', 'Ube'),
      choice('fl-4', 'Mocha'),
      choice('fl-5', 'Red velvet'),
    ],
    finish: [choice('fi-1', 'Buttercream', true), choice('fi-2', 'Fondant'), choice('fi-3', 'Semi-naked')],
    colours: { names: ['Dusty rose', 'Sage', 'White', 'Blush', 'Burgundy', 'Lilac'], max: CAKE_COLOURS_MAX },
    design: [choice('de-1', 'Classic ribbon', true), choice('de-2', 'Floral cascade'), choice('de-3', 'Drip'), choice('de-4', 'Pearls')],
    topper: [choice('to-1', 'None', true), choice('to-2', 'Acrylic names'), choice('to-3', 'Fresh flowers'), choice('to-4', 'Figurine')],
    message: { maxLetters: CAKE_MESSAGE_LETTERS },
  };
}

/** Strip what would break the design message's own separators: line breaks, the "·" divider and the "(…)" note. */
export function cleanCakeLabel(raw: string): string {
  return raw.replace(/[\r\n]+/g, ' ').replace(/·/g, '-').replace(/[()]/g, '').replace(/\s+/g, ' ').trim().slice(0, CAKE_LABEL_MAX);
}

const isWholeCentavos = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;

/** The first problem with a set of cake options, as a sentence for the supplier — or null when it can be saved. */
export function cakeOptionsProblem(cake: CakeOptions): string | null {
  const made = cake.tiers.made;
  if (made.length < 2) return 'Tick at least 2 sizes you make.';
  if (made.some((n) => !Number.isInteger(n) || n < 1 || n > CAKE_MAX_TIERS)) return 'Sizes go from 1 to 6 tiers.';
  if (new Set(made).size !== made.length) return 'A size is ticked twice.';
  if (!made.includes(cake.tiers.standard)) return 'The size in the price has to be one you make.';
  for (const n of made) {
    const extra = cake.tiers.extraCentavos[String(n)] ?? 0;
    if (!isWholeCentavos(extra)) return `The extra for ${tierLabel(n)} can’t go below ₱0.`;
    if (n === cake.tiers.standard && extra !== 0) return 'The size in the price has no extra.';
  }
  const lists: [string, CakeChoice[] | null][] = [
    ['Flavour', cake.flavours],
    ['Finish', cake.finish],
    ['Design', cake.design],
    ['Topper', cake.topper],
  ];
  for (const [name, list] of lists) {
    if (!list) continue;
    if (list.length < 2) return `${name} needs at least 2 choices — or swipe it away.`;
    if (list.length > CAKE_CHOICES_MAX) return `${name} holds at most ${CAKE_CHOICES_MAX} choices.`;
    if (list.some((c) => !cleanCakeLabel(c.label))) return `Name every ${name.toLowerCase()} choice.`;
    if (list.filter((c) => c.standard).length !== 1) return `Pick one ${name.toLowerCase()} as Standard.`;
    if (list.some((c) => !isWholeCentavos(c.extraCentavos))) return `A ${name.toLowerCase()} extra can’t go below ₱0.`;
    if (list.some((c) => c.standard && c.extraCentavos !== 0)) return `The Standard ${name.toLowerCase()} has no extra.`;
    const seen = new Set(list.map((c) => cleanCakeLabel(c.label).toLowerCase()));
    if (seen.size !== list.length) return `Two ${name.toLowerCase()} choices have the same name.`;
  }
  if (cake.colours) {
    const names = cake.colours.names.map(cleanCakeLabel).filter(Boolean);
    if (names.length < 2) return 'Colours need at least 2 of your colours — or swipe it away.';
    if (names.length > CAKE_CHOICES_MAX) return `Colours hold at most ${CAKE_CHOICES_MAX} of your colours.`;
    if (new Set(names.map((n) => n.toLowerCase())).size !== names.length) return 'Two of your colours have the same name.';
    if (!Number.isInteger(cake.colours.max) || cake.colours.max < 1 || cake.colours.max > CAKE_COLOURS_MAX) {
      return `Couples pick 1 to ${CAKE_COLOURS_MAX} colours.`;
    }
  }
  if (cake.message) {
    const m = cake.message.maxLetters;
    if (!Number.isInteger(m) || m < 1 || m > CAKE_MESSAGE_LETTERS_MAX) return `A message holds 1 to ${CAKE_MESSAGE_LETTERS_MAX} letters.`;
  }
  return null;
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Cake options ⇄ package lines                                             */
/* ──────────────────────────────────────────────────────────────────────── */

function toDraftOptions(lineRef: string, list: ReadonlyArray<CakeChoice>, withPhoto: boolean): DraftOption[] {
  return list.map((c, i) => ({
    ref: `${lineRef}-o${i + 1}`,
    label: cleanCakeLabel(c.label),
    price_delta_centavos: c.standard ? 0 : c.extraCentavos,
    is_default: c.standard,
    is_available: true,
    ...(withPhoto && c.photoRef ? { photoRef: c.photoRef } : {}),
  }));
}

function topLine(ref: string, part: Exclude<CakePart, 'flavour'>, canonical: string, options: DraftOption[]): DraftItem {
  return {
    ref,
    service_description: CAKE_LINE_NAME[part],
    canonical_service: canonical,
    // A top-level choice is inside the price; its Standard option is what the one price already pays for.
    is_default_included: true,
    is_required: false,
    replacement_value_centavos: 0,
    options,
    parentRef: null,
    pickMin: null,
    pickMax: null,
    maxExtraHours: null,
    cakePart: part,
  };
}

/**
 * The cake options as the package lines `savePackage` writes, in the order the couple sees them. Call
 * {@link cakeOptionsProblem} first — this does not validate.
 */
export function cakeOptionsToDraftItems(cake: CakeOptions, canonicalService: string): DraftItem[] {
  const items: DraftItem[] = [];
  const made = [...cake.tiers.made].sort((a, b) => a - b);
  const sizeOptions: DraftOption[] = made.map((n) => ({
    ref: `cake-tiers-${n}`,
    label: tierLabel(n),
    price_delta_centavos: n === cake.tiers.standard ? 0 : (cake.tiers.extraCentavos[String(n)] ?? 0),
    is_default: n === cake.tiers.standard,
    is_available: true,
  }));
  items.push(topLine('cake-tiers', 'tiers', canonicalService, sizeOptions));

  if (cake.flavours) {
    for (const n of made) {
      for (let t = 0; t < n; t++) {
        const ref = `cake-fl-${n}-${t + 1}`;
        items.push({
          ref,
          service_description: flavourLineName(t),
          canonical_service: canonicalService,
          // A follow-up is never inside the price (DB-forced); its picked option's extra is real money.
          is_default_included: false,
          is_required: false,
          replacement_value_centavos: 0,
          options: toDraftOptions(ref, cake.flavours, false),
          parentRef: { itemRef: 'cake-tiers', optionRef: `cake-tiers-${n}` },
          pickMin: null,
          pickMax: null,
          maxExtraHours: null,
          cakePart: 'flavour',
        });
      }
    }
  }
  if (cake.finish) items.push(topLine('cake-finish', 'finish', canonicalService, toDraftOptions('cake-finish', cake.finish, false)));
  if (cake.colours) {
    const names = cake.colours.names.map(cleanCakeLabel).filter(Boolean);
    const line = topLine(
      'cake-colours',
      'colours',
      canonicalService,
      names.map((label, i) => ({ ref: `cake-colours-o${i + 1}`, label, price_delta_centavos: 0, is_default: i === 0, is_available: true })),
    );
    items.push({ ...line, pickMin: 1, pickMax: Math.min(cake.colours.max, names.length) });
  }
  if (cake.design) items.push(topLine('cake-design', 'design', canonicalService, toDraftOptions('cake-design', cake.design, true)));
  if (cake.topper) items.push(topLine('cake-topper', 'topper', canonicalService, toDraftOptions('cake-topper', cake.topper, false)));
  return items;
}

/** True when these lines are a cake card's options (they carry a tiers line). */
export function isCakeDraft(items: ReadonlyArray<DraftItem>): boolean {
  return items.some((i) => i.cakePart === 'tiers' && !i.parentRef);
}

/**
 * The stored package lines back into "Your cake options" — the editor on a saved card (ruling 9). Null when the lines
 * are not a cake (no tiers line). Flavours come from the first tier's line: every tier carries the same list.
 */
export function cakeOptionsFromDraftItems(items: ReadonlyArray<DraftItem>, message: { maxLetters: number } | null): CakeOptions | null {
  const tiers = items.find((i) => i.cakePart === 'tiers' && !i.parentRef);
  if (!tiers) return null;
  const sizes = tiers.options
    .map((o) => ({ o, n: tierCountOf(o.label) }))
    .filter((x): x is { o: DraftOption; n: number } => x.n !== null)
    .sort((a, b) => a.n - b.n);
  if (sizes.length === 0) return null;
  const standard = sizes.find((s) => s.o.is_default)?.n ?? sizes[0]!.n;
  const extraCentavos: Record<string, number> = {};
  for (const s of sizes) if (s.o.price_delta_centavos > 0) extraCentavos[String(s.n)] = s.o.price_delta_centavos;

  const back = (line: DraftItem | undefined, prefix: string, withPhoto: boolean): CakeChoice[] | null =>
    line
      ? line.options.map((o, i) => ({
          ref: `${prefix}-${i + 1}`,
          label: o.label,
          extraCentavos: o.is_default ? 0 : o.price_delta_centavos,
          standard: o.is_default,
          ...(withPhoto ? { photoRef: o.photoRef ?? null } : {}),
        }))
      : null;
  const firstFlavour = items.find((i) => i.cakePart === 'flavour');
  const top = (part: CakePart) => items.find((i) => i.cakePart === part && !i.parentRef);
  const colours = top('colours');
  return {
    tiers: { made: sizes.map((s) => s.n), standard, extraCentavos },
    flavours: back(firstFlavour, 'fl', false),
    finish: back(top('finish'), 'fi', false),
    colours: colours ? { names: colours.options.map((o) => o.label), max: Math.max(1, Math.min(CAKE_COLOURS_MAX, colours.pickMax ?? 1)) } : null,
    design: back(top('design'), 'de', true),
    topper: back(top('topper'), 'to', false),
    message,
  };
}

/** The photo refs a set of cake options carries — re-checked against the shop's own portfolio before a save. */
export function cakePhotoRefs(cake: CakeOptions): string[] {
  return (cake.design ?? []).map((c) => c.photoRef ?? '').filter((r) => r.length > 0);
}

/** The editor's wire format (one hidden field on the Card Maker's form). */
export const CAKE_OPTIONS_FIELD = 'cake_options';

export function serializeCakeOptions(cake: CakeOptions): string {
  return JSON.stringify({ v: 1, cake });
}

/** Total: never throws. Absent/blank → `{ ok: true, cake: null }` (no cake options on this form). */
export function parseCakeOptions(raw: unknown): { ok: true; cake: CakeOptions | null } | { ok: false; message: string } {
  if (raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '')) return { ok: true, cake: null };
  const unreadable = { ok: false as const, message: 'Your cake options could not be read. Open them and save again.' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(raw));
  } catch {
    return unreadable;
  }
  const c = (parsed as { cake?: unknown } | null)?.cake as Record<string, unknown> | undefined;
  if (!c || typeof c !== 'object') return unreadable;
  const tiers = c.tiers as Record<string, unknown> | undefined;
  if (!tiers || !Array.isArray(tiers.made) || typeof tiers.standard !== 'number' || typeof tiers.extraCentavos !== 'object' || !tiers.extraCentavos) {
    return unreadable;
  }
  const readList = (v: unknown, withPhoto: boolean): CakeChoice[] | null | 'bad' => {
    if (v === null || v === undefined) return null;
    if (!Array.isArray(v)) return 'bad';
    const out: CakeChoice[] = [];
    for (const [i, x] of v.entries()) {
      const r = x as Record<string, unknown>;
      if (!r || typeof r.label !== 'string' || !isWholeCentavos(r.extraCentavos) || typeof r.standard !== 'boolean') return 'bad';
      const photo = withPhoto && typeof r.photoRef === 'string' && r.photoRef.length > 0 && r.photoRef.length <= 500 ? r.photoRef : null;
      out.push({ ref: typeof r.ref === 'string' && r.ref ? r.ref.slice(0, 40) : `c${i + 1}`, label: r.label, extraCentavos: r.extraCentavos, standard: r.standard, ...(withPhoto ? { photoRef: photo } : {}) });
    }
    return out;
  };
  const flavours = readList(c.flavours, false);
  const finish = readList(c.finish, false);
  const design = readList(c.design, true);
  const topper = readList(c.topper, false);
  if (flavours === 'bad' || finish === 'bad' || design === 'bad' || topper === 'bad') return unreadable;
  let colours: CakeOptions['colours'] = null;
  if (c.colours !== null && c.colours !== undefined) {
    const col = c.colours as Record<string, unknown>;
    if (!Array.isArray(col.names) || col.names.some((n) => typeof n !== 'string') || typeof col.max !== 'number') return unreadable;
    colours = { names: col.names as string[], max: col.max };
  }
  let message: CakeOptions['message'] = null;
  if (c.message !== null && c.message !== undefined) {
    const m = c.message as Record<string, unknown>;
    if (typeof m.maxLetters !== 'number') return unreadable;
    message = { maxLetters: m.maxLetters };
  }
  const extra: Record<string, number> = {};
  for (const [k, v] of Object.entries(tiers.extraCentavos as Record<string, unknown>)) {
    if (!isWholeCentavos(v)) return unreadable;
    extra[k] = v;
  }
  const cake: CakeOptions = {
    tiers: { made: (tiers.made as unknown[]).map(Number), standard: tiers.standard, extraCentavos: extra },
    flavours,
    finish,
    colours,
    design,
    topper,
    message,
  };
  const problem = cakeOptionsProblem(cake);
  return problem ? { ok: false, message: problem } : { ok: true, cake };
}

/* ──────────────────────────────────────────────────────────────────────── */
/* The couple's side — "Design your cake"                                   */
/* ──────────────────────────────────────────────────────────────────────── */

export type CakeSize = { option: VendorPackageItemOptionRow; tiers: number; flavourLines: VendorPackageItemRow[] };

export type CakeCard = {
  tiersLine: VendorPackageItemRow;
  sizes: CakeSize[];
  finish: VendorPackageItemRow | null;
  colours: VendorPackageItemRow | null;
  design: VendorPackageItemRow | null;
  topper: VendorPackageItemRow | null;
};

const available = (item: VendorPackageItemRow | undefined | null) => (item?.options ?? []).filter((o) => o.is_available);

/** The package read as a cake, or null when it is not one (no tiers line → the shipped Book sheet draws). */
export function readCakeCard(pkg: VendorPackageWithItems): CakeCard | null {
  const items = pkg.items;
  const tiersLine = items.find((i) => i.cake_part === 'tiers' && !i.parent_option_id);
  if (!tiersLine) return null;
  const sizes: CakeSize[] = available(tiersLine)
    .map((option) => ({
      option,
      tiers: tierCountOf(option.option_label) ?? 0,
      flavourLines: items
        .filter((i) => i.cake_part === 'flavour' && i.parent_option_id === option.option_id)
        .sort((a, b) => a.display_order - b.display_order),
    }))
    .filter((s) => s.tiers > 0)
    .sort((a, b) => a.tiers - b.tiers);
  if (sizes.length === 0) return null;
  const top = (part: CakePart) => items.find((i) => i.cake_part === part && !i.parent_option_id) ?? null;
  return { tiersLine, sizes, finish: top('finish'), colours: top('colours'), design: top('design'), topper: top('topper') };
}

/** A colour the couple picked: one of the shop's options, or one of their own Mood Board colours (ruling 6). */
export type CakeColourPick = { kind: 'shop'; optionId: string } | { kind: 'mood'; name: string; hex: string };

export type CakeDesignState = {
  sizeOptionId: string;
  /** Flavour line id → the option picked on it (one per tier of the chosen size). */
  flavours: Record<string, string>;
  finishOptionId: string | null;
  colours: CakeColourPick[];
  designOptionId: string | null;
  topperOptionId: string | null;
  message: string;
};

const defaultOf = (item: VendorPackageItemRow | null) => {
  const opts = available(item);
  return (opts.find((o) => o.is_default) ?? opts[0])?.option_id ?? null;
};

/** The design a couple starts on: 3 tiers when the shop makes it (the drawing), else the Standard size; every Standard. */
export function startingCakeDesign(card: CakeCard): CakeDesignState {
  const start = card.sizes.find((s) => s.tiers === 3) ?? card.sizes.find((s) => s.option.is_default) ?? card.sizes[0]!;
  return {
    sizeOptionId: start.option.option_id,
    flavours: flavoursFor(start, {}),
    finishOptionId: defaultOf(card.finish),
    colours: [],
    designOptionId: defaultOf(card.design),
    topperOptionId: defaultOf(card.topper),
    message: '',
  };
}

/**
 * The flavour picks for a size: each tier keeps the flavour the couple already gave the tier at the same height
 * (moving from 3 to 4 tiers keeps the bottom three), and a new tier starts on Standard.
 */
export function flavoursFor(size: CakeSize, previousByIndex: Record<number, string>): Record<string, string> {
  const out: Record<string, string> = {};
  size.flavourLines.forEach((line, i) => {
    const opts = available(line);
    const wantLabel = previousByIndex[i];
    const keep = wantLabel ? opts.find((o) => o.option_label === wantLabel) : undefined;
    const pick = keep ?? opts.find((o) => o.is_default) ?? opts[0];
    if (pick) out[line.item_id] = pick.option_id;
  });
  return out;
}

/** The flavour LABELS by tier height, bottom first — what {@link flavoursFor} carries across a size change. */
export function flavourLabelsByIndex(card: CakeCard, state: CakeDesignState): Record<number, string> {
  const size = card.sizes.find((s) => s.option.option_id === state.sizeOptionId);
  const out: Record<number, string> = {};
  size?.flavourLines.forEach((line, i) => {
    const o = available(line).find((x) => x.option_id === state.flavours[line.item_id]);
    if (o) out[i] = o.option_label;
  });
  return out;
}

export function sizeOf(card: CakeCard, state: CakeDesignState): CakeSize | null {
  return card.sizes.find((s) => s.option.option_id === state.sizeOptionId) ?? null;
}

/** Over the colour cap — "Pick up to 3 — untick one to send your design." */
export function coloursOverCap(card: CakeCard, state: CakeDesignState): boolean {
  return state.colours.length > colourCapOf(card);
}

/** The colour cap: the shop's "Choose 1–N" (the colours line's pick_max), never over 3. */
export function colourCapOf(card: CakeCard): number {
  return Math.max(1, Math.min(CAKE_COLOURS_MAX, card.colours?.pick_max ?? CAKE_COLOURS_MAX));
}

/**
 * The design as the SHIPPED selection the pricer and `lockPackage` read. The shop's colours are picks on the colours
 * line; when the couple picked only their own Mood Board colours, the colours line is REMOVED (its replacement value is
 * ₱0, so the total does not move) — otherwise its "pick at least 1" would refuse a design the couple finished.
 */
export function cakeSelection(card: CakeCard, state: CakeDesignState): { selection: ChoiceSelection; removedItemIds: string[] } {
  const picks: Record<string, string[]> = { [card.tiersLine.item_id]: [state.sizeOptionId] };
  const size = sizeOf(card, state);
  for (const line of size?.flavourLines ?? []) {
    const id = state.flavours[line.item_id];
    if (id) picks[line.item_id] = [id];
  }
  if (card.finish && state.finishOptionId) picks[card.finish.item_id] = [state.finishOptionId];
  if (card.design && state.designOptionId) picks[card.design.item_id] = [state.designOptionId];
  if (card.topper && state.topperOptionId) picks[card.topper.item_id] = [state.topperOptionId];
  const removed: string[] = [];
  if (card.colours) {
    const shop = state.colours.flatMap((c) => (c.kind === 'shop' ? [c.optionId] : []));
    if (shop.length > 0) picks[card.colours.item_id] = shop;
    else removed.push(card.colours.item_id);
  }
  return { selection: { picks }, removedItemIds: removed };
}

/** The live total — the SHIPPED `choiceTotals`. Null when the pricer refuses (the sheet then blocks Send and Book). */
export function cakeTotalCentavos(pkg: VendorPackageWithItems, card: CakeCard, state: CakeDesignState, paxCount: number): number | null {
  const { selection, removedItemIds } = cakeSelection(card, state);
  return choiceTotals({ pkg, removedItemIds, selection, creditEnabled: false, paxCount })?.bookingTotalCentavos ?? null;
}

/* ──────────────────────────────────────────────────────────────────────── */
/* The design, as the message the supplier receives                         */
/* ──────────────────────────────────────────────────────────────────────── */

export const CAKE_DESIGN_HEAD = '🎂 Cake design · ';
export const CAKE_MOOD_NOTE = '(Mood Board)';
const ESTIMATE_TAIL = ' — from the one price and the extras picked. The quote decides.';

export type CakeDesignLine = { label: string; extraCentavos: number };

export type CakeDesign = {
  cardName: string;
  tiers: string;
  /** Bottom → top. */
  flavours: CakeDesignLine[];
  finish: CakeDesignLine | null;
  colours: { name: string; mood: boolean }[];
  design: CakeDesignLine | null;
  topper: CakeDesignLine | null;
  message: string;
  oneCentavos: number;
  estimateCentavos: number;
};

const pickLine = (item: VendorPackageItemRow | null, optionId: string | null): CakeDesignLine | null => {
  if (!item || !optionId) return null;
  const o = available(item).find((x) => x.option_id === optionId);
  return o ? { label: cleanCakeLabel(o.option_label), extraCentavos: o.price_delta_centavos } : null;
};

/** Clean a couple-typed message: one line, no quote marks of ours, at most `max` letters. */
export function cleanCakeMessage(raw: string, max: number): string {
  return Array.from(raw.replace(/[\r\n]+/g, ' ').replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim()).slice(0, max).join('');
}

/**
 * The design, re-read from the package (never from the browser's words): labels from the rows, the estimate from the
 * shipped pricer. Null when the design does not price (an option gone, the pricer refused).
 */
export function cakeDesignOf(
  pkg: VendorPackageWithItems,
  card: CakeCard,
  state: CakeDesignState,
  opts: { cardName: string; messageMax: number; paxCount: number },
): CakeDesign | null {
  const size = sizeOf(card, state);
  if (!size) return null;
  const estimate = cakeTotalCentavos(pkg, card, state, opts.paxCount);
  if (estimate === null) return null;
  const flavours = size.flavourLines.map((line) => pickLine(line, state.flavours[line.item_id] ?? null)).filter((x): x is CakeDesignLine => x !== null);
  const colours = state.colours
    .map((c) => {
      if (c.kind === 'mood') return { name: cleanCakeLabel(c.name), mood: true };
      const o = available(card.colours).find((x) => x.option_id === c.optionId);
      return o ? { name: cleanCakeLabel(o.option_label), mood: false } : null;
    })
    .filter((x): x is { name: string; mood: boolean } => x !== null && x.name.length > 0)
    .slice(0, colourCapOf(card));
  return {
    cardName: cleanCakeLabel(opts.cardName) || 'Cake',
    tiers: size.option.option_label,
    flavours,
    finish: pickLine(card.finish, state.finishOptionId),
    colours,
    design: pickLine(card.design, state.designOptionId),
    topper: pickLine(card.topper, state.topperOptionId),
    message: cleanCakeMessage(state.message, opts.messageMax),
    oneCentavos: pkg.total_price_centavos,
    estimateCentavos: estimate,
  };
}

const withExtra = (l: CakeDesignLine) => (l.extraCentavos > 0 ? `${l.label} (+${formatCentavosPhp(l.extraCentavos)})` : l.label);

/** The design as the lines of the inquiry message. Readable as plain text anywhere a message is shown. */
export function formatCakeDesignBlock(d: CakeDesign): string {
  const lines = [`${CAKE_DESIGN_HEAD}${d.cardName}`, `Tiers: ${d.tiers}`];
  if (d.flavours.length > 0) lines.push(`Flavours, bottom → top: ${d.flavours.map(withExtra).join(' · ')}`);
  if (d.finish) lines.push(`Finish: ${withExtra(d.finish)}`);
  if (d.colours.length > 0) lines.push(`Colours: ${d.colours.map((c) => (c.mood ? `${c.name} ${CAKE_MOOD_NOTE}` : c.name)).join(' · ')}`);
  if (d.design) lines.push(`Design: ${withExtra(d.design)}`);
  if (d.topper) lines.push(`Topper: ${withExtra(d.topper)}`);
  if (d.message) lines.push(`Message: “${d.message}”`);
  lines.push(`One price: ${formatCentavosPhp(d.oneCentavos)}`);
  lines.push(`Estimate: ${formatCentavosPhp(d.estimateCentavos)}${ESTIMATE_TAIL}`);
  return lines.join('\n');
}

/** "₱12,000" / "₱12,000.50" → centavos; anything else → null. */
export function pesoWordsToCentavos(words: string): number | null {
  const m = /^₱(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d{2}))?$/.exec(words.trim());
  if (!m) return null;
  return Number(m[1]!.replace(/,/g, '')) * 100 + (m[2] ? Number(m[2]) : 0);
}

function readPickWords(raw: string): CakeDesignLine | null {
  const s = raw.trim();
  if (!s) return null;
  const m = /^(.*?) \(\+(₱[\d,]+(?:\.\d{2})?)\)$/.exec(s);
  if (m) {
    const c = pesoWordsToCentavos(m[2]!);
    return c === null ? null : { label: m[1]!, extraCentavos: c };
  }
  return { label: s, extraCentavos: 0 };
}

/**
 * The design back out of a message body (the supplier's card, the order page, the prefilled quote). Exact words, never
 * guessed: a body without the head line, or whose block misses its tiers, one price or estimate, is NOT a design (null).
 */
export function parseCakeDesignBlock(body: string | null | undefined): CakeDesign | null {
  const all = (body ?? '').split('\n');
  const start = all.findIndex((l) => l.startsWith(CAKE_DESIGN_HEAD));
  if (start < 0) return null;
  const d: CakeDesign = {
    cardName: all[start]!.slice(CAKE_DESIGN_HEAD.length).trim(),
    tiers: '',
    flavours: [],
    finish: null,
    colours: [],
    design: null,
    topper: null,
    message: '',
    oneCentavos: -1,
    estimateCentavos: -1,
  };
  for (const line of all.slice(start + 1)) {
    const m = /^([A-Za-z ,→]+?): (.*)$/.exec(line);
    if (!m) break;
    const [, key, value] = m as unknown as [string, string, string];
    if (key === 'Tiers') d.tiers = value.trim();
    else if (key === 'Flavours, bottom → top') d.flavours = value.split(' · ').map(readPickWords).filter((x): x is CakeDesignLine => x !== null);
    else if (key === 'Finish') d.finish = readPickWords(value);
    else if (key === 'Colours')
      d.colours = value
        .split(' · ')
        .map((c) => c.trim())
        .filter(Boolean)
        .map((c) => (c.endsWith(` ${CAKE_MOOD_NOTE}`) ? { name: c.slice(0, -CAKE_MOOD_NOTE.length - 1), mood: true } : { name: c, mood: false }));
    else if (key === 'Design') d.design = readPickWords(value);
    else if (key === 'Topper') d.topper = readPickWords(value);
    else if (key === 'Message') d.message = value.replace(/^“|”$/g, '');
    else if (key === 'One price') d.oneCentavos = pesoWordsToCentavos(value) ?? -1;
    else if (key === 'Estimate') {
      const words = value.endsWith(ESTIMATE_TAIL) ? value.slice(0, -ESTIMATE_TAIL.length) : value;
      d.estimateCentavos = pesoWordsToCentavos(words) ?? -1;
    } else break;
  }
  if (!d.cardName || !d.tiers || d.oneCentavos < 0 || d.estimateCentavos < 0) return null;
  return d;
}

/** "Ube · Chocolate · Vanilla chiffon" — the supplier card's Flavours row (bottom → top). */
export function flavoursWords(d: CakeDesign): string {
  return d.flavours.map((f) => f.label).join(' · ');
}

/** The prefilled quote's note — the picks, in the card's order (ruling 8). */
export function cakeQuoteNote(d: CakeDesign): string {
  const parts = [`${d.cardName} · ${d.tiers}`];
  if (d.flavours.length) parts.push(`Flavours, bottom → top: ${flavoursWords(d)}`);
  if (d.finish) parts.push(`Finish: ${d.finish.label}`);
  if (d.colours.length) parts.push(`Colours: ${d.colours.map((c) => c.name).join(' · ')}`);
  if (d.design) parts.push(`Design: ${d.design.label}`);
  if (d.topper) parts.push(`Topper: ${d.topper.label}`);
  if (d.message) parts.push(`Message: “${d.message}”`);
  return parts.join('\n').slice(0, 500);
}
