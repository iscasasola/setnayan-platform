/**
 * PACKAGE CREDIT ENGINE — pure, total, fail-closed (owner-locked 2026-07-26).
 *
 * The successor to `computeCustomization` in ./vendor-packages. That function
 * is the ACCRUAL half of the model — remove a line, the pool grows. This
 * module keeps the accrual and adds the SPEND half: choose a premium
 * alternative on a line, or buy something else from the vendor's catalogue,
 * and the pool drains. Overspend is allowed and lands on the booking total.
 *
 * THE MODEL
 * ---------
 *   1. A package carries a CREDIT POOL (hotel F&B-credit shape). Dropping an
 *      inclusion returns that item's value to the pool. The package PRICE
 *      stays fixed, so credit changes WHAT you get, not what you pay.
 *   2. Credit is spendable across the vendor's WHOLE catalogue, not just the
 *      package's own lines (`additions`).
 *   3. A line can be a CHOICE — one inclusion, N alternatives, pick one. Each
 *      alternative carries its own price delta; the package price assumes the
 *      DEFAULT (whose delta is pinned to 0 in the DB), so a premium pick adds
 *      only its difference.
 *   4. REQUIRED is a SEPARATE AXIS from CHOICE. All four combinations are
 *      real: required+fixed (the venue) · required+choice (must pick a main
 *      course, 1 of 3) · optional+fixed (chocolate fountain, drop it for
 *      credit) · optional+choice (dessert optional; pick one if taken).
 *   5. Unspent credit is the VENDOR's decision PER PACKAGE: 'expiring' (use
 *      it or lose it) or 'refundable' (comes off the price).
 *   6. Overspend is ALLOWED — it is added to the booking total and collected
 *      through the EXISTING apply-then-pay rail. No new payment machinery.
 *
 * THE INVARIANT THAT DECIDES CORRECTNESS
 * --------------------------------------
 * A REQUIRED line's value must NEVER enter the available-credit pool. A
 * couple must never be shown credit they cannot actually free. Structurally
 * enforced here: credit accrues ONLY from ids in `removedItemIds`, and a
 * removal that names a required line is rejected outright — so a required
 * line's `replacement_value_centavos` has no path into the sum. There is no
 * "subtract it back out afterwards" step to get wrong.
 *
 * PURITY
 * ------
 * No env, no clock, no I/O, no imports. Everything arrives as arguments, so
 * this runs under `tsx --test` with nothing mocked. Callers MUST pass
 * server-derived rows: never a price, delta, or total taken from a client
 * payload. The client sends ids (`removedItemIds`, `chosenOptionIds`,
 * addition ids + quantities); the server re-reads every peso from the DB.
 *
 * FAIL CLOSED
 * -----------
 * Every anomaly — unknown id, duplicate selection, removing a required line,
 * an un-chosen required choice, a non-integer or absurd amount — returns
 * `{ ok: false, errors }`. It never falls back to a "best effort" number,
 * because every failure mode here inflates credit, and inflated credit is a
 * promise of money that does not exist.
 *
 * Money is BIGINT CENTAVOS everywhere (matching
 * vendor_packages.total_price_centavos, vendor_package_items.
 * replacement_value_centavos, vendor_package_item_options.
 * price_delta_centavos). Never mix in pesos.
 *
 * Schema: 20271006413374_vendor_package_credit_required_and_choice_options.sql
 * Flag:   ./package-credit-flag  (NEXT_PUBLIC_PACKAGE_CREDIT, default OFF)
 */

/* ──────────────────────────────────────────────────────────────────────── */
/* Bounds                                                                   */
/* ──────────────────────────────────────────────────────────────────────── */

/**
 * Hard ceiling for any single money value: 1,000,000,000 PHP in centavos.
 * Two jobs: (a) reject the absurd (a fat-fingered vendor edit, a corrupted
 * row, a hostile payload) before it becomes a credit promise, and (b) keep
 * every intermediate sum far inside Number.MAX_SAFE_INTEGER so the arithmetic
 * is exact. Real Filipino hotel packages top out ~2M PHP; this is 500x that.
 */
