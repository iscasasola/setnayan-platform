'use server';

/**
 * PACKAGE AUTHORING — server actions (PR-2 of the authoring wave).
 *
 * The couple-side package configurator has shipped at `/v/[slug]` for a while,
 * but prod holds ZERO `vendor_packages` rows because nothing has ever inserted
 * one. These are the writes that fix that.
 *
 * Three guards, in order, on every write:
 *
 *   1. FLAG — `packageAuthoringEnabled()`. Off by default, so this file is inert
 *      in production until the surface is reviewed on preview.
 *   2. OWNERSHIP — the package must belong to the caller's own vendor profile.
 *      Checked against `vendor_profile_id` on every path, never inferred from
 *      the submitted payload.
 *   3. SHAPE — `validatePackageDraft`, the cross-row invariants. The single-row
 *      rules stay CHECK constraints in the database (migration 20271006413374)
 *      and are deliberately not duplicated here.
 *
 * Plus the one that only matters after launch: a package with live bookings is
 * a CONTRACT. `editScopeForPackage` freezes it to metadata, because
 * `event_vendor_packages.customizations.removed_item_ids` and
 * `event_vendors.package_item_id` both point at item rows, and the locked total
 * derives from `total_price_centavos`. Restructuring underneath a booking
 * re-prices a couple's contract and orphans their provenance links.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { packageAuthoringEnabled } from '@/lib/package-authoring-flag';
import {
  validatePackageDraft,
  editScopeForPackage,
  structuralChanges,
  planItemInsertOrder,
  type DraftPackage,
  type DraftProblem,
} from '@/lib/package-authoring';
import {
  loadPackageDraft,
  countActiveBookings,
} from '@/lib/package-draft-loader';
import { type VendorPackageItemOptionRow } from '@/lib/vendor-packages';
import { autoName, findVendorTextViolation } from '@/lib/service-text-integrity';

export type SavePackageResult =
  | { status: 'ok'; packageId: string }
  | { status: 'invalid'; problems: DraftProblem[] }
  | { status: 'frozen'; changed: string[] }
  | { status: 'not_found' }
  | { status: 'disabled' }
  | { status: 'error'; message: string };

async function ensureProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');
  return { supabase, profile };
}

/**
 * Create a package, or replace an existing one's contents.
 *
 * Items and options are REPLACED wholesale rather than diffed. That is safe
 * precisely because it is only reachable at `full` scope — no booking points at
 * the rows being dropped. Once a booking exists the write is refused before it
 * gets here.
 */
