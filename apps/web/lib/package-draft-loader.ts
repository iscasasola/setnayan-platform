/**
 * PACKAGE DRAFT LOADER — read a package the caller owns, or FAIL LOUDLY.
 *
 * ── THE BUG THIS MODULE EXISTS TO MAKE UNREPRESENTABLE ──────────────────────
 * Two separate call sites (the editor page and the save action) each ran their
 * own copy of this query, and each destructured only `{ data }`. That is a
 * SILENT DESTRUCTIVE-SAVE shape, not a cosmetic omission:
 *
 *   1. the item select names a column the database does not have yet
 *      (a migration not applied, a rename mid-deploy, a typo);
 *   2. PostgREST answers 400 and supabase-js returns `{ data: null, error }`;
 *   3. `(items ?? [])` turns that into an EMPTY item list;
 *   4. the editor renders a package with no inclusions and no warning;
 *   5. `validatePackageDraft` only objects to ZERO items, so the vendor adds
 *      one line and presses Save;
 *   6. `savePackage`'s `scope === 'full'` branch DELETES every existing item
 *      and writes back the single new one — and reports success.
 *
 * A read failure became a data-loss write. So the loader returns a RESULT, not
 * a draft-or-null: `read_failed` is a distinct outcome from `not_found`, and
 * `ok: false` carries no `draft` field at all, so no caller can typecheck its
 * way to a save on top of a failed read. The compiler enforces at every call
 * site what a discarded `error` variable never could.
 *
 * Consolidating the two copies is half the fix. The duplicate was why the same
 * defect existed twice, and why fixing one would have left the other.
 *
 * Pure I/O over an injected client — no env, no Next internals — so the failure
 * path is drivable in a unit test with a fake client.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { DraftPackage, DraftParentRef } from './package-authoring';
import {
  PACKAGE_ITEM_AUTHORING_SELECT,
  PACKAGE_ITEM_OPTION_SELECT,
} from './vendor-packages';

export type LoadedPackage = {
  draft: DraftPackage;
  isActive: boolean;
};

export type LoadPackageResult =
  | { ok: true; loaded: LoadedPackage }
  /** No such package, or it belongs to someone else. Indistinguishable on purpose. */
  | { ok: false; reason: 'not_found' }
  /** The database refused a read. NEVER degrade this to an empty draft. */
  | { ok: false; reason: 'read_failed'; message: string };

const VENDOR_PACKAGE_HEAD_SELECT =
  'package_id, package_name, total_price_centavos, consumable_budget_centavos, is_consumable_flexible, is_active';

/**
 * `parent_option_id` → the draft's (itemRef, optionRef) pair.
 *
 * When the option is not among the package's own options the ref is kept with
 * an EMPTY itemRef, which matches no item and so surfaces as
 * `followup_parent_unknown`. Deliberately not `null`: null reads as "a normal
 * top-level line", which would flatten the follow-up into a line every couple
 * sees — a silent data change dressed up as a defensive default. The case is
 * unreachable anyway (the FK plus the same-package guard mean the option is in
 * this package, and the options query fetches all of them).
 */
function parentRefFor(
  parentOptionId: string | null | undefined,
  ownerOfOption: ReadonlyMap<string, string>,
): DraftParentRef | null {
  if (!parentOptionId) return null;
  return {
    itemRef: ownerOfOption.get(parentOptionId) ?? '',
    optionRef: parentOptionId,
  };
}

/**
 * Read one package the caller owns.
 *
 * Ownership is a PREDICATE on the query (`vendor_profile_id = …`), never a
 * filter applied afterwards, so a package belonging to another vendor comes
 * back as `not_found` rather than being fetched and then hidden.
 */
