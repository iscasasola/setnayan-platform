/**
 * SERVICE CUSTOMIZATION DRAFT — the wire format, the state machine, and the
 * money formatting for the wizard's ★ Customization step.
 *
 * ── WHY THIS MODULE EXISTS AT ALL ───────────────────────────────────────────
 * The couple meets ONE card, so the vendor meets ONE maker. The shipped
 * package authoring surface (`/vendor-dashboard/packages`) can already express
 * everything the couple-side configurator renders — choices, options, pick-N,
 * follow-ups, extra-hour caps — but it lives on its own route, behind its own
 * navigation, describing a "package" the vendor never set out to build. This
 * module is the seam that lets the SAME machinery be driven from inside the
 * service wizard, without a second schema and without a second validator.
 *
 * Nothing here is new grammar. `DraftItem` / `DraftOption` /
 * `validatePackageDraft` / `planItemInsertOrder` are all reused verbatim from
 * ./package-authoring; `savePackage` is reused verbatim from the packages
 * route. What this file adds is exactly four things the wizard needs and the
 * standalone editor does not:
 *
 *   1. a FORMDATA-SAFE wire format, because the wizard is ONE <form> whose
 *      steps are all mounted at once and submitted together;
 *   2. a DEFENSIVE parser for it, because a server action must never throw on
 *      a malformed payload and must never silently save an empty structure;
 *   3. the LINE-STATE machine (required / included / optional / choice /
 *      quantity) and its grouping, which is the vendor-facing vocabulary the
 *      raw boolean columns do not speak;
 *   4. AMOUNT-ONLY money formatting — the vendor types digits, never the word
 *      "included" (owner-locked).
 *
 * Pure: no I/O, no env, no clock, no React. Both the client step and the
 * server action import it, which is the point — one definition of the wire
 * format on both ends of the wire.
 */

import type { DraftItem, DraftOption, DraftPackage } from './package-authoring';
import { autoName } from './service-text-integrity';
import { PACKAGE_CANONICAL_TO_VENDOR_CATEGORY } from './vendor-packages';
import type { VendorCategory } from './vendors';

/* ────────────────────────────────────────────────────────────────────────── */
/* THE WIRE                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * The single hidden field the ★ Customization step contributes to the wizard's
 * FormData.
 *
 * ── WHY ONE JSON FIELD AND NOT THE SHIPPED REPEATER GRAMMAR ────────────────
 * `service-list-editors.tsx` establishes this repo's repeater idiom:
 * index-aligned hidden inputs read back with `formData.getAll(name)`. That
 * idiom is correct for FLAT lists (inclusions, discounts, brackets) and it is
 * deliberately NOT used here, for two reasons that are structural rather than
 * stylistic:
 *
 *   • The structure is RECURSIVE. Options nest inside lines, and a follow-up
 *     line points at one specific option on another line by ref. `getAll()`
 *     returns parallel arrays whose alignment is only meaningful when every
 *     row contributes exactly one entry per field — which stops being true the
 *     moment line 1 has two options and line 2 has five. Recovering the tree
 *     would mean inventing a ref-encoding scheme inside field NAMES, which is
 *     a second serialisation format wearing a costume.
 *
 *   • The target type already exists. `savePackage` accepts a `DraftPackage`.
 *     JSON round-trips that type exactly, so there is no translation layer to
 *     drift: what the client validated is byte-for-byte what the server
 *     validates again.
 *
 * The cost of JSON is that a malformed payload is possible, which is why
 * {@link parseCustomizationDraft} exists and is total.
 */
export const CUSTOMIZATION_FIELD_NAME = 'customization_draft';

/**
 * Wire-format version. Bumped only on a BREAKING shape change.
 *
 * A version that does not match is REFUSED, never coerced. A vendor holding a
 * stale tab open across a deploy would otherwise post an old shape that
 * happens to parse into a different meaning — and the write path deletes and
 * re-inserts a package's rows wholesale, so "parsed into a different meaning"
 * is a data-loss shape, not a cosmetic one.
 */
