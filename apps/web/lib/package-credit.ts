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
 *   3. A line can be a CHOICE — one inclusion, N alternatives, pick between
 *      `pick_min` and `pick_max` of them (1 and 1 unless the vendor said
 *      otherwise). Each alternative carries its own price delta; the package
 *      price assumes the DEFAULT (whose delta is pinned to 0 in the DB), so a
 *      premium pick adds only its difference. EVERY pick adds its own.
 *   3b. A picked option can REVEAL a follow-up line ("which style of lechon?"),
 *      which is itself a choice line and is priced the same way. A follow-up is
 *      forced by DB CHECK to `is_default_included = FALSE`, so its own value is
 *      never in the sticker price and it never cascades a booked row — but the
 *      couple reached it by buying its parent, so its option deltas are real
 *      money and are charged.
 *   3c. An hourly line can take EXTRA hours, capped at `max_extra_hours` and
 *      billed at `extra_hour_centavos`.
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
 * The addition types enforce that structurally — `CreditAddition` carries no
 * money at all, and prices arrive separately in `catalogue`.
 *
 * ⚠ 'refundable' IS AN UNVERIFIED SEMANTIC — OWNER DECISION OPEN
 * -------------------------------------------------------------
 * Read literally ("unspent credit comes off the price"), 'refundable' refunds
 * the WHOLE unspent pool — which includes `consumable_budget_centavos`, money
 * the sticker price already charged for. Consequence: on the seeded
 * ₱1,400,000 / ₱200,000-consumable package, a couple who customizes NOTHING
 * pays ₱1,200,000 and still receives every inclusion. It also means removals
 * cut the price, which contradicts the model's own pillar ("changes WHAT you
 * get, not what you pay") — under 'refundable' a flexible package behaves
 * like the legacy non-flexible one.
 *
 * That is what the owner's wording says, so it is implemented as written and
 * PINNED BY TEST rather than quietly reinterpreted. It is safe today: the
 * column DEFAULTS to 'expiring', 'expiring' reproduces the shipped math to the
 * centavo, and no surface can set 'refundable' (there is no vendor authoring
 * UI). Owner must confirm the intended reading before any package uses it.
 *
 * FAIL CLOSED
 * -----------
 * Every anomaly — unknown id, duplicate selection, removing a required line,
 * an un-chosen required choice, more picks than the line takes, FEWER picks
 * than it needs, hours on a line that has no hourly rate, a non-integer or
 * absurd amount — returns `{ ok: false, errors }`. It never falls back to a
 * "best effort" number, because every failure mode here inflates credit, and
 * inflated credit is a promise of money that does not exist.
 *
 * ⚠ THIS IS STILL THE ONLY REFUSAL LAYER. Widening what can be PRICED (§3b/3c)
 * did not widen what can be GUESSED: a shape this engine does not understand
 * still returns null through `priceCustomizedPackage`, which `lockPackage`
 * turns into a hard error rather than a silent ₱0.
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

/**
 * What happens to leftover credit.
 *
 * ONE value, deliberately. Owner-locked 2026-07-26: **"credits can be shifted to
 * other services, but will not discount the price."** Credit changes WHAT the
 * couple gets, never what they pay, so there is no policy under which unspent
 * credit becomes money off the price.
 *
 * ⚠ 'refundable' was RETIRED. It was implemented as-written and flagged as an
 * unverified semantic; read literally it refunded the whole unspent pool —
 * INCLUDING `consumable_budget_centavos`, money the sticker price already
 * charged for. On the seeded ₱1,400,000 / ₱200,000-budget package a couple who
 * customized NOTHING paid ₱1,200,000 and still received every inclusion.
 */
export type UnspentCreditPolicy = 'expiring';

/** How an option's uplift is priced. Mirrors the LINE basis in ./package-line-pricing. */
export type CreditOptionBasis = 'fixed' | 'per_pax';

