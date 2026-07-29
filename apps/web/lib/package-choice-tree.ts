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
 * A follow-up option, a second pick on a pick-N line, and an extra hour are all
 * REAL MONEY (2026-07-28). They used to be render-only and priced at exactly
 * zero, and that was not a stylistic call — the server that commits the money
 * could not see the columns that define them. `VENDOR_PACKAGE_ITEM_SELECT`
 * asked for none of `parent_option_id`, `pick_min`, `pick_max`,
 * `max_extra_hours`, `extra_hour_centavos`, so every line arrived at the pricer
 * as a top-level, exactly-one-of-N line and each of those three cost ₱0 at lock
 * while the couple's screen printed a price on them.
 *
 * All five columns were verified on live prod, the shared select was widened for
 * BOTH money callers at once (`lockPackage` and `removeItemFromPackage` — see
 * `priceCustomizedPackage` for what happens when only one moves), and the credit
 * engine learned the two shapes it used to refuse: a revealed follow-up is
 * resolved like any other choice line, and a line takes up to `pick_max` picks
 * with every one carrying its own delta.
 *
 * {@link chargeableOptionIds} is still THE boundary, and it is still the exact
 * function `lockPackage` calls to narrow what it prices — the display set and
 * the committed set are one function, not two that agree today.
 * {@link chargeableExtraHours} is its hour-axis twin, with the same contract.
 *
 * ── VISIBILITY BOUNDS CHARGEABILITY ─────────────────────────────────────────
 * The narrowing walks {@link visibleLineTree}, so the rule that decides what the
 * couple can SEE is the same rule that decides what they can be BILLED for. A
 * follow-up whose parent option is not in force is not in the tree, so its pick
 * is dropped before the pricer sees it — and refused (`option_on_excluded_item`)
 * by the engine if a hand-rolled payload sends it anyway. Dropping is this
 * module's posture; refusing is the engine's; neither ever prices a shape it
 * does not understand.
 *
 * ── AND THE OTHER HALF: A PREFERENCE MUST ACTUALLY BE FREE ──────────────────
 * {@link isOptionSelectable} still refuses a PRICED option inside whatever
 * remains non-chargeable, so anything shown as pickable-but-unbilled is
 * genuinely a zero-delta option. That region is much smaller now — it is the
 * tail past `pick_max` — but the check is expressed by asking the boundary
 * function rather than by restating the rule, so it stays honest on its own.
 *
 * Money is BIGINT CENTAVOS throughout, as everywhere else in this wave.
 */

import {
  defaultOptionFor,
  isChoiceLine,
  type VendorPackageItemOptionRow,
  type VendorPackageItemRow,
  type VendorPackageWithItems,
} from './vendor-packages';
import { priceCustomizedPackage } from './package-credit-adapter';
import {
  extraHoursBounds as extraHoursBoundsOf,
  optionDeltaCentavos,
  pickBounds as pickBoundsOf,
} from './package-credit';

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
 * `extraHours` is item_id → extra hours requested on top of `min_hours`, which
 * the package price already covers. It IS money: each one bills at the line's
 * own `extra_hour_centavos`, and the narrowed set is persisted at lock as
 * `customizations_json.extra_hours` so the record matches the total.
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
 * ⚠ RE-EXPORTED, NOT REIMPLEMENTED. The body lives in `./package-credit`
 * because the pricer needs the same answer and the import can only run in that
 * direction. A renderer that thought a line took 2 picks while the pricer
 * thought it took 1 is exactly the display-vs-charge divergence this whole
 * module exists to foreclose, so there is one function and this is a view of it.
 */
export function pickBounds(item: VendorPackageItemRow): { min: number; max: number } {
  return pickBoundsOf(item);
}

/**
 * The options actually IN FORCE on a line for pricing and for revealing
 * follow-ups: the couple's picks, capped at `pick_max`, in display order.
 *
 * 🚨 THE CAP IS LOAD-BEARING IN BOTH DIRECTIONS. It is what stops a stale or
 * hand-rolled client billing for a 4th pick on a choose-3 line, and — because
 * the SAME list drives the reveal walk — what stops that 4th pick revealing a
 * follow-up nobody paid to unlock. Capping in one place and not the other would
 * show a question that costs money to answer and charge nothing for it.
 *
 * Display order rather than click order, so "the first `max` picks" is a stable,
 * server-reproducible notion: the server sees a flat id list with no click
 * sequence in it, and must reach the same answer the browser did.
 */