export const CUSTOMIZATION_DRAFT_VERSION = 1;

/**
 * Hard ceilings on a submitted payload.
 *
 * Not a product rule — a DoS guard. The write path is a loop of INSERTs per
 * level, so an unbounded payload is unbounded database work performed on
 * behalf of one form post. The numbers are far above any plausible authoring
 * session (a hotel's fattest wedding package is ~40 lines) and far below
 * anything expensive.
 */
export const MAX_CUSTOMIZATION_ITEMS = 60;
export const MAX_OPTIONS_PER_ITEM = 30;

export type ServiceCustomizationDraft = {
  v: number;
  items: DraftItem[];
};

export type ParseCustomizationResult =
  | { ok: true; items: DraftItem[] }
  /** A readable sentence for the vendor. Never a stack trace, never a code. */
  | { ok: false; message: string };

/** The wire string for a set of lines. Empty list → empty string (field absent). */
export function serializeCustomizationDraft(items: ReadonlyArray<DraftItem>): string {
  if (items.length === 0) return '';
  const payload: ServiceCustomizationDraft = {
    v: CUSTOMIZATION_DRAFT_VERSION,
    // Normalised on the way out so the wire carries exactly the fields the
    // parser expects — an `undefined` branching field and an explicit `null`
    // must not produce two different wire strings for the same draft.
    items: items.map(normaliseItem),
  };
  return JSON.stringify(payload);
}

function normaliseItem(i: DraftItem): DraftItem {
  return {
    ref: i.ref,
    service_description: i.service_description,
    canonical_service: i.canonical_service,
    is_default_included: i.is_default_included,
    is_required: i.is_required,
    replacement_value_centavos: i.replacement_value_centavos,
    options: i.options.map((o) => ({
      ref: o.ref,
      label: o.label,
      price_delta_centavos: o.price_delta_centavos,
      is_default: o.is_default,
      is_available: o.is_available,
    })),
    parentRef: i.parentRef ?? null,
    pickMin: i.pickMin ?? null,
    pickMax: i.pickMax ?? null,
    maxExtraHours: i.maxExtraHours ?? null,
  };
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isWholeNonNegative = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v) && v >= 0;

const isNonEmptyString = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0;

/** `null` | absent → null; anything else must be a whole non-negative number. */
function readOptionalWhole(
  v: unknown,
  label: string,
  problems: string[],
): number | null {
  if (v === null || v === undefined) return null;
  if (!isWholeNonNegative(v)) {
    problems.push(`${label} is not a whole number.`);
    return null;
  }
  return v;
}

/**
 * Turn a submitted field into lines, or into a sentence the vendor can act on.
 *
 * TOTAL BY CONSTRUCTION — this function does not throw, for any input. The
 * caller is a server action whose failure mode is a redirect, and an exception
 * escaping here would surface as a 500 on a form the vendor just spent ten
 * minutes filling.
 *
 * ABSENT IS NOT MALFORMED. A missing or blank field means "this vendor did not
 * author any customization", which is the overwhelmingly common case (and the
 * only case while the flag is off). It returns `ok: true` with an EMPTY list,
 * and the caller writes no package at all. It must never be reported as an
 * error, and it must never be turned into an empty-but-real package: an empty
 * package renders an empty configurator on the couple side.
 */
