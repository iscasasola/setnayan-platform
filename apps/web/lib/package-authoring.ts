/**
 * PACKAGE AUTHORING — the whole-package validator.
 *
 * Vendors have never been able to build a package: prod holds ZERO
 * `vendor_packages` rows because no application code inserts one. This module is
 * the gate that authoring writes through, so the first package that ever exists
 * is already well-formed.
 *
 * ── DIVISION OF LABOUR ──────────────────────────────────────────────────────
 * The 2026-07-26 credit migration already enforces every rule expressible on a
 * SINGLE row, via CHECK constraints. Do NOT re-implement those here; a duplicate
 * that drifts is worse than no check at all:
 *
 *   • `is_required = FALSE OR is_default_included = TRUE`
 *       — a required line is necessarily included. The "ghost" shape (required
 *         but not included) would deliver a line nobody bought AND inflate the
 *         platform-fee base, so it is refused outright.
 *   • `price_delta_centavos >= 0`
 *       — owner-locked: "swap will only add, since swap starts at the cheapest
 *         variant." A swap can never make a service cheaper, and never free.
 *   • `is_default = FALSE OR price_delta_centavos = 0`
 *       — the default option IS the baseline, so it costs nothing extra.
 *   • `is_default = FALSE OR is_available = TRUE`
 *       — a sold-out option cannot be the one everyone starts on.
 *
 * What a CHECK cannot see is the rest of the package. Those are the invariants
 * below: they are all CROSS-ROW, which is exactly why they need a validator.
 *
 * Pure: no I/O, no env, no clock. Callers do the DB work.
 */

export type DraftOption = {
  /** Stable key for error reporting — an id for saved rows, an index for new ones. */
  ref: string;
  label: string;
  price_delta_centavos: number;
  is_default: boolean;
  is_available: boolean;
};

export type DraftItem = {
  ref: string;
  service_description: string;
  canonical_service: string;
  is_default_included: boolean;
  is_required: boolean;
  replacement_value_centavos: number;
  /** Empty = a plain line. Non-empty = a CHOICE line. */
  options: DraftOption[];
};

export type DraftPackage = {
  package_name: string;
  total_price_centavos: number;
  consumable_budget_centavos: number;
  is_consumable_flexible: boolean;
  items: DraftItem[];
};

export type DraftProblem = {
  /** Machine-readable — the UI maps this to the field it should highlight. */
  code:
    | 'package_name_empty'
    | 'package_no_items'
    | 'package_price_not_positive'
    | 'package_price_below_required'
    | 'consumable_exceeds_total'
    | 'consumable_without_flex_or_budget'
    | 'item_description_empty'
    | 'item_value_negative'
    | 'choice_needs_two_options'
    | 'choice_needs_exactly_one_default'
    | 'choice_default_unavailable'
    | 'choice_option_label_duplicated'
    | 'choice_all_options_unavailable';
  /** Which item/option it belongs to, when it is not a package-level problem. */
  itemRef?: string;
  optionRef?: string;
  message: string;
};

const isBlank = (s: string) => s.trim().length === 0;
const isWholeNonNegative = (n: number) =>
  Number.isFinite(n) && Number.isInteger(n) && n >= 0;

/**
 * Every problem with a draft, in one pass. An empty array means the draft is
 * safe to write.
 *
 * Returns ALL problems rather than the first, because a vendor filling a long
 * form should see every fix at once instead of playing whack-a-mole.
 */
