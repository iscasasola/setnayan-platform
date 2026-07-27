/**
 * THE COUPLE-SIDE CHOICE TREE — visibility, pick bounds, and the CHARGEABLE
 * BOUNDARY that keeps the shown total equal to the committed total.
 *
 * Pure module — no React, no env, no clock, no I/O. Runs under `tsx --test`.
 *
 * ── WHAT THIS ADDS ──────────────────────────────────────────────────────────
 * `lock-modal.tsx` already renders a package's default-included lines with
 * checkboxes, renders a CHOICE line as a one-of-N radio group, and recomputes a
 * live total through `computeCustomization` + `chosenOptionsSurchargeCentavos`.
 * What it cannot do is BRANCH: it has no notion of a follow-up line, of
 * "choose 2 of 3", or of a quantity. This module is that missing layer, and
 * nothing else — it re-derives none of the pricing that already exists.
 *
 * ── 🚨 THE BOUNDARY, AND WHY IT IS WHERE IT IS ──────────────────────────────
 * A follow-up line, a second pick on a pick-N line, and an extra hour are all
 * RENDER-ONLY AND PRICED AT EXACTLY ZERO in this slice. That is not a stylistic
 * call; the server that commits the money cannot see the columns that define
 * them:
 *
 *   • `lockPackage` reads its items with `VENDOR_PACKAGE_ITEM_SELECT`, which
 *     asks for neither `parent_option_id`, `pick_min`, `pick_max`, nor
 *     `max_extra_hours`. Every line therefore arrives at the pricer as a
 *     top-level, exactly-one-of-N line.
 *   • Adding those columns to that select is a DOCUMENTED PRODUCTION HAZARD —
 *     see the header on `PACKAGE_ITEM_AUTHORING_COLUMNS`: a column whose
 *     migration has not landed turns into a PostgREST 400 on a money action,
 *     and this repo's migrations auto-apply unreliably.
 *   • Independently, the credit engine already refuses both shapes. A follow-up
 *     is forced to `is_default_included = FALSE` by DB CHECK, so an option
 *     picked on one fails `option_on_excluded_item`; and two options on one line
 *     fail `multiple_options_for_item`. Either refusal collapses
 *     `priceCustomizedPackage` to `null`, which `lockPackage` turns into a hard
 *     error on a money action.
 *
 * So the honest move is to keep the RENDERER inside what the pricer can commit,
 * and to make that boundary an explicit, tested function rather than a habit.
 * {@link chargeableOptionIds} IS that boundary, and `lockPackage` calls this
 * exact function to narrow what it prices — the display set and the committed
 * set are one function, not two that agree today.
 *
 * ── AND THE OTHER HALF: A PREFERENCE MUST ACTUALLY BE FREE ──────────────────
 * A vendor can author a PRICED option inside the non-chargeable region. Showing
 * it as pickable would promise the couple an upgrade nobody is charged for, and
 * hand the vendor a bill they never agreed to. {@link isOptionSelectable}
 * refuses it: inside the non-chargeable region, only a ZERO-delta option may be
 * picked. A preference is therefore always genuinely free, and free is exactly
 * what the lock commits.
 *
 * Money is BIGINT CENTAVOS throughout, as everywhere else in this wave.
 */

import {
  defaultOptionFor,
  isChoiceLine,
  keptItems,
  resolveChosenOption,
  type VendorPackageItemOptionRow,
  type VendorPackageItemRow,
  type VendorPackageWithItems,
} from './vendor-packages';
import { priceCustomizedPackage } from './package-credit-adapter';
import { optionDeltaCentavos } from './package-credit';

/* ──────────────────────────────────────────────────────────────────────── */
/* Selection state                                                          */
/* ──────────────────────────────────────────────────────────────────────── */

/**
 * What the couple has picked so far.
 *
 * `picks` is item_id → option_ids, because a pick-N line holds more than one.
 * A plain one-of-N line simply holds an array of length ≤ 1, so there is ONE
 * shape rather than two that must be kept in step.
 *
 * `extraHours` is item_id → extra hours requested on top of `min_hours`. It is
 * NOT money in this slice — see the boundary note in the module header — and it
 * is deliberately not part of what gets persisted at lock.
 */
