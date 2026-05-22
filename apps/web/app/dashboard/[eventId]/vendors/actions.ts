'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { emitNotification } from '@/lib/notification-emit';
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
// HARD_SINGLE_PICK_GROUPS set in lib/wedding-plan-groups.ts, ceremony_venue +
// reception_venue + officiant groups allow only ONE locked vendor at a time.
// If the host tries to lock a second vendor in one of those groups, the
// action returns 'hard_single_conflict' with the existing locked vendor's
// info; the UI then offers a Switch flow that (a) reverts the existing
// locked vendor to 'considering' and (b) locks the new vendor in one pass.
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

  // Refresh both the event home (FinalizedChipStrip + PlanningGroups read
  // from the same event_vendors fetch) and the vendor tracker (separate
  // surface that lists every vendor + status).
  revalidatePath(`/dashboard/${eventId}`);
  revalidatePath(`/dashboard/${eventId}/vendors`);

  return { status: 'ok', vendorId, lockedStatus: LOCKED_STATUS };
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