export function parseCustomizationDraft(raw: unknown): ParseCustomizationResult {
  if (raw === null || raw === undefined) return { ok: true, items: [] };
  if (typeof raw !== 'string') {
    return {
      ok: false,
      message: 'The customization options could not be read. Reload the page and try again.',
    };
  }
  const text = raw.trim();
  if (text.length === 0) return { ok: true, items: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      ok: false,
      message:
        'The customization options were sent in a form we could not read, so nothing was saved. Reload the page and set them again.',
    };
  }

  if (!isPlainObject(parsed)) {
    return {
      ok: false,
      message: 'The customization options were sent in an unexpected shape, so nothing was saved.',
    };
  }
  if (parsed.v !== CUSTOMIZATION_DRAFT_VERSION) {
    return {
      ok: false,
      message:
        'This page is out of date, so your customization options were not saved. Reload the page and set them again.',
    };
  }
  if (!Array.isArray(parsed.items)) {
    return {
      ok: false,
      message: 'The customization options were sent without a list of lines, so nothing was saved.',
    };
  }
  if (parsed.items.length > MAX_CUSTOMIZATION_ITEMS) {
    return {
      ok: false,
      message: `A service can carry up to ${MAX_CUSTOMIZATION_ITEMS} customization lines. Remove a few and save again.`,
    };
  }

  const problems: string[] = [];
  const items: DraftItem[] = [];
  const seenItemRefs = new Set<string>();
  const seenOptionRefs = new Set<string>();

  parsed.items.forEach((rawItem: unknown, idx: number) => {
    const where = `Line ${idx + 1}`;
    if (!isPlainObject(rawItem)) {
      problems.push(`${where} could not be read.`);
      return;
    }

    if (!isNonEmptyString(rawItem.ref)) {
      problems.push(`${where} is missing its identifier.`);
      return;
    }
    // DUPLICATE REFS ARE FATAL, not cosmetic. `planItemInsertOrder` and
    // `validatePackageDraft` both build `Map`s keyed by ref; a duplicate
    // silently makes one of the two lines invisible to the parent/cycle checks,
    // which is precisely the guard that stops a follow-up being written as a
    // top-level line every couple pays for.
    if (seenItemRefs.has(rawItem.ref)) {
      problems.push(`${where} repeats an identifier used by another line.`);
      return;
    }
    seenItemRefs.add(rawItem.ref);

    if (typeof rawItem.service_description !== 'string') {
      problems.push(`${where} has no name field.`);
      return;
    }
    if (!isNonEmptyString(rawItem.canonical_service)) {
      problems.push(`${where} is missing its category.`);
      return;
    }
    if (
      typeof rawItem.is_default_included !== 'boolean' ||
      typeof rawItem.is_required !== 'boolean'
    ) {
      problems.push(`${where} has an unreadable included/required setting.`);
      return;
    }
    if (!isWholeNonNegative(rawItem.replacement_value_centavos)) {
      problems.push(`${where} has an unreadable amount.`);
      return;
    }
    if (!Array.isArray(rawItem.options)) {
      problems.push(`${where} has an unreadable list of options.`);
      return;
    }
    if (rawItem.options.length > MAX_OPTIONS_PER_ITEM) {
      problems.push(`${where} has more than ${MAX_OPTIONS_PER_ITEM} options.`);
      return;
    }

    const options: DraftOption[] = [];
    let optionsOk = true;
    rawItem.options.forEach((rawOpt: unknown, oIdx: number) => {
      const optWhere = `${where}, option ${oIdx + 1}`;
      if (!isPlainObject(rawOpt)) {
        problems.push(`${optWhere} could not be read.`);
        optionsOk = false;
        return;
      }
      if (!isNonEmptyString(rawOpt.ref)) {
        problems.push(`${optWhere} is missing its identifier.`);
        optionsOk = false;
        return;
      }
      // An option ref must be unique across the WHOLE draft, not just its own
      // line: `parentRef.optionRef` is resolved through one flat
      // optionRef → owning-itemRef map, so a collision would attach a
      // follow-up to whichever line happened to be walked last.
      if (seenOptionRefs.has(rawOpt.ref)) {
        problems.push(`${optWhere} repeats an identifier used by another option.`);
        optionsOk = false;
        return;
      }
      seenOptionRefs.add(rawOpt.ref);
      if (typeof rawOpt.label !== 'string') {
        problems.push(`${optWhere} has no name field.`);
        optionsOk = false;
        return;
      }
      if (!isWholeNonNegative(rawOpt.price_delta_centavos)) {
        problems.push(`${optWhere} has an unreadable price.`);
        optionsOk = false;
        return;
      }
      if (
        typeof rawOpt.is_default !== 'boolean' ||
        typeof rawOpt.is_available !== 'boolean'
      ) {
        problems.push(`${optWhere} has an unreadable standard/available setting.`);
        optionsOk = false;
        return;
      }
      options.push({
        ref: rawOpt.ref,
        label: rawOpt.label,
        price_delta_centavos: rawOpt.price_delta_centavos,
        is_default: rawOpt.is_default,
        is_available: rawOpt.is_available,
      });
    });
    if (!optionsOk) return;

    let parentRef: DraftItem['parentRef'] = null;
    if (rawItem.parentRef !== null && rawItem.parentRef !== undefined) {
      const p = rawItem.parentRef;
      if (!isPlainObject(p) || !isNonEmptyString(p.itemRef) || !isNonEmptyString(p.optionRef)) {
        problems.push(`${where} points at a follow-up parent we could not read.`);
        return;
      }
      parentRef = { itemRef: p.itemRef, optionRef: p.optionRef };
    }

    const before = problems.length;
    const pickMin = readOptionalWhole(rawItem.pickMin, `${where}'s smallest number of picks`, problems);
    const pickMax = readOptionalWhole(rawItem.pickMax, `${where}'s largest number of picks`, problems);
    const maxExtraHours = readOptionalWhole(rawItem.maxExtraHours, `${where}'s limit`, problems);
    if (problems.length !== before) return;

    items.push({
      ref: rawItem.ref,
      service_description: rawItem.service_description,
      canonical_service: rawItem.canonical_service,
      is_default_included: rawItem.is_default_included,
      is_required: rawItem.is_required,
      replacement_value_centavos: rawItem.replacement_value_centavos,
      options,
      parentRef,
      pickMin,
      pickMax,
      maxExtraHours,
    });
  });

  const first = problems[0];
  if (first !== undefined) {
    // FIRST PROBLEM WINS, plus a count. The save paths bounce with a single
    // `?error=` string, so one sentence naming one line beats a concatenated
    // list nobody reads — and the count tells the vendor there is more.
    const more = problems.length > 1 ? ` (${problems.length - 1} more like it.)` : '';
    return { ok: false, message: `${first}${more} Nothing was saved.` };
  }

  return { ok: true, items };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* BLANK NAMES ARE FILLED IN, NEVER REFUSED (owner-locked 2026-07-27)          */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * The name a blank line/option will be saved under. This is what the field
 * shows as its PLACEHOLDER while the vendor is still typing.
 *
 * Deliberately delegates to the shipped `autoName` rather than re-deriving the
 * string: the placeholder the vendor reads and the name the server writes must
 * be the same words, or the placeholder is a lie.
 */