export const MAX_MONEY_CENTAVOS = 100_000_000_000;

/** Ceiling on a single catalogue addition's quantity. */
export const MAX_ADDITION_QUANTITY = 10_000;

/* ──────────────────────────────────────────────────────────────────────── */
/* Input types — structural, so this module stays decoupled from the DB      */
/* row types in ./vendor-packages (same convention as ./package-line-pricing) */
/* ──────────────────────────────────────────────────────────────────────── */

/** Vendor's per-package decision about leftover credit. */
export type UnspentCreditPolicy = 'expiring' | 'refundable';

/** One alternative on a CHOICE line (`vendor_package_item_options` row). */
export type CreditOption = {
  option_id: string;
  /**
   * EXTRA cost over the package's assumed default, in centavos. The DB pins
   * the default's delta to 0 (`vendor_package_item_options_default_is_free`)
   * because total_price_centavos already pays for the default.
   */
  price_delta_centavos: number;
  is_default: boolean;
  /** A retired alternative: still referenced by old bookings, not newly choosable. */
  is_available: boolean;
};

/** One package line (`vendor_package_items` row + its options). */
export type CreditItem = {
  item_id: string;
  /**
   * TRUE = cannot be removed AND its value never enters the credit pool.
   * NOT the same thing as is_default_included.
   */
  is_required: boolean;
  /** "Ticked by default." A line that is not included frees nothing. */
  is_default_included: boolean;
  /** The credit this line returns when it is dropped. */
  replacement_value_centavos: number;
  /** A line is a CHOICE iff this is non-empty. */
  options?: ReadonlyArray<CreditOption>;
};

/** The package being customized (`vendor_packages` row + its items). */
export type CreditPackage = {
  total_price_centavos: number;
  consumable_budget_centavos: number;
  /**
   * TRUE  = credit model. Removing a line moves its value into the pool and
   *         the price stays fixed ("changes WHAT you get, not what you pay").
   * FALSE = legacy behaviour, preserved: removing a line reduces the price
   *         one-for-one and the pool stays at consumable_budget_centavos.
   */
  is_consumable_flexible: boolean;
  unspent_credit_policy: UnspentCreditPolicy;
  items: ReadonlyArray<CreditItem>;
};

/**
 * Something bought from the vendor's wider catalogue with package credit.
 * `unit_price_centavos` MUST be re-read server-side from the catalogue row —
 * never accepted from the client.
 */
export type CreditAddition = {
  /** Catalogue row id (vendor_services / vendor add-on). Used for de-duping. */
  addition_id: string;
  unit_price_centavos: number;
  quantity: number;
};

export type PackageCreditInput = {
  pkg: CreditPackage;
  /** Line ids the couple dropped. Required lines here are an error. */
  removedItemIds?: ReadonlyArray<string>;
  /** Option ids the couple picked. At most one per line. */
  chosenOptionIds?: ReadonlyArray<string>;
  /** Catalogue buys funded by the credit pool. */
  additions?: ReadonlyArray<CreditAddition>;
};

/* ──────────────────────────────────────────────────────────────────────── */
/* Output types                                                             */
/* ──────────────────────────────────────────────────────────────────────── */

export type PackageCreditErrorCode =
  | 'invalid_package'
  | 'invalid_money'
  | 'invalid_addition'
  | 'duplicate_item'
  | 'duplicate_option'
  | 'duplicate_removal'
  | 'duplicate_addition'
  | 'multiple_default_options'
  | 'unknown_item'
  | 'unknown_option'
  | 'required_item_removed'
  | 'remove_not_included'
  | 'option_on_removed_item'
  | 'multiple_options_for_item'
  | 'option_unavailable'
  | 'required_choice_unselected'
  | 'choice_line_has_no_default'
  | 'overflow';

export type PackageCreditError = {
  code: PackageCreditErrorCode;
  /** The offending id, when there is one. */
  ref?: string;
  /** Operator-facing detail. Not user copy. */
  detail: string;
};