export async function savePackage(
  input: DraftPackage & {
    packageId?: string;
    primary_canonical_service?: string;
    /**
     * The service CARD this package is being minted for, when it is the maker's
     * ★ Customization step calling. Standalone packages authored in the
     * packages editor pass nothing and stay unlinked, which is the normal case.
     *
     * 🔒 NOT A PERMISSION. The database refuses a card belonging to a different
     * vendor (trg_vendor_package_service_same_owner) — the FK proves the card
     * EXISTS, never that it is YOURS, and `vendor_packages` is writable by its
     * owning vendor through PostgREST.
     *
     * CREATE ONLY. An update never re-points an existing package at a different
     * card: a package a couple may already have locked must not silently change
     * which card's record it feeds.
     */
    vendorServiceId?: string | null;
  },
): Promise<SavePackageResult> {
  if (!packageAuthoringEnabled()) return { status: 'disabled' };

  const { supabase, profile } = await ensureProfile();
  const vendorProfileId = profile.vendor_profile_id as string;

  const problems = validatePackageDraft(input);
  if (problems.length > 0) return { status: 'invalid', problems };

  // Card-text integrity (owner 2026-07-27 · flag-dark): no off-platform contact
  // info in anything a couple reads on the configurator. Runs before the first
  // write on BOTH the update and create branches below.
  //
  // It rides the `invalid` channel, but note WHERE it surfaces: the editor's
  // inline note list is rendered from the CLIENT copy of validatePackageDraft,
  // which cannot see this server-only rule — so package-editor.tsx renders
  // `res.problems` into the alert instead. Do not "simplify" that back to a
  // fixed string: it pointed the vendor at notes that did not exist.
  {
    const viol = findVendorTextViolation([
      { field: 'Package name', value: input.package_name },
      ...input.items.flatMap((item, i) => [
        { field: `Item ${i + 1}`, value: item.service_description },
        ...item.options.map((o, j) => ({
          field: `Item ${i + 1} option ${j + 1}`,
          value: o.label,
        })),
      ]),
    ]);
    if (viol) {
      return { status: 'invalid', problems: [{ code: 'text_not_allowed', message: viol }] };
    }
  }

  // A BLANK NAME IS FILLED IN, NOT REFUSED (owner 2026-07-27: "saving builds
  // blank will make us autocreate a name for the build"). `addChoice` seeds two
  // options with `label: ''` and validatePackageDraft has no blank-option rule,
  // so an untouched choice row reaches this point blank and would otherwise
  // save an unreadable bullet onto a public card. Items are covered too, as
  // defence in depth — today `item_description_empty` above already stops a
  // blank one, so that branch is unreachable unless that rule is relaxed.
  input = {
    ...input,
    items: input.items.map((item, i) => ({
      ...item,
      service_description:
        item.service_description.trim().length > 0
          ? item.service_description
          : autoName('item', i),
      options: item.options.map((o, j) => ({
        ...o,
        label: o.label.trim().length > 0 ? o.label : autoName('option', j),
      })),
    })),
  };

  // ---- UPDATE ----
  if (input.packageId) {
    const read = await loadPackageDraft(supabase, vendorProfileId, input.packageId);
    if (!read.ok) {
      if (read.reason === 'not_found') return { status: 'not_found' };
      // A FAILED READ IS NOT AN EMPTY PACKAGE. Everything below deletes the
      // package's item rows and writes back whatever the draft holds, so
      // continuing on a read we could not perform is the destructive-save shape
      // documented in lib/package-draft-loader.ts. Refuse instead.
      return {
        status: 'error',
        message: `Could not read the package to save it, so nothing was changed: ${read.message}`,
      };
    }
    const stored = read.loaded.draft;

    const bookings = await countActiveBookings(supabase, input.packageId);
    if (bookings === null) {
      // Same rule as above, one level out: an unreadable booking count read as
      // zero would unfreeze a BOOKED package and unlock the branch that deletes
      // every item row underneath a live contract.
      return {
        status: 'error',
        message:
          'Could not check whether this package has bookings, so nothing was changed.',
      };
    }

    const scope = editScopeForPackage(bookings);
    if (scope === 'metadata_only') {
      const changed = structuralChanges(stored, input);
      if (changed.length > 0) return { status: 'frozen', changed };
    }

    const { error: upErr } = await supabase
      .from('vendor_packages')
      .update({
        package_name: input.package_name.trim(),
        total_price_centavos: input.total_price_centavos,
        consumable_budget_centavos: input.consumable_budget_centavos,
        is_consumable_flexible: input.is_consumable_flexible,
        updated_at: new Date().toISOString(),
      })
      .eq('package_id', input.packageId)
      .eq('vendor_profile_id', vendorProfileId);
    if (upErr) return { status: 'error', message: upErr.message };

    if (scope === 'full') {
      // Options cascade from items, so deleting the items clears both.
      const { error: delErr } = await supabase
        .from('vendor_package_items')
        .delete()
        .eq('package_id', input.packageId);
      if (delErr) return { status: 'error', message: delErr.message };

      const wrote = await writeItems(supabase, input.packageId, input);
      if (wrote) return wrote;
    }

    revalidatePath('/vendor-dashboard/packages');
    return { status: 'ok', packageId: input.packageId };
  }

  // ---- CREATE ----
  const { data: created, error: insErr } = await supabase
    .from('vendor_packages')
    .insert({
      vendor_profile_id: vendorProfileId,
      package_name: input.package_name.trim(),
      total_price_centavos: input.total_price_centavos,
      consumable_budget_centavos: input.consumable_budget_centavos,
      is_consumable_flexible: input.is_consumable_flexible,
      primary_canonical_service:
        input.primary_canonical_service ?? input.items[0]?.canonical_service ?? null,
      // The card this package was minted for, or NULL for a standalone one.
      // Ownership is enforced in the database, not here.
      vendor_service_id: input.vendorServiceId ?? null,
      // A new package starts UNLISTED. The vendor publishes it deliberately —
      // a half-built package must never appear on a live card mid-edit.
      is_active: false,
    })
    .select('package_id')
    .single();
  if (insErr || !created) {
    return { status: 'error', message: insErr?.message ?? 'Package insert failed' };
  }

  const wrote = await writeItems(supabase, created.package_id, input);
  if (wrote) {
    // Roll back rather than leave a package with no inclusions — the couple
    // side would render an empty configurator.
    await supabase.from('vendor_packages').delete().eq('package_id', created.package_id);
    return wrote;
  }

  revalidatePath('/vendor-dashboard/packages');
  return { status: 'ok', packageId: created.package_id };
}

