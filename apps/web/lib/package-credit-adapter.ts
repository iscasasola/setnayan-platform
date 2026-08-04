/**
 * ADAPTER — DB rows → the credit engine's structural input.
 *
 * `./package-credit` is deliberately decoupled from the row types in
 * `./vendor-packages`: it takes plain shapes so it can be tested with nothing
 * mocked. That decoupling is worth keeping, but something has to bridge it, and
 * doing the mapping inline at each call site is how the two drift apart. This
 * module is the ONE bridge.
 *
 * It is pure — no env, no clock, no I/O — so it runs under `tsx --test`.
 *
 * ⚠ Callers MUST pass rows they read from the DB. Everything here is a
 * structural re-shaping; nothing is validated as trustworthy, and no price is
 * recomputed. Hand it a client payload and you have handed the engine a client
 * payload.
 */
import {
  chosenOptionsSurchargeCentavos,
  computeCustomization,
  extraHoursSurchargeCentavos,
  isRemovableItem,
  type VendorPackageItemRow,
  type VendorPackageWithItems,
} from './vendor-packages';
import { computePackageCredit } from './package-credit';
import type { CreditAddition, CreditCatalogueEntry } from './package-credit';
import type { CreditItem, CreditPackage, UnspentCreditPolicy } from './package-credit';

/**
 * The policy a package is treated as having when the column was not selected or
 * holds something unrecognised.
 *
 * 'expiring' is the DB default AND reproduces the shipped `computeCustomization`
 * math to the centavo, so defaulting here can only ever preserve today's
 * behaviour. Defaulting to 'refundable' would take money off the price on the
 * strength of a missing column — see the unresolved-semantics warning in
 * ./package-credit.
 */
export const DEFAULT_UNSPENT_CREDIT_POLICY: UnspentCreditPolicy = 'expiring';

function toCreditItem(item: VendorPackageItemRow): CreditItem {
  return {
    item_id: item.item_id,
    // The column post-dates the row type and defaults FALSE in the DB. Reading
    // a missing value as `true` would make a line unremovable and hide credit
    // the couple is entitled to; `false` is the conservative direction.
    is_required: item.is_required === true,
    is_default_included: item.is_default_included === true,
    replacement_value_centavos: item.replacement_value_centavos,
    // ── The BRANCHING columns. `VENDOR_PACKAGE_ITEM_SELECT` now carries all
    // five, so both money callers see them; before that widening they arrived
    // `undefined` here and every line read as a top-level, exactly-one line —
    // which is precisely why a follow-up pick and a second pick billed ₱0.
    //
    // `?? null` / `?? undefined` rather than a default of 1: the engine's
    // `pickBounds` is what turns "not set" into exactly-one, and duplicating
    // that default here would be a second place for it to drift.
    parent_option_id: item.parent_option_id ?? null,
    pick_min: item.pick_min ?? null,
    pick_max: item.pick_max ?? null,
    extra_hour_centavos: item.extra_hour_centavos ?? null,
    max_extra_hours: item.max_extra_hours ?? null,
    // A line is a CHOICE iff this is non-empty, so an unfetched `options`
    // (undefined) must stay a plain line rather than becoming an empty choice.
    ...(item.options && item.options.length > 0
      ? {
          options: item.options.map((o) => ({
            option_id: o.option_id,
            price_delta_centavos: o.price_delta_centavos,
            is_default: o.is_default,
            is_available: o.is_available,
            // Absent basis reads as 'fixed', so options written before per-head
            // pricing existed keep their exact behaviour.
            pricing_basis: o.pricing_basis ?? 'fixed',
            per_pax_delta_centavos: o.per_pax_delta_centavos ?? 0,
            min_pax: o.min_pax ?? 0,
          })),
        }
      : {}),
  };
}

/** Re-shape a fetched package into the engine's input. */
export function toCreditPackage(pkg: VendorPackageWithItems): CreditPackage {
  const policy = pkg.unspent_credit_policy;
  return {
    total_price_centavos: pkg.total_price_centavos,
    consumable_budget_centavos: pkg.consumable_budget_centavos,
    is_consumable_flexible: pkg.is_consumable_flexible === true,
    // 'refundable' is RETIRED (owner 2026-07-26: credit shifts, never
    // discounts). Anything that is not 'expiring' — including a stored
    // 'refundable' — normalises here, and the engine refuses it if it somehow
    // reaches that far. Both directions land on "the couple pays full price".
    unspent_credit_policy:
      policy === 'expiring' ? policy : DEFAULT_UNSPENT_CREDIT_POLICY,
    items: pkg.items.map(toCreditItem),
  };
}