/** How a CHOICE line ended up resolved. */
export type ResolvedSelection = {
  item_id: string;
  option_id: string;
  price_delta_centavos: number;
  /** 'chosen' = the couple picked it. 'default' = fell back to the line default. */
  source: 'chosen' | 'default';
};

export type PackageCreditOk = {
  ok: true;
  /** Credit the couple can actually spend. Required lines contribute NOTHING. */
  availableCreditCentavos: number;
  /** Option deltas on kept lines + catalogue additions. */
  spentCreditCentavos: number;
  /** available − spent, floored at 0. */
  remainingCreditCentavos: number;
  /** spent − available, floored at 0. Billed on the existing apply-then-pay rail. */
  overspendCentavos: number;
  /** Remaining credit lost under the 'expiring' policy (0 under 'refundable'). */
  forfeitedCreditCentavos: number;
  /** Remaining credit taken off the price under 'refundable' (0 under 'expiring'). */
  creditRefundCentavos: number;
  /** What the couple pays. */
  bookingTotalCentavos: number;
  /** Sum of removed lines' replacement values (all optional, by construction). */
  removedTotalCentavos: number;
  /** Lines that survive — these are the ones that cascade into event_vendors. */
  keptItemIds: ReadonlyArray<string>;
  /** One entry per kept CHOICE line. */
  selections: ReadonlyArray<ResolvedSelection>;
};

export type PackageCreditResult =
  | PackageCreditOk
  | { ok: false; errors: ReadonlyArray<PackageCreditError> };

/* ──────────────────────────────────────────────────────────────────────── */
/* Guards                                                                   */
/* ──────────────────────────────────────────────────────────────────────── */

/** A money amount we are willing to reason about: exact, non-negative, sane. */
function isMoney(v: unknown): v is number {
  return (
    typeof v === 'number' &&
    Number.isSafeInteger(v) &&
    v >= 0 &&
    v <= MAX_MONEY_CENTAVOS
  );
}

