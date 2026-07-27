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
 * ── THE ONE DELIBERATE MIRROR ───────────────────────────────────────────────
 * `vendor_package_items_followup_not_default_included_ck` — a FOLLOW-UP line
 * can be neither default-included nor required — IS single-row, and IS repeated
 * here, on purpose. Two reasons the "do not duplicate" rule yields to it:
 *
 *   1. The editor's own default for a new line is `is_default_included: true`
 *      (package-editor.tsx), so the FIRST follow-up a vendor ever draws is the
 *      shape the database refuses. Left to the DB, every vendor's first attempt
 *      dies on a 23514 they cannot act on.
 *   2. It is a MONEY rule — a default-included follow-up charges the couple for
 *      a line the configurator never showed them — so a readable sentence at
 *      the point of authoring is worth the duplication. Same precedent as
 *      `choice_default_unavailable` below.
 *
 * The database remains the enforcement; this is only the sentence.
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

/**
 * Which OPTION, on which ITEM, reveals a follow-up line.
 *
 * Both halves are CLIENT REFS, not database ids, and that is the whole point.
 * `savePackage` replaces a package's items and options wholesale, so every
 * `option_id` is regenerated on every save; a stored id would dangle the moment
 * the vendor pressed Save twice. The refs are resolved to freshly-minted ids at
 * write time (see {@link planItemInsertOrder}).
 */
export type DraftParentRef = {
  itemRef: string;
  optionRef: string;
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
  /**
   * FOLLOW-UP line: the couple sees it only once `optionRef` is picked on
   * `itemRef`. Absent / null = a normal top-level line, which is every line
   * that exists today. Maps to `vendor_package_items.parent_option_id`.
   */
  parentRef?: DraftParentRef | null;
  /**
   * "Choose N of M" on a CHOICE line. Both or neither — the DB refuses a
   * half-set pair (`vendor_package_items_pick_range_ck`) because "at least 2,
   * no maximum" would have to be read off a different table. Absent = today's
   * behaviour: exactly one option.
   */
  pickMin?: number | null;
  pickMax?: number | null;
  /**
   * Ceiling on the EXTRA HOURS a couple may add on top of `min_hours`. Extends
   * the hourly model already on the row — it is NOT a generic quantity cap;
   * this schema has no generic quantity concept. Absent = uncapped.
   */
  maxExtraHours?: number | null;
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
    | 'choice_all_options_unavailable'
    // ---- recursive customization (parent_option_id / pick_min / pick_max) ----
    // Each mirrors a database constraint, so the vendor reads a sentence
    // instead of a 23514 they cannot act on.
    | 'choice_pick_range_invalid'
    | 'choice_pick_max_exceeds_options'
    | 'item_max_extra_hours_invalid'
    | 'followup_parent_unknown'
    | 'followup_cycle'
    // Mirrors vendor_package_items_followup_not_default_included_ck. A
    // follow-up is CONDITIONAL by definition, so it can never be inside the
    // package price — charging for a line the couple was never shown, and
    // cascading it into a booked vendor row, is the hazard the constraint
    // closes. Two codes, not one, because they highlight two different
    // checkboxes on the editor row.
    | 'followup_cannot_be_default_included'
    | 'followup_cannot_be_required'
    // Raised by the card-text integrity gate (lib/service-text-integrity.ts),
    // NOT by validatePackageDraft — that gate needs this `problems` channel to
    // report a blank / contact-info line through the editor's existing list.
    | 'text_not_allowed';
  /** Which item/option it belongs to, when it is not a package-level problem. */
  itemRef?: string;
  optionRef?: string;
  message: string;
};

const isBlank = (s: string) => s.trim().length === 0;
const isWholeNonNegative = (n: number) =>
  Number.isFinite(n) && Number.isInteger(n) && n >= 0;

/**
 * Does walking `item`'s parent chain come back to `item`?
 *
 * Bounded by a visited set rather than by a depth constant, because the chain
 * may contain a cycle that does NOT include `item` — an unbounded walk would
 * hang the vendor's browser on every keystroke, which is a worse failure than
 * the one being detected. Refs that do not resolve simply end the walk; the
 * dangling case is reported separately as `followup_parent_unknown`.
 */
