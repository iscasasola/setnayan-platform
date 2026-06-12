'use server';

// Every `revalidatePath()` below uses `'layout'` mode (not default 'page')
// so the dashboard layout invalidates too. Vendor lock/unlock/switch + custom
// vendor add + invite + payout flows touch event_vendors rows that the
// dashboard layout aggregates into the chrome event-switcher labels and
// monogram refresh logic; without 'layout' the chrome stays stale until
// manual reload. Same canonical fix as wizard-actions.ts (PR #514) — see
// CLAUDE.md 2026-05-24 "Fix: chrome monogram (+ layout-cached fields) stay
// stale after wizard save".
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import { uploadPublicAsset } from '@/lib/storage';
import { insertFaultLog } from '@/lib/telemetry/fault-log';
import {
  VENDOR_CATEGORIES,
  VENDOR_STATUSES,
  type VendorCategory,
  type VendorStatus,
} from '@/lib/vendors';
import { primaryTileForVendorCategory } from '@/lib/vendor-category-taxonomy';
import {
  HARD_SINGLE_PICK_GROUPS,
  canonicalServiceToPlanGroupId,
  planGroupForCategory,
} from '@/lib/wedding-plan-groups';
import { CONFIRMED_VENDOR_STATUSES, recomputeReceptionAnchor } from '@/lib/events';
import { buildClaimUrl, ensureAutoShareInvite } from '@/lib/vendor-invites';
import {
  fetchSlotsForCoupleBooking,
  type VendorServiceTimeSlot,
} from '@/lib/vendor-time-slots';
import {
  acquireSchedulePools,
  releaseSchedulePools,
  resolvePoolIdsForService,
} from '@/lib/schedule-pools';

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

  // Stamp source='host_manual' so the UI can distinguish picks the host
  // added themselves from picks that were auto-cascaded by finalizeVendor.
  // Legacy rows stay NULL via the column default — UI treats both
  // 'host_manual' and NULL the same (no badge).
  const { error } = await supabase.from('event_vendors').insert({
    event_id: eventId,
    category,
    // Dual-write the taxonomy-keyed column alongside the legacy enum (PR-2 of
    // the enum→key migration, col added in 20260815000000). Nothing reads it
    // yet — safe expand-phase; primary tile, or null for exempt categories.
    category_key: primaryTileForVendorCategory(category),
    vendor_name: trimmedName,
    contact_email: nullIfBlank(formData.get('contact_email')),
    contact_phone: nullIfBlank(formData.get('contact_phone')),
    total_cost_php: parseMoney(formData.get('total_cost_php')),
    deposit_paid_php: parseMoney(formData.get('deposit_paid_php')),
    notes: nullIfBlank(formData.get('notes')),
    source: 'host_manual',
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/vendors`, 'layout');
}

// ============================================================================
// 3-line cost edit (CLAUDE.md 2026-05-31): Service + Transport + Food allowance.
// The couple edits all three together in the vendor workspace Costing section;
// the accordion then rolls them into the card/topbar total via
// buildPlanBudgetModel. Blank field → null (₱0). RLS scopes the update to the
// couple's own event; same auth + parseMoney pattern as createVendor.
// ============================================================================

export async function updateVendorCosts(formData: FormData) {
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
    .update({
      total_cost_php: parseMoney(formData.get('total_cost_php')),
      transport_php: parseMoney(formData.get('transport_php')),
      food_allowance_php: parseMoney(formData.get('food_allowance_php')),
    })
    .eq('vendor_id', vendorId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/vendors`, 'layout');
  revalidatePath(`/dashboard/${eventId}/vendors/${vendorId}/workspace`, 'layout');
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
      source: 'host_manual',
    })
    .select('vendor_id')
    .single();

  if (error || !inserted) {
    return { status: 'error', message: error?.message ?? 'Insert failed' };
  }

  revalidatePath(`/dashboard/${eventId}`, 'layout');
  revalidatePath(`/dashboard/${eventId}/vendors`, 'layout');
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
  // transition that triggers the review-request notification below, and
  // the white→BOOKED capacity transition for the schedule-pool gate.
  const { data: prev } = await supabase
    .from('event_vendors')
    .select('status, vendor_name, marketplace_vendor_id, service_id')
    .eq('vendor_id', vendorId)
    .eq('event_id', eventId)
    .maybeSingle();

  // ── Schedule-pool gate (owner lock 2026-06-12) ─────────────────────────
  // White (considering..contracted) is unlimited and consumes nothing; only
  // BOOKED (deposit_paid/delivered/complete) consumes pool capacity. The
  // acquire fires BEFORE the status write so a full/closed date blocks the
  // flip atomically (the RPC holds the pool row locks); the reverse
  // transition releases via released_at status-flip — never a DELETE.
  // Off-platform vendors (no marketplace_vendor_id) and rows without a
  // booked service degrade open — no shared scheduling primitive.
  const prevRow = prev as {
    status?: VendorStatus;
    vendor_name?: string;
    marketplace_vendor_id?: string | null;
    service_id?: string | null;
  } | null;
  const wasConsuming = prevRow?.status
    ? DOWNPAID_STATUSES.has(prevRow.status)
    : false;
  const willConsume = DOWNPAID_STATUSES.has(status);
  if (
    !wasConsuming
    && willConsume
    && prevRow?.marketplace_vendor_id
    && prevRow.service_id
  ) {
    const poolIds = await resolvePoolIdsForService(
      supabase,
      prevRow.marketplace_vendor_id,
      prevRow.service_id,
    );
    if (poolIds.length > 0) {
      const acq = await acquireSchedulePools(supabase, eventId, vendorId, poolIds);
      if (acq.status === 'full') {
        throw new Error(
          `That date is fully booked for ${acq.poolLabel || 'this category'} on the vendor's schedule — message the vendor or adjust the date before marking the deposit paid.`,
        );
      }
      if (acq.status === 'blocked') {
        throw new Error(
          "The vendor has closed this date on their calendar — message them before marking the deposit paid.",
        );
      }
      if (acq.status === 'error') {
        throw new Error(acq.message);
      }
      // 'ok' | 'no_date' | 'no_pools' | 'not_authorized' fall through:
      // no_date/no_pools = degrade open (eventual-consistency doctrine);
      // not_authorized can't happen past the RLS-gated reads above.
    }
  }

  const { error } = await supabase
    .from('event_vendors')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('vendor_id', vendorId)
    .eq('event_id', eventId);
  if (error) {
    // The acquire above may have consumed pools for a status flip that
    // never landed — free them so the date isn't phantom-held.
    if (!wasConsuming && willConsume) {
      await releaseSchedulePools(supabase, vendorId, 'status_downgrade');
    }
    throw new Error(error.message);
  }

  // BOOKED → white downgrade frees the date (status-flip, never DELETE).
  // Best-effort: the visible status change already succeeded.
  if (wasConsuming && !willConsume) {
    await releaseSchedulePools(supabase, vendorId, 'status_downgrade');
  }

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

  revalidatePath(`/dashboard/${eventId}/vendors`, 'layout');
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

  // Read the category before deleting so we know whether removing this pick
  // frees the reception "ground 0" anchor (CLAUDE.md 2026-06-02 directive 3),
  // and the status for the booked-row guard below.
  const { data: removing } = await supabase
    .from('event_vendors')
    .select('category, status')
    .eq('vendor_id', vendorId)
    .eq('event_id', eventId)
    .maybeSingle();

  // Booked rows (deposit_paid+) can't be hard-deleted from the tracker —
  // money has moved and the row holds live schedule-pool reservations.
  // Route through the cancel/dispute flow instead (2026-06-04 conflict
  // audit finding #6; owner status-flip lock 2026-06-12).
  const removingStatus = (removing as { status?: VendorStatus } | null)?.status;
  if (removingStatus && DOWNPAID_STATUSES.has(removingStatus)) {
    throw new Error(
      'This vendor is already booked (downpayment recorded). Use the cancel flow on their workspace page instead of deleting.',
    );
  }

  // Defensive release of any stray live pool reservations before the row
  // goes away (a hard delete would CASCADE them silently — release first
  // so the date frees with an auditable reason).
  await releaseSchedulePools(supabase, vendorId, 'host_cancelled');

  const { error } = await supabase
    .from('event_vendors')
    .delete()
    .eq('vendor_id', vendorId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  // Re-anchor "ground 0" if a RECEPTION venue pick was just removed — the
  // distance chips for every other vendor fall back to the next reception
  // (or leave the existing anchor untouched if none has resolvable coords,
  // never blanking distance). recomputeReceptionAnchor reads coords across
  // RLS, so it takes the service client. Best-effort — never throws.
  if (removing?.category === 'venue') {
    await recomputeReceptionAnchor(createAdminClient(), eventId);
  }

  // Revalidate both surfaces so an incompatible-pick Remove on the event
  // home (PR B 2026-05-22) clears the chip without a hard refresh, and
  // the vendor tracker stays in sync.
  revalidatePath(`/dashboard/${eventId}`, 'layout');
  revalidatePath(`/dashboard/${eventId}/vendors`, 'layout');
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
  // PR A · soft-hold limit reached (Rule 3 of the lock/delete/overlap
  // architecture — CLAUDE.md 2026-05-24 row "Canonical wizard sequence
  // reconciled 38 → 45 + Lock/delete/overlap architecture"). Fires when the
  // target vendor's max_soft_holds_per_date is already filled by N other
  // hosts' contracted-status picks on the same event_date. UI surfaces a
  // polite "{vendorName} already has {existingHoldCount} confirmed soft
  // holds for your wedding date · they only accept {currentLimit}" copy
  // plus a Browse-similar-vendors CTA. Off-platform / custom vendors
  // (marketplace_vendor_id IS NULL) skip the check — no shared scheduling
  // primitive to gate on. Events without wedding_date also skip — no date
  // means no overlap.
  | {
      status: 'soft_hold_limit_reached';
      vendorId: string;
      vendorName: string;
      currentLimit: number;
      existingHoldCount: number;
    }
  // Tier #3 (owner 2026-06-09 · couple picks the slot). The booked service has
  // active time slots but the couple didn't choose one — the UI must surface a
  // picker and resubmit with `service_time_slot_id`. Distinct from the generic
  // 'error' so the client can render the inline picker rather than a red toast.
  | {
      status: 'slot_required';
      vendorId: string;
      vendorName: string;
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
  // Tier #3 — the couple's chosen time slot (owner 2026-06-09). Only meaningful
  // when the booked service has active slots; ignored otherwise.
  const chosenSlotIdRaw = formData.get('service_time_slot_id');
  const chosenSlotId =
    typeof chosenSlotIdRaw === 'string' && chosenSlotIdRaw.length > 0
      ? chosenSlotIdRaw
      : null;

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
  // marketplace_vendor_id added 2026-05-22 — drives the auto-add cascade
  // below. Off-platform / custom vendors (where the host typed the
  // vendor name themselves and has no vendor_profiles link) won't have
  // OTHER services to cascade in from, so the cascade is gated on the
  // marketplace link being non-null.
  const { data: targetVendor, error: targetErr } = await supabase
    .from('event_vendors')
    .select('vendor_id, category, status, vendor_name, marketplace_vendor_id, manual_vendor_id, service_id')
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

  // PR A · Soft-hold limit gate (Rule 3 of the lock/delete/overlap
  // architecture — CLAUDE.md 2026-05-24 row "Canonical wizard sequence
  // reconciled 38 → 45 + Lock/delete/overlap architecture").
  //
  // Vendors can configure max_soft_holds_per_date on their profile (default
  // 3, range 1-20 — see migration 20260627010000). Once that many hosts
  // have contracted-status picks on the same wedding date, further lock
  // attempts return 'soft_hold_limit_reached' with the vendor's current
  // limit + existing hold count + a suggestion to browse similar vendors.
  //
  // The check skips when:
  //   • Target is an off-platform / custom vendor (marketplace_vendor_id
  //     IS NULL) — no shared scheduling primitive, hosts independently
  //     track these themselves.
  //   • Target event has no wedding_date set yet — no date means no
  //     overlap; the wizard will surface the check the moment Card 01
  //     locks a date.
  //   • Target vendor row's marketplace_vendor_id resolution somehow
  //     fails — degrade open (lock proceeds) rather than block on an
  //     internal data issue. Defensive: better than crashing the lock
  //     CTA when a vendor_profiles row is in an unexpected state.
  //
  // Filipino-market reality: vendors regularly juggle multiple soft holds
  // for the same date until money commits — the limit isn't a hard ban,
  // it's a vendor-controlled queue depth. When a downpayment confirms
  // (Rule 4, lands in PR D), the auto-release trigger frees the other
  // soft holds and Setnayan emails each affected host with a similar-
  // vendors strip per [0028 template auto_released_due_to_other_booking].
  // ── Capacity gate · per-service ────────────────────────────────────────
  // Two mutually-exclusive models per service, by precedence:
  //   #3 (Enterprise time-bound slots): if the booked service has >=1 ACTIVE
  //      slot AND the event date is day-precise, the couple PICKS a slot
  //      (owner 2026-06-09) and acquire_service_time_slot consumes capacity
  //      ATOMICALLY (it locks the chosen slot row, counts the full confirmed
  //      set on events.event_date, and writes status+slot inside the lock).
  //      This SKIPS the #2 daily_capacity gate AND the generic lock write
  //      below (slotPathLocked short-circuits it).
  //   #2 (daily_capacity): services with ZERO active slots keep the existing
  //      per-day count gate — repointed from the (ungenerated) wedding_date
  //      mirror to the canonical events.event_date column (verifier C5/C6).
  // Both degrade OPEN on missing data so a lock is never wrongly blocked.
  let slotPathLocked = false;
  if (targetVendor.marketplace_vendor_id && targetVendor.service_id) {
    const { count: slotCount } = await supabase
      .from('vendor_service_time_slots')
      .select('slot_id', { count: 'exact', head: true })
      .eq('vendor_service_id', targetVendor.service_id)
      .eq('is_active', true);

    let useSlotPath = false;
    if ((slotCount ?? 0) > 0) {
      // Only enforce/assign a slot on a day-precise event (verifier C4).
      // year/month-precision events have a placeholder DATE — degrade to a
      // date-only booking (fall through to #2, which itself no-ops without a
      // daily_capacity, so the generic lock write handles it).
      const { data: precRow } = await supabase
        .from('events')
        .select('event_date_precision')
        .eq('event_id', eventId)
        .maybeSingle();
      const precision =
        (precRow as { event_date_precision?: string | null } | null)
          ?.event_date_precision ?? null;
      useSlotPath = precision === 'day';
    }

    if (useSlotPath) {
      // ── #3 SLOT PATH — couple must have chosen a slot. ──
      if (!chosenSlotId) {
        return {
          status: 'slot_required',
          vendorId,
          vendorName: targetVendor.vendor_name as string,
        };
      }
      const { data: acq, error: acqErr } = await supabase.rpc(
        'acquire_service_time_slot',
        {
          p_event_id: eventId,
          p_vendor_id: vendorId,
          p_service_id: targetVendor.service_id,
          p_slot_id: chosenSlotId,
        },
      );
      if (acqErr) {
        return { status: 'error', message: acqErr.message };
      }
      const acqStatus =
        (acq as { status?: string } | null)?.status ?? 'error';
      switch (acqStatus) {
        case 'ok':
          // The RPC already flipped status→'contracted' + stamped the slot
          // inside the lock; skip the generic lock write below.
          slotPathLocked = true;
          break;
        case 'full':
          // All capacity on the chosen window is taken — reuse the existing
          // at-capacity modal contract (currentLimit/existingHoldCount aren't
          // surfaced per-slot, so 0/0; the client renders generic copy).
          return {
            status: 'soft_hold_limit_reached',
            vendorId,
            vendorName: targetVendor.vendor_name as string,
            currentLimit: 0,
            existingHoldCount: 0,
          };
        case 'slot_required':
        case 'slot_not_found':
          // Chosen slot is gone/inactive — ask the couple to pick again.
          return {
            status: 'slot_required',
            vendorId,
            vendorName: targetVendor.vendor_name as string,
          };
        case 'not_authorized':
          return {
            status: 'error',
            message: "We couldn't confirm this is your event. Refresh and try again.",
          };
        case 'no_date':
          // Date became non-day-precise between the read and the RPC — degrade
          // open to a date-only booking via the generic lock write below.
          break;
        default:
          return { status: 'error', message: 'Could not reserve the time slot.' };
      }
    } else {
      // ── #2 DAILY-CAPACITY PATH (service has no active slots). ──
      const { data: svcRow } = await supabase
        .from('vendor_services')
        .select('daily_capacity')
        .eq('vendor_service_id', targetVendor.service_id)
        .maybeSingle();
      const capacity =
        (svcRow as { daily_capacity?: number | null } | null)?.daily_capacity ?? null;
      if (typeof capacity === 'number' && capacity > 0) {
        // event_date is the canonical DATE column; wedding_date is a generated
        // mirror with NO migration DDL, so it can silently no-op on a fresh DB
        // (verifier C5/C6). Repointed to event_date in this same PR.
        const { data: capEventRow } = await supabase
          .from('events')
          .select('event_date')
          .eq('event_id', eventId)
          .maybeSingle();
        const capDate =
          (capEventRow as { event_date?: string | null } | null)?.event_date ?? null;
        if (capDate) {
          const { data: capSameDate } = await supabase
            .from('events')
            .select('event_id')
            .eq('event_date', capDate);
          const capEventIds = (capSameDate ?? []).map((r) => r.event_id as string);
          if (capEventIds.length > 0) {
            const { count: capCount } = await supabase
              .from('event_vendors')
              .select('vendor_id', { count: 'exact', head: true })
              .eq('service_id', targetVendor.service_id)
              .in('status', CONFIRMED_VENDOR_STATUSES as unknown as string[])
              .is('archived_at', null)
              .in('event_id', capEventIds)
              .neq('vendor_id', vendorId);
            if ((capCount ?? 0) >= capacity) {
              return {
                status: 'soft_hold_limit_reached',
                vendorId,
                vendorName: targetVendor.vendor_name as string,
                currentLimit: capacity,
                existingHoldCount: capCount ?? 0,
              };
            }
          }
        }
      }
    }
  }

  // Skip the vendor-level soft-hold gate (and the generic lock write below)
  // on the #3 slot path: acquire_service_time_slot already committed the lock
  // atomically, so re-checking gates after a committed write is incorrect.
  if (!slotPathLocked && targetVendor.marketplace_vendor_id) {
    // Read wedding_date + the vendor's configured limit in parallel-friendly
    // sequential calls. (Single round trip via .from('events').select is
    // already cheap; the limit lookup hits a different table.)
    const [{ data: eventRow, error: eventErr }, { data: vendorProfileRow, error: vpErr }] =
      await Promise.all([
        supabase
          .from('events')
          .select('wedding_date')
          .eq('event_id', eventId)
          .maybeSingle(),
        supabase
          .from('vendor_profiles')
          .select('max_soft_holds_per_date')
          .eq('vendor_profile_id', targetVendor.marketplace_vendor_id)
          .maybeSingle(),
      ]);
    if (eventErr) {
      return { status: 'error', message: eventErr.message };
    }
    if (vpErr) {
      return { status: 'error', message: vpErr.message };
    }

    const weddingDate = eventRow?.wedding_date as string | null | undefined;
    const limit = (vendorProfileRow?.max_soft_holds_per_date as number | undefined) ?? null;

    // Skip the check when the event has no wedding date, OR when the
    // vendor's profile/limit can't be resolved. Degrades open.
    if (weddingDate && typeof limit === 'number') {
      // Count other event_vendors rows where:
      //   • same marketplace_vendor_id (same Setnayan vendor account)
      //   • event_id maps to an event with the same wedding_date
      //   • status = 'contracted' (soft hold — not 'considering', not 'paid')
      //   • archived_at IS NULL (not soft-archived)
      //   • vendor_id != $current_vendor_id (don't count the target row
      //     itself even though it'll never be 'contracted' here — defensive)
      //
      // Two-step query: first fetch the event_ids on the same wedding_date,
      // then count event_vendors rows scoped to those event_ids. PostgREST
      // doesn't support a single .in('event_id', subquery) so the two-step
      // is the canonical shape.
      const { data: sameDateEvents, error: sdeErr } = await supabase
        .from('events')
        .select('event_id')
        .eq('wedding_date', weddingDate);
      if (sdeErr) {
        return { status: 'error', message: sdeErr.message };
      }
      const sameDateEventIds = (sameDateEvents ?? [])
        .map((r) => r.event_id as string)
        .filter((id) => id !== eventId);

      // If no OTHER events share this date, there's no way the limit can
      // be hit (the host's own pick is the only one). Skip the count.
      if (sameDateEventIds.length > 0) {
        const { count, error: countErr } = await supabase
          .from('event_vendors')
          .select('vendor_id', { count: 'exact', head: true })
          .eq('marketplace_vendor_id', targetVendor.marketplace_vendor_id)
          .eq('status', 'contracted')
          .is('archived_at', null)
          .in('event_id', sameDateEventIds)
          .neq('vendor_id', vendorId);
        if (countErr) {
          return { status: 'error', message: countErr.message };
        }
        const existingHoldCount = count ?? 0;
        if (existingHoldCount >= limit) {
          return {
            status: 'soft_hold_limit_reached',
            vendorId,
            vendorName: targetVendor.vendor_name as string,
            currentLimit: limit,
            existingHoldCount,
          };
        }
      }
    }
  }

  // Generic lock write — for the date-only / #2 path. The #3 slot path already
  // flipped status→'contracted' + stamped service_time_slot_id inside the
  // acquire RPC's lock, so it skips this write (slotPathLocked).
  if (!slotPathLocked) {
    const { error: lockErr } = await supabase
      .from('event_vendors')
      .update({ status: LOCKED_STATUS, updated_at: new Date().toISOString() })
      .eq('vendor_id', vendorId)
      .eq('event_id', eventId);
    if (lockErr) {
      await insertFaultLog({
        event_type: 'SUPABASE_SAVE_ERROR',
        element_name: 'Lock (finalize) vendor booking',
        file_path: 'app/dashboard/[eventId]/vendors/actions.ts',
        error_message: lockErr.message,
        payload_snapshot: { eventId, vendorId, targetCategory, overrideExisting },
      });
      return { status: 'error', message: lockErr.message };
    }
  }

  // ----------------------------------------------------------------------
  // Auto-create claim-link invite for manual vendors (CLAUDE.md 2026-05-22
  // owner directive — verbatim: "when we lock a vendor for an event without
  // an account here, there will be a link the host can send to the vendor
  // to login and lock this schedule for them. they will have access to the
  // free account for vendors.")
  //
  // Triggers ONLY when:
  //   - targetVendor.manual_vendor_id IS NOT NULL  → host attached a manual
  //     vendor (one of the event_manual_vendors entries — has photo +
  //     business_name + contact_person + contact_number per
  //     20260604080000), AND
  //   - targetVendor.marketplace_vendor_id IS NULL → vendor doesn't yet have
  //     a Setnayan vendor_profiles row (no Setnayan account).
  //
  // Both conditions are independent of the vendor_name being "manual-y" —
  // a marketplace-linked row with manual_vendor_id incidentally set (rare
  // edge case from a future UI that wraps a marketplace pick as a manual
  // contact) shouldn't get an invite, because the vendor already has an
  // account.
  //
  // Idempotent — ensureAutoShareInvite re-uses any existing pending row
  // (partial unique index vendor_invites_auto_share_live_unique enforces
  // one pending row per event_vendors id), so repeat finalize/switch
  // cycles don't spam invites.
  //
  // Failure mode: silently swallows errors (returns null from the helper).
  // The lock has already succeeded — failing the entire finalize because
  // of an invite-creation hiccup would be hostile UX. The workspace page
  // re-attempts ensure on render (via the same helper), so a transient
  // failure here self-heals next time the host opens the workspace.
  // ----------------------------------------------------------------------
  if (targetVendor.manual_vendor_id && !targetVendor.marketplace_vendor_id) {
    try {
      await ensureAutoShareInvite(supabase, {
        eventVendorId: vendorId,
        invitedByUserId: user.id,
        businessName: targetVendor.vendor_name as string,
        serviceCategory: targetVendor.category as string,
      });
    } catch {
      // Silent — see comment block above.
    }
  }

  // ----------------------------------------------------------------------
  // booking_confirmed signal → marketplace vendor (cross-actor audit
  // 2026-06-07). Before this, locking a MARKETPLACE vendor was SILENT: the
  // couple's finalize wrote event_vendors (couple-only RLS) and the vendor —
  // who has no read path to that table — never learned they'd been booked.
  // Their dashboard "Confirmed bookings" tile counts accepted inquiries, NOT
  // couple finalizations, so a real booking could go entirely unnoticed.
  //
  // Manual / off-platform vendors are covered by the claim-link invite above
  // (no Setnayan account to notify yet); this `else if` covers the
  // marketplace case. Best-effort + fail-soft — the lock already succeeded,
  // so a notification hiccup must never roll it back. Deep-links to the
  // existing chat thread when one exists, else the vendor bookings list.
  // ----------------------------------------------------------------------
  else if (targetVendor.marketplace_vendor_id) {
    try {
      const adminClient = createAdminClient();
      const [{ data: profileRow }, { data: eventRow }, { data: threadRow }] =
        await Promise.all([
          adminClient
            .from('vendor_profiles')
            .select('user_id')
            .eq('vendor_profile_id', targetVendor.marketplace_vendor_id)
            .maybeSingle(),
          adminClient
            .from('events')
            .select('display_name')
            .eq('event_id', eventId)
            .maybeSingle(),
          adminClient
            .from('chat_threads')
            .select('thread_id')
            .eq('event_id', eventId)
            .eq('vendor_profile_id', targetVendor.marketplace_vendor_id)
            .maybeSingle(),
        ]);
      const vendorUserId =
        (profileRow as { user_id: string | null } | null)?.user_id ?? null;
      if (vendorUserId) {
        const eventDisplay =
          (eventRow as { display_name: string } | null)?.display_name ??
          'A couple';
        const threadId =
          (threadRow as { thread_id: string } | null)?.thread_id ?? null;
        await emitNotification({
          userId: vendorUserId,
          type: 'booking_confirmed',
          title: 'You have a new confirmed booking',
          body: `${eventDisplay} confirmed their booking with you on Setnayan. Open the conversation to lock in the details and next steps.`,
          relatedUrl: threadId
            ? `/vendor-dashboard/messages/${threadId}`
            : '/vendor-dashboard/bookings',
        });
      }
    } catch (e) {
      // Fail-soft — the lock already succeeded; never roll it back.
      console.error(
        `[finalizeVendor] booking_confirmed notify failed for vendor_id=${vendorId} event_id=${eventId}:`,
        e,
      );
    }
  }

  // ----------------------------------------------------------------------
  // Finalize auto-cleanup (CLAUDE.md 2026-05-22 owner directive — Task #26).
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
  // ----------------------------------------------------------------------
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

  // ----------------------------------------------------------------------
  // Auto-add cascade on finalize — CLAUDE.md 2026-05-22 owner directive.
  //
  // Owner verbatim: "when finalized, and the other services of that vendor
  // is not yet availed, it will be automatically added to the list of the
  // event. example. a vendor locked in catering but also has a photobooth.
  // their photobooth would automatically be on the list for photobooths.
  // so the host can consider them as well."
  //
  // Complements the intra-category archive sweep ABOVE (Task #26): that
  // pass collapses other vendors competing for the SAME category. This
  // pass expands the host's plan into OTHER categories the locked vendor
  // can also handle. The two are complementary, not conflicting.
  //
  // Algorithm:
  //   1. Skip if the target vendor isn't marketplace-linked (off-platform
  //      / custom vendors don't have vendor_services rows).
  //   2. Look up vendor_services rows for the locked vendor.
  //   3. For each row, resolve canonical_service → target PlanGroupId.
  //   4. Skip if target == source category (no self-cascade).
  //   5. Skip if host already has a finalized vendor in the target group
  //      (don't replace someone's chosen pick).
  //   6. Skip if host already has any event_vendors row (any status) for
  //      THIS vendor in the target category (no duplicate).
  //   7. INSERT new event_vendors row with status='considering',
  //      source='auto_cascade_from_finalize', source_category=X.
  //
  // Failure mode: the cascade swallows errors silently (try/catch around
  // the whole block). The lock step has already succeeded — failing the
  // entire finalize because of a cascade hiccup would be hostile UX. The
  // worst case is the host sees their lock but not the auto-cascaded
  // considering picks; they can manually add them later if needed.
  //
  // Reversal: revertVendorToConsidering does NOT auto-remove cascaded
  // rows. Host can manually remove via the existing pick-row Remove
  // button (which fires deleteVendor). V1 keeps this simple — explicit
  // host control over considering picks.
  // ----------------------------------------------------------------------
  if (targetVendor.marketplace_vendor_id) {
    try {
      const { data: vendorServices } = await supabase
        .from('vendor_services')
        .select('category')
        .eq('vendor_profile_id', targetVendor.marketplace_vendor_id)
        .eq('is_active', true);

      if (vendorServices && vendorServices.length > 0) {
        // Compute distinct target categories from the vendor's services.
        // We bucket by PlanGroupId, then for each unique target group we
        // pick the FIRST canonical category in vendor_services as the
        // representative — that's the category the new event_vendors
        // row gets stamped with. Picking one specific category (rather
        // than the whole group) keeps the row queryable + filterable by
        // VENDOR_CATEGORIES the same way every other row is.
        const sourceCategory = targetVendor.category as VendorCategory;
        const sourceGroupId = planGroupForCategory(sourceCategory);
        // Map of PlanGroupId → first VendorCategory we saw for it.
        const targetGroupToCategory = new Map<string, VendorCategory>();
        for (const vs of vendorServices) {
          const canonicalService = (vs as { category: string }).category;
          if (!canonicalService) continue;
          const targetGroup = canonicalServiceToPlanGroupId(canonicalService);
          if (!targetGroup) continue;
          // Skip self-cascade: don't auto-add into the same PlanGroup the
          // host just locked in. (Hard-single groups can only have one
          // vendor anyway; soft-single + multi groups would clutter.)
          if (sourceGroupId && targetGroup === sourceGroupId) continue;
          if (!targetGroupToCategory.has(targetGroup)) {
            targetGroupToCategory.set(
              targetGroup,
              canonicalService as VendorCategory,
            );
          }
        }

        if (targetGroupToCategory.size > 0) {
          // Pre-fetch the host's existing event_vendors rows in one trip
          // so we can check (a) finalized vendors per group and (b) any
          // existing row for THIS vendor per category without N+1
          // queries. Filter out archived rows — they don't count as
          // "already taken" since the host could re-add the vendor.
          const { data: existing } = await supabase
            .from('event_vendors')
            .select('vendor_id, category, status, marketplace_vendor_id')
            .eq('event_id', eventId)
            .is('archived_at', null);

          // Build two lookup sets:
          //   • finalizedCategories: VendorCategory[] where the host has
          //     a CONFIRMED status already (cascade skips these groups)
          //   • vendorTakenCategories: VendorCategory[] where the host
          //     already has any row for the SAME vendor (no duplicate)
          const finalizedGroups = new Set<string>();
          const vendorTakenCategories = new Set<string>();
          for (const row of existing ?? []) {
            const rowStatus = (row as { status: string | null }).status;
            const rowCategory = (row as { category: string }).category;
            const rowVendor = (row as { marketplace_vendor_id: string | null })
              .marketplace_vendor_id;
            if (
              rowStatus &&
              (CONFIRMED_VENDOR_STATUSES as readonly string[]).includes(
                rowStatus,
              )
            ) {
              const g = planGroupForCategory(rowCategory as VendorCategory);
              if (g) finalizedGroups.add(g);
            }
            if (rowVendor === targetVendor.marketplace_vendor_id) {
              vendorTakenCategories.add(rowCategory);
            }
          }

          // Build the insert payload for every eligible target.
          const insertRows: Array<{
            event_id: string;
            category: VendorCategory;
            category_key: string | null;
            vendor_name: string;
            status: string;
            marketplace_vendor_id: string;
            source: string;
            source_category: VendorCategory;
          }> = [];
          for (const [targetGroup, targetCategory] of targetGroupToCategory) {
            // Skip if host already finalized something in this group.
            if (finalizedGroups.has(targetGroup)) continue;
            // Skip if host already has ANY row for this vendor in this
            // exact category.
            if (vendorTakenCategories.has(targetCategory)) continue;
            insertRows.push({
              event_id: eventId,
              category: targetCategory,
              category_key: primaryTileForVendorCategory(targetCategory),
              vendor_name: targetVendor.vendor_name as string,
              status: 'considering',
              marketplace_vendor_id: targetVendor.marketplace_vendor_id,
              source: 'auto_cascade_from_finalize',
              source_category: sourceCategory,
            });
          }

          if (insertRows.length > 0) {
            // Batch insert — single round-trip. Errors are swallowed
            // intentionally per the failure-mode comment above; the
            // lock succeeded and that's what matters most to the host.
            await supabase.from('event_vendors').insert(insertRows);
          }
        }
      }
    } catch {
      // Silent cascade failure — preserves the successful lock.
    }
  }

  // Re-anchor "ground 0" when a RECEPTION venue is the thing just locked.
  // A LOCKED reception wins the anchor over any 'considering' one, so every
  // other vendor's marketplace distance chip now re-measures from the
  // reception the couple actually committed to (CLAUDE.md 2026-06-02
  // directive 3 · "reception will be ground 0 for the distance of other
  // vendors"). recomputeReceptionAnchor reads coords across RLS
  // (marketplace + venue_directory) so it takes the service client.
  // Best-effort — never throws; the lock already succeeded.
  if (targetCategory === 'venue') {
    await recomputeReceptionAnchor(createAdminClient(), eventId);
  }

  // Refresh both the event home (FinalizedChipStrip + PlanningGroups read
  // from the same event_vendors fetch) and the vendor tracker (separate
  // surface that lists every vendor + status).
  revalidatePath(`/dashboard/${eventId}`, 'layout');
  revalidatePath(`/dashboard/${eventId}/vendors`, 'layout');

  return { status: 'ok', vendorId, lockedStatus: LOCKED_STATUS };
}

// ============================================================================
// listLockTimeSlots (tier #3, owner 2026-06-09) — couple-side slot picker
// feed. The lock UI calls this lazily before locking: if the booked vendor's
// service has >=1 ACTIVE time slot, the couple is shown a <select> of those
// windows and must choose one; the chosen slot_id is passed back into
// finalizeVendor (service_time_slot_id). Returns [] for date-only / #2 / off-
// platform bookings (no picker needed). Couple-RLS-scoped via
// fetchSlotsForCoupleBooking. Empty array → the lock proceeds with the existing
// one-tap happy path, unchanged for the vast majority of vendors.
// ============================================================================
export async function listLockTimeSlots(
  eventId: string,
  vendorId: string,
): Promise<VendorServiceTimeSlot[]> {
  if (!eventId || !vendorId) return [];
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  return fetchSlotsForCoupleBooking(supabase, eventId, vendorId);
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

  revalidatePath(`/dashboard/${eventId}`, 'layout');
  revalidatePath(`/dashboard/${eventId}/vendors`, 'layout');
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

  revalidatePath(`/dashboard/${eventId}`, 'layout');
  revalidatePath(`/dashboard/${eventId}/vendors`, 'layout');

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

  revalidatePath(`/dashboard/${eventIdRaw}`, 'layout');
  revalidatePath(`/dashboard/${eventIdRaw}/vendors`, 'layout');
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

  revalidatePath(`/dashboard/${existing.event_id}`, 'layout');
  revalidatePath(`/dashboard/${existing.event_id}/vendors`, 'layout');
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
    revalidatePath(`/dashboard/${eventIdForRevalidate}`, 'layout');
    revalidatePath(`/dashboard/${eventIdForRevalidate}/vendors`, 'layout');
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
      // Stamp source='host_manual' so the AutoCascadedChip doesn't
      // fire on rows the host added themselves (manual vendor attach).
      source: 'host_manual',
    })
    .select('vendor_id')
    .single();
  if (insertErr || !inserted) {
    return { status: 'error', message: insertErr?.message ?? 'Insert failed' };
  }

  revalidatePath(`/dashboard/${eventIdRaw}`, 'layout');
  revalidatePath(`/dashboard/${eventIdRaw}/vendors`, 'layout');
  return {
    status: 'ok',
    eventVendorId: inserted.vendor_id,
    manualVendorId: manualVendorIdRaw,
  };
}