function isNonEmptyId(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

/** A line is a CHOICE iff it carries at least one alternative. */
export function isChoiceLine(item: CreditItem): boolean {
  return Array.isArray(item.options) && item.options.length > 0;
}

/* ──────────────────────────────────────────────────────────────────────── */
/* The engine                                                               */
/* ──────────────────────────────────────────────────────────────────────── */

/**
 * Compute the credit position for a customized package.
 *
 * Returns EVERY problem it finds (not just the first) so a caller can show a
 * complete list, and returns nothing spendable when there is any problem at
 * all. There is deliberately no partial-success mode: a half-validated credit
 * figure is worse than no figure.
 */
export function computePackageCredit(input: PackageCreditInput): PackageCreditResult {
  const errors: PackageCreditError[] = [];
  const fail = (code: PackageCreditErrorCode, detail: string, ref?: string) => {
    errors.push(ref === undefined ? { code, detail } : { code, ref, detail });
  };

  /* ---- 0. Shape of the package itself ---------------------------------- */

  const pkg = input?.pkg;
  if (!pkg || typeof pkg !== 'object') {
    return { ok: false, errors: [{ code: 'invalid_package', detail: 'pkg missing' }] };
  }
  if (!Array.isArray(pkg.items)) {
    return { ok: false, errors: [{ code: 'invalid_package', detail: 'pkg.items is not an array' }] };
  }
  if (!isMoney(pkg.total_price_centavos)) {
    fail('invalid_money', `total_price_centavos is not a sane centavo amount: ${String(pkg.total_price_centavos)}`);
  }
  if (!isMoney(pkg.consumable_budget_centavos)) {
    fail('invalid_money', `consumable_budget_centavos is not a sane centavo amount: ${String(pkg.consumable_budget_centavos)}`);
  }
  if (pkg.unspent_credit_policy !== 'expiring' && pkg.unspent_credit_policy !== 'refundable') {
    // Unknown policy => we cannot say what happens to leftover money. Refuse.
    fail('invalid_package', `unknown unspent_credit_policy: ${String(pkg.unspent_credit_policy)}`);
  }
  if (typeof pkg.is_consumable_flexible !== 'boolean') {
    fail('invalid_package', 'is_consumable_flexible must be a boolean');
  }

  /* ---- 1. Index the items + options ------------------------------------ */

  const itemById = new Map<string, CreditItem>();
  /** option_id → { option, item } */
  const optionById = new Map<string, { option: CreditOption; item: CreditItem }>();

  for (const item of pkg.items) {
    if (!item || typeof item !== 'object' || !isNonEmptyId(item.item_id)) {
      fail('invalid_package', 'package item missing a usable item_id');
      continue;
    }
    if (itemById.has(item.item_id)) {
      fail('duplicate_item', 'the same item appears twice in pkg.items', item.item_id);
      continue;
    }
    if (typeof item.is_required !== 'boolean' || typeof item.is_default_included !== 'boolean') {
      fail('invalid_package', 'item is_required / is_default_included must be booleans', item.item_id);
      continue;
    }
    if (!isMoney(item.replacement_value_centavos)) {
      fail(
        'invalid_money',
        `replacement_value_centavos is not a sane centavo amount: ${String(item.replacement_value_centavos)}`,
        item.item_id,
      );
      continue;
    }
    itemById.set(item.item_id, item);

    const options = item.options;
    if (options === undefined || options === null) continue;
    if (!Array.isArray(options)) {
      fail('invalid_package', 'item.options is not an array', item.item_id);
      continue;
    }
    let defaultCount = 0;
    for (const option of options) {
      if (!option || typeof option !== 'object' || !isNonEmptyId(option.option_id)) {
        fail('invalid_package', 'option missing a usable option_id', item.item_id);
        continue;
      }
      if (optionById.has(option.option_id)) {
        fail('duplicate_option', 'the same option_id appears twice', option.option_id);
        continue;
      }
      if (typeof option.is_default !== 'boolean' || typeof option.is_available !== 'boolean') {
        fail('invalid_package', 'option is_default / is_available must be booleans', option.option_id);
        continue;
      }
      if (!isMoney(option.price_delta_centavos)) {
        // Negative deltas would let a REQUIRED line mint credit — the exact
        // thing the invariant forbids — so they are refused here as well as
        // by the DB CHECK.
        fail(
          'invalid_money',
          `price_delta_centavos is not a sane centavo amount: ${String(option.price_delta_centavos)}`,
          option.option_id,
        );
        continue;
      }
      if (option.is_default) {
        defaultCount += 1;
        if (option.price_delta_centavos !== 0) {
          // The package price already includes the default; charging extra
          // for it would surcharge a couple who chose nothing.
          fail('invalid_package', 'the default option must have a zero delta', option.option_id);
        }
      }
      optionById.set(option.option_id, { option, item });
    }
    if (defaultCount > 1) {
      fail('multiple_default_options', 'a choice line has more than one default option', item.item_id);
    }
  }

  /* ---- 2. Removals ------------------------------------------------------ */

  const removedItemIds = input.removedItemIds ?? [];
  if (!Array.isArray(removedItemIds)) {
    return { ok: false, errors: [{ code: 'invalid_package', detail: 'removedItemIds is not an array' }] };
  }

  const removed = new Set<string>();
  for (const rawId of removedItemIds) {
    if (!isNonEmptyId(rawId)) {
      fail('unknown_item', 'removedItemIds contains a non-id value');
      continue;
    }
    if (removed.has(rawId)) {
      // Silently de-duping would be safe for the sum but hides a caller bug
      // that is one refactor away from double-counting. Refuse instead.
      fail('duplicate_removal', 'the same item is removed twice', rawId);
      continue;
    }
    const item = itemById.get(rawId);
    if (!item) {
      fail('unknown_item', 'removed item does not belong to this package', rawId);
      continue;
    }
    if (item.is_required) {
      // 🚨 THE INVARIANT. A required line cannot be dropped, so its value
      // never reaches the credit sum below.
      fail('required_item_removed', 'this line is required and cannot be removed', rawId);
      continue;
    }
    if (!item.is_default_included) {
      // It was never in the package, so dropping it frees nothing. Allowing
      // it would mint credit out of thin air.
      fail('remove_not_included', 'line is not included by default, so it frees no credit', rawId);
      continue;
    }
    removed.add(rawId);
  }

  /* ---- 3. Chosen options ------------------------------------------------ */

  const chosenOptionIds = input.chosenOptionIds ?? [];
  if (!Array.isArray(chosenOptionIds)) {
    return { ok: false, errors: [{ code: 'invalid_package', detail: 'chosenOptionIds is not an array' }] };
  }

  /** item_id → chosen option */
  const chosenByItem = new Map<string, CreditOption>();
  const seenOptionIds = new Set<string>();
  for (const rawId of chosenOptionIds) {
    if (!isNonEmptyId(rawId)) {
      fail('unknown_option', 'chosenOptionIds contains a non-id value');
      continue;
    }
    if (seenOptionIds.has(rawId)) {
      fail('duplicate_option', 'the same option is chosen twice', rawId);
      continue;
    }
    seenOptionIds.add(rawId);
    const hit = optionById.get(rawId);
    if (!hit) {
      // Covers the vendor-deleted-the-option case: a stored selection that no
      // longer resolves fails closed instead of silently re-pricing.
      fail('unknown_option', 'option does not belong to this package', rawId);
      continue;
    }
    if (removed.has(hit.item.item_id)) {
      fail('option_on_removed_item', 'an option was chosen on a line that was removed', rawId);
      continue;
    }
    if (!hit.option.is_available) {
      fail('option_unavailable', 'this alternative is no longer offered', rawId);
      continue;
    }
    if (chosenByItem.has(hit.item.item_id)) {
      fail('multiple_options_for_item', 'more than one alternative chosen for the same line', hit.item.item_id);
      continue;
    }
    chosenByItem.set(hit.item.item_id, hit.option);
  }

  /* ---- 4. Resolve every kept line -------------------------------------- */

  const keptItemIds: string[] = [];
  const selections: ResolvedSelection[] = [];
  let optionDeltaTotal = 0;

  for (const item of itemById.values()) {
    if (removed.has(item.item_id)) continue;
    // A line that is neither required nor ticked by default simply is not in
    // the booking; it is not "kept" and it carries no delta.
    if (!item.is_default_included && !item.is_required) continue;
    keptItemIds.push(item.item_id);

    if (!isChoiceLine(item)) continue;

    const chosen = chosenByItem.get(item.item_id);
    if (chosen) {
      selections.push({
        item_id: item.item_id,
        option_id: chosen.option_id,
        price_delta_centavos: chosen.price_delta_centavos,
        source: 'chosen',
      });
      optionDeltaTotal += chosen.price_delta_centavos;
      continue;
    }

    if (item.is_required) {
      // Owner rule: a required choice line must be picked. We do NOT quietly
      // apply the default — "must pick a main course" is a decision the
      // couple has to make, and pretending otherwise hides it from them.
      fail('required_choice_unselected', 'this line requires one alternative to be chosen', item.item_id);
      continue;
    }

    // Optional choice line, kept, nothing picked → the package's own default,
    // which by construction costs nothing extra.
    const fallback = (item.options ?? []).find((o) => o.is_default && o.is_available);
    if (!fallback) {
      fail('choice_line_has_no_default', 'kept choice line has no available default to fall back on', item.item_id);
      continue;
    }
    selections.push({
      item_id: item.item_id,
      option_id: fallback.option_id,
      price_delta_centavos: fallback.price_delta_centavos,
      source: 'default',
    });
    optionDeltaTotal += fallback.price_delta_centavos;
  }

  /* ---- 5. Catalogue additions ------------------------------------------ */

  const additions = input.additions ?? [];
  if (!Array.isArray(additions)) {
    return { ok: false, errors: [{ code: 'invalid_package', detail: 'additions is not an array' }] };
  }

  const seenAdditionIds = new Set<string>();
  let additionsTotal = 0;
  for (const addition of additions) {
    if (!addition || typeof addition !== 'object' || !isNonEmptyId(addition.addition_id)) {
      fail('invalid_addition', 'addition missing a usable addition_id');
      continue;
    }
    if (seenAdditionIds.has(addition.addition_id)) {
      fail('duplicate_addition', 'the same catalogue item is added twice — use quantity', addition.addition_id);
      continue;
    }
    seenAdditionIds.add(addition.addition_id);
    if (!isMoney(addition.unit_price_centavos)) {
      fail(
        'invalid_addition',
        `unit_price_centavos is not a sane centavo amount: ${String(addition.unit_price_centavos)}`,
        addition.addition_id,
      );
      continue;
    }
    if (
      typeof addition.quantity !== 'number' ||
      !Number.isSafeInteger(addition.quantity) ||
      addition.quantity < 1 ||
      addition.quantity > MAX_ADDITION_QUANTITY
    ) {
      fail(
        'invalid_addition',
        `quantity must be an integer in 1..${MAX_ADDITION_QUANTITY}, got ${String(addition.quantity)}`,
        addition.addition_id,
      );
      continue;
    }
    additionsTotal += addition.unit_price_centavos * addition.quantity;
  }

  /* ---- 6. Nothing computes unless everything validated ------------------ */

  if (errors.length > 0) return { ok: false, errors };

  /* ---- 7. The credit math ---------------------------------------------- */

  let removedTotalCentavos = 0;
  for (const id of removed) {
    // Non-null: `removed` only ever receives ids that resolved in itemById.
    removedTotalCentavos += itemById.get(id)!.replacement_value_centavos;
  }

  // AVAILABLE CREDIT. Required lines contribute nothing — they cannot be in
  // `removed`, so there is no term to subtract back out.
  const availableCreditCentavos = pkg.is_consumable_flexible
    ? pkg.consumable_budget_centavos + removedTotalCentavos
    : // Legacy (non-flexible) packages: removals cut the PRICE instead of
      // feeding the pool, so the pool is just the stated budget.
      pkg.consumable_budget_centavos;

  const spentCreditCentavos = optionDeltaTotal + additionsTotal;

  const remainingCreditCentavos = Math.max(0, availableCreditCentavos - spentCreditCentavos);
  const overspendCentavos = Math.max(0, spentCreditCentavos - availableCreditCentavos);

  const refundable = pkg.unspent_credit_policy === 'refundable';
  const creditRefundCentavos = refundable ? remainingCreditCentavos : 0;
  const forfeitedCreditCentavos = refundable ? 0 : remainingCreditCentavos;

  // BOOKING TOTAL. Flexible = the price is fixed ("changes WHAT you get, not
  // what you pay"); non-flexible keeps the legacy dollar-for-dollar cut.
  const basePriceCentavos = pkg.is_consumable_flexible
    ? pkg.total_price_centavos
    : Math.max(0, pkg.total_price_centavos - removedTotalCentavos);

  const bookingTotalCentavos = Math.max(
    0,
    basePriceCentavos + overspendCentavos - creditRefundCentavos,
  );

  // Belt-and-braces: if any sum left exact-integer territory, refuse rather
  // than hand back a rounded peso figure.
  for (const value of [
    availableCreditCentavos,
    spentCreditCentavos,
    remainingCreditCentavos,
    overspendCentavos,
    bookingTotalCentavos,
    removedTotalCentavos,
  ]) {
    if (!Number.isSafeInteger(value)) {
      return {
        ok: false,
        errors: [{ code: 'overflow', detail: 'a credit total left safe-integer range' }],
      };
    }
  }

  return {
    ok: true,
    availableCreditCentavos,
    spentCreditCentavos,
    remainingCreditCentavos,
    overspendCentavos,
    forfeitedCreditCentavos,
    creditRefundCentavos,
    bookingTotalCentavos,
    removedTotalCentavos,
    keptItemIds,
    selections,
  };
}