export async function loadPackageDraft(
  supabase: SupabaseClient,
  vendorProfileId: string,
  packageId: string,
): Promise<LoadPackageResult> {
  const { data: pkg, error: pkgErr } = await supabase
    .from('vendor_packages')
    .select(VENDOR_PACKAGE_HEAD_SELECT)
    .eq('package_id', packageId)
    .eq('vendor_profile_id', vendorProfileId) // ownership, not a filter
    .maybeSingle();
  if (pkgErr) {
    return { ok: false, reason: 'read_failed', message: pkgErr.message };
  }
  if (!pkg) return { ok: false, reason: 'not_found' };

  const { data: items, error: itemsErr } = await supabase
    .from('vendor_package_items')
    .select(PACKAGE_ITEM_AUTHORING_SELECT)
    .eq('package_id', packageId)
    .order('display_order', { ascending: true });
  // THE ONE THAT MATTERS. `items` is what a failed read would silently empty,
  // and an empty item list is what makes the next save destructive.
  if (itemsErr) {
    return { ok: false, reason: 'read_failed', message: itemsErr.message };
  }

  const itemIds = (items ?? []).map((i) => i.item_id);
  const { data: options, error: optionsErr } = itemIds.length
    ? await supabase
        .from('vendor_package_item_options')
        .select(PACKAGE_ITEM_OPTION_SELECT)
        .in('item_id', itemIds)
        .order('display_order', { ascending: true })
    : { data: [] as never[], error: null };
  // Losing the OPTIONS is destructive too, just one level down: a choice line
  // would reload as a plain line and save back with its alternatives deleted.
  if (optionsErr) {
    return { ok: false, reason: 'read_failed', message: optionsErr.message };
  }

  // option_id → the item it hangs off, so a stored `parent_option_id` can be
  // re-expressed as the (itemRef, optionRef) pair the draft speaks in. Refs on
  // a LOADED draft are the database ids, so this is a lookup, not a rename.
  const ownerOfOption = new Map<string, string>(
    (options ?? []).map((o) => [o.option_id, o.item_id]),
  );

  return {
    ok: true,
    loaded: {
      isActive: pkg.is_active,
      draft: {
        package_name: pkg.package_name,
        total_price_centavos: pkg.total_price_centavos,
        consumable_budget_centavos: pkg.consumable_budget_centavos,
        is_consumable_flexible: pkg.is_consumable_flexible,
        items: (items ?? []).map((i) => ({
          ref: i.item_id,
          service_description: i.service_description,
          canonical_service: i.canonical_service,
          is_default_included: i.is_default_included,
          is_required: i.is_required ?? false,
          replacement_value_centavos: i.replacement_value_centavos,
          // Round-tripping this is load-bearing: `savePackage` rebuilds a
          // package from the draft it is handed, so a loader that dropped
          // parentRef would FLATTEN every follow-up into a top-level line on
          // the vendor's next save.
          parentRef: parentRefFor(i.parent_option_id, ownerOfOption),
          pickMin: i.pick_min ?? null,
          pickMax: i.pick_max ?? null,
          maxExtraHours: i.max_extra_hours ?? null,
          options: (options ?? [])
            .filter((o) => o.item_id === i.item_id)
            .map((o) => ({
              ref: o.option_id,
              label: o.option_label,
              price_delta_centavos: o.price_delta_centavos,
              is_default: o.is_default,
              is_available: o.is_available,
            })),
        })),
      },
    },
  };
}

/**
 * Bookings that still bind the vendor. A released booking no longer does.
 *
 * `null` = the count could not be read. Same class as the loader above and the
 * same rule: callers must REFUSE, not assume zero. Reading a failed count as 0
 * unfreezes a BOOKED package, and the `full` scope it unlocks is the branch
 * that deletes every item row.
 */
export async function countActiveBookings(
  supabase: SupabaseClient,
  packageId: string,
): Promise<number | null> {
  const { count, error } = await supabase
    .from('event_vendor_packages')
    .select('booking_id', { count: 'exact', head: true })
    .eq('package_id', packageId)
    .neq('status', 'released');
  if (error || count === null || count === undefined) return null;
  return count;
}
