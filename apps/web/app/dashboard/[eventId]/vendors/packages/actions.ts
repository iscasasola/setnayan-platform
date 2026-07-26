'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isMarketplaceVendorBookable } from '@/lib/vendor-verification';
import { isBookingFeeEnabled } from '@/lib/booking-fee-gate';
import { resolveLivePax } from '@/lib/pax';
import { collectBookingFeeAtLock } from '@/lib/booking-fee-lock.server';
import { packageCreditEnabled } from '@/lib/package-credit-flag';
import {
  priceCustomizedPackage,
  unresolvedRequiredChoices,
} from '@/lib/package-credit-adapter';
import {
  isRemovableItem,
  keptItems,
  resolveChosenOption,
  resolveVendorCategory,
  PACKAGE_ITEM_OPTION_SELECT,
  VENDOR_PACKAGE_SELECT,
  VENDOR_PACKAGE_ITEM_SELECT,
  type VendorPackageRow,
  type PackageCustomizations,
  type VendorPackageItemOptionRow,
  type VendorPackageItemRow,
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
  // Booking requires a VERIFIED vendor (owner 2026-07-24) — a package cascade
  // inserts contracted event_vendors rows for pkg.vendor_profile_id, so it's
  // gated the same as finalizeVendor. The DB trigger is the hard guard.
  | { status: 'vendor_not_verified'; vendorName: string }
  // A REQUIRED choice line was left unpicked. Owner rule: the couple must
  // choose, and the engine refuses to apply the default on their behalf. The
  // modal blocks the button, so this is the stale-client backstop.
  | { status: 'choice_required'; itemIds: ReadonlyArray<string> }
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
    .select(VENDOR_PACKAGE_SELECT)
    .eq('package_id', packageId)
    .maybeSingle();
  if (pkgErr) return { status: 'error', message: pkgErr.message };
  if (!pkgRow) return { status: 'package_not_found' };
  if (!pkgRow.is_active) return { status: 'package_inactive' };

  const { data: itemsRows, error: itemsErr } = await supabase
    .from('vendor_package_items')
    .select(
      // `is_required` is load-bearing: `isRemovableItem` refuses to price a
      // removal without it, so omitting it here silently let a host drop a
      // line the vendor marked mandatory.
      VENDOR_PACKAGE_ITEM_SELECT,
    )
    .eq('package_id', packageId)
    .order('display_order', { ascending: true });
  if (itemsErr) return { status: 'error', message: itemsErr.message };

  // CHOICE options. Read here, from the DB, on purpose: the browser sends only
  // option IDs, and every peso attached to one is resolved server-side. A price
  // that arrived from the client must never be what the host is charged.
  const itemIds = (itemsRows ?? []).map((i) => i.item_id);
  const { data: optionRows, error: optionsErr } = itemIds.length
    ? await supabase
        .from('vendor_package_item_options')
        .select(PACKAGE_ITEM_OPTION_SELECT)
        .in('item_id', itemIds)
        .eq('is_available', true)
        .order('display_order', { ascending: true })
    : { data: [] as VendorPackageItemOptionRow[], error: null };
  if (optionsErr) return { status: 'error', message: optionsErr.message };

  const optionsByItem = new Map<string, VendorPackageItemOptionRow[]>();
  for (const row of (optionRows ?? []) as VendorPackageItemOptionRow[]) {
    const list = optionsByItem.get(row.item_id) ?? [];
    list.push(row);
    optionsByItem.set(row.item_id, list);
  }

  const pkg: VendorPackageWithItems = {
    ...pkgRow,
    items: (itemsRows ?? []).map((row) => ({
      ...(row as VendorPackageItemRow),
      options: optionsByItem.get(row.item_id) ?? [],
    })),
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
  const kept = keptItems(pkg, removedIds);

  // Keep only option ids that really belong to a KEPT choice line on THIS
  // package. Anything else — another package's option, a retired one, an id for
  // a line the host just dropped — is discarded rather than rejected, matching
  // how `computeCustomization` already treats a bogus removal: a stale or
  // hostile client can neither crash the lock nor profit from it.
  const requestedOptionIds = customizations.chosen_option_ids ?? [];
  const chosenOptionIds = kept
    .map((item) => resolveChosenOption(item, requestedOptionIds))
    .filter((opt): opt is VendorPackageItemOptionRow => opt !== undefined)
    .filter((opt) => requestedOptionIds.includes(opt.option_id))
    .map((opt) => opt.option_id);

  // ── The CREDIT engine (flag-dark) ────────────────────────────────────────
  //
  // With the flag ON, ./package-credit becomes the single authority for every
  // number on this booking. It is a strict superset of the shipped math: with
  // policy 'expiring' and no upgrades it reproduces `computeCustomization` to
  // the centavo (the DB default is 'expiring', and nothing can write anything
  // else), so flipping the flag on a plain package is a no-op by construction.
  //
  // It FAILS CLOSED. The removal list is narrowed first — see `allowedRemovals`
  // for why that specific forgiveness is preserved and why it can only ever
  // hand out LESS credit — and anything the engine still refuses is a real
  // problem, so we surface it instead of quietly falling back to a number. A
  // silent fallback here would be the worst of both: the couple is charged by
  // one model while being shown another.
  if (packageCreditEnabled()) {
    const unresolved = unresolvedRequiredChoices(pkg, removedIds, chosenOptionIds);
    if (unresolved.length > 0) {
      // Owner rule: a required choice line must be PICKED, never defaulted.
      // The modal blocks this, so reaching here means a stale or hand-rolled
      // client — answer it as the product question it is, not as an error code.
      return {
        status: 'choice_required',
        itemIds: unresolved,
      };
    }
  }

  // ── Credit spent on the vendor's OTHER services ──────────────────────────
  //
  // Owner-locked 2026-07-26: "credits can be consumables to other services, but
  // not deductables… can be used on other services of the vendors as well."
  //
  // Two hard rules, both enforced here rather than trusted:
  //   1. SAME VENDOR ONLY. The catalogue query is scoped to this package's
  //      vendor_profile_id, so credit can never be spent against a different
  //      vendor's service — that would be Setnayan moving money between two
  //      businesses, which this model explicitly does not do (0% commission,
  //      vendors settle off-platform).
  //   2. THE PRICE COMES FROM THE DB. The client sends service ids and
  //      quantities only. `credit_price_centavos` is the vendor's COMMITTED
  //      price; NULL means not purchasable with credit, and the engine then
  //      refuses the addition (`unknown_addition`) rather than pricing it at 0.
  const requestedAdditions = (customizations.credit_additions ?? []).filter(
    (a) => typeof a?.service_id === 'string' && Number.isFinite(a?.quantity),
  );
  let creditAdditions: Array<{ addition_id: string; quantity: number }> = [];
  let creditCatalogue: Array<{ addition_id: string; unit_price_centavos: number }> = [];
  if (requestedAdditions.length > 0) {
    const { data: sellable, error: catErr } = await supabase
      .from('vendor_services')
      .select('vendor_service_id, credit_price_centavos')
      .eq('vendor_profile_id', pkg.vendor_profile_id) // rule 1
      .in('vendor_service_id', requestedAdditions.map((a) => a.service_id))
      .not('credit_price_centavos', 'is', null);
    if (catErr) return { status: 'error', message: catErr.message };

    creditCatalogue = (sellable ?? []).map((r) => ({
      addition_id: r.vendor_service_id as string,
      unit_price_centavos: Number(r.credit_price_centavos),
    }));
    const priced = new Set(creditCatalogue.map((c) => c.addition_id));
    // Keep only what we actually resolved a committed price for. An unpriced
    // id is dropped here AND would be refused by the engine — belt and braces,
    // because the failure mode is spending credit at a price nobody set.
    creditAdditions = requestedAdditions
      .filter((a) => priced.has(a.service_id))
      .map((a) => ({ addition_id: a.service_id, quantity: Math.trunc(a.quantity) }));
  }

  // Head count for per-head option upgrades ("+₱150/head"). SERVER-resolved —
  // it multiplies money, so it must never come from the client. Null (no
  // headcount yet) reads as 0 and each option's own `min_pax` floors it, so a
  // per-head upgrade prices at its minimum rather than at nothing.
  const livePax = (await resolveLivePax(supabase, eventId)) ?? 0;

  // ONE pricer, shared with removeItemFromPackage — see priceCustomizedPackage
  // for why computing this in two places was a live money bug.
  const creditTotals = priceCustomizedPackage(
    pkg,
    removedIds,
    chosenOptionIds,
    packageCreditEnabled(),
    livePax,
    creditAdditions,
    creditCatalogue,
  );
  if (!creditTotals) {
    return {
      status: 'error',
      message: 'Package pricing could not be computed.',
    };
  }

  const bookingTotalCentavos = creditTotals.bookingTotalCentavos;

  // Persist the SANITISED set, not the raw client object — otherwise a bogus id
  // survives in customizations_json and reads as truth to every later consumer.
  const persistedCustomizations: PackageCustomizations = {
    ...customizations,
    ...(chosenOptionIds.length > 0
      ? { chosen_option_ids: chosenOptionIds }
      : { chosen_option_ids: undefined }),
  };
  if (persistedCustomizations.chosen_option_ids === undefined) {
    delete persistedCustomizations.chosen_option_ids;
  }

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

  // 5b. Booking requires a VERIFIED vendor (owner 2026-07-24). The cascade below
  //     inserts contracted event_vendors rows for this vendor — gate it the same
  //     as finalizeVendor. Admin read: verification_state isn't public-readable
  //     for a non-verified profile. The DB trigger is the hard backstop.
  if (!(await isMarketplaceVendorBookable(createAdminClient(), pkg.vendor_profile_id))) {
    return {
      status: 'vendor_not_verified',
      vendorName: vendor.business_name || pkg.package_name || 'this vendor',
    };
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
      customizations_json: persistedCustomizations,
      // Credit left in the pool after upgrades. Flag OFF: the shipped
      // consumable figure, unchanged. Flag ON: the engine's remaining credit,
      // which is the same number for a package with no upgrades.
      remaining_consumable_centavos: creditTotals.remainingConsumableCentavos,
      // Includes any picked upgrades — this is the number the couple agreed to,
      // and §6.4 makes it the package booking-fee base.
      total_locked_centavos: bookingTotalCentavos,
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
    // ── ONE ANCHOR, N COVERED (Vendor_Package_Credit_BUILD_SPEC_2026-07-26 § 0)
    //
    // A package used to cascade N equal rows, all carrying the same
    // marketplace_vendor_id — which the partial unique index
    // `event_vendors_unique_marketplace_pick_per_event` has forbidden since
    // 2026-06-25, so ANY package with 2+ lines failed to lock outright.
    //
    // Now exactly ONE row is the anchor: it carries the gross total, the
    // booking fee, and the free-tier slot. Every other kept line is a COVERED
    // row carrying NO money (a DB CHECK enforces that), exempt from the
    // marketplace-pick and hard-single uniqueness rules.
    //
    // The anchor ABSORBS the item matching the package's primary service, so
    // that item gets no covered row of its own. If none matches, the anchor
    // carries package_item_id = NULL and no line is skipped.
    const anchorCategory = resolveVendorCategory(pkg.primary_canonical_service);
    const anchorItem =
      kept.find((i) => resolveVendorCategory(i.canonical_service) === anchorCategory) ?? null;

    const baseRow = {
      event_id: eventId,
      vendor_name: vendor.business_name || pkg.package_name,
      contact_email: vendor.contact_email ?? null,
      contact_phone: vendor.contact_phone ?? null,
      status: 'contracted' as const,
      marketplace_vendor_id: pkg.vendor_profile_id,
      event_vendor_package_id: bookingId,
    };

    const eventVendorRows = [
      {
        ...baseRow,
        category: anchorCategory,
        package_role: 'anchor' as const,
        // THE money row: the whole agreed total, upgrades included. This is the
        // §6.4 booking-fee base — one number the couple accepted, not a line.
        total_cost_php: bookingTotalCentavos > 0 ? bookingTotalCentavos / 100 : null,
        package_item_id: anchorItem?.item_id ?? null,
        notes: `Package: ${pkg.package_name}`,
      },
      ...kept
        .filter((item) => item.item_id !== anchorItem?.item_id)
        .map((item) => ({
          ...baseRow,
          category: resolveVendorCategory(item.canonical_service),
          package_role: 'covered' as const,
          // NEVER money. The anchor holds it; `event_vendors_covered_rows_carry_no_money`
          // makes a peso here impossible rather than merely discouraged.
          total_cost_php: null,
          package_item_id: item.item_id,
          notes: `From package: ${pkg.package_name} — ${item.service_description}`,
        })),
    ];

    const { data: insertedRows, error: cascadeErr } = await supabase
      .from('event_vendors')
      .insert(eventVendorRows)
      .select('vendor_id, category, package_role');
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

    // The ANCHOR is the primary, by construction — it is the row carrying the
    // agreed total. This used to be a heuristic (venue category, else the
    // package's primary service, else whichever row came back first), which
    // could land on a covered row that carries no money at all.
    const anchorRow = insertedRows?.find((r) => r.package_role === 'anchor');
    if (anchorRow) {
      await supabase
        .from('event_vendor_packages')
        .update({ primary_event_vendor_id: anchorRow.vendor_id })
        .eq('booking_id', bookingId);

      // ── § 6.4 — the booking fee, ONCE, on the package's agreed total ──────
      //
      // Until now `lockPackage` never called the collector at all, so on
      // flag-flip a package booked for ₱0 in fees no matter its size.
      //
      // It fires on the ANCHOR precisely because the anchor carries
      // `total_cost_php` = the whole number the couple accepted. Calling it per
      // cascaded row would instead price the largest single LINE, and — worse —
      // burn one of the vendor's five free bookings per service and freeze a
      // ledger ordinal that is only ever computed once. The RPC now refuses a
      // covered row outright (`covered_row_no_fee`) so that cannot happen even
      // by mistake.
      //
      // Ships dark: `collectBookingFeeAtLock` is a no-op unless
      // NEXT_PUBLIC_BOOKING_FEE_ENABLED is on. Fail-soft on purpose — the
      // couple's booking must never fail because a fee could not be opened;
      // the next lock re-attempts it.
      if (isBookingFeeEnabled()) {
        try {
          await collectBookingFeeAtLock(createAdminClient(), {
            eventVendorId: anchorRow.vendor_id,
          });
        } catch (e) {
          console.error(
            `[lockPackage] booking-fee collect failed for booking_id=${bookingId}:`,
            e,
          );
        }
      }
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
    .select(VENDOR_PACKAGE_SELECT)
    .eq('package_id', booking.package_id)
    .maybeSingle();
  if (!pkgRow) throw new Error('Package not found');

  const { data: itemsRows } = await supabase
    .from('vendor_package_items')
    .select(
      // `is_required` is load-bearing: `isRemovableItem` refuses to price a
      // removal without it, so omitting it here silently let a host drop a
      // line the vendor marked mandatory.
      VENDOR_PACKAGE_ITEM_SELECT,
    )
    .eq('package_id', booking.package_id)
    .order('display_order', { ascending: true });

  const pkg: VendorPackageWithItems = {
    ...pkgRow,
    items: itemsRows ?? [],
  };

  // Update the customizations payload + recompute the math.
  // Options, so a choice line is still a choice line when we re-price. Without
  // this every line reads as plain and the surcharge vanishes.
  const removeItemIds = (itemsRows ?? []).map((i) => i.item_id);
  const { data: removeOptionRows } = removeItemIds.length
    ? await supabase
        .from('vendor_package_item_options')
        .select(PACKAGE_ITEM_OPTION_SELECT)
        .in('item_id', removeItemIds)
        .eq('is_available', true)
        .order('display_order', { ascending: true })
    : { data: [] as VendorPackageItemOptionRow[] };
  const removeOptionsByItem = new Map<string, VendorPackageItemOptionRow[]>();
  for (const row of (removeOptionRows ?? []) as VendorPackageItemOptionRow[]) {
    const list = removeOptionsByItem.get(row.item_id) ?? [];
    list.push(row);
    removeOptionsByItem.set(row.item_id, list);
  }
  pkg.items = pkg.items.map((i) => ({
    ...i,
    options: removeOptionsByItem.get(i.item_id) ?? [],
  }));

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
  // Choices matter here too. This path used to price with `computeCustomization`
  // alone, so removing ANY line from a package carrying a paid upgrade silently
  // dropped the upgrade from the stored total while `chosen_option_ids` still
  // recorded the pick — and the booking fee rides on that total.
  const survivingOptionIds = newCustom.chosen_option_ids ?? [];
  const removePax = (await resolveLivePax(supabase, eventId)) ?? 0;
  const totals = priceCustomizedPackage(
    pkg,
    newRemoved,
    survivingOptionIds,
    packageCreditEnabled(),
    removePax,
  );
  if (!totals) throw new Error('Package pricing could not be computed.');
  const { remainingConsumableCentavos, bookingTotalCentavos: totalLockedCentavos } =
    totals;

  const removedItem = pkg.items.find((i) => i.item_id === itemId);
  if (!removedItem) throw new Error('Item not found in package');

  // A required line is not the host's to drop (owner-locked 2026-07-26). The
  // client disables the control, but the server is what decides.
  if (!isRemovableItem(removedItem)) {
    throw new Error('That item is part of the package and cannot be removed.');
  }

  // Delete by ITEM, not by category. resolveVendorCategory is many-to-one
  // (reception_venue + hotel_ballroom + garden_… all → 'venue'), so the old
  // category match deleted every sibling row in the category while recording
  // only this one item_id — see migration 20271007240000.
  const { data: deletedRows, error: deleteErr } = await supabase
    .from('event_vendors')
    .delete()
    .eq('event_id', eventId)
    .eq('event_vendor_package_id', bookingId)
    .eq('package_item_id', itemId)
    .select('vendor_id');
  if (deleteErr) throw new Error(deleteErr.message);

  // Fallback for rows cascaded before package_item_id existed (none in prod —
  // this booking predates the column). Category-scoped as before, but only
  // when the precise match found nothing, so it can never over-delete a
  // booking that does carry provenance.
  if ((deletedRows?.length ?? 0) === 0) {
    const removedCategory = resolveVendorCategory(removedItem.canonical_service);
    const { error: legacyErr } = await supabase
      .from('event_vendors')
      .delete()
      .eq('event_id', eventId)
      .eq('event_vendor_package_id', bookingId)
      .eq('category', removedCategory)
      .is('package_item_id', null);
    if (legacyErr) throw new Error(legacyErr.message);
  }

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