/** One alternative on a CHOICE line (`vendor_package_item_options` row). */
export type CreditOption = {
  option_id: string;
  /**
   * 'fixed'   → `price_delta_centavos` is the whole uplift.
   * 'per_pax' → the uplift is `per_pax_delta_centavos × max(pax, min_pax)`,
   *             which is how PH catering actually prices a premium menu.
   * Absent = 'fixed', so every option written before this existed keeps its
   * exact behaviour.
   */
  pricing_basis?: CreditOptionBasis;
  /** Per-head uplift when the basis is 'per_pax'. Non-negative, like the flat delta. */
  per_pax_delta_centavos?: number;
  /** Billing floor for a per_pax option. */
  min_pax?: number;
  /**
   * EXTRA cost over the package's assumed default, in centavos. The DB pins
   * the default's delta to 0 (`vendor_package_item_options_default_is_free`)
   * because total_price_centavos already pays for the default.
   */
  price_delta_centavos: number;
  is_default: boolean;
  /**
   * FALSE = retired; the vendor no longer offers it.
   *
   * ⚠ This engine rejects ANY chosen option that is unavailable. It cannot
   * tell a NEW pick from one already stored on a locked booking, so today
   * retirement bricks a stored selection exactly as hard as deleting the row
   * (`option_unavailable` vs `unknown_option`). Resolving stored selections
   * regardless of availability needs an extra input and belongs to the
   * booking/lock wave. The DB pins the DEFAULT option available so a vendor
   * retiring an alternative can never brick a whole live package.
   */
  is_available: boolean;
};