export function autoNamePlaceholder(kind: 'item' | 'option', index: number): string {
  return autoName(kind, index);
}

/**
 * Fill every blank name, in the SAME index basis `savePackage` uses.
 *
 * ── WHY THIS RUNS BEFORE VALIDATION AND NOT INSIDE savePackage ─────────────
 * `savePackage` already auto-names — but it does so AFTER
 * `validatePackageDraft`, and the validator refuses a blank
 * `service_description` outright (`item_description_empty`). So on the shipped
 * path a blank OPTION is named and a blank LINE is bounced. That asymmetry is
 * documented in `packages/actions.ts` and is fine for the standalone editor,
 * whose vendor is deliberately building a package.
 *
 * The wizard's vendor is not: they are adding a line to a service card, and the
 * owner ruling is that a blank name is auto-named, NEVER refused. Naming here —
 * before the draft is ever validated — makes that true without touching the
 * shared validator or `savePackage`, so the packages route keeps its exact
 * behaviour. `savePackage`'s own auto-naming then finds nothing left to do,
 * which is the correct relationship between a belt and a brace.
 */
export function autoNameDraftItems(items: ReadonlyArray<DraftItem>): DraftItem[] {
  return items.map((item, i) => ({
    ...item,
    service_description:
      item.service_description.trim().length > 0
        ? item.service_description
        : autoName('item', i),
    options: item.options.map((o, j) => ({
      ...o,
      label: o.label.trim().length > 0 ? o.label : autoName('option', j),
    })),
  }));
}