export function effectivePicksOn(
  item: VendorPackageItemRow,
  selection: ChoiceSelection,
): VendorPackageItemOptionRow[] {
  return pickedOptionsOn(item, selection).slice(0, pickBounds(item).max);
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
  const picked = effectivePicksOn(item, selection);
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
  /**
   * An UNTICKED root, kept on screen so the couple can change their mind
   * (owner 2026-07-29 — the "+₱X back to budget" copy invites experimenting,
   * and a vanished line is an unfinishable experiment). A removed line renders
   * struck-through, reveals NO follow-ups, and contributes NOTHING to any
   * charge walk — visibility no longer implies chargeability for exactly this
   * one marked state, and both charge walkers skip it explicitly.
   */
  removed: boolean;
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
    visible.push({ item, depth, removed: false });

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
    if (removed.has(item.item_id) && item.is_required !== true) {
      // An unticked root STAYS VISIBLE, marked, so it can be re-ticked — but it
      // is NOT walked: its follow-up subtree stays hidden and none of its
      // options are in force. Charge walkers skip `removed` entries, so this
      // line contributes nothing anywhere money is computed.
      visible.push({ item, depth: 0, removed: true });
      continue;
    }
    walk(item, 0);
  }

  return visible;
}

export function visibleLines(
  pkg: VendorPackageWithItems,
  removedItemIds: ReadonlyArray<string>,
  selection: ChoiceSelection,
): VendorPackageItemRow[] {
  // Removed-but-still-rendered roots are a DISPLAY state; every flat-list
  // consumer keeps the pre-reversibility semantics: lines IN the booking.
  return visibleLineTree(pkg, removedItemIds, selection)
    .filter((v) => !v.removed)
    .map((v) => v.item);
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
 * Regroup a FLAT list of option ids back onto the lines they belong to.
 *
 * The browser holds a {@link ChoiceSelection}; the wire carries a flat array;
 * the server has to reach the same answer the browser did. Scoping each id to
 * the line whose options actually contain it is what makes that possible without
 * trusting the client's grouping — and it is what stops one line's id counting
 * toward another line's picks.
 *
 * Unknown and unavailable ids simply do not land anywhere, which is the file's
 * standing posture: DROP a stale id rather than reject it, so a page that loaded
 * before the vendor retired an option cannot fail a money action.
 */
export function selectionFromRequested(
  pkg: VendorPackageWithItems,
  requestedOptionIds: ReadonlyArray<string>,
  requestedExtraHours: Readonly<Record<string, number>> = {},
): ChoiceSelection {
  const requested = new Set(requestedOptionIds);
  const picks: Record<string, string[]> = {};
  for (const item of pkg.items ?? []) {
    const own = (item.options ?? [])
      .filter((o) => requested.has(o.option_id) && o.is_available)
      .map((o) => o.option_id);
    if (own.length > 0) picks[item.item_id] = own;
  }
  return { picks, extraHours: requestedExtraHours };
}

/**
 * 💰 The option ids that actually reach the pricer — the ONE definition, shared
 * by the modal's live total and by `lockPackage`'s commit.
 *
 * ── WHAT THIS USED TO DO, AND WHY IT CHANGED ────────────────────────────────
 * It used to be `keptItems` + `resolveChosenOption`, and those two helpers
 * silently defined the charge boundary as "top-level lines only, one pick each".
 * That was correct while `VENDOR_PACKAGE_ITEM_SELECT` withheld the branching
 * columns — the server could not tell a follow-up from a top-level line, so
 * pricing one would have been guessing. It is no longer correct now that the
 * select carries all five columns: it was billing ₱0 for a follow-up option, a
 * second pick, and an extra hour that the couple's own screen had priced.
 *
 * ── WHAT IT DOES NOW ────────────────────────────────────────────────────────
 * It walks {@link visibleLineTree} and takes each visible line's effective
 * picks. VISIBILITY BOUNDS CHARGEABILITY, which is the whole safety argument:
 *
 *   • a follow-up whose parent option is NOT in force never appears in the
 *     tree, so its picks are DROPPED here and never priced;
 *   • a removed line and its entire subtree leave the tree together, so their
 *     picks go with them;
 *   • picks beyond `pick_max` are dropped by {@link effectivePicksOn} — the
 *     same cap that bounds the reveal walk, so a clamped-out pick can neither
 *     be billed nor unlock a follow-up;
 *   • an id naming no available option on a visible line lands nowhere in
 *     {@link selectionFromRequested} and is dropped, not rejected, so a stale
 *     page cannot fail a money action.
 *
 * DROPPING is this function's posture; REFUSING is the engine's. Anything that
 * slips past the drop — a hand-rolled payload naming an option on an unrevealed
 * follow-up — hits `option_on_excluded_item` in `computePackageCredit` and fails
 * closed. Neither layer ever prices a shape it does not understand.
 */
export function chargeableOptionIds(
  pkg: VendorPackageWithItems,
  removedItemIds: ReadonlyArray<string>,
  requestedOptionIds: ReadonlyArray<string>,
): string[] {
  return chargeableOptionIdsForSelection(
    pkg,
    removedItemIds,
    selectionFromRequested(pkg, requestedOptionIds),
  );
}

/** The same boundary, expressed over a {@link ChoiceSelection}. */
export function chargeableOptionIdsForSelection(
  pkg: VendorPackageWithItems,
  removedItemIds: ReadonlyArray<string>,
  selection: ChoiceSelection,
): string[] {
  const ids: string[] = [];
  for (const { item, removed } of visibleLineTree(pkg, removedItemIds, selection)) {
    if (removed) continue; // visible for re-ticking only — never chargeable
    if (!isChoiceLine(item)) continue;
    for (const option of effectivePicksOn(item, selection)) {
      ids.push(option.option_id);
    }
  }
  return ids;
}

/**
 * 💰 The extra hours that actually reach the pricer — the hour-axis twin of
 * {@link chargeableOptionIds}, and the same contract.
 *
 * Only a VISIBLE line with a real hourly axis (a rate AND a cap — see
 * `extraHoursBounds`) can carry hours, and the number is clamped to that line's
 * own `max_extra_hours`. Hours asked of a hidden line, a removed line, or a line
 * the vendor never priced by the hour are dropped here; the engine refuses them
 * (`extra_hours_not_offered`) if they arrive anyway.
 *
 * Zero is omitted rather than recorded: an untouched stepper is not a request,
 * and persisting `{ item: 0 }` would put noise in `customizations_json` that a
 * later reader could mistake for a decision.
 */
export function chargeableExtraHoursForSelection(
  pkg: VendorPackageWithItems,
  removedItemIds: ReadonlyArray<string>,
  selection: ChoiceSelection,
): Record<string, number> {
  const hours: Record<string, number> = {};
  for (const { item, removed } of visibleLineTree(pkg, removedItemIds, selection)) {
    if (removed) continue; // visible for re-ticking only — never chargeable
    const value = extraHoursOn(item, selection);
    if (value > 0) hours[item.item_id] = value;
  }
  return hours;
}

/** The same, over the flat ids + quantities the wire actually carries. */
export function chargeableExtraHours(
  pkg: VendorPackageWithItems,
  removedItemIds: ReadonlyArray<string>,
  requestedOptionIds: ReadonlyArray<string>,
  requestedExtraHours: Readonly<Record<string, number>>,
): Record<string, number> {
  return chargeableExtraHoursForSelection(
    pkg,
    removedItemIds,
    selectionFromRequested(pkg, requestedOptionIds, requestedExtraHours),
  );
}

/**
 * May the couple pick this option?
 *
 * TRUE for anything the pricer will charge for — which, since the charge path
 * was widened, is every pick on every visible line up to `pick_max`. A follow-up
 * option and a second pick on a pick-N line are now ordinary priced picks, so
 * this returns TRUE for them where it used to refuse the priced ones.
 *
 * ⚠ THE RULE IS UNCHANGED, ITS REACH SHRANK. It still says: inside the
 * NON-chargeable region, only a ZERO-delta option may be offered, because a
 * priced one would promise the couple an upgrade nobody is billed for and hand
 * the vendor a bill they never agreed to. That region is now just the tail past
 * `pick_max` (which `isPickCapReached` also disables) and anything the pricer
 * would drop. Keeping the check rather than deleting it is deliberate: it is
 * expressed by ASKING the boundary function, so if the boundary ever narrows
 * again this stays honest without being edited.
 *
 * `paxCount` is passed through so a per-head option is judged on what it would
 * actually cost, not on its (zero) flat delta.
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
 * ⚠ RE-EXPORTED, NOT REIMPLEMENTED — same argument as {@link pickBounds}. The
 * body lives in `./package-credit` so the stepper the couple sees and the hours
 * the engine will bill are bounded by literally one function.
 *
 * `null` = this line has no quantity axis.
 */
export function extraHoursBounds(
  item: VendorPackageItemRow,
): { min: 0; max: number } | null {
  return extraHoursBoundsOf(item);
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
  /**
   * The hours that produced this number, narrowed and clamped. Submitted
   * verbatim, exactly like `chargeableOptionIds` — the screen sends what it
   * priced, and the server re-derives the same set from it.
   */
  chargeableExtraHours: Readonly<Record<string, number>>;
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
  const hours = chargeableExtraHoursForSelection(pkg, removedItemIds, selection);
  const priced = priceCustomizedPackage({
    pkg,
    removedItemIds,
    chosenOptionIds: ids,
    creditEnabled,
    paxCount,
    extraHours: hours,
    // Catalogue buys are a different surface (the credit spender); this one
    // configures the package itself. Empty, not omitted — the args type is
    // fully required on purpose, so a new field must be answered here too.
    additions: [],
    catalogue: [],
  });
  if (!priced) return null;
  return { ...priced, chargeableOptionIds: ids, chargeableExtraHours: hours };
}