function isSelfAncestor(
  item: DraftItem,
  itemByRef: ReadonlyMap<string, DraftItem>,
  optionOwner: ReadonlyMap<string, string>,
): boolean {
  const seen = new Set<string>([item.ref]);
  let cursor: DraftItem | undefined = item;
  while (cursor?.parentRef) {
    const ownerRef = optionOwner.get(cursor.parentRef.optionRef);
    if (ownerRef === undefined) return false; // dangling — a different problem
    if (ownerRef === item.ref) return true;
    if (seen.has(ownerRef)) return false; // a cycle elsewhere, not ours
    seen.add(ownerRef);
    cursor = itemByRef.get(ownerRef);
  }
  return false;
}

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

  // Every ref the draft owns, so a parentRef can be checked against the draft
  // the vendor is actually looking at. A ref that is not in here is dangling —
  // and a dangling parentRef is not a cosmetic problem: the save path would
  // have to either invent a NULL parent, which PROMOTES a follow-up into a line
  // every couple sees, or 23503 at the database.
  const itemByRef = new Map(draft.items.map((i) => [i.ref, i]));
  const optionOwner = new Map<string, string>(); // optionRef → owning itemRef
  for (const i of draft.items) {
    for (const o of i.options) optionOwner.set(o.ref, i.ref);
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

    // ---- RECURSIVE CUSTOMIZATION ----
    // Checked for EVERY line, plain or choice: "choose 2" on a line with no
    // options is exactly the authoring slip these rules exist to catch.

    // BOTH-OR-NEITHER, >= 1, min <= max — mirrors
    // vendor_package_items_pick_range_ck.
    const hasMin = item.pickMin !== undefined && item.pickMin !== null;
    const hasMax = item.pickMax !== undefined && item.pickMax !== null;
    if (hasMin || hasMax) {
      const min = item.pickMin;
      const max = item.pickMax;
      if (
        !hasMin ||
        !hasMax ||
        !isWholeNonNegative(min as number) ||
        !isWholeNonNegative(max as number) ||
        (min as number) < 1 ||
        (max as number) < 1 ||
        (min as number) > (max as number)
      ) {
        problems.push({
          code: 'choice_pick_range_invalid',
          itemRef: item.ref,
          message:
            'Set both a smallest and a largest number of picks, at least 1 each, with the smallest first.',
        });
      } else if ((max as number) > item.options.length) {
        // A line that asks for more picks than it offers can never be
        // completed, so the couple is stuck on a configurator that will not let
        // them continue.
        problems.push({
          code: 'choice_pick_max_exceeds_options',
          itemRef: item.ref,
          message: `You can pick at most ${item.options.length} here — that is how many options this line has.`,
        });
      }
    }

    // Mirrors vendor_package_items_max_extra_hours_ck.
    if (item.maxExtraHours !== undefined && item.maxExtraHours !== null) {
      if (!isWholeNonNegative(item.maxExtraHours)) {
        problems.push({
          code: 'item_max_extra_hours_invalid',
          itemRef: item.ref,
          message: 'Extra hours cannot be a negative number.',
        });
      }
    }

    if (item.parentRef) {
      // ---- A FOLLOW-UP IS CONDITIONAL, SO IT IS NEVER INSIDE THE PRICE ----
      // Mirrors vendor_package_items_followup_not_default_included_ck. Checked
      // off `parentRef` alone — the vendor DREW a follow-up, so the rule
      // applies whether or not the parent still resolves; a dangling parent is
      // reported separately below and is not a licence to charge for the line.
      if (item.is_default_included) {
        problems.push({
          code: 'followup_cannot_be_default_included',
          itemRef: item.ref,
          message:
            'A follow-up only appears once its option is picked, so it cannot also be included by default — most couples would never see it, and every one of them would be charged for it. Untick “included”, or detach it from the choice to make it a normal inclusion.',
        });
      }
      if (item.is_required) {
        problems.push({
          code: 'followup_cannot_be_required',
          itemRef: item.ref,
          message:
            'A follow-up cannot be required. “Required” means every couple keeps and pays for the line, but a follow-up is only shown to the couples who pick its option. Make the CHOICE required instead, or detach this line from it.',
        });
      }

      const owner = optionOwner.get(item.parentRef.optionRef);
      if (
        !itemByRef.has(item.parentRef.itemRef) ||
        owner === undefined ||
        owner !== item.parentRef.itemRef
      ) {
        problems.push({
          code: 'followup_parent_unknown',
          itemRef: item.ref,
          message:
            'This follow-up points at a choice that is no longer in the package. Re-attach it or delete it.',
        });
      } else if (isSelfAncestor(item, itemByRef, optionOwner)) {
        // Mirrors the database trigger (package_followup_self_parent /
        // package_followup_cycle / package_followup_too_deep). A cycle would
        // hang the couple-side renderer, which walks children to decide what to
        // show — so it is caught here where the vendor can read a sentence.
        problems.push({
          code: 'followup_cycle',
          itemRef: item.ref,
          message:
            'This follow-up eventually leads back to itself. A follow-up cannot depend on its own answer.',
        });
      }
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
/* INSERT ORDER — the only reason a follow-up can be written at all           */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Group a draft's items into WRITE LEVELS.
 *
 * `savePackage` deletes and re-inserts a package's rows wholesale, so every
 * `option_id` is minted fresh on every save. A follow-up's `parent_option_id`
 * therefore cannot be known until its parent's OPTIONS have been inserted and
 * their new ids read back. Hence levels, not a flat ordered list:
 *
 *   level 0 → items with no parentRef        …then their options
 *   level 1 → items whose parent is level 0  …then their options
 *   …
 *
 * Two separate reasons this must be level-by-level rather than one sorted
 * INSERT. The obvious one is that the parent's option ids do not exist yet. The
 * subtle one is that a BEFORE-ROW trigger reads the statement's own snapshot,
 * so rows inserted earlier in the SAME multi-row INSERT are invisible to it —
 * the database's cycle guard would not see the parent and would raise
 * `package_followup_parent_missing` even for a perfectly ordered array.
 *
 * `unresolvedRefs` is non-empty when an item can never be placed: its parentRef
 * dangles, or it sits in a cycle. Callers MUST fail the save on that — writing
 * the item with a NULL parent would silently promote a follow-up into a line
 * every couple sees.
 */
export type InsertPlan =
  | { ok: true; levels: ReadonlyArray<ReadonlyArray<DraftItem>> }
  | { ok: false; unresolvedRefs: string[] };

export function planItemInsertOrder(
  items: ReadonlyArray<DraftItem>,
): InsertPlan {
  const optionOwner = new Map<string, string>(); // optionRef → owning itemRef
  for (const i of items) for (const o of i.options) optionOwner.set(o.ref, i.ref);

  const placed = new Set<string>();
  const levels: DraftItem[][] = [];
  let remaining = items.filter((i) => Boolean(i.parentRef));

  const roots = items.filter((i) => !i.parentRef);
  if (roots.length > 0) {
    levels.push(roots);
    for (const i of roots) placed.add(i.ref);
  }

  // Each pass places every item whose parent landed in a PREVIOUS level. A pass
  // that places nothing means what is left is dangling or cyclic.
  while (remaining.length > 0) {
    const next = remaining.filter((i) => {
      const ownerRef = optionOwner.get(i.parentRef!.optionRef);
      // The ref pair must agree — an optionRef that belongs to some OTHER item
      // than the one named is not a parent we are willing to guess at.
      return ownerRef !== undefined && ownerRef === i.parentRef!.itemRef && placed.has(ownerRef);
    });
    if (next.length === 0) {
      return { ok: false, unresolvedRefs: remaining.map((i) => i.ref) };
    }
    levels.push(next);
    for (const i of next) placed.add(i.ref);
    const nextRefs = new Set(next.map((i) => i.ref));
    remaining = remaining.filter((i) => !nextRefs.has(i.ref));
  }

  return { ok: true, levels };
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
          // Branching is STRUCTURE. Re-parenting a line, widening "choose 2 of
          // 5" to "choose 4 of 5", or raising the extra-hour ceiling all change
          // what a booked couple is owed, so each must freeze with everything
          // else. `?? null` keeps an absent field and an explicit null equal —
          // a loader that stops populating one must not read as a re-price.
          i.parentRef
            ? [i.parentRef.itemRef, i.parentRef.optionRef]
            : null,
          i.pickMin ?? null,
          i.pickMax ?? null,
          i.maxExtraHours ?? null,
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