/** How many names the save is about to fill in. Reported back to the vendor. */
export function countAutoNamed(items: ReadonlyArray<DraftItem>): number {
  let n = 0;
  for (const item of items) {
    if (item.service_description.trim().length === 0) n += 1;
    for (const o of item.options) if (o.label.trim().length === 0) n += 1;
  }
  return n;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* MONEY — AMOUNT ONLY, GROUPED, AND "included" IS NEVER TYPED                */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * What a zero renders as: NOTHING. Owner 2026-07-28 ("remove the word
 * included. just place a blank since there is no additional cost — included
 * makes it seem like this is included whether they pick it or not") —
 * superseding the earlier "included" placeholder. A ₱0 option is just blank;
 * the pick still decides. The constant stays so every amount field renders the
 * one answer, and the never-a-value rule stands: a vendor typing prose into
 * the field still parses to 0, never to a stray amount.
 */
export const INCLUDED_PLACEHOLDER = '';

/** The static prefix rendered beside the field. Never part of the value. */
export const AMOUNT_PREFIX = '+₱';

/**
 * Centavos → the grouped digits the field displays. `0` → `''`, which the
 * placeholder then renders as "included".
 *
 * WHOLE PESOS by design. The field is amount-only (digits in, digits out), and
 * every value it can produce is a whole number of pesos, so the round-trip
 * `parseAmountInput(formatAmountInput(x)) === x` holds for everything this
 * surface can author. A sub-peso value could only arrive from a legacy row;
 * it rounds for DISPLAY rather than showing a decimal the field cannot accept.
 */
export function formatAmountInput(centavos: number): string {
  if (!Number.isFinite(centavos) || centavos <= 0) return '';
  return groupThousands(String(Math.round(centavos / 100)));
}

/**
 * Live grouping as the vendor types: `80000` → `80,000`.
 *
 * Operates on the DIGITS the vendor has typed so far, so it is safe to call on
 * every keystroke — it never re-interprets a partial number as a different one.
 */
export function groupThousands(digits: string): string {
  const clean = digits.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (clean.length === 0) return '';
  return clean.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** What the vendor typed → centavos. Non-digits are dropped, never guessed at. */
export function parseAmountInput(raw: string): number {
  const clean = raw.replace(/\D/g, '');
  if (clean.length === 0) return 0;
  // Cap at a value that cannot overflow BIGINT centavos through any plausible
  // paste. 10 digits of pesos is ₱9,999,999,999 — orders above any real event.
  const pesos = Number(clean.slice(0, 10));
  return Number.isFinite(pesos) ? pesos * 100 : 0;
}

/** True when this amount reads as "included" rather than as a number. */
export function rendersAsIncluded(centavos: number): boolean {
  return !Number.isFinite(centavos) || centavos <= 0;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* THE LINE-STATE MACHINE                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * The five things a line can BE, in the vendor's words.
 *
 * These are a VIEW over the shipped columns, not a new column. There is no
 * `line_state` anywhere in the schema and there must not be — a stored state
 * beside the booleans it summarises is a second source of truth that can
 * disagree with them. Every state below is derived, and every transition is
 * expressed as a patch to the same booleans the database already enforces.
 *
 *   required  → is_default_included TRUE  · is_required TRUE   · no options
 *   included  → is_default_included TRUE  · is_required FALSE  · no options
 *   optional  → is_default_included FALSE · is_required FALSE  · no options
 *   choice    → at least one option (a line IS a choice iff it has options)
 *   quantity  → maxExtraHours set · no options
 */
export type LineState = 'required' | 'included' | 'optional' | 'choice' | 'quantity';

/** The four zones the step lists lines under. Derived from the state. */
export type LineGroup = 'included' | 'choices' | 'quantities' | 'addons';

export const LINE_GROUP_LABEL: Record<LineGroup, string> = {
  included: 'Included in the price',
  choices: 'Choices',
  quantities: 'Quantities',
  addons: 'Optional add-ons',
};

/** Group render order — the couple reads them in this order too. */
export const LINE_GROUP_ORDER: ReadonlyArray<LineGroup> = [
  'included',
  'choices',
  'quantities',
  'addons',
];

export function lineStateOf(item: DraftItem): LineState {
  // A line IS a choice iff it carries options — checked FIRST because a choice
  // may also be included-by-default, and "choice" is the more specific claim.
  if (item.options.length > 0) return 'choice';
  if (item.maxExtraHours !== undefined && item.maxExtraHours !== null) return 'quantity';
  if (item.is_required) return 'required';
  if (item.is_default_included) return 'included';
  return 'optional';
}

export function lineGroupOf(item: DraftItem): LineGroup {
  switch (lineStateOf(item)) {
    case 'choice':
      return 'choices';
    case 'quantity':
      return 'quantities';
    case 'required':
    case 'included':
      return 'included';
    case 'optional':
      return 'addons';
  }
}

/** True when this line is revealed by picking an option on another line. */
export function isFollowUp(item: DraftItem): boolean {
  return Boolean(item.parentRef);
}

/**
 * Which states the UI may offer for this line.
 *
 * A FOLLOW-UP MAY NOT BE `required` OR `included`, structurally — mirrors
 * `vendor_package_items_followup_not_default_included_ck` and the two
 * `followup_cannot_be_*` rules in `validatePackageDraft`. A follow-up is only
 * shown to the couples who picked its option, so charging every couple for it
 * (which is what `is_default_included` means) delivers a line most of them
 * never saw. The database refuses it, the validator explains it — and this is
 * the third layer, the one that stops the vendor DRAWING it in the first place.
 */
export function allowedLineStates(item: DraftItem): LineState[] {
  if (isFollowUp(item)) return ['optional', 'choice', 'quantity'];
  return ['required', 'included', 'optional', 'choice', 'quantity'];
}

/**
 * Move a line into a state. Returns a NEW item; never mutates.
 *
 * REFUSES A DISALLOWED TRANSITION BY RETURNING THE LINE UNCHANGED rather than
 * throwing. The UI does not offer the forbidden states for a follow-up, so
 * this branch is only reachable from a bug or a hand-crafted payload — and in
 * both cases the safe answer is "nothing happened", not a crash on a form the
 * vendor is in the middle of.
 */
export function applyLineState(item: DraftItem, state: LineState): DraftItem {
  if (!allowedLineStates(item).includes(state)) return item;

  switch (state) {
    case 'required':
      // Required implies included — the DB refuses any other combination
      // (`vendor_package_items_required_implies_included`).
      return {
        ...item,
        is_required: true,
        is_default_included: true,
        options: [],
        pickMin: null,
        pickMax: null,
        maxExtraHours: null,
      };
    case 'included':
      return {
        ...item,
        is_required: false,
        is_default_included: true,
        options: [],
        pickMin: null,
        pickMax: null,
        maxExtraHours: null,
      };
    case 'optional':
      return {
        ...item,
        is_required: false,
        is_default_included: false,
        options: [],
        pickMin: null,
        pickMax: null,
        maxExtraHours: null,
      };
    case 'choice':
      return {
        ...item,
        // A follow-up can never be inside the price; a top-level choice is, and
        // its default option is what `total_price_centavos` already pays for.
        is_required: false,
        is_default_included: !isFollowUp(item),
        maxExtraHours: null,
        // Seed TWO — one option is not a choice — and mark the first standard
        // so the line starts valid rather than starting with two red notes.
        options:
          item.options.length >= 2
            ? item.options
            : [
                seedOption(`${item.ref}-o1`, true),
                seedOption(`${item.ref}-o2`, false),
              ],
      };
    case 'quantity':
      return {
        ...item,
        is_required: false,
        // A quantity line is something the couple ADDS, so it is not inside the
        // price. `replacement_value_centavos` carries the per-unit price.
        is_default_included: false,
        options: [],
        pickMin: null,
        pickMax: null,
        maxExtraHours: item.maxExtraHours ?? 0,
      };
  }
}

function seedOption(ref: string, isDefault: boolean): DraftOption {
  return {
    ref,
    label: '',
    price_delta_centavos: 0,
    is_default: isDefault,
    is_available: true,
  };
}

/** A fresh line, in the state the vendor asked for. */
export function newLine(
  ref: string,
  canonicalService: string,
  state: LineState = 'included',
): DraftItem {
  const base: DraftItem = {
    ref,
    service_description: '',
    canonical_service: canonicalService,
    is_default_included: true,
    is_required: false,
    replacement_value_centavos: 0,
    options: [],
    parentRef: null,
    pickMin: null,
    pickMax: null,
    maxExtraHours: null,
  };
  return applyLineState(base, state);
}

/** A fresh FOLLOW-UP line hanging off one option of one line. */
export function newFollowUpLine(
  ref: string,
  canonicalService: string,
  parent: { itemRef: string; optionRef: string },
): DraftItem {
  return {
    ref,
    service_description: '',
    canonical_service: canonicalService,
    // Structurally forced — see allowedLineStates.
    is_default_included: false,
    is_required: false,
    replacement_value_centavos: 0,
    options: [],
    parentRef: { itemRef: parent.itemRef, optionRef: parent.optionRef },
    pickMin: null,
    pickMax: null,
    maxExtraHours: null,
  };
}

/**
 * "↳ follows 'Lechon belly' on Main course" — the lineage sentence for a
 * follow-up row, or null for a top-level line.
 *
 * Falls back to the auto-name for a parent whose own name is still blank, so
 * the lineage never reads `follows '' on ''` mid-authoring.
 */
export function followUpLineage(
  item: DraftItem,
  allItems: ReadonlyArray<DraftItem>,
): string | null {
  const parentRef = item.parentRef;
  if (!parentRef) return null;
  const parentIndex = allItems.findIndex((i) => i.ref === parentRef.itemRef);
  const parent = parentIndex < 0 ? undefined : allItems[parentIndex];
  if (!parent) return null;
  const optionIndex = parent.options.findIndex((o) => o.ref === parentRef.optionRef);
  const option = optionIndex < 0 ? undefined : parent.options[optionIndex];
  if (!option) return null;
  const optionLabel = option.label.trim() || autoName('option', optionIndex);
  const parentLabel = parent.service_description.trim() || autoName('item', parentIndex);
  return `follows “${optionLabel}” on ${parentLabel}`;
}

/**
 * Every line that would be orphaned by deleting `ref` — the line itself plus
 * everything that follows one of its options, transitively.
 *
 * Deleting a parent without its children leaves a `parentRef` pointing at an
 * option that no longer exists, which `validatePackageDraft` reports as
 * `followup_parent_unknown` and `planItemInsertOrder` refuses to place. Better
 * to remove the subtree than to leave the vendor a red note they cannot clear.
 */
export function refsToRemoveWith(
  ref: string,
  items: ReadonlyArray<DraftItem>,
): Set<string> {
  const doomed = new Set<string>([ref]);
  // Bounded by the item count: each pass can only add lines, and a line is
  // added once. A cycle therefore terminates instead of hanging the browser.
  for (let pass = 0; pass < items.length; pass += 1) {
    let grew = false;
    for (const item of items) {
      if (doomed.has(item.ref) || !item.parentRef) continue;
      if (doomed.has(item.parentRef.itemRef)) {
        doomed.add(item.ref);
        grew = true;
      }
    }
    if (!grew) break;
  }
  return doomed;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* SERVICE → PACKAGE                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * The vendor-category → canonical_service direction, DERIVED from the shipped
 * map rather than hand-written a second time.
 *
 * ⚠ THE TWO NAMESPACES ARE NOT THE SAME. `vendor_services.category` is the
 * legacy `vendor_category` enum (`photographer`, `florist`); `canonical_service`
 * is the iteration-0044 taxonomy (`photography`, `florals`). The shipped map
 * `PACKAGE_CANONICAL_TO_VENDOR_CATEGORY` only goes canonical → category, and
 * it is MANY-to-one, so the inverse is genuinely ambiguous (`venue` is the
 * target of `reception_venue`, `function_hall`, `hotel_ballroom`, …).
 *
 * The tie-break is FIRST-DECLARED-WINS, which is not arbitrary: that map is
 * written anchors-first, so the first canonical pointing at a category is the
 * broad one (`reception_venue`, not `garden_reception_venue`). A category with
 * no canonical at all falls back to its own string — the column is TEXT with no
 * FK, and `resolveVendorCategory` documents an unmapped string as landing in
 * the generic Misc bucket rather than failing.
 */
export function canonicalServiceForVendorCategory(category: string): string {
  for (const [canonical, vendorCategory] of Object.entries(
    PACKAGE_CANONICAL_TO_VENDOR_CATEGORY,
  )) {
    if (vendorCategory === (category as VendorCategory)) return canonical;
  }
  return category;
}

/**
 * The one-service package a set of customization lines becomes.
 *
 * ── HOW A SERVICE RESOLVES TO ITS PACKAGE ROW ──────────────────────────────
 * It does not — there is NO link column. `vendor_packages` carries
 * `vendor_profile_id` and `primary_canonical_service` and nothing else that
 * could name a service (migration 20260604110000). So this slice creates a
 * package ANCHORED to the service's category and owned by the same vendor, and
 * the wizard is CREATE-ONLY (`/services/new/[category]` is its only mount), so
 * one wizard run mints exactly one package and re-editing a service cannot
 * fork a second one.
 *
 * That is sufficient for authoring and INSUFFICIENT for editing. The smallest
 * honest fix — proposed, deliberately NOT taken here because this slice adds no
 * migration — is one nullable column:
 *
 *     ALTER TABLE public.vendor_packages
 *       ADD COLUMN IF NOT EXISTS vendor_service_id UUID
 *         REFERENCES public.vendor_services(vendor_service_id) ON DELETE CASCADE;
 *
 * Additive, idempotent, defaulted NULL, and every existing reader keeps
 * working. `ON DELETE CASCADE` rather than `SET NULL` because a service-anchored
 * package has no meaning once its service is gone, whereas orphaning it would
 * leave a nameless package live on the vendor's public page.
 */
export function toPackageDraft(
  items: ReadonlyArray<DraftItem>,
  head: { packageName: string; totalPriceCentavos: number },
): DraftPackage {
  return {
    package_name: head.packageName,
    total_price_centavos: head.totalPriceCentavos,
    // The wizard authors STRUCTURE, not a credit pool. Both stay at the shipped
    // defaults so `consumable_without_flex_or_budget` cannot fire, and so the
    // couple-side credit engine sees exactly today's behaviour.
    consumable_budget_centavos: 0,
    is_consumable_flexible: false,
    items: items.map(normaliseItem),
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* WHERE THE STEP SITS IN THE WIZARD                                          */
/* ────────────────────────────────────────────────────────────────────────── */

export type WizardStep = { id: string; label: string };

/**
 * The wizard's step sequence.
 *
 * Extracted from `service-wizard.tsx` so the FLAG-OFF guarantee is testable
 * without rendering React: with `customizationEnabled: false` this returns
 * exactly the array the component built before this change, so the wizard is
 * byte-identical to today.
 *
 * ★ Customization sits AFTER "Value & media" and BEFORE "Comes with" /
 * "Review & publish" — the vendor has described and priced the thing before
 * they are asked what a couple may change about it.
 */
export function serviceWizardSteps(opts: {
  hasOtherCategories: boolean;
  customizationEnabled: boolean;
}): WizardStep[] {
  const steps: WizardStep[] = [
    { id: 'what', label: 'What you offer' },
    { id: 'price', label: 'Pricing' },
    { id: 'perk', label: 'Setnayan Exclusive' },
    { id: 'extras', label: 'Value & media' },
  ];
  if (opts.customizationEnabled) {
    steps.push({ id: 'custom', label: '★ Customization' });
  }
  if (opts.hasOtherCategories) steps.push({ id: 'links', label: 'Comes with' });
  steps.push({ id: 'review', label: 'Review & publish' });
  return steps;
}