export type ChoiceSelection = {
  picks: Readonly<Record<string, ReadonlyArray<string>>>;
  extraHours?: Readonly<Record<string, number>>;
};

export const EMPTY_SELECTION: ChoiceSelection = { picks: {} };

/** Every option id in the selection, flattened. Order follows the item map. */
export function selectedOptionIds(selection: ChoiceSelection): string[] {
  return Object.values(selection?.picks ?? {}).flat();
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Line classification                                                      */
/* ──────────────────────────────────────────────────────────────────────── */

/** A FOLLOW-UP hangs off one specific option on another line. */
export function isFollowUpLine(item: VendorPackageItemRow): boolean {
  return item.parent_option_id != null;
}

/**
 * How many options this line takes.
 *
 * `pick_min`/`pick_max` null (which is every row that exists today, and every
 * row the lock path can see) ⇒ `{ min: 1, max: 1 }` — today's exactly-one
 * behaviour, unchanged. The DB refuses a half-set pair and refuses `pick_min`
 * of 0, so a set pair is always coherent; the clamps below exist because this
 * function is also handed objects built IN MEMORY, where no constraint applies.
 */
export function pickBounds(item: VendorPackageItemRow): { min: number; max: number } {
  const rawMin = item.pick_min;
  const rawMax = item.pick_max;
  if (
    rawMin == null ||
    rawMax == null ||
    !Number.isSafeInteger(rawMin) ||
    !Number.isSafeInteger(rawMax)
  ) {
    return { min: 1, max: 1 };
  }
  const min = Math.max(1, rawMin);
  const max = Math.max(min, rawMax);
  return { min, max };
}

/**
 * The options actually picked on THIS line — scoped to the line's own available
 * options, in the line's display order.
 *
 * Scoping is what stops another line's id (a stale page, a hand-rolled client)
 * counting toward this line's minimum. Order comes from the item rather than
 * from the click sequence so that "the first pick" is a stable, server-
 * reproducible notion: `resolveChosenOption` resolves in exactly this order.
 */
export function pickedOptionsOn(
  item: VendorPackageItemRow,
  selection: ChoiceSelection,
): VendorPackageItemOptionRow[] {
  const wanted = new Set(selection?.picks?.[item.item_id] ?? []);
  if (wanted.size === 0) return [];
  return (item.options ?? []).filter((o) => wanted.has(o.option_id) && o.is_available);
}

/**
 * The options in force on a line for VISIBILITY purposes.
 *
 * A line the couple has not answered still shows its vendor default, and that
 * default reveals whatever hangs off it — otherwise a follow-up under the
 * standard option would be invisible until the couple re-picked the option they
 * already had. A REQUIRED choice line is the exception: the engine refuses to
 * apply its default (`required_choice_unselected`), so nothing is in force until
 * the couple actually picks, and nothing may be revealed by a pick they have not
 * made.
 */
function optionsInForce(
  item: VendorPackageItemRow,
  selection: ChoiceSelection,
): VendorPackageItemOptionRow[] {
  const picked = pickedOptionsOn(item, selection);
  if (picked.length > 0) return picked;
  if (item.is_required === true) return [];
  const fallback = defaultOptionFor(item);
  return fallback ? [fallback] : [];
}

/* ──────────────────────────────────────────────────────────────────────── */
/* The visibility tree                                                      */
/* ──────────────────────────────────────────────────────────────────────── */

/**
 * The lines the couple can currently see, in package display order.
 *
 * ROOTS are exactly what the modal lists today: default-included, non-follow-up
 * lines. A removed line and everything beneath it drop out together.
 *
 * Then the walk: for every visible line, whatever options are in force reveal
 * their follow-ups, and those follow-ups' own options reveal theirs, to any
 * depth. The DB caps a chain at 5 levels; this walk does not rely on that,
 * because it is also handed in-memory objects — a `seen` set makes a cycle
 * terminate instead of hanging the browser.
 *
 * 🚨 The whole point: a follow-up whose parent option is NOT in force never
 * appears here, so it is never rendered, never picked, never priced, and never
 * cascaded.
 */
export type VisibleLine = {
  item: VendorPackageItemRow;
  /** 0 = a top-level line. Each follow-up sits one level under what revealed it. */
  depth: number;
};

/**
 * The visible lines WITH their nesting depth, so the renderer can draw the
 * chain rather than a flat list — "which style of lechon?" has to read as a
 * consequence of picking lechon, not as a peer of it.
 */
export function visibleLineTree(
  pkg: VendorPackageWithItems,
  removedItemIds: ReadonlyArray<string>,
  selection: ChoiceSelection,
): VisibleLine[] {
  const removed = new Set(removedItemIds);
  const items = pkg.items ?? [];

  /** parent_option_id → the lines it reveals. */
  const childrenByOption = new Map<string, VendorPackageItemRow[]>();
  for (const item of items) {
    const parent = item.parent_option_id;
    if (parent == null) continue;
    const list = childrenByOption.get(parent) ?? [];
    list.push(item);
    childrenByOption.set(parent, list);
  }

  const visible: VisibleLine[] = [];
  const seen = new Set<string>();

  const walk = (item: VendorPackageItemRow, depth: number) => {
    if (seen.has(item.item_id)) return; // cycle guard — in-memory shapes only
    seen.add(item.item_id);
    visible.push({ item, depth });

    if (!isChoiceLine(item)) return;
    for (const option of optionsInForce(item, selection)) {
      for (const child of childrenByOption.get(option.option_id) ?? []) {
        walk(child, depth + 1);
      }
    }
  };

  for (const item of items) {
    if (isFollowUpLine(item)) continue; // reached through its parent, or not at all
    if (!item.is_default_included) continue; // add-ons are not part of the booking
    if (removed.has(item.item_id) && item.is_required !== true) continue;
    walk(item, 0);
  }

  return visible;
}

export function visibleLines(
  pkg: VendorPackageWithItems,
  removedItemIds: ReadonlyArray<string>,
  selection: ChoiceSelection,
): VendorPackageItemRow[] {
  return visibleLineTree(pkg, removedItemIds, selection).map((v) => v.item);
}

/** Convenience: just the ids, for tests and for cheap membership checks. */
export function visibleLineIds(
  pkg: VendorPackageWithItems,
  removedItemIds: ReadonlyArray<string>,
  selection: ChoiceSelection,
): string[] {
  return visibleLines(pkg, removedItemIds, selection).map((i) => i.item_id);
}

/* ──────────────────────────────────────────────────────────────────────── */
/* THE CHARGEABLE BOUNDARY                                                  */
/* ──────────────────────────────────────────────────────────────────────── */

/**
 * 💰 The option ids that actually reach the pricer — the ONE definition, shared
 * by the modal's live total and by `lockPackage`'s commit.
 *
 * This reproduces the narrowing `lockPackage` has always done, and `lockPackage`
 * now calls this function instead of spelling it out again:
 *
 *     kept.map((item) => resolveChosenOption(item, requested))
 *         .filter(Boolean)
 *         .filter((opt) => requested.includes(opt.option_id))
 *         .map((opt) => opt.option_id)
 *
 * Three consequences fall out of `keptItems` + `resolveChosenOption`, and each
 * is exactly the safe direction:
 *
 *   • `keptItems` drops every follow-up (and every non-included line), so an
 *     option picked on a follow-up is NOT here — a picked follow-up costs zero.
 *   • `resolveChosenOption` returns at most ONE option per line, so picks 2..N
 *     on a pick-N line are NOT here — they cost zero.
 *   • an id that names no available option on a kept line is dropped rather than
 *     rejected, so a stale page cannot fail a money action.
 *
 * Everything absent from this list is a PREFERENCE, and {@link isOptionSelectable}
 * guarantees a preference is always a zero-delta option.
 */
export function chargeableOptionIds(
  pkg: VendorPackageWithItems,
  removedItemIds: ReadonlyArray<string>,
  requestedOptionIds: ReadonlyArray<string>,
): string[] {
  return keptItems(pkg, removedItemIds)
    .map((item) => resolveChosenOption(item, requestedOptionIds))
    .filter((opt): opt is VendorPackageItemOptionRow => opt !== undefined)
    .filter((opt) => requestedOptionIds.includes(opt.option_id))
    .map((opt) => opt.option_id);
}

/** The same boundary, expressed over a {@link ChoiceSelection}. */
export function chargeableOptionIdsForSelection(
  pkg: VendorPackageWithItems,
  removedItemIds: ReadonlyArray<string>,
  selection: ChoiceSelection,
): string[] {
  return chargeableOptionIds(pkg, removedItemIds, selectedOptionIds(selection));
}

/**
 * May the couple pick this option?
 *
 * TRUE for anything the pricer will charge for. Inside the non-chargeable
 * region — a follow-up line, or a pick beyond the first on a pick-N line — only
 * a ZERO-delta option is offered, because a priced one would be shown as an
 * upgrade the couple is never billed for and the vendor never agreed to give
 * away. `paxCount` is passed through so a per-head option is judged on what it
 * would actually cost, not on its (zero) flat delta.
 */
export function isOptionSelectable(
  pkg: VendorPackageWithItems,
  removedItemIds: ReadonlyArray<string>,
  item: VendorPackageItemRow,
  option: VendorPackageItemOptionRow,
  selection: ChoiceSelection,
  paxCount = 0,
): boolean {
  if (!option.is_available) return false;

  const current = selection.picks?.[item.item_id] ?? [];
  // Already picked ⇒ always interactive, so the couple can UNPICK it. Refusing
  // here would strand a selection that a stale page or an earlier rule allowed.
  if (current.includes(option.option_id)) return true;

  // The line's picks as they WOULD be, and what the pricer would then charge
  // for. Asking the boundary itself is what keeps this in step with the pricer
  // rather than re-deriving the rule.
  const nextPicks = [...current, option.option_id];
  const withOption = selectedOptionIds({
    ...selection,
    picks: { ...selection.picks, [item.item_id]: nextPicks },
  });
  const chargeable = new Set(chargeableOptionIds(pkg, removedItemIds, withOption));

  // 🚨 EVERY pick on the line must be either charged for or genuinely free —
  // not just the one being added.
  //
  // Checking only the new option leaves an order-dependent hole. `pick_max > 1`
  // lets two PRICED options be picked on one line, but `resolveChosenOption`
  // charges for whichever comes FIRST in display order — so picking a late
  // priced option and then an earlier one would quietly demote the first to
  // free, and the vendor would owe an upgrade nobody paid for. Judging the
  // whole line closes that in both directions.
  return (item.options ?? [])
    .filter((o) => nextPicks.includes(o.option_id))
    .every(
      (o) => chargeable.has(o.option_id) || optionDeltaCentavos(o, paxCount) === 0,
    );
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Pick-N state + the block                                                 */
/* ──────────────────────────────────────────────────────────────────────── */

export type PickState = {
  item_id: string;
  chosen: number;
  min: number;
  max: number;
  /** Fewer than `min` picked. The package cannot be sent while this is true. */
  belowMinimum: boolean;
  /** `max` reached — the remaining options stop accepting picks. */
  atMaximum: boolean;
  /** "2 of 3 chosen" — the live counter. */
  counterLabel: string;
};

/** The live pick state for one choice line. */
export function pickState(
  item: VendorPackageItemRow,
  selection: ChoiceSelection,
): PickState {
  const { min, max } = pickBounds(item);
  const chosen = pickedOptionsOn(item, selection).length;
  return {
    item_id: item.item_id,
    chosen,
    min,
    max,
    belowMinimum: chosen < min,
    atMaximum: chosen >= max,
    counterLabel: `${chosen} of ${max} chosen`,
  };
}

/**
 * Is this specific option refused because the line is already full?
 *
 * Picking is capped at `pick_max`; an already-picked option is always still
 * clickable so the couple can UNPICK it.
 */
export function isPickCapReached(
  item: VendorPackageItemRow,
  option: VendorPackageItemOptionRow,
  selection: ChoiceSelection,
): boolean {
  const picked = pickedOptionsOn(item, selection);
  if (picked.some((o) => o.option_id === option.option_id)) return false;
  return picked.length >= pickBounds(item).max;
}

/**
 * The visible choice lines the couple has not finished answering.
 *
 * 🚫 A package below a line's minimum is an UNFINISHED ORDER, never a cheaper
 * one. There is no discount for answering less — the vendor priced the package
 * assuming every question is answered — so the send/lock button must block
 * rather than quote a lower number.
 *
 * Only VISIBLE lines count: a follow-up nobody has revealed asks nothing, and a
 * removed line asks nothing.
 */
export function unfinishedChoiceLines(
  pkg: VendorPackageWithItems,
  removedItemIds: ReadonlyArray<string>,
  selection: ChoiceSelection,
): VendorPackageItemRow[] {
  return visibleLines(pkg, removedItemIds, selection).filter((item) => {
    if (!isChoiceLine(item)) return false;
    const { min, max } = pickBounds(item);

    // An OPTIONAL exactly-one line is answered by its vendor default — that is
    // today's shipped behaviour and the DB pins the default's delta to 0, so it
    // is answered AND correctly priced. Only a genuine pick-N line, or a
    // REQUIRED line (which the engine refuses to default), can be unfinished.
    if (min === 1 && max === 1 && item.is_required !== true) return false;

    return pickState(item, selection).belowMinimum;
  });
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Quantities — the hour stepper                                            */
/* ──────────────────────────────────────────────────────────────────────── */

/**
 * Does this line take a quantity, and how far does it go?
 *
 * `max_extra_hours` extends the HOURLY model already on `vendor_package_items`
 * (`hour_base_centavos` covers `min_hours`; each further hour costs
 * `extra_hour_centavos`). It is deliberately NOT a generic quantity cap — see
 * the column comment in migration 20271012816361 — so a line takes a stepper
 * only when it is actually priced by the hour.
 *
 * `null` = this line has no quantity axis.
 */
export function extraHoursBounds(
  item: VendorPackageItemRow,
): { min: 0; max: number } | null {
  const rate = item.extra_hour_centavos;
  if (rate == null || !Number.isFinite(rate) || rate <= 0) return null;
  const cap = item.max_extra_hours;
  if (cap == null || !Number.isSafeInteger(cap) || cap <= 0) return null;
  return { min: 0, max: cap };
}

/** The extra hours currently requested on a line, clamped to its own cap. */
export function extraHoursOn(
  item: VendorPackageItemRow,
  selection: ChoiceSelection,
): number {
  const bounds = extraHoursBounds(item);
  if (!bounds) return 0;
  const raw = selection?.extraHours?.[item.item_id] ?? 0;
  if (!Number.isSafeInteger(raw) || raw <= 0) return 0;
  return Math.min(raw, bounds.max);
}

/* ──────────────────────────────────────────────────────────────────────── */
/* The live total                                                           */
/* ──────────────────────────────────────────────────────────────────────── */

export type ChoiceTotals = {
  /** What the couple is shown. Identical to what the lock commits, by construction. */
  bookingTotalCentavos: number;
  remainingConsumableCentavos: number;
  availableCreditCentavos: number;
  overspendCentavos: number;
  /** The ids that produced this number — the audit trail for the equality test. */
  chargeableOptionIds: ReadonlyArray<string>;
};

/**
 * The number on the couple's screen.
 *
 * 🚨 THERE IS NO SECOND PRICER HERE. This calls `priceCustomizedPackage` — the
 * same function `lockPackage` and `removeItemFromPackage` call — with the same
 * narrowed option ids, so the shown total and the committed total are the same
 * computation over the same inputs rather than two computations that happen to
 * agree. A display total that drifts from the committed total is the worst
 * outcome available on this surface; making them one call is what forecloses it.
 *
 * `null` when the pricer refuses. Callers MUST surface that and block the
 * action — never substitute a number.
 */
export function choiceTotals({
  pkg,
  removedItemIds,
  selection,
  creditEnabled,
  paxCount,
}: {
  pkg: VendorPackageWithItems;
  removedItemIds: ReadonlyArray<string>;
  selection: ChoiceSelection;
  creditEnabled: boolean;
  paxCount: number;
}): ChoiceTotals | null {
  const ids = chargeableOptionIdsForSelection(pkg, removedItemIds, selection);
  const priced = priceCustomizedPackage({
    pkg,
    removedItemIds,
    chosenOptionIds: ids,
    creditEnabled,
    paxCount,
    // Catalogue buys are a different surface (the credit spender); this one
    // configures the package itself. Empty, not omitted — the args type is
    // fully required on purpose, so a new field must be answered here too.
    additions: [],
    catalogue: [],
  });
  if (!priced) return null;
  return { ...priced, chargeableOptionIds: ids };
}
