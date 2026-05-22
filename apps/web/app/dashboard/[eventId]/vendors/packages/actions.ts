'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  computeCustomization,
  keptItems,
  resolveVendorCategory,
  type PackageCustomizations,
  type VendorPackageWithItems,
} from '@/lib/vendor-packages';

/**
 * Vendor package server actions (owner directive 2026-05-22) — cascade-
 * lock + release + per-item remove. Sits next to the package detail
 * page at /dashboard/[eventId]/vendors/packages/[bookingId].
 *
 * Cascade-lock walks the package items, maps each canonical_service to a
 * vendor_category enum value via PACKAGE_CANONICAL_TO_VENDOR_CATEGORY,
 * and inserts an event_vendors row per kept item — each carrying the
 * same event_vendor_package_id back-link. Planning-cards on event home
 * render a "from package" badge using that back-link.
 *
 * Lock is one-shot: the booking transitions considering → locked. After
 * lock, the only mutations are (a) remove an individual item from the
 * package (releases its event_vendors row + refunds replacement value
 * into the consumable pool), or (b) release the whole package (transitions
 * locked → released + reverts every linked event_vendors row to
 * 'considering').
 */

export type LockPackageResult =
  | { status: 'ok'; bookingId: string }
  | { status: 'not_signed_in' }
  | { status: 'forbidden' }
  | { status: 'package_not_found' }
  | { status: 'package_inactive' }
  | { status: 'already_locked'; bookingId: string }
  | { status: 'error'; message: string };

/**
 * Lock a vendor's package onto an event. Cascade-creates one
 * event_vendors row per kept package item, each tagged with
 * event_vendor_package_id pointing at the new booking row.
 *
 * `customizations` carries the host's choices from the customization
 * modal. Defaults: all items included, no consumable allocations.
 */
export async function lockPackage(
  eventId: string,
  packageId: string,
  customizations: PackageCustomizations,
): Promise<LockPackageResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'not_signed_in' };

  // 1. Verify host can write to this event. The RLS policy on
  //    event_vendor_packages enforces the same check at the DB layer,
  //    but checking up-front lets us return a clean 'forbidden' result
  //    instead of a Postgres permission error.
  const { data: membership } = await supabase
    .from('event_members')
    .select('event_id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .eq('member_type', 'couple')
    .maybeSingle();
  if (!membership) return { status: 'forbidden' };

  // 2. Load the package + its items. Active-only.
  const { data: pkgRow, error: pkgErr } = await supabase
    .from('vendor_packages')
    .select(
      'package_id, vendor_profile_id, package_name, description, total_price_centavos, consumable_budget_centavos, is_consumable_flexible, primary_canonical_service, is_active, created_at, updated_at',
    )
    .eq('package_id', packageId)
    .maybeSingle();
  if (pkgErr) return { status: 'error', message: pkgErr.message };
  if (!pkgRow) return { status: 'package_not_found' };
  if (!pkgRow.is_active) return { status: 'package_inactive' };

  const { data: itemsRows, error: itemsErr } = await supabase
    .from('vendor_package_items')
    .select(
      'item_id, package_id, canonical_service, service_description, is_default_included, replacement_value_centavos, display_order, created_at',
    )
    .eq('package_id', packageId)
    .order('display_order', { ascending: true });
  if (itemsErr) return { status: 'error', message: itemsErr.message };

  const pkg: VendorPackageWithItems = {
    ...pkgRow,
    items: itemsRows ?? [],
  };

  // 3. Idempotency guard — if this event already has an active locked
  //    booking for this package, return the existing booking ID instead
  //    of double-locking.
  const { data: existing } = await supabase
    .from('event_vendor_packages')
    .select('booking_id')
    .eq('event_id', eventId)
    .eq('package_id', packageId)
    .eq('status', 'locked')
    .maybeSingle();
  if (existing) return { status: 'already_locked', bookingId: existing.booking_id };

  // 4. Compute the cascade math.
  const removedIds = customizations.removed_item_ids ?? [];
  const { remainingConsumableCentavos, totalLockedCentavos } =
    computeCustomization(pkg, removedIds);
  const kept = keptItems(pkg, removedIds);

  // 5. Fetch vendor info for the cascaded event_vendors row metadata.
  //    business_name carries onto event_vendors.vendor_name so the
  //    planning-card row reads cleanly even before the marketplace_logo
  //    join enriches it.
  const { data: vendor } = await supabase
    .from('vendor_profiles')
    .select('vendor_profile_id, business_name, contact_email, contact_phone')
    .eq('vendor_profile_id', pkg.vendor_profile_id)
    .maybeSingle();
  if (!vendor) {
    return { status: 'error', message: 'Vendor profile missing for package' };
  }

  // 6. Insert the booking row first (status=locked, customizations
  //    persisted, totals computed). primary_event_vendor_id is filled
  //    in after the cascade inserts.
  const { data: bookingRow, error: bookingErr } = await supabase
    .from('event_vendor_packages')
    .insert({
      event_id: eventId,
      package_id: packageId,
      status: 'locked',
      customizations_json: customizations,
      remaining_consumable_centavos: remainingConsumableCentavos,
      total_locked_centavos: totalLockedCentavos,
      locked_at: new Date().toISOString(),
    })
    .select('booking_id')
    .single();
  if (bookingErr || !bookingRow) {
    return { status: 'error', message: bookingErr?.message ?? 'Booking insert failed' };
  }
  const bookingId = bookingRow.booking_id;

  // 7. Cascade event_vendors INSERTs — one per kept item. Each carries
  //    event_vendor_package_id pointing at the booking row, plus the
  //    marketplace_vendor_id link so the compatibility-check + finalized-
  //    card-photo flows (PR #341 + PR B 2026-05-22) work out-of-the-box.
  if (kept.length > 0) {
    const eventVendorRows = kept.map((item) => ({
      event_id: eventId,
      category: resolveVendorCategory(item.canonical_service),
      vendor_name: vendor.business_name || pkg.package_name,
      contact_email: vendor.contact_email ?? null,
      contact_phone: vendor.contact_phone ?? null,
      status: 'contracted' as const,
      total_cost_php: item.replacement_value_centavos > 0
        ? item.replacement_value_centavos / 100
        : null,
      marketplace_vendor_id: pkg.vendor_profile_id,
      event_vendor_package_id: bookingId,
      notes: `From package: ${pkg.package_name} — ${item.service_description}`,
    }));

    const { data: insertedRows, error: cascadeErr } = await supabase
      .from('event_vendors')
      .insert(eventVendorRows)
      .select('vendor_id, category');
    if (cascadeErr) {
      // Best-effort rollback: delete the booking we just created so the
      // host doesn't end up with an orphaned package row pointing at no
      // event_vendors. The cascade FK doesn't help here (event_vendors
      // failed to insert, so there's nothing to cascade-delete from).
      await supabase
        .from('event_vendor_packages')
        .delete()
        .eq('booking_id', bookingId);
      return { status: 'error', message: cascadeErr.message };
    }

    // Pick the primary (reception_venue category if present, else first).
    const primary =
      insertedRows?.find((r) => r.category === 'venue') ??
      insertedRows?.find(
        (r) => r.category === resolveVendorCategory(pkg.primary_canonical_service),
      ) ??
      insertedRows?.[0];
    if (primary) {
      await supabase
        .from('event_vendor_packages')
        .update({ primary_event_vendor_id: primary.vendor_id })
        .eq('booking_id', bookingId);
    }
  }

  // 8. Revalidate every surface that reads event_vendors or the package
  //    booking. Event home + vendor tracker + the package detail page
  //    all need to refresh.
  revalidatePath(`/dashboard/${eventId}`);
  revalidatePath(`/dashboard/${eventId}/vendors`);
  revalidatePath(`/dashboard/${eventId}/vendors/packages/${bookingId}`);

  return { status: 'ok', bookingId };
}