/**
 * Insert items + their options. Returns an error result, or null on success.
 *
 * ── WHY THIS IS NOT ONE INSERT ANY MORE ─────────────────────────────────────
 * A follow-up line stores `parent_option_id`, an OPTION id — and this function
 * mints every option id fresh on every save, because `savePackage` replaces a
 * package's rows wholesale rather than diffing them. So a follow-up cannot be
 * written until its parent's options exist and their new ids have been read
 * back. `planItemInsertOrder` groups the draft into levels for exactly that:
 *
 *     level 0 items → level 0 options → level 1 items → level 1 options → …
 *
 * Sorting the array by depth and issuing ONE insert would not be enough, for a
 * second and less obvious reason: a BEFORE-ROW trigger sees the statement's own
 * snapshot, so rows inserted earlier in the same multi-row INSERT are invisible
 * to it. The database's cycle guard would look for the parent, not find it, and
 * raise `package_followup_parent_missing` on a perfectly ordered array.
 *
 * `display_order` stays the item's index in the ORIGINAL draft array, not its
 * index within a level, so the vendor's authored order survives the regrouping
 * and remains the key that maps inserted rows back to draft refs.
 */
async function writeItems(
  supabase: SupabaseClient,
  packageId: string,
  draft: DraftPackage,
): Promise<SavePackageResult | null> {
  if (draft.items.length === 0) return null;

  const plan = planItemInsertOrder(draft.items);
  if (!plan.ok) {
    // A parentRef that names nothing, or an item inside a cycle. FAIL — the
    // alternative is inserting it with a NULL parent, which PROMOTES a
    // follow-up into a line every couple sees on every booking.
    // `validatePackageDraft` already refuses both shapes; this is the backstop
    // for a payload that never went through it.
    return {
      status: 'invalid',
      problems: plan.unresolvedRefs.map((ref) => ({
        code: 'followup_parent_unknown' as const,
        itemRef: ref,
        message:
          'This follow-up points at a choice that is not in the package. Re-attach it or delete it.',
      })),
    };
  }

  const orderOfRef = new Map(draft.items.map((i, idx) => [i.ref, idx]));
  /** draft optionRef → the option id this save just minted for it. */
  const optionIdByRef = new Map<string, string>();

  for (const level of plan.levels) {
    const itemRows = level.map((i) => {
      const parentOptionId = i.parentRef
        ? optionIdByRef.get(i.parentRef.optionRef)
        : undefined;
      return {
        package_id: packageId,
        canonical_service: i.canonical_service,
        service_description: i.service_description.trim(),
        is_default_included: i.is_default_included,
        is_required: i.is_required,
        replacement_value_centavos: i.replacement_value_centavos,
        display_order: orderOfRef.get(i.ref) ?? 0,
        // The branching columns are written ONLY when the vendor set them, so a
        // package with no branching produces byte-identical SQL to before this
        // change — and cannot 400 on a deployment where the migration has not
        // landed yet. NULL is the column default in every one of these cases.
        ...(parentOptionId ? { parent_option_id: parentOptionId } : {}),
        ...(i.pickMin != null && i.pickMax != null
          ? { pick_min: i.pickMin, pick_max: i.pickMax }
          : {}),
        ...(i.maxExtraHours != null ? { max_extra_hours: i.maxExtraHours } : {}),
      };
    });

    // Unreachable via the plan, which only places an item once its parent's
    // level is done — but a missing id here would silently write a top-level
    // line, so it is checked rather than assumed.
    const orphan = level.find(
      (i) => i.parentRef && !optionIdByRef.has(i.parentRef.optionRef),
    );
    if (orphan) {
      return {
        status: 'error',
        message: `Could not resolve the parent choice for "${orphan.service_description}".`,
      };
    }

    const { data: inserted, error: itemErr } = await supabase
      .from('vendor_package_items')
      .insert(itemRows)
      .select('item_id, display_order');
    if (itemErr || !inserted) {
      return { status: 'error', message: itemErr?.message ?? 'Item insert failed' };
    }

    // Re-key by display_order — the insert preserves it, and it is the only
    // link back to the draft's client-side refs.
    const itemIdByOrder = new Map(inserted.map((r) => [r.display_order, r.item_id]));

    // Typed as the real row so a mis-named column is a compile error, not a
    // PostgREST 400 at runtime — writing `label` here (the column is
    // `option_label`) silently saved every choice line with no options at all.
    const optionRows: ReadonlyArray<
      Omit<VendorPackageItemOptionRow, 'option_id'> & { __ref: string }
    > = level.flatMap((i) => {
      const itemId = itemIdByOrder.get(orderOfRef.get(i.ref) ?? -1);
      if (!itemId) return [];
      return i.options.map((o, oIdx) => ({
        item_id: itemId,
        option_label: o.label.trim(),
        price_delta_centavos: o.price_delta_centavos,
        is_default: o.is_default,
        is_available: o.is_available,
        display_order: oIdx,
        __ref: o.ref,
      }));
    });

    if (optionRows.length === 0) continue;

    const { data: insertedOptions, error: optErr } = await supabase
      .from('vendor_package_item_options')
      .insert(optionRows.map(({ __ref, ...row }) => row))
      .select('option_id, item_id, display_order');
    if (optErr || !insertedOptions) {
      return { status: 'error', message: optErr?.message ?? 'Option insert failed' };
    }

    // (item_id, display_order) is unique within one save, so it is a safe key
    // back to the draft ref that produced the row.
    const refByKey = new Map(
      optionRows.map((r) => [`${r.item_id}:${r.display_order}`, r.__ref]),
    );
    for (const row of insertedOptions) {
      const ref = refByKey.get(`${row.item_id}:${row.display_order}`);
      if (ref) optionIdByRef.set(ref, row.option_id);
    }
  }

  return null;
}