/**
 * THE ONE PRICER for a customized package. Both write sites on the lock path
 * must go through this.
 *
 * Why it exists: `lockPackage` and `removeItemFromPackage` each compute
 * `total_locked_centavos` independently. They drifted the moment choices
 * shipped — the lock path became credit-aware while the remove path kept
 * calling `computeCustomization` alone, so removing any line from a package
 * that carried a paid upgrade silently dropped the upgrade from the stored
 * total while `chosen_option_ids` still recorded the couple's pick. The vendor
 * would deliver the upgrade against a total that no longer contained it, and
 * because the booking fee is based on that total, the fee would quietly shrink
 * with it. One function, both callers, no room to diverge.
 *
 * Pure: the flag arrives as an argument rather than being read here, so this
 * stays testable with nothing mocked and both flag states are assertable.
 *
 * Returns `null` when the credit engine refuses — callers must surface that,
 * never substitute a number.
 */
/**
 * ⚠ ONE REQUIRED OBJECT, NOT POSITIONAL OPTIONALS — this shape is a bug fix.
 *
 * This took positional args with defaults, and a new one (`additions`) was
 * added at the lock site and forgotten at the remove site. `tsc` said nothing,
 * because a defaulted parameter is legal to omit — so removing a line silently
 * handed back credit the couple had already spent.
 *
 * Every field is REQUIRED. Adding one is now a compile error at every call
 * site, which forces each caller to answer for it rather than inherit a default
 * that happens to be wrong for them.
 */
export type PriceCustomizedPackageArgs = {
  pkg: VendorPackageWithItems;
  removedItemIds: ReadonlyArray<string>;
  chosenOptionIds: ReadonlyArray<string>;
  creditEnabled: boolean;
  /** Server-resolved head count, for per-head option upgrades. */
  paxCount: number;
  /** Catalogue buys funded by credit — ids + quantities only. */
  additions: ReadonlyArray<CreditAddition>;
  /** SERVER-read prices for those buys. Never a client number. */
  catalogue: ReadonlyArray<CreditCatalogueEntry>;
  /**
   * item_id → extra hours beyond the line's `min_hours`. A QUANTITY only; the
   * rate is re-read from the item row, never sent.
   *
   * ⚠ MUST ALREADY BE NARROWED — like `chosenOptionIds`, pass what
   * `chargeableExtraHours` returned, not what the browser sent. Both money
   * callers do; that shared narrowing is what makes the shown total and the
   * committed total the same computation.
   */
  extraHours: Readonly<Record<string, number>>;
};