// ============================================================================
// createManualVendorInvite (2026-06-11) — the "Add a contact" modal's
// post-save step lets the host generate the claim link RIGHT after adding
// their own vendor (owner: Shortlist must make adding-your-vendor easy —
// entry + price + invite in one place). Reuses the same idempotent
// ensureAutoShareInvite primitive finalizeVendor uses; this just makes it
// host-initiated at add time instead of lock time. Returns the URL so the
// client renders copy/share affordances without another round trip.
// ============================================================================

export type ManualVendorInviteResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export async function createManualVendorInvite(input: {
  eventId: string;
  vendorId: string;
}): Promise<ManualVendorInviteResult> {
  if (
    !input ||
    typeof input.eventId !== 'string' ||
    input.eventId.length === 0 ||
    typeof input.vendorId !== 'string' ||
    input.vendorId.length === 0
  ) {
    return { ok: false, error: 'Invalid input' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in.' };

  // RLS scopes the read to the host's own events. Only manual (off-platform)
  // vendors get a claim link — marketplace vendors already have an account.
  const { data: row } = await supabase
    .from('event_vendors')
    .select('vendor_id, vendor_name, category, manual_vendor_id, marketplace_vendor_id')
    .eq('event_id', input.eventId)
    .eq('vendor_id', input.vendorId)
    .maybeSingle();
  if (!row) return { ok: false, error: 'Vendor not found.' };
  if (!row.manual_vendor_id || row.marketplace_vendor_id) {
    return { ok: false, error: 'This vendor is already on Setnayan.' };
  }

  const invite = await ensureAutoShareInvite(supabase, {
    eventVendorId: input.vendorId,
    invitedByUserId: user.id,
    businessName:
      typeof row.vendor_name === 'string' && row.vendor_name.trim().length > 0
        ? row.vendor_name.trim()
        : 'Vendor',
    serviceCategory: typeof row.category === 'string' ? row.category : null,
  });
  if (!invite) {
    return { ok: false, error: 'Could not create the invite link. Try again.' };
  }
  return { ok: true, url: buildClaimUrl(invite.claim_token) };
}

// ============================================================================
// searchMarketplaceVendorsByName (2026-05-23) — autocomplete for the
// "Add a contact" modal's Vendor Name input.
//
// Owner directive 2026-05-22 (screenshot of Hair & Makeup Add modal):
//   "When a customer types a vendor name in the manual add form, ALSO
//    search the existing Setnayan marketplace so the host can pick from
//    existing vendor_profiles instead of duplicating a manual entry.
//    Search hits ALL vendors regardless of category. If the matched
//    vendor doesn't have service for the current category, surface a
//    polite notice so the host knows — they can still pick the vendor."
//
// Shape: debounced ilike against vendor_profiles.business_name + a
// follow-up vendor_services read so the caller can render the
// cross-category notice ("Maria's Hair Studio doesn't list Photography
// as a service — they offer Hair & Makeup").
//
// Auth: host must be signed in. We use the admin client for the
// vendor_profiles + vendor_services reads because vendor_services RLS
// restricts to the vendor's own user_id (same pattern as
// addRecommendedVendorToCategory at line 763). The signed-in check still
// gates the action — anonymous browsers can't search.
//
// Graceful-degrade: if vendor_profiles / vendor_services / event_vendors
// tables aren't on prod (42P01) or columns are missing (42703), the
// search returns []. The manual-add form stays fully functional in that
// state — the autocomplete just never surfaces matches.
//
// No event_vendors writes here — that's attachMarketplaceVendorToCategory
// below. This action is a read-only lookup that powers the dropdown.
// ============================================================================

export type MarketplaceVendorSuggestion = {
  vendor_profile_id: string;
  business_name: string;
  /** Pre-resolved logo URL. NULL = fall back to initials in the UI. The
   *  display URL is resolved via displayLogoUrl so r2:// refs become
   *  presigned GET URLs with 24h TTL — no client-side fetch needed. */
  logo_url: string | null;
  city: string | null;
  /** All canonical VendorCategory values this vendor has an active
   *  service for. May be empty if the vendor hasn't added any services
   *  yet (rare — most published vendors have ≥1). */
  categories: VendorCategory[];
  /** TRUE iff `categories` includes the current card's category. Drives
   *  the amber "Pick them anyway?" chip in the UI. */
  serves_current_category: boolean;
};

export type SearchMarketplaceVendorsResult =
  | { status: 'ok'; matches: ReadonlyArray<MarketplaceVendorSuggestion> }
  | { status: 'not_signed_in' }
  | { status: 'invalid_input' };

/**
 * Server action invoked from the Add-a-contact modal's debounced
 * autocomplete. Returns up to 8 marketplace vendors whose business_name
 * matches `query` (ilike, case-insensitive, partial). Vendors already
 * linked to `eventId` are filtered out so the host never sees a duplicate
 * suggestion.
 */
export async function searchMarketplaceVendorsByName(
  query: string,
  eventId: string,
  currentCategory: string,
): Promise<SearchMarketplaceVendorsResult> {
  const trimmed = query.trim();
  // Mirror the client-side >=2 guard. Server stays the source of truth so
  // a curl client can't trigger a full-table scan with an empty query.
  if (trimmed.length < 2) {
    return { status: 'ok', matches: [] };
  }
  if (typeof eventId !== 'string' || eventId.length === 0) {
    return { status: 'invalid_input' };
  }
  if (!isValidCategory(currentCategory)) {
    return { status: 'invalid_input' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: 'not_signed_in' };
  }

  // adminClient bypasses RLS on vendor_services (restricted to vendor's
  // own user_id) the same way addRecommendedVendorToCategory does. The
  // signed-in check above + the per-event filter below remain the
  // authorization gates.
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const adminClient = createAdminClient();

  // Step 1 — find vendor_profiles matching the name. PostgREST escape
  // for ilike: % and _ are pattern chars; the marketplace page already
  // does this raw (`%${filters.q}%`) without sanitization. We follow
  // suit — the worst case is a host typing % matches more rows; no
  // injection risk because Supabase parameterizes the value.
  let profilesQuery = adminClient
    .from('vendor_profiles')
    .select('vendor_profile_id, business_name, logo_url, location_city')
    .ilike('business_name', `%${trimmed}%`)
    .eq('is_published', true)
    .in('public_visibility', ['verified', 'coming_soon'])
    .order('business_name', { ascending: true })
    .limit(16); // Over-fetch — filter event-vendors below, then slice to 8.

  const profilesResult = await profilesQuery;
  if (profilesResult.error) {
    // Graceful-degrade: 42P01 (relation does not exist) or 42703
    // (column does not exist) mean the marketplace schema isn't on this
    // deploy. Return empty matches so the manual-add form behaves as
    // today.
    const code = (profilesResult.error as { code?: string }).code;
    if (code === '42P01' || code === '42703') {
      return { status: 'ok', matches: [] };
    }
    // Other errors — also degrade silently. The autocomplete is best-
    // effort; surfacing a server error to the host here would noise up
    // a simple Add-contact flow.
    return { status: 'ok', matches: [] };
  }
  const profiles = profilesResult.data ?? [];
  if (profiles.length === 0) {
    return { status: 'ok', matches: [] };
  }
  const profileIds = profiles.map((p) => p.vendor_profile_id);

  // Step 2 — filter out vendors already attached to this event so the
  // host never sees a duplicate suggestion. Uses the user-scoped client
  // (not adminClient) so the per-event RLS policy gates this read — a
  // host can only filter against their own events.
  const { data: alreadyLinked, error: alreadyErr } = await supabase
    .from('event_vendors')
    .select('marketplace_vendor_id')
    .eq('event_id', eventId)
    .in('marketplace_vendor_id', profileIds);
  // We don't graceful-degrade alreadyErr — if event_vendors can't be
  // read the autocomplete is unusable. Treat as no-matches.
  if (alreadyErr) {
    return { status: 'ok', matches: [] };
  }
  const linkedIds = new Set(
    (alreadyLinked ?? [])
      .map((r) => r.marketplace_vendor_id)
      .filter((id): id is string => typeof id === 'string'),
  );
  const candidates = profiles.filter((p) => !linkedIds.has(p.vendor_profile_id));
  if (candidates.length === 0) {
    return { status: 'ok', matches: [] };
  }

  // Step 3 — fetch the active service categories for the surviving
  // candidates. Powers (a) the `categories` array, (b) the
  // `serves_current_category` boolean that drives the cross-category
  // notice. Bulk read keyed on vendor_profile_id.
  const candidateIds = candidates.map((p) => p.vendor_profile_id);
  const { data: services, error: servicesErr } = await adminClient
    .from('vendor_services')
    .select('vendor_profile_id, category, is_active')
    .in('vendor_profile_id', candidateIds)
    .eq('is_active', true);
  // Services missing → render rows with empty categories (no cross-cat
  // notice; the row simply offers the vendor as a stretch).
  const servicesByVendor = new Map<string, Set<VendorCategory>>();
  if (!servicesErr && services) {
    for (const svc of services) {
      const cat = svc.category;
      if (typeof cat !== 'string') continue;
      if (!(VENDOR_CATEGORIES as readonly string[]).includes(cat)) continue;
      const id = svc.vendor_profile_id;
      if (typeof id !== 'string') continue;
      if (!servicesByVendor.has(id)) servicesByVendor.set(id, new Set());
      servicesByVendor.get(id)!.add(cat as VendorCategory);
    }
  }

  // Step 4 — presign logos so the dropdown rows render with the vendor's
  // actual brand mark instead of initials. r2:// refs need a signed GET
  // URL with 24h TTL; legacy http(s) URLs pass through unchanged.
  const { displayLogoUrl } = await import('@/lib/uploads');
  const presigned = await Promise.all(
    candidates.map(async (p) => {
      const logoUrl = await displayLogoUrl({ logo_url: p.logo_url ?? null });
      const cats = Array.from(
        servicesByVendor.get(p.vendor_profile_id) ?? [],
      );
      return {
        vendor_profile_id: p.vendor_profile_id,
        business_name: p.business_name,
        logo_url: logoUrl,
        city: p.location_city ?? null,
        categories: cats,
        serves_current_category: cats.includes(
          currentCategory as VendorCategory,
        ),
      } satisfies MarketplaceVendorSuggestion;
    }),
  );

  // Sort: vendors who serve the current category first, then by name.
  // Surfaces the most directly-relevant matches at the top of the
  // dropdown so the host's eye lands on them first.
  presigned.sort((a, b) => {
    if (a.serves_current_category && !b.serves_current_category) return -1;
    if (!a.serves_current_category && b.serves_current_category) return 1;
    return a.business_name.localeCompare(b.business_name);
  });

  return { status: 'ok', matches: presigned.slice(0, 8) };
}

// ============================================================================
// attachMarketplaceVendorToCategory (2026-05-23) — sibling of
// attachManualVendorToCategory; called when the host picks a marketplace
// vendor from the autocomplete dropdown.
//
// Reuses the same shape as addRecommendedVendorToCategory (above at line
// 702) — insert an event_vendors row with marketplace_vendor_id +
// service_id (when an active service exists for the category) + status =
// 'considering' + source = 'host_marketplace_search'. Idempotent: if
// (event_id, marketplace_vendor_id, category) already exists, returns
// 'already_attached' so the UI can surface a friendly toast instead of
// a duplicate row.
//
// Unlike addRecommendedVendorToCategory, this action doesn't require a
// "source pick" on the event — the host is starting from a name-search
// in a brand-new card, not from a cross-category recommendation. The
// service_id is best-effort: if the vendor has an active service for
// the current category we attach it; if not, the row inserts WITHOUT a
// service_id (matches the "no service for current category" case the
// owner specifically called out: "pick them anyway").
// ============================================================================

export type AttachMarketplaceVendorResult =
  | {
      status: 'ok';
      eventVendorId: string;
      marketplaceVendorId: string;
      /** TRUE if we found + attached an active vendor_services row for
       *  the current category. FALSE means the host picked a vendor who
       *  doesn't list this category — the row is still inserted but
       *  `service_id` stays NULL. */
      service_linked: boolean;
    }
  | { status: 'not_signed_in' }
  | { status: 'invalid_category' }
  | { status: 'invalid_input' }
  | { status: 'already_attached'; eventVendorId: string }
  | { status: 'marketplace_vendor_not_found' }
  | { status: 'error'; message: string };

export async function attachMarketplaceVendorToCategory(
  formData: FormData,
): Promise<AttachMarketplaceVendorResult> {
  const eventIdRaw = formData.get('event_id');
  const marketplaceVendorIdRaw = formData.get('marketplace_vendor_id');
  const categoryRaw = formData.get('category');

  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) {
    return { status: 'invalid_input' };
  }
  if (
    typeof marketplaceVendorIdRaw !== 'string' ||
    marketplaceVendorIdRaw.length === 0
  ) {
    return { status: 'invalid_input' };
  }
  if (!isValidCategory(categoryRaw)) {
    return { status: 'invalid_category' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: 'not_signed_in' };
  }

  // Idempotent guard. The autocomplete already filters out
  // already-linked vendors, but a stale dropdown render (host opens two
  // tabs of the same event) could submit a duplicate. Surface
  // 'already_attached' so the modal can show a friendly toast instead
  // of inserting a second row.
  const { data: existing, error: existingErr } = await supabase
    .from('event_vendors')
    .select('vendor_id')
    .eq('event_id', eventIdRaw)
    .eq('marketplace_vendor_id', marketplaceVendorIdRaw)
    .eq('category', categoryRaw)
    .is('archived_at', null)
    .limit(1)
    .maybeSingle();
  if (existingErr) {
    // archived_at column may not exist on every deploy — graceful-degrade
    // by checking without it. If THAT also fails, fall through to the
    // insert and let the DB enforce its own constraints.
    const code = (existingErr as { code?: string }).code;
    if (code !== '42703') {
      return { status: 'error', message: existingErr.message };
    }
  }
  if (existing) {
    return { status: 'already_attached', eventVendorId: existing.vendor_id };
  }

  // Look up the marketplace vendor's canonical name + the active
  // vendor_services row for this category. adminClient bypasses
  // vendor_services RLS (same pattern as addRecommendedVendorToCategory
  // line 763).
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const adminClient = createAdminClient();
  const { data: profile, error: profileErr } = await adminClient
    .from('vendor_profiles')
    .select('vendor_profile_id, business_name')
    .eq('vendor_profile_id', marketplaceVendorIdRaw)
    .maybeSingle();
  if (profileErr) {
    return { status: 'error', message: profileErr.message };
  }
  if (!profile) {
    return { status: 'marketplace_vendor_not_found' };
  }

  const { data: serviceRow } = await adminClient
    .from('vendor_services')
    .select('vendor_service_id')
    .eq('vendor_profile_id', marketplaceVendorIdRaw)
    .eq('category', categoryRaw)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  const serviceId = serviceRow?.vendor_service_id ?? null;

  // Insert. Stamp source so downstream chips (AutoCascadedChip etc.) can
  // distinguish "host picked from marketplace name-search" from the
  // existing 'host_manual' (typed in the form) and the recommendation
  // / cascade paths.
  const insertPayload: Record<string, unknown> = {
    event_id: eventIdRaw,
    category: categoryRaw,
    vendor_name: profile.business_name,
    status: 'considering',
    marketplace_vendor_id: marketplaceVendorIdRaw,
    source: 'host_marketplace_search',
  };
  if (serviceId) {
    insertPayload.service_id = serviceId;
  }
  const { data: inserted, error: insertErr } = await supabase
    .from('event_vendors')
    .insert(insertPayload)
    .select('vendor_id')
    .single();
  if (insertErr || !inserted) {
    await insertFaultLog({
      event_type: 'SUPABASE_SAVE_ERROR',
      element_name: 'Add marketplace vendor to category',
      file_path: 'app/dashboard/[eventId]/vendors/actions.ts',
      error_message: insertErr?.message ?? 'Insert failed',
      payload_snapshot: {
        eventId: eventIdRaw,
        marketplaceVendorId: marketplaceVendorIdRaw,
        category: categoryRaw,
        serviceLinked: serviceId !== null,
      },
    });
    return {
      status: 'error',
      message: insertErr?.message ?? 'Insert failed',
    };
  }

  revalidatePath(`/dashboard/${eventIdRaw}`, 'layout');
  revalidatePath(`/dashboard/${eventIdRaw}/vendors`, 'layout');
  return {
    status: 'ok',
    eventVendorId: inserted.vendor_id,
    marketplaceVendorId: marketplaceVendorIdRaw,
    service_linked: serviceId !== null,
  };
}

// ============================================================================
// cancelBookingAsHost (2026-05-24, PR B) — Host-side cancel pre-downpayment.
//
// CLAUDE.md decision-log row "Canonical wizard sequence reconciled 38 → 45 +
// Lock/delete/overlap architecture" (2026-05-24). Rule 1 of 5 from the
// lock/delete/overlap pillar — pilot-critical batch with PR A
// (`max_soft_holds_per_date` schema + finalizeVendor extension) and PR C
// (PLAN_GROUPS.bridal_car alignment) landing same session.
//
// Why this exists:
//   Pilot couples WILL change their minds on picks (5-20 personal/family
//   cohort exercising real BDO/GCash payment cycle 2026-06-01 onwards).
//   Without an in-app cancel path, admin would manually delete event_vendors
//   rows from Supabase Studio — bad UX, slow turnaround, no audit. The
//   existing `deleteVendor` server action is a blunt hard-delete that:
//     (a) doesn't notify the vendor (they'd discover via stale calendar +
//         lose a soft-hold slot silently), and
//     (b) shouldn't fire on `deposit_paid` / `delivered` / `complete` rows
//         where real money has moved — those need the dispute flow.
//
// Status → action matrix (the canonical lock):
//   considering / shortlisted     → existing deleteVendor (no notification)
//   contracted (no payment)       → cancelBookingAsHost (this action)
//   contracted (payment confirmed) → downpaid_use_dispute_flow → 0023 § 3.6
//   deposit_paid / delivered / complete → downpaid_use_dispute_flow
//
// V1 payment-signal source: per the canonical lock, the gate is
// "ANY row in service_order_payments exists with confirmed_at IS NOT NULL
//  for this event_vendor". In V1, the actual `public.payments` table
// (migration 20260513150000) is keyed on `order_id` (not event_vendor_id)
// and the order→vendor link is via `orders.service_key` — there's no
// direct event_vendor_id FK on payments yet (deferred to V1.x payment
// reconciliation refactor per CLAUDE.md 2026-05-16 row 8). The canonical
// V1 signal is instead:
//   (a) event_vendors.status IN ('deposit_paid','delivered','complete'), OR
//   (b) event_vendors.deposit_paid_php > 0
// Both flip at the same time per the existing workspace status stepper
// (workspace page.tsx:122 inferStageFromVendorStatus). We check (a) AND
// (b) belt-and-suspenders so a host who manually entered a deposit
// figure (via the inline contact form) without flipping the status pill
// still triggers the dispute gate. When V1.x adds the direct payments
// link, this check extends without changing the action signature.
//
// Notification trigger: PR B is scoped to "no schema migration" per the
// batch contract (PR A owns schema changes for this lock/delete/overlap
// arc). Two schema gaps relevant to PR B's vendor-notification step:
//   1. `chat_messages.sender_role` has no 'system' value (enum: couple /
//      vendor / coordinator) — inserting a system thread message would
//      require an ADD VALUE migration. SKIPPED for PR B.
//   2. `public.notification_type` has no 'booking_cancelled' value (per
//      apps/web/lib/notifications.ts NotificationType union). The
//      canonical emitNotification path would 22P02-fail on insert.
//      SKIPPED for PR B; we send a direct Resend email instead.
//
// V1.x follow-up (paired with PR A's schema work) adds both enum
// values + restores the canonical emitNotification path. For PR B
// pilot scope, a direct email via sendEmail() + a chat-deep-link in
// the body delivers the vendor-side signal cleanly without spec drift.
// When RESEND_API_KEY isn't configured (dev / preview env), sendEmail
// no-ops and returns ok:false reason:'not_configured' — we log and
// continue. The cancel itself is the load-bearing action; the
// notification is best-effort.
//
// Idempotent: re-cancel after the row is gone returns 'not_found' (not
// an error). RLS on event_vendors gates the action to host-on-event
// members; an outside user submitting a forged form sees 'not_found'
// the same way (RLS-denied select == row missing from the response).
//
// Entry points (orphan-prevention per feedback_setnayan_orphan_prevention):
//   - /dashboard/[eventId]/vendors/[eventVendorId]/workspace — primary
//     detail surface (added in this PR alongside the action)
//   - /dashboard/[eventId]/vendors list — replaces the existing Trash2
//     icon for `contracted` rows with the new modal flow (PR B UI work)
// ============================================================================

export type CancelBookingAsHostResult =
  | { status: 'ok'; vendorId: string; vendorName: string }
  | { status: 'not_signed_in' }
  | { status: 'not_found' }
  | { status: 'downpaid_use_dispute_flow' }
  | { status: 'error'; message: string };

const DOWNPAID_STATUSES = new Set<VendorStatus>([
  'deposit_paid',
  'delivered',
  'complete',
]);

/**
 * Cancels a host's vendor booking BEFORE any downpayment lands. Hard-
 * deletes the event_vendors row + notifies the vendor (when marketplace-
 * linked) via the standard notification pipeline.
 *
 * Form fields:
 *   - event_id: UUID of the event
 *   - vendor_id: UUID of the event_vendors row
 *
 * Status routing: any row already past `contracted` (deposit_paid /
 * delivered / complete) returns 'downpaid_use_dispute_flow' so the UI
 * can swap to the dispute CTA. The host can't accidentally hard-delete
 * a row where money has moved.
 *
 * Returns vendor name on success so the UI's confirmation toast reads
 * "Cancelled your booking with {Vendor Name}" without an extra fetch.
 */
export async function cancelBookingAsHost(
  formData: FormData,
): Promise<CancelBookingAsHostResult> {
  const eventIdRaw = formData.get('event_id');
  const vendorIdRaw = formData.get('vendor_id');

  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) {
    return { status: 'error', message: 'Missing event id' };
  }
  if (typeof vendorIdRaw !== 'string' || vendorIdRaw.length === 0) {
    return { status: 'error', message: 'Missing vendor id' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: 'not_signed_in' };
  }

  // Read the target row — RLS gates this to host-on-event members. A
  // forged vendor_id from outside the event will return null (RLS deny
  // is indistinguishable from row-missing in PostgREST), which we
  // surface as 'not_found' for the same idempotent re-cancel path.
  const { data: vendorRow, error: readErr } = await supabase
    .from('event_vendors')
    .select(
      'vendor_id, vendor_name, status, deposit_paid_php, marketplace_vendor_id, event_id',
    )
    .eq('vendor_id', vendorIdRaw)
    .eq('event_id', eventIdRaw)
    .maybeSingle();
  if (readErr) {
    // 42P01 / 42703 on event_vendors would mean the migration didn't
    // land — surface a clean error instead of leaking the SQL code.
    return { status: 'error', message: readErr.message };
  }
  if (!vendorRow) {
    return { status: 'not_found' };
  }

  const ev = vendorRow as {
    vendor_id: string;
    vendor_name: string;
    status: VendorStatus;
    deposit_paid_php: number | string | null;
    marketplace_vendor_id: string | null;
    event_id: string;
  };

  // Downpayment gate. Any of three signals routes the host to the
  // dispute flow instead of the silent hard-delete:
  //   (a) Status reached deposit_paid / delivered / complete (the
  //       canonical workspace-stepper signal — set by the vendor
  //       tracker or the workspace surface when payment confirmed).
  //   (b) deposit_paid_php > 0 — belt-and-suspenders for hosts who
  //       enter a deposit figure via the inline contact form on the
  //       vendors list WITHOUT flipping the status pill. Real money
  //       has moved even if the enum lags behind.
  if (DOWNPAID_STATUSES.has(ev.status)) {
    return { status: 'downpaid_use_dispute_flow' };
  }
  const depositValue =
    typeof ev.deposit_paid_php === 'string'
      ? Number(ev.deposit_paid_php)
      : ev.deposit_paid_php;
  if (Number.isFinite(depositValue) && (depositValue ?? 0) > 0) {
    return { status: 'downpaid_use_dispute_flow' };
  }

  // Resolve host display name BEFORE the delete so the notification copy
  // reads "Maria Santos cancelled..." not "Someone cancelled...". Falls
  // back to email-local-part when display_name is null — every signed-in
  // user has at least one of those two via the signup flow.
  let hostDisplay: string = 'A host';
  {
    const { data: hostRow } = await supabase
      .from('users')
      .select('display_name, email')
      .eq('user_id', user.id)
      .maybeSingle();
    if (hostRow) {
      const row = hostRow as { display_name: string | null; email: string };
      hostDisplay =
        row.display_name?.trim() ||
        row.email.split('@')[0] ||
        'A host';
    }
  }

  // Pre-resolve the event display name + date for the email body. The
  // vendor needs context — "cancelled their booking with you for Maria
  // & Juan's wedding on Aug 15" is more useful than the bare cancel
  // notice. Event read is via the host's RLS — they already have
  // membership on this event so the select succeeds.
  let eventDisplay: string = 'their event';
  let eventDateIso: string | null = null;
  {
    const { data: eventRow } = await supabase
      .from('events')
      .select('display_name, event_date')
      .eq('event_id', ev.event_id)
      .maybeSingle();
    if (eventRow) {
      const row = eventRow as {
        display_name: string;
        event_date: string | null;
      };
      eventDisplay = row.display_name;
      eventDateIso = row.event_date;
    }
  }

  // Pre-resolve chat thread (when marketplace-linked) so the
  // notification deep-links the vendor straight to the conversation
  // where they negotiated the booking. Best-effort: missing thread
  // just falls back to /vendor-dashboard.
  let vendorChatThreadId: string | null = null;
  let vendorPrimaryUserId: string | null = null;
  if (ev.marketplace_vendor_id) {
    // adminClient bypasses chat_threads RLS — same pattern as
    // notification-emit.ts uses for cross-account writes. We only
    // need the thread_id + the vendor's user_id; no sensitive data.
    const adminClient = createAdminClient();
    const { data: threadRow } = await adminClient
      .from('chat_threads')
      .select('thread_id')
      .eq('event_id', ev.event_id)
      .eq('vendor_profile_id', ev.marketplace_vendor_id)
      .maybeSingle();
    if (threadRow) {
      vendorChatThreadId = (threadRow as { thread_id: string }).thread_id;
    }

    const { data: profileRow } = await adminClient
      .from('vendor_profiles')
      .select('user_id')
      .eq('vendor_profile_id', ev.marketplace_vendor_id)
      .maybeSingle();
    if (profileRow) {
      vendorPrimaryUserId =
        (profileRow as { user_id: string | null }).user_id ?? null;
    }
  }

  // Free any stray live schedule-pool reservations with an auditable
  // reason BEFORE the row delete cascades them away. Pre-payment rows
  // normally hold none (white never consumes — owner lock 2026-06-12),
  // so this is belt-and-suspenders for downgrade leftovers. Best-effort.
  await releaseSchedulePools(supabase, vendorIdRaw, 'host_cancelled');

  // PRIMARY ACTION — hard-delete the event_vendors row. RLS enforces
  // host-on-event membership. If the row vanished between our read and
  // this delete (multi-host race), the delete affects 0 rows but doesn't
  // throw — we still return 'ok' because the desired state (row gone) is
  // achieved.
  const { error: deleteErr } = await supabase
    .from('event_vendors')
    .delete()
    .eq('vendor_id', vendorIdRaw)
    .eq('event_id', eventIdRaw);
  if (deleteErr) {
    await insertFaultLog({
      event_type: 'SUPABASE_SAVE_ERROR',
      element_name: 'Cancel vendor booking (host)',
      file_path: 'app/dashboard/[eventId]/vendors/actions.ts',
      error_message: deleteErr.message,
      payload_snapshot: { eventId: eventIdRaw, vendorId: vendorIdRaw, status: ev.status },
    });
    return { status: 'error', message: deleteErr.message };
  }

  // BEST-EFFORT NOTIFICATION — fire-and-forget. Any failure here (vendor
  // user missing, Resend rate-limited, etc.) MUST NOT roll back the cancel;
  // the host's action has already succeeded. Now that the
  // 'booking_cancelled' enum value exists (migration
  // 20260907000000_notification_types_cross_actor_signals.sql) this is
  // consolidated onto the canonical dual-channel emitNotification (in-app
  // row + Resend email) instead of the prior email-only direct send — so
  // the cancellation also lands in the vendor's notification tray, not just
  // their inbox. emitNotification resolves the recipient email + prefixes
  // the app URL internally, so the manual users-table lookup is gone.
  if (vendorPrimaryUserId) {
    const formattedDate = (() => {
      if (!eventDateIso) return null;
      try {
        return new Date(eventDateIso).toLocaleDateString('en-PH', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });
      } catch {
        return null;
      }
    })();
    const dateClause = formattedDate ? ` on ${formattedDate}` : '';
    const deepLinkPath = vendorChatThreadId
      ? `/vendor-dashboard/messages/${vendorChatThreadId}`
      : '/vendor-dashboard';

    try {
      await emitNotification({
        userId: vendorPrimaryUserId,
        type: 'booking_cancelled',
        title: `${hostDisplay} cancelled their booking with you`,
        body: `${hostDisplay} cancelled their booking with you for ${eventDisplay}${dateClause}. This happened before any payment was made — your soft hold has been released and the date is open on your calendar again.`,
        relatedUrl: deepLinkPath,
      });
    } catch (e) {
      // Silent — the cancel itself succeeded. Log for ops visibility.
      // eslint-disable-next-line no-console
      console.error(
        `[cancelBookingAsHost] vendor notification failed for vendor_id=${vendorIdRaw} event_id=${eventIdRaw}:`,
        e,
      );
    }
  }

  // Revalidate both surfaces — event home + vendor tracker — so the
  // cancelled vendor disappears from every host-facing view without a
  // hard refresh. 'layout' mode mirrors the convention used across this
  // file (see file-top comment block).
  revalidatePath(`/dashboard/${eventIdRaw}`, 'layout');
  revalidatePath(`/dashboard/${eventIdRaw}/vendors`, 'layout');

  return { status: 'ok', vendorId: ev.vendor_id, vendorName: ev.vendor_name };
}