export function validatePackageDraft(draft: DraftPackage): DraftProblem[] {
  const problems: DraftProblem[] = [];

  if (isBlank(draft.package_name)) {
    problems.push({
      code: 'package_name_empty',
      message: 'Give the package a name.',
    });
  }

  if (draft.items.length === 0) {
    problems.push({
      code: 'package_no_items',
      message: 'A package needs at least one inclusion.',
    });
  }

  // Owner-locked: "there should never be an option to have a service at 0."
  // A package priced at nothing is not a free gift — it is an authoring slip
  // that would lock a booking worth ₱0 and a platform fee of ₱0.
  if (!isWholeNonNegative(draft.total_price_centavos) || draft.total_price_centavos <= 0) {
    problems.push({
      code: 'package_price_not_positive',
      message: 'Set a package price above zero.',
    });
  }

  // The mandatory content is the floor. Pricing a package below the sum of the
  // lines the couple cannot drop means the credit engine could refund more than
  // the package ever cost.
  const requiredFloor = draft.items
    .filter((i) => i.is_required)
    .reduce((sum, i) => sum + Math.max(0, i.replacement_value_centavos), 0);
  if (draft.total_price_centavos > 0 && draft.total_price_centavos < requiredFloor) {
    problems.push({
      code: 'package_price_below_required',
      message:
        'The package price is below the total value of the lines you marked required.',
    });
  }

  if (
    !isWholeNonNegative(draft.consumable_budget_centavos) ||
    draft.consumable_budget_centavos > Math.max(0, draft.total_price_centavos)
  ) {
    problems.push({
      code: 'consumable_exceeds_total',
      message: 'The spendable budget cannot be more than the package price.',
    });
  }

  // A flexible package redirects freed money into the consumable pool. With no
  // pool to redirect into, "flexible" is a setting that does nothing — and a
  // couple would be told they have credit that buys nothing.
  if (draft.is_consumable_flexible && draft.consumable_budget_centavos === 0) {
    problems.push({
      code: 'consumable_without_flex_or_budget',
      message:
        'A flexible package needs a spendable budget — otherwise freed money has nowhere to go.',
    });
  }

  for (const item of draft.items) {
    if (isBlank(item.service_description)) {
      problems.push({
        code: 'item_description_empty',
        itemRef: item.ref,
        message: 'Describe what this inclusion is.',
      });
    }

    if (!isWholeNonNegative(item.replacement_value_centavos)) {
      problems.push({
        code: 'item_value_negative',
        itemRef: item.ref,
        message: 'An inclusion cannot have a negative value.',
      });
    }

    if (item.options.length === 0) continue; // a plain line — nothing further

    // ---- CHOICE lines ----
    if (item.options.length < 2) {
      problems.push({
        code: 'choice_needs_two_options',
        itemRef: item.ref,
        message: 'A choice needs at least two options — otherwise it is not a choice.',
      });
    }

    // Exactly one default. Zero leaves the couple with no baseline and no
    // package price that means anything; two makes the baseline ambiguous, and
    // the credit engine would pick arbitrarily.
    const defaults = item.options.filter((o) => o.is_default);
    if (defaults.length !== 1) {
      problems.push({
        code: 'choice_needs_exactly_one_default',
        itemRef: item.ref,
        message:
          defaults.length === 0
            ? 'Pick which option is included as standard.'
            : 'Only one option can be the standard one.',
      });
    }

    // Belt over the row-level CHECK — caught here the vendor gets a sentence,
    // rather than a constraint violation from the database.
    for (const opt of defaults) {
      if (!opt.is_available) {
        problems.push({
          code: 'choice_default_unavailable',
          itemRef: item.ref,
          optionRef: opt.ref,
          message: 'The standard option cannot be marked unavailable.',
        });
      }
    }

    if (item.options.length > 0 && item.options.every((o) => !o.is_available)) {
      problems.push({
        code: 'choice_all_options_unavailable',
        itemRef: item.ref,
        message: 'At least one option has to be available.',
      });
    }

    // Two options reading "Beef caldereta" priced differently is unpickable for
    // the couple and unreadable on the vendor's own quote.
    const seen = new Map<string, DraftOption>();
    for (const opt of item.options) {
      const key = opt.label.trim().toLowerCase();
      if (key.length === 0) continue;
      if (seen.has(key)) {
        problems.push({
          code: 'choice_option_label_duplicated',
          itemRef: item.ref,
          optionRef: opt.ref,
          message: `Two options are both called "${opt.label.trim()}".`,
        });
      } else {
        seen.set(key, opt);
      }
    }
  }

  return problems;
}

/** Convenience for callers that only need the yes/no. */
export function isPackageDraftValid(draft: DraftPackage): boolean {
  return validatePackageDraft(draft).length === 0;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* EDIT SCOPE — what a vendor may still change once someone has booked        */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * A booked package is a CONTRACT, and three separate things point into its rows:
 *
 *   • `event_vendor_packages.customizations.removed_item_ids` — item ids
 *   • `event_vendors.package_item_id` — item ids (ON DELETE SET NULL)
 *   • the locked total, derived from `total_price_centavos` minus removals
 *
 * So restructuring a package underneath a live booking silently re-prices a
 * couple's contract and can orphan the provenance link on their booked rows.
 * Once a booking exists the vendor keeps only cosmetic control; to sell
 * something different they publish a NEW package, which is also what keeps the
 * couple's copy honest.
 */
export type EditScope = 'full' | 'metadata_only';

export function editScopeForPackage(activeBookingCount: number): EditScope {
  return activeBookingCount > 0 ? 'metadata_only' : 'full';
}

/** The fields a `metadata_only` edit may touch. Everything else is frozen. */
const METADATA_FIELDS = ['package_name', 'description', 'is_active'] as const;

export type StructuralChange =
  | 'total_price_centavos'
  | 'consumable_budget_centavos'
  | 'is_consumable_flexible'
  | 'items';

/**
 * Which structural fields a draft would change against what is stored.
 * Empty = the edit is metadata-only and safe on a booked package.
 *
 * Item comparison is deliberately SHALLOW-BUT-TOTAL: any change to the set of
 * item refs, or to any priced/required field on one, counts. A vendor fixing a
 * typo in `service_description` is treated as structural too — that is the
 * conservative direction, and the alternative is a diff subtle enough to let a
 * real re-price through.
 */
export function structuralChanges(
  stored: DraftPackage,
  draft: DraftPackage,
): StructuralChange[] {
  const changed: StructuralChange[] = [];

  if (stored.total_price_centavos !== draft.total_price_centavos)
    changed.push('total_price_centavos');
  if (stored.consumable_budget_centavos !== draft.consumable_budget_centavos)
    changed.push('consumable_budget_centavos');
  if (stored.is_consumable_flexible !== draft.is_consumable_flexible)
    changed.push('is_consumable_flexible');

  const fingerprint = (p: DraftPackage) =>
    JSON.stringify(
      [...p.items]
        .sort((a, b) => a.ref.localeCompare(b.ref))
        .map((i) => [
          i.ref,
          i.service_description,
          i.canonical_service,
          i.is_default_included,
          i.is_required,
          i.replacement_value_centavos,
          [...i.options]
            .sort((a, b) => a.ref.localeCompare(b.ref))
            .map((o) => [
              o.ref,
              o.label,
              o.price_delta_centavos,
              o.is_default,
              o.is_available,
            ]),
        ]),
    );
  if (fingerprint(stored) !== fingerprint(draft)) changed.push('items');

  return changed;
}

/** True when this edit is legal for the scope. */
export function isEditAllowed(
  scope: EditScope,
  stored: DraftPackage,
  draft: DraftPackage,
): boolean {
  if (scope === 'full') return true;
  return structuralChanges(stored, draft).length === 0;
}

export { METADATA_FIELDS };