export function priceCustomizedPackage({
  pkg,
  removedItemIds,
  chosenOptionIds,
  creditEnabled,
  paxCount,
  additions,
  catalogue,
  extraHours,
}: PriceCustomizedPackageArgs): {
  bookingTotalCentavos: number;
  remainingConsumableCentavos: number;
  availableCreditCentavos: number;
  overspendCentavos: number;
} | null {
  const legacy = computeCustomization(pkg, removedItemIds);

  // ── 🚦 THE SAFETY FLOOR RUNS ON BOTH BRANCHES ────────────────────────────
  //
  // THE FLAG CHOOSES THE PRICING MODEL, NEVER THE SAFETY FLOOR.
  //
  // Every refusal the branching shapes need — below `pick_min`, above
  // `pick_max`, an option on a line the booking does not contain, hours on a
  // line with no hourly rate or past its cap — lived only inside
  // `computePackageCredit`, which the legacy branch below never calls. So the
  // flag-OFF path (the one production actually runs) priced a 1-of-2 pick set
  // instead of refusing it, and quoted it CHEAPER than the finished order —
  // the exact thing this wave's own invariant forbids: "an unfinished order is
  // never a cheaper one, refuse rather than quote less."
  //
  // The floor is the engine itself, called for its VERDICT and not its numbers.
  // That is deliberate: a second hand-written copy of these rules is how the
  // two would drift, and drift on a refusal layer means one branch silently
  // permitting what the other refuses. The credit MATH stays flag-gated below;
  // only the yes/no is shared.
  const verdict = computePackageCredit({
    pkg: toCreditPackage(pkg),
    removedItemIds: allowedRemovals(pkg, removedItemIds),
    chosenOptionIds,
    paxCount,
    additions,
    catalogue,
    extraHours,
  });
  if (!verdict.ok) return null;

  if (!creditEnabled) {
    // Credit is OFF, so there is no pool to consume and no catalogue buy can be
    // funded. Refuse rather than silently dropping the additions — a caller
    // that asked to spend credit must not be told the booking simply cost less.
    if (additions.length > 0) return null;
    // Flag OFF: the shipped math, plus any option surcharge, plus any extra
    // hours. On a package with no choices this is byte-identical to what shipped
    // before choices existed, and a choice line sits on its standard option,
    // whose delta the DB pins to 0 — so this cannot quote below what the vendor
    // charges either.
    //
    // ⚠ THE BRANCHING SHAPES ARE PRICED ON THIS PATH TOO. The two flags are
    // independent: `packageAuthoringEnabled()` is what lets a vendor CREATE a
    // follow-up / pick-N / hourly line, and it is not this one. Leaving those
    // shapes at ₱0 here would mean "credit off" silently gave the couple every
    // upgrade for free.
    return {
      bookingTotalCentavos:
        legacy.totalLockedCentavos +
        chosenOptionsSurchargeCentavos(pkg, removedItemIds, chosenOptionIds) +
        extraHoursSurchargeCentavos(pkg, removedItemIds, extraHours),
      remainingConsumableCentavos: legacy.remainingConsumableCentavos,
      availableCreditCentavos: legacy.remainingConsumableCentavos,
      overspendCentavos: 0,
    };
  }

  // Flag ON: the engine's NUMBERS, from the same call whose verdict already
  // cleared the floor above. One evaluation, so the branch that prices and the
  // branch that merely validates can never see different results.
  return {
    bookingTotalCentavos: verdict.bookingTotalCentavos,
    remainingConsumableCentavos: verdict.remainingCreditCentavos,
    availableCreditCentavos: verdict.availableCreditCentavos,
    overspendCentavos: verdict.overspendCentavos,
  };
}

/**
 * Narrow the host's removal list to the removals they are actually ALLOWED to
 * make, before the engine ever sees it.
 *
 * The engine fails CLOSED on a removal naming a required or never-included line
 * (`required_item_removed` / `remove_not_included`), while the shipped
 * `computeCustomization` silently ignores it. Handing the raw list straight
 * through would therefore turn a stale page — a vendor marked a line required
 * after the modal loaded — into a hard lock failure on a money action, which is
 * a regression against behaviour couples have today.
 *
 * Dropping a removal is CONSERVATIVE in exactly the direction that matters: the
 * line stays in the booking and its value never enters the credit pool, so this
 * can only ever hand out LESS credit, never more. The engine's fail-closed
 * guarantee exists to stop credit being INFLATED; this cannot inflate it.
 *
 * Everything else the engine refuses — unknown ids, duplicate picks, an
 * unchosen required choice — is left to fail closed, because those are real
 * problems that a number would paper over.
 */
export function allowedRemovals(
  pkg: VendorPackageWithItems,
  removedItemIds: ReadonlyArray<string>,
): string[] {
  const requested = new Set(removedItemIds);
  return pkg.items
    .filter((item) => requested.has(item.item_id) && isRemovableItem(item))
    .map((item) => item.item_id);
}

/**
 * The choice lines that the couple MUST pick before the package can be locked.
 *
 * A required choice line has no valid unpicked state: the engine refuses to
 * apply its default (`required_choice_unselected`), by owner rule — "must pick
 * a main course" is a decision the couple has to make, and quietly defaulting
 * it hides that from them. The UI has to block rather than preselect, or the
 * modal shows a selection the server will reject.
 *
 * Only KEPT lines count: a removed line requires nothing.
 */
export function unresolvedRequiredChoices(
  pkg: VendorPackageWithItems,
  removedItemIds: ReadonlyArray<string>,
  chosenOptionIds: ReadonlyArray<string>,
): string[] {
  const removed = new Set(allowedRemovals(pkg, removedItemIds));
  const chosen = new Set(chosenOptionIds);
  return pkg.items
    .filter(
      (item) =>
        item.is_required === true &&
        item.is_default_included === true &&
        !removed.has(item.item_id) &&
        (item.options?.length ?? 0) > 0 &&
        !item.options!.some((o) => chosen.has(o.option_id) && o.is_available),
    )
    .map((item) => item.item_id);
}