/** One package line (`vendor_package_items` row + its options). */
export type CreditItem = {
  item_id: string;
  /**
   * TRUE = cannot be removed AND its value never enters the credit pool.
   * NOT the same thing as is_default_included — but it IMPLIES it: a required
   * line that is not included is refused as `invalid_package` (mirrored by the
   * DB CHECK vendor_package_items_required_implies_included).
   */
  is_required: boolean;
  /** "Ticked by default." A line that is not included frees nothing. */
  is_default_included: boolean;
  /** The credit this line returns when it is dropped. */
  replacement_value_centavos: number;
  /**
   * FOLLOW-UP link. Non-null = this line exists only while that specific option
   * is IN FORCE on another line (picked, or the vendor default on a line the
   * couple left alone).
   *
   * 🚨 THIS IS WHY THE LINE IS PRICEABLE AT ALL. The DB CHECK
   * `vendor_package_items_followup_not_default_included_ck` forces every
   * follow-up to `is_default_included = FALSE`, and a not-included line used to
   * refuse every option on it outright (`option_on_excluded_item`). That refusal
   * was correct for an ADD-ON — nobody bought it — and wrong for a follow-up,
   * which the couple reached precisely BY buying its parent. The engine now
   * walks the reveal chain and treats a revealed follow-up as in the booking:
   * its own option deltas are charged exactly like any other choice line's.
   *
   * The line's own `replacement_value_centavos` still never enters the price or
   * the pool — a follow-up is a consequence of a pick, not a second purchase.
   */
  parent_option_id?: string | null;
  /**
   * "Choose N of M." Both or neither — the DB refuses a half-set pair. Null (the
   * only shape that existed before branching) reads as exactly-one, which is the
   * behaviour every package shipped with.
   */
  pick_min?: number | null;
  pick_max?: number | null;
  /**
   * The HOUR axis. `extra_hour_centavos` is the rate for each hour beyond the
   * line's `min_hours` (already inside the package price); `max_extra_hours`
   * caps how many the couple may add. A line takes hours iff BOTH are set — a
   * cap without a rate is not something we know how to bill.
   */
  extra_hour_centavos?: number | null;
  max_extra_hours?: number | null;
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
 *
 * DELIBERATELY CARRIES NO MONEY. The couple's request is "this id, this many"
 * and nothing else; the price comes from `PackageCreditInput.catalogue`, which
 * the server reads from the vendor's catalogue rows. The rule "never trust a
 * price from the client" used to live only in a doc comment — anyone spreading
 * a request body into `additions` could have minted arbitrary credit spend.
 * Now the shape makes that mistake unrepresentable.
 */
export type CreditAddition = {
  /** Catalogue row id (vendor_services / vendor add-on). Used for de-duping. */
  addition_id: string;
  quantity: number;
};

/**
 * A server-resolved catalogue price. MUST come from the DB row, never from a
 * client payload — this is the only place a peso figure for an addition may
 * enter the engine.
 */
export type CreditCatalogueEntry = {
  addition_id: string;
  unit_price_centavos: number;
};

export type PackageCreditInput = {
  pkg: CreditPackage;
  /**
   * Head count used to price `per_pax` options. Server-resolved (`lib/pax.ts`
   * `resolveLivePax`), never taken from the client — it is a multiplier on
   * money.
   *
   * Omitted = 0, which with `min_pax` floors still prices a per-head option at
   * its minimum rather than at nothing. A per-head upgrade must never be free
   * because a caller forgot to pass the guest count.
   */
  paxCount?: number;
  /** Line ids the couple dropped. Required lines here are an error. */
  removedItemIds?: ReadonlyArray<string>;
  /**
   * Option ids the couple picked. At most `pick_max` per line (which is 1 for
   * every line that does not set the pair), and only on lines the booking
   * actually contains — a kept top-level line, or a follow-up whose parent
   * option is in force.
   */
  chosenOptionIds?: ReadonlyArray<string>;
  /**
   * item_id → EXTRA hours requested beyond the line's `min_hours`, which the
   * package price already covers. Priced at the line's own
   * `extra_hour_centavos`, and refused outright above `max_extra_hours` — the
   * caller clamps, this fails closed.
   *
   * Like every other number here it must be SERVER-derived: the client sends a
   * quantity, the server re-reads the rate.
   */
  extraHours?: Readonly<Record<string, number>>;
  /** Catalogue buys funded by the credit pool — ids + quantities only. */
  additions?: ReadonlyArray<CreditAddition>;
  /**
   * Server-resolved prices for everything in `additions`. An addition with no
   * entry here fails closed (`unknown_addition`) rather than being priced at
   * zero — a missing price must never become free credit spend.
   */
  catalogue?: ReadonlyArray<CreditCatalogueEntry>;
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
  | 'option_on_excluded_item'
  | 'unknown_addition'
  /** More picks than the line's `pick_max` admits (1 unless the vendor set a pair). */
  | 'multiple_options_for_item'
  /** FEWER picks than `pick_min`. An unfinished order is not a cheaper one. */
  | 'pick_below_minimum'
  | 'option_unavailable'
  | 'required_choice_unselected'
  | 'choice_line_has_no_default'
  /** Hours asked of a line with no hour rate, or of a line not in the booking. */
  | 'extra_hours_not_offered'
  /** Hours that are not a whole number in `0..max_extra_hours`. */
  | 'invalid_extra_hours'
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
  /** Option deltas on lines in the booking + extra hours + catalogue additions. */
  spentCreditCentavos: number;
  /**
   * What the hour steppers added, in centavos. Broken out of
   * `spentCreditCentavos` purely as an audit trail — it is spend like any other,
   * so it drains the pool first and only overflows onto the price.
   */
  extraHoursCentavos: number;
  /** available − spent, floored at 0. */
  remainingCreditCentavos: number;
  /** spent − available, floored at 0. Billed on the existing apply-then-pay rail. */
  overspendCentavos: number;
  /**
   * Remaining credit that is LOST: all of it under 'expiring', and under
   * 'refundable' whatever the price was too small to absorb.
   * Always `remainingCredit − creditRefund`.
   */
  forfeitedCreditCentavos: number;
  /**
   * Remaining credit actually taken off the price under 'refundable' (0 under
   * 'expiring'). Capped at the base price — never reports a discount larger
   * than the one applied.
   */
  creditRefundCentavos: number;
  /**
   * What the couple pays. Exactly
   * `basePrice + overspendCentavos − creditRefundCentavos`, and never negative.
   */
  bookingTotalCentavos: number;
  /** Sum of removed lines' replacement values (all optional, by construction). */
  removedTotalCentavos: number;
  /**
   * Lines that survive: included by default and not removed.
   *
   * ⚠ NOT the same set as the shipped `keptItems()` in ./vendor-packages,
   * which filters ONLY on removal and therefore also returns lines with
   * `is_default_included = FALSE`. This engine excludes those — an unticked
   * line is not in the booking and must not cascade into event_vendors. The
   * divergence is intentional and inert while the flag is off (nothing calls
   * this), but the lock wave MUST pick one: switching the cascade to these
   * ids silently drops rows it creates today.
   *
   * FOLLOW-UPS ARE NOT HERE, even when they are revealed and charged for — see
   * {@link PackageCreditOk.revealedItemIds}. A follow-up is a question raised by
   * a pick, not a separate booked service, so it must never cascade a row.
   */
  keptItemIds: ReadonlyArray<string>;
  /**
   * FOLLOW-UP lines the reveal walk actually reached — their parent option is in
   * force, so their own options were resolved and priced.
   *
   * Deliberately a SEPARATE list from `keptItemIds`: these are priceable but not
   * cascadable, and collapsing the two is exactly how a conditional line would
   * become a booked `event_vendors` row.
   */
  revealedItemIds: ReadonlyArray<string>;
  /** One entry per resolved CHOICE line — kept or revealed, one per pick. */
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

/**
 * How many options a line takes.
 *
 * ⚠ ONE DEFINITION, TWO SURFACES. This lives here rather than in the choice
 * tree because the tree already imports from this module and the reverse edge
 * would be a cycle — and because the tree deciding a line takes 2 picks while
 * the pricer decided it takes 1 is precisely a display-vs-charge divergence.
 * `./package-choice-tree` re-exports it; there is no second copy.
 *
 * `pick_min`/`pick_max` null (every row written before branching) ⇒
 * `{ min: 1, max: 1 }` — today's exactly-one behaviour, unchanged. The DB
 * refuses a half-set pair and refuses `pick_min` of 0, so a set pair is always
 * coherent; the clamps exist because this is also handed objects built IN
 * MEMORY, where no constraint applies.
 */
export function pickBounds(item: {
  pick_min?: number | null;
  pick_max?: number | null;
}): { min: number; max: number } {
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
 * Does this line take a quantity of EXTRA hours, and how far does it go?
 *
 * `max_extra_hours` caps the HOURLY model already on `vendor_package_items`
 * (`hour_base_centavos` covers `min_hours`; each further hour costs
 * `extra_hour_centavos`). It is deliberately NOT a generic quantity cap — see
 * the column comment in migration 20271012816361 — so a line takes a stepper
 * only when it is actually priced by the hour, i.e. only when there is a rate
 * to bill. A cap with no rate is not something anyone knows how to charge for.
 *
 * `null` = this line has no quantity axis. Same one-definition argument as
 * {@link pickBounds}: the stepper the couple sees and the hours the pricer will
 * bill must be bounded by the same function.
 */
export function extraHoursBounds(item: {
  extra_hour_centavos?: number | null;
  max_extra_hours?: number | null;
}): { min: 0; max: number } | null {
  const rate = item.extra_hour_centavos;
  if (rate == null || !Number.isFinite(rate) || rate <= 0) return null;
  const cap = item.max_extra_hours;
  if (cap == null || !Number.isSafeInteger(cap) || cap <= 0) return null;
  return { min: 0, max: cap };
}

/**
 * What one option actually adds, in centavos, at this guest count.
 *
 * 'fixed'   → the flat delta.
 * 'per_pax' → rate × max(pax, min_pax) — the same billable-pax rule package
 *             LINES already use (`lib/package-line-pricing.ts`), so a premium
 *             menu prices identically whether it is a line or an option.
 */
export function optionDeltaCentavos(option: CreditOption, paxCount: number): number {
  if (option.pricing_basis === 'per_pax') {
    const rate = Number(option.per_pax_delta_centavos ?? 0);
    const billablePax = Math.max(
      Number.isFinite(paxCount) ? paxCount : 0,
      Number(option.min_pax ?? 0),
    );
    if (!Number.isFinite(rate) || !Number.isFinite(billablePax)) return 0;
    return Math.max(0, Math.round(rate * billablePax));
  }
  return Number(option.price_delta_centavos ?? 0);
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
  // Server-resolved head count for per-pax options. See PackageCreditInput.
  const paxCount = Number.isFinite(input?.paxCount) ? Number(input.paxCount) : 0;
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
  if (pkg.unspent_credit_policy !== 'expiring') {
    // 'refundable' lands here on purpose: a stored row still carrying the
    // retired value must REFUSE rather than quietly discount the price.
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
    if (item.is_required && !item.is_default_included) {
      // REQUIRED implies INCLUDED. "You must keep this line" is meaningless
      // for a line that is not in the package, and resolving it by precedence
      // is a money bug either way: keep it and the couple is DELIVERED an
      // inclusion they never paid for (and the cascade prices an
      // event_vendors row off it, inflating the platform-fee base); drop it
      // and "required" silently meant nothing. Refuse the row instead.
      // Mirrored at the DB by vendor_package_items_required_implies_included.
      fail(
        'invalid_package',
        'a required line must also be included by default (is_required=TRUE with is_default_included=FALSE is not a coherent line)',
        item.item_id,
      );
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
      if (option.pricing_basis === 'per_pax') {
        if (!isMoney(option.per_pax_delta_centavos)) {
          fail(
            'invalid_money',
            `per_pax_delta_centavos is not a sane centavo amount: ${String(option.per_pax_delta_centavos)}`,
            option.option_id,
          );
          continue;
        }
        const floor = option.min_pax ?? 0;
        if (!Number.isSafeInteger(floor) || floor < 0) {
          fail('invalid_package', `min_pax must be a non-negative integer: ${String(floor)}`, option.option_id);
          continue;
        }
      } else if (option.per_pax_delta_centavos) {
        // Money parked on the basis that is NOT in force reads as an upgrade a
        // reader might price from. Refuse the shape rather than pick a column.
        fail('invalid_package', 'a fixed-basis option carries a per-pax rate', option.option_id);
        continue;
      }
      if (option.is_default) {
        defaultCount += 1;
        // The package price already includes the default; charging extra for it
        // would surcharge a couple who chose nothing. Free on BOTH bases.
        if (option.price_delta_centavos !== 0 || (option.per_pax_delta_centavos ?? 0) !== 0) {
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

  /* ---- 3. Chosen options — index them; MEMBERSHIP is decided in §4 ------- */

  const chosenOptionIds = input.chosenOptionIds ?? [];
  if (!Array.isArray(chosenOptionIds)) {
    return { ok: false, errors: [{ code: 'invalid_package', detail: 'chosenOptionIds is not an array' }] };
  }

  /**
   * item_id → the options chosen on that line, in submission order.
   *
   * An ARRAY, because a `pick_max > 1` line legitimately holds several. The
   * count is judged in §4 against that line's own bounds rather than here
   * against a hard-coded 1 — "more than one alternative" is only an error on a
   * line the vendor said takes one.
   *
   * The other check that MOVED to §4 is `option_on_excluded_item`. It used to
   * fire on any line with `is_default_included = FALSE`, which is right for an
   * ADD-ON (nobody bought it) and wrong for a FOLLOW-UP — the DB forces those to
   * not-included, and the couple reached one precisely by buying its parent.
   * Whether a line is in the booking is a property of the reveal walk, so the
   * walk is where it is answered.
   */
  const chosenByItem = new Map<string, CreditOption[]>();
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
    const picked = chosenByItem.get(hit.item.item_id) ?? [];
    picked.push(hit.option);
    chosenByItem.set(hit.item.item_id, picked);
  }

  /* ---- 4. Resolve the booking TREE -------------------------------------- */

  /**
   * parent_option_id → the follow-up lines that option reveals.
   *
   * Built over `itemById`, so a follow-up hanging off an option that does not
   * exist is simply never reached — it cannot be revealed, so it cannot be
   * billed.
   */
  const childrenByOption = new Map<string, CreditItem[]>();
  for (const item of itemById.values()) {
    const parent = item.parent_option_id;
    if (parent == null) continue;
    const list = childrenByOption.get(parent) ?? [];
    list.push(item);
    childrenByOption.set(parent, list);
  }

  const extraHoursInput = input.extraHours ?? {};
  if (typeof extraHoursInput !== 'object' || Array.isArray(extraHoursInput)) {
    return { ok: false, errors: [{ code: 'invalid_package', detail: 'extraHours is not a record' }] };
  }

  const keptItemIds: string[] = [];
  const revealedItemIds: string[] = [];
  const selections: ResolvedSelection[] = [];
  /** Every line the booking actually contains — kept roots + revealed follow-ups. */
  const inBooking = new Set<string>();
  let optionDeltaTotal = 0;
  let extraHoursTotal = 0;

  /**
   * Resolve ONE line, then recurse into whatever its in-force options reveal.
   *
   * 🚨 THE REVEAL RULE, and it is the same one the couple was shown: an option
   * is IN FORCE when the couple picked it, or — on an optional line they left
   * alone — when it is the vendor's default. Whatever is in force reveals its
   * follow-ups; nothing else does. So a follow-up whose parent was never picked
   * is never resolved, never in `inBooking`, and any option on it is refused
   * below as `option_on_excluded_item` rather than quietly billed.
   */
  const resolveLine = (item: CreditItem, isRoot: boolean) => {
    // Cycle guard. The DB refuses a cycle by trigger; an in-memory object
    // cannot be refused, and an unbounded walk here is a hung request.
    if (inBooking.has(item.item_id)) return;
    inBooking.add(item.item_id);
    if (isRoot) keptItemIds.push(item.item_id);
    else revealedItemIds.push(item.item_id);

    // ── The HOUR axis. Priced on any line in the booking, follow-ups included.
    const requestedHours = extraHoursInput[item.item_id];
    if (requestedHours !== undefined) {
      const bounds = extraHoursBounds(item);
      if (!bounds) {
        fail(
          'extra_hours_not_offered',
          'extra hours were requested on a line with no hourly rate and cap',
          item.item_id,
        );
      } else if (
        typeof requestedHours !== 'number' ||
        !Number.isSafeInteger(requestedHours) ||
        requestedHours < 0 ||
        requestedHours > bounds.max
      ) {
        // REFUSED, not clamped. The caller clamps against the same bounds
        // before it gets here (`chargeableExtraHours`), so a value outside them
        // means the two disagree — and silently billing the nearest legal
        // number would charge for something nobody was quoted.
        fail(
          'invalid_extra_hours',
          `extra hours must be a whole number in 0..${bounds.max}, got ${String(requestedHours)}`,
          item.item_id,
        );
      } else {
        extraHoursTotal += requestedHours * Number(item.extra_hour_centavos);
      }
    }

    if (!isChoiceLine(item)) return;

    const { min, max } = pickBounds(item);
    const picked = chosenByItem.get(item.item_id) ?? [];

    if (picked.length > max) {
      // Kept as `multiple_options_for_item`: on a line that takes one (every
      // line without an explicit pair) this is the exact error it always was.
      fail(
        'multiple_options_for_item',
        `${picked.length} alternatives chosen on a line that takes at most ${max}`,
        item.item_id,
      );
      return;
    }

    /** What ends up in force on this line — each one reveals its own children. */
    const inForce: CreditOption[] = [];

    if (picked.length > 0) {
      if (picked.length < min) {
        // 🚫 An unfinished order is NEVER a cheaper one. The vendor priced the
        // package assuming every question is answered, so answering fewer must
        // refuse rather than quote less.
        fail(
          'pick_below_minimum',
          `${picked.length} of ${min} required alternatives chosen`,
          item.item_id,
        );
        return;
      }
      for (const option of picked) {
        const delta = optionDeltaCentavos(option, paxCount);
        selections.push({
          item_id: item.item_id,
          option_id: option.option_id,
          price_delta_centavos: delta,
          source: 'chosen',
        });
        // 💰 EVERY pick adds its delta. This used to be "the first one does" —
        // a `pick_max` of 3 charged for one option and delivered three.
        optionDeltaTotal += delta;
        inForce.push(option);
      }
    } else if (item.is_required) {
      // Owner rule: a required choice line must be picked. We do NOT quietly
      // apply the default — "must pick a main course" is a decision the
      // couple has to make, and pretending otherwise hides it from them.
      fail('required_choice_unselected', 'this line requires one alternative to be chosen', item.item_id);
      return;
    } else if (min > 1) {
      // A genuine "choose 2 of 3" with nothing chosen. One default cannot stand
      // in for two answers, so this is unfinished, not defaulted.
      fail('pick_below_minimum', `0 of ${min} required alternatives chosen`, item.item_id);
      return;
    } else {
      // Optional exactly-one line, kept, nothing picked → the package's own
      // default, which by construction costs nothing extra.
      const fallback = (item.options ?? []).find((o) => o.is_default && o.is_available);
      if (!fallback) {
        fail('choice_line_has_no_default', 'kept choice line has no available default to fall back on', item.item_id);
        return;
      }
      selections.push({
        item_id: item.item_id,
        option_id: fallback.option_id,
        price_delta_centavos: optionDeltaCentavos(fallback, paxCount),
        source: 'default',
      });
      optionDeltaTotal += optionDeltaCentavos(fallback, paxCount);
      inForce.push(fallback);
    }

    for (const option of inForce) {
      for (const child of childrenByOption.get(option.option_id) ?? []) {
        resolveLine(child, false);
      }
    }
  };

  for (const item of itemById.values()) {
    if (removed.has(item.item_id)) continue;
    // A line that is not ticked by default simply is not in the booking; it
    // is not "kept" and it carries no delta. (Required lines are always
    // included — enforced above — so this single test covers both axes.)
    if (!item.is_default_included) continue;
    // A follow-up is reached THROUGH the option that reveals it, or not at all.
    // The DB already forces every follow-up to not-included, so this is a belt
    // over that brace — it matters because this engine is also handed objects
    // built in memory, where no constraint applies.
    if (item.parent_option_id != null) continue;
    resolveLine(item, true);
  }

  /* ---- 4b. Picks on lines the booking does not contain ------------------ */

  // Silently dropping the pick is the dangerous choice: a stored selection
  // whose line the vendor later un-included would vanish from `selections`
  // with no error, and we would write a booking missing an upgrade the couple
  // chose and may already have been quoted. Same class as
  // option_on_removed_item — refuse, do not guess.
  for (const [itemId, options] of chosenByItem) {
    if (inBooking.has(itemId)) continue;
    for (const option of options) {
      fail(
        'option_on_excluded_item',
        'an option was chosen on a line the booking does not contain — an add-on, ' +
          'or a follow-up whose parent option is not in force',
        option.option_id,
      );
    }
  }

  for (const itemId of Object.keys(extraHoursInput)) {
    if (inBooking.has(itemId)) continue; // priced inside the walk
    fail(
      'extra_hours_not_offered',
      'extra hours were requested on a line the booking does not contain',
      itemId,
    );
  }

  /* ---- 5. Catalogue additions ------------------------------------------ */

  const additions = input.additions ?? [];
  if (!Array.isArray(additions)) {
    return { ok: false, errors: [{ code: 'invalid_package', detail: 'additions is not an array' }] };
  }

  const catalogue = input.catalogue ?? [];
  if (!Array.isArray(catalogue)) {
    return { ok: false, errors: [{ code: 'invalid_package', detail: 'catalogue is not an array' }] };
  }

  /** addition_id → server-resolved unit price. */
  const priceById = new Map<string, number>();
  for (const entry of catalogue) {
    if (!entry || typeof entry !== 'object' || !isNonEmptyId(entry.addition_id)) {
      fail('invalid_addition', 'catalogue entry missing a usable addition_id');
      continue;
    }
    if (priceById.has(entry.addition_id)) {
      // Two prices for one id is ambiguous; picking either would be a guess.
      fail('invalid_addition', 'the same catalogue id is priced twice', entry.addition_id);
      continue;
    }
    if (!isMoney(entry.unit_price_centavos)) {
      fail(
        'invalid_addition',
        `unit_price_centavos is not a sane centavo amount: ${String(entry.unit_price_centavos)}`,
        entry.addition_id,
      );
      continue;
    }
    priceById.set(entry.addition_id, entry.unit_price_centavos);
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
    const unitPriceCentavos = priceById.get(addition.addition_id);
    if (unitPriceCentavos === undefined) {
      // No server-resolved price => we do not know what this costs. Refusing
      // is the only safe answer; treating it as 0 would hand out free credit
      // spend to anything the client can name.
      fail(
        'unknown_addition',
        'no server-resolved catalogue price for this addition',
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
    additionsTotal += unitPriceCentavos * addition.quantity;
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

  // SPEND is spend. An extra hour drains the pool exactly like a premium option
  // or a catalogue buy — treating it as a straight surcharge instead would bill
  // a couple who still had credit sitting unspent.
  const spentCreditCentavos = optionDeltaTotal + additionsTotal + extraHoursTotal;

  const remainingCreditCentavos = Math.max(0, availableCreditCentavos - spentCreditCentavos);
  const overspendCentavos = Math.max(0, spentCreditCentavos - availableCreditCentavos);

  // BOOKING TOTAL. Flexible = the price is fixed ("changes WHAT you get, not
  // what you pay"); non-flexible keeps the legacy dollar-for-dollar cut.
  const basePriceCentavos = pkg.is_consumable_flexible
    ? pkg.total_price_centavos
    : Math.max(0, pkg.total_price_centavos - removedTotalCentavos);

  // CREDIT NEVER DISCOUNTS THE PRICE (owner-locked 2026-07-26). Unspent credit
  // is forfeited, never returned as money off the total — the pillar is that
  // credit changes WHAT you get, not what you pay. Kept in the result shape,
  // pinned at 0, so every consumer still reconciles:
  //     bookingTotal === basePrice + overspend − creditRefund
  const creditRefundCentavos = 0;
  const forfeitedCreditCentavos = remainingCreditCentavos - creditRefundCentavos;

  const bookingTotalCentavos = basePriceCentavos + overspendCentavos - creditRefundCentavos;

  // Belt-and-braces: if any sum left exact-integer territory, refuse rather
  // than hand back a rounded peso figure.
  for (const value of [
    availableCreditCentavos,
    spentCreditCentavos,
    remainingCreditCentavos,
    overspendCentavos,
    bookingTotalCentavos,
    removedTotalCentavos,
    extraHoursTotal,
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
    extraHoursCentavos: extraHoursTotal,
    remainingCreditCentavos,
    overspendCentavos,
    forfeitedCreditCentavos,
    creditRefundCentavos,
    bookingTotalCentavos,
    removedTotalCentavos,
    keptItemIds,
    revealedItemIds,
    selections,
  };
}
