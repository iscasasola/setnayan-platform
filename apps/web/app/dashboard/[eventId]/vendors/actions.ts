'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { emitNotification } from '@/lib/notification-emit';
import { uploadPublicAsset } from '@/lib/storage';
import {
  VENDOR_CATEGORIES,
  VENDOR_STATUSES,
  type VendorCategory,
  type VendorStatus,
} from '@/lib/vendors';
import {
  HARD_SINGLE_PICK_GROUPS,
  planGroupForCategory,
} from '@/lib/wedding-plan-groups';
import { CONFIRMED_VENDOR_STATUSES } from '@/lib/events';

function isValidCategory(value: unknown): value is VendorCategory {
  return typeof value === 'string' && (VENDOR_CATEGORIES as readonly string[]).includes(value);
}

function isValidStatus(value: unknown): value is VendorStatus {
  return typeof value === 'string' && (VENDOR_STATUSES as readonly string[]).includes(value);
}

function parseMoney(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

function nullIfBlank(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

export async function createVendor(formData: FormData) {
  const eventId = formData.get('event_id');
  const name = formData.get('vendor_name');
  const category = formData.get('category');

  if (typeof eventId !== 'string' || typeof name !== 'string' || !isValidCategory(category)) {
    throw new Error('Invalid input');
  }
  const trimmedName = name.trim();
  if (trimmedName.length === 0 || trimmedName.length > 128) {
    throw new Error('Vendor name must be 1–128 chars');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase.from('event_vendors').insert({
    event_id: eventId,
    category,
    vendor_name: trimmedName,
    contact_email: nullIfBlank(formData.get('contact_email')),
    contact_phone: nullIfBlank(formData.get('contact_phone')),
    total_cost_php: parseMoney(formData.get('total_cost_php')),
    deposit_paid_php: parseMoney(formData.get('deposit_paid_php')),
    notes: nullIfBlank(formData.get('notes')),
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/vendors`);
}

// ============================================================================
// Inline custom-vendor add from the home-page planner cards (2026-05-21).
//
// Same insert shape as createVendor but returns a Result so the client
// component can render pending / added / error states without the
// "thrown error → page-level fault" UX that createVendor produces inside
// a `<form action={...}>`.
// ============================================================================

export type AddCustomVendorResult =
  | { status: 'ok'; eventVendorId: string }
  | { status: 'not_signed_in' }
  | { status: 'error'; message: string };

export async function addCustomVendor(
  formData: FormData,
): Promise<AddCustomVendorResult> {
  const eventId = formData.get('event_id');
  const name = formData.get('vendor_name');
  const category = formData.get('category');

  if (typeof eventId !== 'string' || eventId.length === 0) {
    return { status: 'error', message: 'Missing event id' };
  }
  if (typeof name !== 'string') {
    return { status: 'error', message: 'Missing vendor name' };
  }
  if (!isValidCategory(category)) {
    return { status: 'error', message: 'Unknown category' };
  }
  const trimmedName = name.trim();
  if (trimmedName.length === 0) {
    return { status: 'error', message: 'Vendor name is required' };
  }
  if (trimmedName.length > 128) {
    return { status: 'error', message: 'Name must be 128 chars or fewer' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: 'not_signed_in' };
  }

  const { data: inserted, error } = await supabase
    .from('event_vendors')
    .insert({
      event_id: eventId,
      category,
      vendor_name: trimmedName,
      status: 'considering',
    })
    .select('vendor_id')
    .single();

  if (error || !inserted) {
    return { status: 'error', message: error?.message ?? 'Insert failed' };
  }

  revalidatePath(`/dashboard/${eventId}`);
  revalidatePath(`/dashboard/${eventId}/vendors`);
  return { status: 'ok', eventVendorId: inserted.vendor_id };
}

export async function updateVendorStatus(formData: FormData) {
  const eventId = formData.get('event_id');
  const vendorId = formData.get('vendor_id');
  const status = formData.get('status');

  if (typeof eventId !== 'string' || typeof vendorId !== 'string' || !isValidStatus(status)) {
    throw new Error('Invalid input');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Snapshot the prior state so we can detect the "first-time delivered"
  // transition that triggers the review-request notification below.
  const { data: prev } = await supabase
    .from('event_vendors')
    .select('status, vendor_name')
    .eq('vendor_id', vendorId)
    .eq('event_id', eventId)
    .maybeSingle();

  const { error } = await supabase
    .from('event_vendors')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('vendor_id', vendorId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  // Phase-2 review-request emit: the moment a vendor's service is marked
  // delivered (and wasn't already delivered/complete), drop a notification
  // on the couple's tray + send a Resend email asking them to leave a
  // review. Failure to emit must never roll back the status change itself,
  // so emitNotification swallows errors internally.
  if (
    status === 'delivered'
    && prev?.status !== 'delivered'
    && prev?.status !== 'complete'
  ) {
    const vendorName = prev?.vendor_name ?? 'your vendor';
    await emitNotification({
      userId: user.id,
      type: 'review_request',
      title: `How was ${vendorName}?`,
      body: 'Their service is marked delivered. Take a minute to leave a public review.',
      relatedUrl: `/dashboard/${eventId}/vendors/${vendorId}/review`,
    });
  }

  revalidatePath(`/dashboard/${eventId}/vendors`);
}

export async function deleteVendor(formData: FormData) {
  const eventId = formData.get('event_id');
  const vendorId = formData.get('vendor_id');
  if (typeof eventId !== 'string' || typeof vendorId !== 'string') {
    throw new Error('Invalid input');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('event_vendors')
    .delete()
    .eq('vendor_id', vendorId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  // Revalidate both surfaces so an incompatible-pick Remove on the event
  // home (PR B 2026-05-22) clears the chip without a hard refresh, and
  // the vendor tracker stays in sync.
  revalidatePath(`/dashboard/${eventId}`);
  revalidatePath(`/dashboard/${eventId}/vendors`);
}

// ============================================================================
// finalizeVendor (2026-05-22) — Lock-this-vendor action from PlanCardCompare.
//
// Flips a vendor's status from 'considering' / 'shortlisted' → 'contracted'
// (the first entry in CONFIRMED_VENDOR_STATUSES from lib/events.ts). Returns
// a Result shape so the client compare drawer can render confirmation /
// hard-single conflict / error states without the "thrown error → page-fault"
// UX that synchronous form actions produce.
//
// Hard-single conflict gate: per CLAUDE.md 2026-05-09 saturation rules + the
// HARD_SINGLE_PICK_GROUPS set in lib/wedding-plan-groups.ts. As of the 22-card
// grid expansion (2026-05-22), the hard-single set covers: ceremony_venue +
// reception_venue + officiant + coordinator + host_mc + led_background — each
// allows only ONE locked vendor at a time. If the host tries to lock a second
// vendor in one of those groups, the action returns 'hard_single_conflict'
// with the existing locked vendor's info; the UI then offers a Switch flow
// that (a) reverts the existing locked vendor to 'considering' and
// (b) locks the new vendor in one pass.
//
// Multi-host race: per iteration 0048, two hosts (e.g. a couple member + a
// parent_of_bride moderator) could both try to lock different vendors in
// the same hard-single category concurrently. The first lock wins because
// the conflict check reads from the same row that the update would write
// to — the second host sees the conflict modal and chooses Switch or
// Cancel. Acceptable for V1 pilot; tighter row-level locking lands V1.x if
// real contention emerges.
//
// Auth: relies on RLS on event_vendors (same as updateVendorStatus). The
// `if (!user) redirect('/login')` guard keeps the action from running for
// signed-out users; everything beyond that is RLS-enforced.
// ============================================================================

export type FinalizeVendorResult =
  | { status: 'ok'; vendorId: string; lockedStatus: string }
  | { status: 'not_signed_in' }
  | { status: 'not_found' }
  | { status: 'already_locked'; vendorId: string }
  | {
      status: 'hard_single_conflict';
      groupId: string;
      groupLabel: string;
      existingVendorId: string;
      existingVendorName: string;
    }
  | { status: 'error'; message: string };

const LOCKED_STATUS: VendorStatus = 'contracted';

export async function finalizeVendor(
  formData: FormData,
): Promise<FinalizeVendorResult> {
  const eventId = formData.get('event_id');
  const vendorId = formData.get('vendor_id');
  const overrideExistingRaw = formData.get('override_existing');
  const overrideExisting = overrideExistingRaw === '1' || overrideExistingRaw === 'true';

  if (typeof eventId !== 'string' || eventId.length === 0) {
    return { status: 'error', message: 'Missing event id' };
  }
  if (typeof vendorId !== 'string' || vendorId.length === 0) {
    return { status: 'error', message: 'Missing vendor id' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: 'not_signed_in' };
  }

  // Read the target vendor and any already-locked siblings in one trip.
  const { data: targetVendor, error: targetErr } = await supabase
    .from('event_vendors')
    .select('vendor_id, category, status, vendor_name')
    .eq('event_id', eventId)
    .eq('vendor_id', vendorId)
    .maybeSingle();
  if (targetErr) {
    return { status: 'error', message: targetErr.message };
  }
  if (!targetVendor) {
    return { status: 'not_found' };
  }

  const targetCategory = targetVendor.category as VendorCategory;

  // Already locked → idempotent no-op. Surface the state to the caller
  // so the UI can collapse the action without a misleading "succeeded".
  if (
    typeof targetVendor.status === 'string' &&
    (CONFIRMED_VENDOR_STATUSES as readonly string[]).includes(targetVendor.status)
  ) {
    return { status: 'already_locked', vendorId };
  }

  // Hard-single conflict check.
  const groupId = planGroupForCategory(targetCategory);
  let existingLocked:
    | { vendor_id: string; vendor_name: string; category: VendorCategory }
    | null = null;

  if (groupId && HARD_SINGLE_PICK_GROUPS.has(groupId)) {
    const groupCategories = (() => {
      const list: VendorCategory[] = [];
      for (const c of VENDOR_CATEGORIES) {
        if (planGroupForCategory(c) === groupId) list.push(c);
      }
      return list;
    })();

    const { data: lockedSiblings, error: lockedErr } = await supabase
      .from('event_vendors')
      .select('vendor_id, vendor_name, category, status')
      .eq('event_id', eventId)
      .in('category', groupCategories as unknown as string[])
      .in('status', CONFIRMED_VENDOR_STATUSES as unknown as string[])
      .neq('vendor_id', vendorId)
      .limit(1);
    if (lockedErr) {
      return { status: 'error', message: lockedErr.message };
    }
    const sibling = lockedSiblings?.[0];
    if (sibling) {
      existingLocked = {
        vendor_id: sibling.vendor_id as string,
        vendor_name: sibling.vendor_name as string,
        category: sibling.category as VendorCategory,
      };
    }
  }

  if (existingLocked && !overrideExisting) {
    // Surface the conflict to the UI for the Switch / Cancel modal.
    // Use the canonical group label (defer to the call site if it wants
    // to label it differently — the server returns the groupId so the
    // client can resolve the label from PLAN_GROUPS).
    const { PLAN_GROUPS: planGroups } = await import('@/lib/wedding-plan-groups');
    const groupRow = planGroups.find((g) => g.id === groupId);
    return {
      status: 'hard_single_conflict',
      groupId: groupId ?? '',
      groupLabel: groupRow?.label ?? groupId ?? 'this category',
      existingVendorId: existingLocked.vendor_id,
      existingVendorName: existingLocked.vendor_name,
    };
  }

  // Switch flow: revert the existing locked vendor to 'considering' so the
  // host's prior research stays on the card but doesn't double-occupy the
  // hard-single slot. We don't delete the row — the host can re-lock the
  // other vendor later if they change their mind.
  if (existingLocked && overrideExisting) {
    const { error: revertErr } = await supabase
      .from('event_vendors')
      .update({ status: 'considering', updated_at: new Date().toISOString() })
      .eq('vendor_id', existingLocked.vendor_id)
      .eq('event_id', eventId);
    if (revertErr) {
      return { status: 'error', message: revertErr.message };
    }
  }

  const { error: lockErr } = await supabase
    .from('event_vendors')
    .update({ status: LOCKED_STATUS, updated_at: new Date().toISOString() })
    .eq('vendor_id', vendorId)
    .eq('event_id', eventId);
  if (lockErr) {
    return { status: 'error', message: lockErr.message };
  }

  // Finalize auto-cleanup (CLAUDE.md 2026-05-22 owner directive).
  //
  // Owner verbatim: "when the vendor is finalized, the other vendors there
  // will be removed from the recommended vendors. this technique will help
  // the host of the event find a faster way to process other services
  // since they already locked this service with that vendor."
  //
  // Auto-archive every OTHER considering pick in the SAME category — the
  // host has committed to this vendor, so the rest of the shortlist no
  // longer needs to clutter the planning grid. Uses the
  // 20260604100000_event_vendors_archive_pattern.sql archived_at column
  // (soft-delete; rows stay in DB for audit + potential restore via the
  // existing SwitchVendorConfirm flow).
  //
  // Status filter: only archive 'considering' + 'shortlisted' rows. We
  // never touch rows already in CONFIRMED_VENDOR_STATUSES (those wouldn't
  // exist anyway after the hard-single conflict gate above on
  // ceremony_venue/reception_venue/officiant — but for the multi-pick
  // groups like Music & Entertainment, multiple confirmed vendors IS the
  // happy path, so we don't accidentally archive a legitimate co-lock).
  //
  // Failure mode: if the archive sweep fails, we DON'T roll back the lock
  // because the lock itself was the primary action the host took. The
  // host can manually delete or re-confirm any stale considering picks
  // from the vendor tracker. We log the error to console.warn so it
  // surfaces in Sentry for ops attention, but the action returns ok.
  const { error: archiveErr } = await supabase
    .from('event_vendors')
    .update({
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('event_id', eventId)
    .eq('category', targetCategory)
    .neq('vendor_id', vendorId)
    .in('status', ['considering', 'shortlisted'])
    .is('archived_at', null);
  if (archiveErr) {
    // Surface to Sentry-style logging without rolling back the lock.
    // eslint-disable-next-line no-console
    console.warn(
      `[finalizeVendor] archive-others cleanup failed for event=${eventId} category=${targetCategory}:`,
      archiveErr.message,
    );
  }

  // Refresh both the event home (FinalizedChipStrip + PlanningGroups read
  // from the same event_vendors fetch) and the vendor tracker (separate
  // surface that lists every vendor + status).
  revalidatePath(`/dashboard/${eventId}`);
  revalidatePath(`/dashboard/${eventId}/vendors`);

  return { status: 'ok', vendorId, lockedStatus: LOCKED_STATUS };
}

// ============================================================================
// addRecommendedVendorToCategory (2026-05-22) — Cross-category vendor
// recommendations · CLAUDE.md owner directive.
//
// When the host picks Vendor A in Catering, and Vendor A also offers Cake +
// Mobile Bar services via their vendor_services rows, the planning grid
// surfaces Vendor A as RECOMMENDED on the Cake card + Music & Entertainment
// card. This action lets the host accept that recommendation — adding Vendor
// A to the new category with the same marketplace link + service link as
// their existing pick.
//
// Two modes via the `status` form field:
//   - 'considering' — adds as a new option-on-the-table for the host to
//     compare against other vendors they might browse.
//   - 'contracted' — locks the vendor in the new category directly (the
//     host already trusts them from the source category, the "Lock too"
//     shortcut). Cascades the finalize cleanup (auto-archive other
//     considering picks in this category).
//
// Verification at the action boundary:
//   - host must be signed in (redirect to /login if not).
//   - host must have access to this event (RLS on event_vendors gates writes).
//   - the source vendor row must exist on this event (defensive — the
//     recommendation surfaces only when the home page bundled this vendor,
//     but a stale form submission with a wrong vendor_id should fail
//     loudly rather than insert a phantom pick).
//   - vendor_services row must exist + be active + match the requested
//     category (defensive — the form submits service_id + category, so
//     we verify they match what the vendor actually offers).
// ============================================================================

export type AddRecommendedVendorResult =
  | { status: 'ok'; eventVendorId: string; locked: boolean }
  | { status: 'not_signed_in' }
  | { status: 'source_vendor_not_found' }
  | { status: 'service_not_found' }
  | { status: 'invalid_category' }
  | { status: 'already_picked' }
  | { status: 'error'; message: string };

export async function addRecommendedVendorToCategory(
  formData: FormData,
): Promise<AddRecommendedVendorResult> {
  const eventId = formData.get('event_id');
  const sourceMarketplaceVendorId = formData.get('marketplace_vendor_id');
  const serviceId = formData.get('service_id');
  const categoryRaw = formData.get('category');
  const desiredStatusRaw = formData.get('desired_status');

  if (typeof eventId !== 'string' || eventId.length === 0) {
    return { status: 'error', message: 'Missing event id' };
  }
  if (
    typeof sourceMarketplaceVendorId !== 'string' ||
    sourceMarketplaceVendorId.length === 0
  ) {
    return { status: 'error', message: 'Missing marketplace vendor id' };
  }
  if (typeof serviceId !== 'string' || serviceId.length === 0) {
    return { status: 'error', message: 'Missing service id' };
  }
  if (!isValidCategory(categoryRaw)) {
    return { status: 'invalid_category' };
  }
  const lockImmediately =
    desiredStatusRaw === 'contracted' || desiredStatusRaw === 'lock';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: 'not_signed_in' };
  }

  // Verify the source vendor row exists on this event AND is linked to
  // the marketplace vendor we're recommending. Belt-and-suspenders against
  // stale form submissions — the recommendation surface only renders when
  // the home page bundled this vendor as a pick.
  const { data: sourcePick, error: sourceErr } = await supabase
    .from('event_vendors')
    .select('vendor_id, vendor_name, status')
    .eq('event_id', eventId)
    .eq('marketplace_vendor_id', sourceMarketplaceVendorId)
    .is('archived_at', null)
    .limit(1)
    .maybeSingle();
  if (sourceErr) {
    return { status: 'error', message: sourceErr.message };
  }
  if (!sourcePick) {
    return { status: 'source_vendor_not_found' };
  }

  // Defensive: confirm the vendor_services row matches the marketplace
  // vendor + category we were told. The form data is host-supplied so a
  // race condition (vendor deactivates a service after the page renders
  // but before the host clicks Consider) should fail cleanly.
  // We use the admin client because vendor_services RLS restricts to
  // the vendor's own user_id — same reason page.tsx uses adminClient
  // for the cross-category fetch.
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const adminClient = createAdminClient();
  const { data: serviceRow, error: serviceErr } = await adminClient
    .from('vendor_services')
    .select('vendor_service_id, vendor_profile_id, category, is_active')
    .eq('vendor_service_id', serviceId)
    .maybeSingle();
  if (serviceErr) {
    return { status: 'error', message: serviceErr.message };
  }
  if (
    !serviceRow ||
    !serviceRow.is_active ||
    serviceRow.vendor_profile_id !== sourceMarketplaceVendorId ||
    serviceRow.category !== categoryRaw
  ) {
    return { status: 'service_not_found' };
  }

  // Already picked in this category? Idempotent no-op — surface the state
  // so the UI can collapse the action without a misleading "added" toast.
  const { data: existing, error: existingErr } = await supabase
    .from('event_vendors')
    .select('vendor_id')
    .eq('event_id', eventId)
    .eq('marketplace_vendor_id', sourceMarketplaceVendorId)
    .eq('category', categoryRaw)
    .is('archived_at', null)
    .limit(1)
    .maybeSingle();
  if (existingErr) {
    return { status: 'error', message: existingErr.message };
  }
  if (existing) {
    return { status: 'already_picked' };
  }

  // Look up the canonical vendor name from vendor_profiles for the new row.
  // Falls back to the source pick's vendor_name if the join misses (the
  // marketplace vendor row was deleted after the recommendation rendered).
  const { data: marketplaceProfile } = await adminClient
    .from('vendor_profiles')
    .select('business_name')
    .eq('vendor_profile_id', sourceMarketplaceVendorId)
    .maybeSingle();
  const insertedVendorName =
    marketplaceProfile?.business_name ?? sourcePick.vendor_name;

  // Insert the new pick. Same marketplace_vendor_id + service_id as the
  // source — that's what makes this a cross-category recommendation
  // rather than a brand-new vendor entry. Status defaults to 'considering'
  // (lockImmediately flag handled below as a follow-up update).
  const { data: inserted, error: insertErr } = await supabase
    .from('event_vendors')
    .insert({
      event_id: eventId,
      category: categoryRaw,
      vendor_name: insertedVendorName,
      status: 'considering',
      marketplace_vendor_id: sourceMarketplaceVendorId,
      service_id: serviceId,
    })
    .select('vendor_id')
    .single();
  if (insertErr || !inserted) {
    return {
      status: 'error',
      message: insertErr?.message ?? 'Insert failed',
    };
  }

  // Lock-too path: chain into the finalize action. This goes through the
  // same hard-single conflict + cleanup logic so the host gets one
  // coherent flow regardless of entry point.
  let locked = false;
  if (lockImmediately) {
    const lockForm = new FormData();
    lockForm.set('event_id', eventId);
    lockForm.set('vendor_id', inserted.vendor_id);
    // Don't override existing locked vendors silently — if the host hits
    // Lock-too on a category that already has a locked vendor, they need
    // to see the SwitchVendorConfirm modal explicitly. The result surface
    // for that is already handled in PlanCardCompare's existing finalize
    // flow; we just return ok+locked=false here so the UI can route the
    // host into that modal.
    lockForm.set('override_existing', '0');
    const finalizeResult = await finalizeVendor(lockForm);
    locked = finalizeResult.status === 'ok';
    // Note: we don't surface the conflict result up here — the
    // recommendation UI is a "Consider" path; locking is a secondary
    // affordance. If the lock fails, the row still exists as a
    // considering pick, which is the correct safe default.
  }

  revalidatePath(`/dashboard/${eventId}`);
  revalidatePath(`/dashboard/${eventId}/vendors`);
  return { status: 'ok', eventVendorId: inserted.vendor_id, locked };
}

// ============================================================================
// revertVendorToConsidering (2026-05-22) — Undo for the lock action.
//
// Companion to finalizeVendor. Used by the 5-second Undo affordance on the
// confirmation toast so a host who clicks Lock then immediately realizes
// they meant a different vendor can roll back without leaving the compare
// drawer. Sets the row's status back to 'considering' (the canonical
// pre-lock state for picks added via /vendors or addCustomVendor).
// ============================================================================

export type RevertVendorResult =
  | { status: 'ok'; vendorId: string }
  | { status: 'not_signed_in' }
  | { status: 'not_found' }
  | { status: 'not_locked' }
  | { status: 'error'; message: string };

export async function revertVendorToConsidering(
  formData: FormData,
): Promise<RevertVendorResult> {
  const eventId = formData.get('event_id');
  const vendorId = formData.get('vendor_id');
  if (typeof eventId !== 'string' || eventId.length === 0) {
    return { status: 'error', message: 'Missing event id' };
  }
  if (typeof vendorId !== 'string' || vendorId.length === 0) {
    return { status: 'error', message: 'Missing vendor id' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: 'not_signed_in' };
  }

  const { data: current, error: readErr } = await supabase
    .from('event_vendors')
    .select('status')
    .eq('vendor_id', vendorId)
    .eq('event_id', eventId)
    .maybeSingle();
  if (readErr) {
    return { status: 'error', message: readErr.message };
  }
  if (!current) {
    return { status: 'not_found' };
  }
  if (
    typeof current.status !== 'string' ||
    !(CONFIRMED_VENDOR_STATUSES as readonly string[]).includes(current.status)
  ) {
    // Defensive — Undo should only fire while the vendor is in a locked
    // state. If the host already moved past it (e.g. deposit_paid via the
    // vendor tracker), don't silently roll back to 'considering'.
    return { status: 'not_locked' };
  }

  const { error: revertErr } = await supabase
    .from('event_vendors')
    .update({ status: 'considering', updated_at: new Date().toISOString() })
    .eq('vendor_id', vendorId)
    .eq('event_id', eventId);
  if (revertErr) {
    return { status: 'error', message: revertErr.message };
  }

  revalidatePath(`/dashboard/${eventId}`);
  revalidatePath(`/dashboard/${eventId}/vendors`);

  return { status: 'ok', vendorId };
}

// ============================================================================
// Manual vendor primitive (2026-05-22) — Photo + Name + Contact Person + Phone.
//
// Owner directive: "When we add a vendor for the card, can we show a drop
// down of all manually added vendors, so we can choose them as well, and
// have an option to add a new one if not there? Manual input must have
// Photo, Vendor Name, Contact Person, Contact Number."
//
// Pattern: create a manual vendor ONCE per event with rich contact info,
// then attach the same manual_vendor_id across N planning categories.
// Each category attach creates a fresh event_vendors row (so per-category
// status / total cost / deposit tracking stays independent) but they all
// share the same manual_vendor_id — editing the manual vendor row (e.g.
// updating the contact number) propagates everywhere it's attached.
//
// Schema: supabase/migrations/20260604080000_event_manual_vendors_table.sql
//
// All four actions return Result-shaped responses so the client dropdown
// + modal can render pending / saved / error states without the
// "thrown error → page-level fault" UX that synchronous form actions
// produce.
// ============================================================================

export type ManualVendorResult =
  | { status: 'ok'; manualVendorId: string }
  | { status: 'not_signed_in' }
  | { status: 'error'; message: string };

export type AttachManualVendorResult =
  | { status: 'ok'; eventVendorId: string; manualVendorId: string }
  | { status: 'not_signed_in' }
  | { status: 'error'; message: string };

export type DeleteManualVendorResult =
  | { status: 'ok' }
  | { status: 'not_signed_in' }
  | { status: 'error'; message: string };

const PHOTO_PATH_PREFIX = 'manual-vendors';

function readStringField(
  formData: FormData,
  key: string,
  maxLen: number,
): { ok: true; value: string } | { ok: false; message: string } {
  const raw = formData.get(key);
  if (typeof raw !== 'string') {
    return { ok: false, message: `${key} is required` };
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, message: `${key} is required` };
  }
  if (trimmed.length > maxLen) {
    return { ok: false, message: `${key} must be ${maxLen} chars or fewer` };
  }
  return { ok: true, value: trimmed };
}

/**
 * Creates a manual vendor row for an event with the 4 owner-directive
 * fields (business_name, contact_person, contact_number, optional photo).
 *
 * Photo upload is OPTIONAL — host can skip it at create-time and add
 * later via updateManualVendor. When present, the photo runs through
 * uploadPublicAsset which (a) validates MIME + size, (b) falls back to
 * Supabase Storage if R2 env vars are unset (dev / preview env), (c)
 * returns an R2 object key we persist to photo_r2_key.
 *
 * Returns the manual_vendor_id so the caller (typically the dropdown's
 * "+ Add new" modal) can pipe it into attachManualVendorToCategory
 * without a roundtrip.
 */
export async function createManualVendor(
  formData: FormData,
): Promise<ManualVendorResult> {
  const eventIdRaw = formData.get('event_id');
  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) {
    return { status: 'error', message: 'Missing event id' };
  }

  const businessName = readStringField(formData, 'business_name', 128);
  if (!businessName.ok) return { status: 'error', message: businessName.message };
  const contactPerson = readStringField(formData, 'contact_person', 128);
  if (!contactPerson.ok) return { status: 'error', message: contactPerson.message };
  const contactNumber = readStringField(formData, 'contact_number', 32);
  if (!contactNumber.ok) return { status: 'error', message: contactNumber.message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: 'not_signed_in' };
  }

  // Optional photo upload. The FormData carries either a File object
  // (when the host picked one) or an empty File / no entry (when they
  // skipped). Skip the upload pipeline entirely when no file present so
  // the create flow stays fast.
  let photoR2Key: string | null = null;
  const photoEntry = formData.get('photo');
  if (photoEntry instanceof File && photoEntry.size > 0) {
    const uploadResult = await uploadPublicAsset({
      pathPrefix: `${PHOTO_PATH_PREFIX}/${eventIdRaw}`,
      file: photoEntry,
    });
    if (!uploadResult.ok) {
      return { status: 'error', message: uploadResult.error };
    }
    photoR2Key = uploadResult.key;
  }

  const { data: inserted, error } = await supabase
    .from('event_manual_vendors')
    .insert({
      event_id: eventIdRaw,
      business_name: businessName.value,
      contact_person: contactPerson.value,
      contact_number: contactNumber.value,
      photo_r2_key: photoR2Key,
      created_by_user_id: user.id,
    })
    .select('manual_vendor_id')
    .single();

  if (error || !inserted) {
    return { status: 'error', message: error?.message ?? 'Insert failed' };
  }

  revalidatePath(`/dashboard/${eventIdRaw}`);
  revalidatePath(`/dashboard/${eventIdRaw}/vendors`);
  return { status: 'ok', manualVendorId: inserted.manual_vendor_id };
}

/**
 * Updates an existing manual vendor's 4 fields. Edit-once-propagates:
 * because every linked event_vendors row reads the contact info via the
 * manual_vendor_id join, updating here flows to all attached categories
 * automatically.
 *
 * Photo handling is dual-mode:
 *   - When the form sends a new File (size > 0), we upload + replace the
 *     stored r2_key. We do NOT delete the prior R2 object — keep the
 *     history for cheap rollback. Storage cost on R2 is small enough
 *     that V1 doesn't need a vacuum job.
 *   - When the form carries an empty File OR no `photo` entry, we leave
 *     the existing photo_r2_key untouched (host edited name only).
 *   - When the form carries `remove_photo=1` (explicit clear), we null
 *     the column. The orphaned R2 object stays — same rationale.
 */
export async function updateManualVendor(
  formData: FormData,
): Promise<ManualVendorResult> {
  const manualVendorIdRaw = formData.get('manual_vendor_id');
  if (typeof manualVendorIdRaw !== 'string' || manualVendorIdRaw.length === 0) {
    return { status: 'error', message: 'Missing manual vendor id' };
  }

  const businessName = readStringField(formData, 'business_name', 128);
  if (!businessName.ok) return { status: 'error', message: businessName.message };
  const contactPerson = readStringField(formData, 'contact_person', 128);
  if (!contactPerson.ok) return { status: 'error', message: contactPerson.message };
  const contactNumber = readStringField(formData, 'contact_number', 32);
  if (!contactNumber.ok) return { status: 'error', message: contactNumber.message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: 'not_signed_in' };
  }

  // Read existing row to scope path-prefix on the photo upload (we
  // re-use the same {event_id} prefix so per-event photo grouping
  // stays stable across edits).
  const { data: existing, error: readErr } = await supabase
    .from('event_manual_vendors')
    .select('event_id, photo_r2_key')
    .eq('manual_vendor_id', manualVendorIdRaw)
    .maybeSingle();
  if (readErr) {
    return { status: 'error', message: readErr.message };
  }
  if (!existing) {
    return { status: 'error', message: 'Manual vendor not found' };
  }

  let nextPhotoR2Key: string | null | undefined = undefined;
  const removePhotoFlag = formData.get('remove_photo');
  if (removePhotoFlag === '1' || removePhotoFlag === 'true') {
    nextPhotoR2Key = null;
  } else {
    const photoEntry = formData.get('photo');
    if (photoEntry instanceof File && photoEntry.size > 0) {
      const uploadResult = await uploadPublicAsset({
        pathPrefix: `${PHOTO_PATH_PREFIX}/${existing.event_id}`,
        file: photoEntry,
      });
      if (!uploadResult.ok) {
        return { status: 'error', message: uploadResult.error };
      }
      nextPhotoR2Key = uploadResult.key;
    }
  }

  const update: Record<string, unknown> = {
    business_name: businessName.value,
    contact_person: contactPerson.value,
    contact_number: contactNumber.value,
    updated_at: new Date().toISOString(),
  };
  if (nextPhotoR2Key !== undefined) {
    update.photo_r2_key = nextPhotoR2Key;
  }

  const { error: updateErr } = await supabase
    .from('event_manual_vendors')
    .update(update)
    .eq('manual_vendor_id', manualVendorIdRaw);
  if (updateErr) {
    return { status: 'error', message: updateErr.message };
  }

  revalidatePath(`/dashboard/${existing.event_id}`);
  revalidatePath(`/dashboard/${existing.event_id}/vendors`);
  return { status: 'ok', manualVendorId: manualVendorIdRaw };
}

/**
 * Hard-deletes a manual vendor row. Per the FK ON DELETE SET NULL on
 * event_vendors.manual_vendor_id, every linked event_vendors row
 * survives with its manual_vendor_id zeroed out — the host's saved
 * categories don't disappear, they just lose the contact-info link.
 *
 * This intentionally doesn't cascade-delete the event_vendors rows.
 * Some hosts use the manual-vendor dropdown to attach the same person
 * to multiple categories, then realize they want different contacts
 * per category — deleting the manual vendor should leave the per-
 * category status / cost tracking intact for re-attachment.
 */
export async function deleteManualVendor(
  formData: FormData,
): Promise<DeleteManualVendorResult> {
  const manualVendorIdRaw = formData.get('manual_vendor_id');
  if (typeof manualVendorIdRaw !== 'string' || manualVendorIdRaw.length === 0) {
    return { status: 'error', message: 'Missing manual vendor id' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: 'not_signed_in' };
  }

  // Read the event_id for revalidation before we delete the row.
  const { data: row } = await supabase
    .from('event_manual_vendors')
    .select('event_id')
    .eq('manual_vendor_id', manualVendorIdRaw)
    .maybeSingle();
  const eventIdForRevalidate = row?.event_id as string | undefined;

  const { error } = await supabase
    .from('event_manual_vendors')
    .delete()
    .eq('manual_vendor_id', manualVendorIdRaw);
  if (error) {
    return { status: 'error', message: error.message };
  }

  if (eventIdForRevalidate) {
    revalidatePath(`/dashboard/${eventIdForRevalidate}`);
    revalidatePath(`/dashboard/${eventIdForRevalidate}/vendors`);
  }
  return { status: 'ok' };
}

/**
 * Attaches a manual vendor to a planning category by creating a fresh
 * event_vendors row linked via manual_vendor_id. The new row gets the
 * vendor's business_name as vendor_name (for backwards-compat with
 * surfaces that read vendor_name directly), the category passed in,
 * and status='considering' (initial state — host promotes via the
 * Compare drawer's Lock action).
 *
 * Reuse semantics — calling this N times against the same manual
 * vendor with N different categories creates N event_vendors rows that
 * all read the same contact info. The host sees "Tito Marcel" in both
 * the Coordinator card and the Host/MC card, status tracked
 * independently per card.
 *
 * Does NOT dedupe — if the host accidentally attaches the same manual
 * vendor to the same category twice, we'll create two event_vendors
 * rows. The dropdown UX should prevent that (greyed-out option once
 * already-attached for THIS category), but the server stays permissive
 * so concurrent inserts from multi-host events don't fail.
 */
export async function attachManualVendorToCategory(
  formData: FormData,
): Promise<AttachManualVendorResult> {
  const eventIdRaw = formData.get('event_id');
  const manualVendorIdRaw = formData.get('manual_vendor_id');
  const categoryRaw = formData.get('category');

  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) {
    return { status: 'error', message: 'Missing event id' };
  }
  if (typeof manualVendorIdRaw !== 'string' || manualVendorIdRaw.length === 0) {
    return { status: 'error', message: 'Missing manual vendor id' };
  }
  if (!isValidCategory(categoryRaw)) {
    return { status: 'error', message: 'Unknown category' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: 'not_signed_in' };
  }

  // Read the manual vendor's business_name so the event_vendors row
  // carries a vendor_name (some surfaces still read vendor_name
  // directly; updating it here lets edits to the manual vendor
  // propagate without rewriting every event_vendors row).
  const { data: manualVendor, error: readErr } = await supabase
    .from('event_manual_vendors')
    .select('business_name, event_id')
    .eq('manual_vendor_id', manualVendorIdRaw)
    .maybeSingle();
  if (readErr) {
    return { status: 'error', message: readErr.message };
  }
  if (!manualVendor) {
    return { status: 'error', message: 'Manual vendor not found' };
  }
  // Defensive: the manual vendor must belong to the same event the
  // host is attaching from. RLS would also catch a cross-event attach
  // but the explicit check produces a clearer error path.
  if (manualVendor.event_id !== eventIdRaw) {
    return { status: 'error', message: 'Manual vendor belongs to a different event' };
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('event_vendors')
    .insert({
      event_id: eventIdRaw,
      category: categoryRaw,
      vendor_name: manualVendor.business_name,
      manual_vendor_id: manualVendorIdRaw,
      status: 'considering',
    })
    .select('vendor_id')
    .single();
  if (insertErr || !inserted) {
    return { status: 'error', message: insertErr?.message ?? 'Insert failed' };
  }

  revalidatePath(`/dashboard/${eventIdRaw}`);
  revalidatePath(`/dashboard/${eventIdRaw}/vendors`);
  return {
    status: 'ok',
    eventVendorId: inserted.vendor_id,
    manualVendorId: manualVendorIdRaw,
  };
}
