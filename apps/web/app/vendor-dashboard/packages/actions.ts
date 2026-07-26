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
  type DraftPackage,
  type DraftProblem,
} from '@/lib/package-authoring';
import {
  PACKAGE_ITEM_OPTION_SELECT,
  type VendorPackageItemOptionRow,
} from '@/lib/vendor-packages';

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

/** Bookings that still bind the vendor. A released booking no longer does. */
async function activeBookingCount(
  supabase: SupabaseClient,
  packageId: string,
): Promise<number> {
  const { count } = await supabase
    .from('event_vendor_packages')
    .select('booking_id', { count: 'exact', head: true })
    .eq('package_id', packageId)
    .neq('status', 'released');
  return count ?? 0;
}

/** Read a package the caller owns, in the DraftPackage shape, or null. */
async function loadOwnDraft(
  supabase: SupabaseClient,
  vendorProfileId: string,
  packageId: string,
): Promise<DraftPackage | null> {
  const { data: pkg } = await supabase
    .from('vendor_packages')
    .select(
      'package_id, vendor_profile_id, package_name, total_price_centavos, consumable_budget_centavos, is_consumable_flexible',
    )
    .eq('package_id', packageId)
    .eq('vendor_profile_id', vendorProfileId) // ownership, not a filter
    .maybeSingle();
  if (!pkg) return null;

  const { data: items } = await supabase
    .from('vendor_package_items')
    .select(
      'item_id, canonical_service, service_description, is_default_included, is_required, replacement_value_centavos, display_order',
    )
    .eq('package_id', packageId)
    .order('display_order', { ascending: true });

  const itemIds = (items ?? []).map((i) => i.item_id);
  const { data: options } = itemIds.length
    ? await supabase
        .from('vendor_package_item_options')
        .select(PACKAGE_ITEM_OPTION_SELECT)
        .in('item_id', itemIds)
    : { data: [] as never[] };

  return {
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
  };
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
  input: DraftPackage & { packageId?: string; primary_canonical_service?: string },
): Promise<SavePackageResult> {
  if (!packageAuthoringEnabled()) return { status: 'disabled' };

  const { supabase, profile } = await ensureProfile();
  const vendorProfileId = profile.vendor_profile_id as string;

  const problems = validatePackageDraft(input);
  if (problems.length > 0) return { status: 'invalid', problems };

  // ---- UPDATE ----
  if (input.packageId) {
    const stored = await loadOwnDraft(supabase, vendorProfileId, input.packageId);
    if (!stored) return { status: 'not_found' };

    const scope = editScopeForPackage(
      await activeBookingCount(supabase, input.packageId),
    );
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

/** Insert items + their options. Returns an error result, or null on success. */
async function writeItems(
  supabase: SupabaseClient,
  packageId: string,
  draft: DraftPackage,
): Promise<SavePackageResult | null> {
  if (draft.items.length === 0) return null;

  const { data: itemRows, error: itemErr } = await supabase
    .from('vendor_package_items')
    .insert(
      draft.items.map((i, idx) => ({
        package_id: packageId,
        canonical_service: i.canonical_service,
        service_description: i.service_description.trim(),
        is_default_included: i.is_default_included,
        is_required: i.is_required,
        replacement_value_centavos: i.replacement_value_centavos,
        display_order: idx,
      })),
    )
    .select('item_id, display_order');
  if (itemErr || !itemRows) {
    return { status: 'error', message: itemErr?.message ?? 'Item insert failed' };
  }

  // Re-key by display_order — the insert preserves it, and it is the only link
  // back to the draft's client-side refs.
  const byOrder = new Map(itemRows.map((r) => [r.display_order, r.item_id]));
  // Typed as the real row so a mis-named column is a compile error, not a
  // PostgREST 400 at runtime — writing `label` here (the column is
  // `option_label`) silently saved every choice line with no options at all.
  const optionRows: ReadonlyArray<Omit<VendorPackageItemOptionRow, 'option_id'>> =
    draft.items.flatMap((i, idx) => {
      const itemId = byOrder.get(idx);
      if (!itemId) return [];
      return i.options.map((o, oIdx) => ({
        item_id: itemId,
        option_label: o.label.trim(),
        price_delta_centavos: o.price_delta_centavos,
        is_default: o.is_default,
        is_available: o.is_available,
        display_order: oIdx,
      }));
    });

  if (optionRows.length > 0) {
    const { error: optErr } = await supabase
      .from('vendor_package_item_options')
      .insert(optionRows);
    if (optErr) return { status: 'error', message: optErr.message };
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
    const stored = await loadOwnDraft(
      supabase,
      profile.vendor_profile_id as string,
      packageId,
    );
    if (!stored) return { status: 'not_found' };
    const problems = validatePackageDraft(stored);
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