/* ──────────────────────────────────────────────────────────────────────── */
/* releasePackage                                                           */
/* ──────────────────────────────────────────────────────────────────────── */

export type ReleasePackageResult =
  | { status: 'ok' }
  | { status: 'not_signed_in' }
  | { status: 'forbidden' }
  | { status: 'booking_not_found' }
  | { status: 'already_released' }
  | { status: 'error'; message: string };

/**
 * Release a locked package. Reverts every cascade-created event_vendors
 * row back to 'considering' status (preserves the row so the host can
 * see what was there + manually delete if desired). The booking
 * transitions locked → released and gets a released_at timestamp.
 *
 * Reverting rather than deleting keeps the host's history intact + lets
 * them re-lock without losing context. Per-row deletion remains
 * available via the existing deleteVendor action.
 */
export async function releasePackage(formData: FormData) {
  const eventId = formData.get('event_id');
  const bookingId = formData.get('booking_id');
  if (typeof eventId !== 'string' || typeof bookingId !== 'string') {
    throw new Error('Invalid input');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Load the booking; RLS enforces host scope but we still want a clean
  // not-found vs already-released distinction for UX copy.
  const { data: booking } = await supabase
    .from('event_vendor_packages')
    .select('booking_id, status, event_id')
    .eq('booking_id', bookingId)
    .eq('event_id', eventId)
    .maybeSingle();
  if (!booking) throw new Error('Package booking not found');
  if (booking.status === 'released') {
    // Already released — no-op, just revalidate so the UI catches up.
    revalidatePath(`/dashboard/${eventId}`);
    revalidatePath(`/dashboard/${eventId}/vendors`);
    return;
  }

  // 1. Revert linked event_vendors rows to 'considering'. The FK back-
  //    link stays so the planning-card "from package" badge persists
  //    (the host can see this was once a package booking).
  const { error: revertErr } = await supabase
    .from('event_vendors')
    .update({ status: 'considering' })
    .eq('event_id', eventId)
    .eq('event_vendor_package_id', bookingId);
  if (revertErr) throw new Error(revertErr.message);

  // 2. Mark the booking released.
  const { error: bookingErr } = await supabase
    .from('event_vendor_packages')
    .update({ status: 'released', released_at: new Date().toISOString() })
    .eq('booking_id', bookingId);
  if (bookingErr) throw new Error(bookingErr.message);

  revalidatePath(`/dashboard/${eventId}`);
  revalidatePath(`/dashboard/${eventId}/vendors`);
  revalidatePath(`/dashboard/${eventId}/vendors/packages/${bookingId}`);
}

/* ──────────────────────────────────────────────────────────────────────── */
/* removeItemFromPackage                                                    */
/* ──────────────────────────────────────────────────────────────────────── */

/**
 * Remove a single item from a locked package. Adds the item_id to the
 * booking's removed_item_ids list, deletes the cascaded event_vendors
 * row for that canonical_service, and refunds the replacement value
 * into the consumable pool (when is_consumable_flexible is TRUE).
 *
 * Useful for "I want the package but skip the photobooth — I already
 * booked one separately."
 */
export async function removeItemFromPackage(formData: FormData) {
  const eventId = formData.get('event_id');
  const bookingId = formData.get('booking_id');
  const itemId = formData.get('item_id');
  if (
    typeof eventId !== 'string' ||
    typeof bookingId !== 'string' ||
    typeof itemId !== 'string'
  ) {
    throw new Error('Invalid input');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Load booking + package + items.
  const { data: booking } = await supabase
    .from('event_vendor_packages')
    .select(
      'booking_id, event_id, package_id, status, customizations_json',
    )
    .eq('booking_id', bookingId)
    .eq('event_id', eventId)
    .maybeSingle();
  if (!booking) throw new Error('Package booking not found');
  if (booking.status !== 'locked') {
    throw new Error('Can only remove items from a locked package');
  }

  const { data: pkgRow } = await supabase
    .from('vendor_packages')
    .select(
      'package_id, vendor_profile_id, package_name, description, total_price_centavos, consumable_budget_centavos, is_consumable_flexible, primary_canonical_service, is_active, created_at, updated_at',
    )
    .eq('package_id', booking.package_id)
    .maybeSingle();
  if (!pkgRow) throw new Error('Package not found');

  const { data: itemsRows } = await supabase
    .from('vendor_package_items')
    .select(
      'item_id, package_id, canonical_service, service_description, is_default_included, replacement_value_centavos, display_order, created_at',
    )
    .eq('package_id', booking.package_id)
    .order('display_order', { ascending: true });

  const pkg: VendorPackageWithItems = {
    ...pkgRow,
    items: itemsRows ?? [],
  };

  // Update the customizations payload + recompute the math.
  const existingCustom = (booking.customizations_json ?? {}) as PackageCustomizations;
  const existingRemoved = existingCustom.removed_item_ids ?? [];
  if (existingRemoved.includes(itemId)) {
    // Idempotent: already removed, no-op.
    revalidatePath(`/dashboard/${eventId}`);
    revalidatePath(`/dashboard/${eventId}/vendors/packages/${bookingId}`);
    return;
  }
  const newRemoved = [...existingRemoved, itemId];
  const newCustom: PackageCustomizations = {
    ...existingCustom,
    removed_item_ids: newRemoved,
  };
  const { remainingConsumableCentavos, totalLockedCentavos } =
    computeCustomization(pkg, newRemoved);

  // Map the removed item's canonical_service to its vendor_category so we
  // know which cascaded event_vendors row to delete.
  const removedItem = pkg.items.find((i) => i.item_id === itemId);
  if (!removedItem) throw new Error('Item not found in package');
  const removedCategory = resolveVendorCategory(removedItem.canonical_service);

  // Delete the cascaded event_vendors row(s) for this category in this
  // booking. There's typically exactly one match — the package cascade
  // creates one row per item.
  const { error: deleteErr } = await supabase
    .from('event_vendors')
    .delete()
    .eq('event_id', eventId)
    .eq('event_vendor_package_id', bookingId)
    .eq('category', removedCategory);
  if (deleteErr) throw new Error(deleteErr.message);

  // Persist new customization + recomputed totals.
  const { error: updateErr } = await supabase
    .from('event_vendor_packages')
    .update({
      customizations_json: newCustom,
      remaining_consumable_centavos: remainingConsumableCentavos,
      total_locked_centavos: totalLockedCentavos,
    })
    .eq('booking_id', bookingId);
  if (updateErr) throw new Error(updateErr.message);

  revalidatePath(`/dashboard/${eventId}`);
  revalidatePath(`/dashboard/${eventId}/vendors`);
  revalidatePath(`/dashboard/${eventId}/vendors/packages/${bookingId}`);
}