/**
 * Publish / unpublish. Allowed at any scope — it is the one control a vendor
 * keeps over a booked package, and unlisting never touches an existing booking.
 */
export async function setPackageActive(
  packageId: string,
  isActive: boolean,
): Promise<SavePackageResult> {
  if (!packageAuthoringEnabled()) return { status: 'disabled' };
  const { supabase, profile } = await ensureProfile();

  // Refuse to publish a package that would not validate — otherwise a draft
  // saved before a rule tightened could go live broken.
  if (isActive) {
    const read = await loadPackageDraft(
      supabase,
      profile.vendor_profile_id as string,
      packageId,
    );
    if (!read.ok) {
      if (read.reason === 'not_found') return { status: 'not_found' };
      // Publishing on a failed read would put a package live having validated
      // an empty draft — `validatePackageDraft` objects to zero items, but only
      // AFTER the empty list has already been mistaken for the real one.
      return {
        status: 'error',
        message: `Could not read the package to publish it: ${read.message}`,
      };
    }
    const problems = validatePackageDraft(read.loaded.draft);
    if (problems.length > 0) return { status: 'invalid', problems };
  }

  const { error } = await supabase
    .from('vendor_packages')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('package_id', packageId)
    .eq('vendor_profile_id', profile.vendor_profile_id as string);
  if (error) return { status: 'error', message: error.message };

  revalidatePath('/vendor-dashboard/packages');
  return { status: 'ok', packageId };
}

/**
 * Delete a package outright. Only when nothing has ever booked it — otherwise
 * `event_vendors.package_item_id` would go NULL under a live booking and the
 * couple would lose the record of what they bought. A booked package is
 * unlisted, never deleted.
 */
export async function deletePackage(packageId: string): Promise<SavePackageResult> {
  if (!packageAuthoringEnabled()) return { status: 'disabled' };
  const { supabase, profile } = await ensureProfile();

  const { data: owned } = await supabase
    .from('vendor_packages')
    .select('package_id')
    .eq('package_id', packageId)
    .eq('vendor_profile_id', profile.vendor_profile_id as string)
    .maybeSingle();
  if (!owned) return { status: 'not_found' };

  // Any booking at all, including released ones — a released booking is still
  // the couple's record of a real transaction.
  const { count } = await supabase
    .from('event_vendor_packages')
    .select('booking_id', { count: 'exact', head: true })
    .eq('package_id', packageId);
  if ((count ?? 0) > 0) return { status: 'frozen', changed: ['has_bookings'] };

  const { error } = await supabase
    .from('vendor_packages')
    .delete()
    .eq('package_id', packageId)
    .eq('vendor_profile_id', profile.vendor_profile_id as string);
  if (error) return { status: 'error', message: error.message };

  revalidatePath('/vendor-dashboard/packages');
  return { status: 'ok', packageId };
}
