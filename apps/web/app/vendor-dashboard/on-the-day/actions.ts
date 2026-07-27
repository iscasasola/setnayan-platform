'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchVendorPoolBookings } from '@/lib/vendor-schedule';
import { saveDayOfOverride } from '@/lib/vendor-dayof-config';
import { resolveModules } from '@/lib/vendor-dayof-modules';
import { isDataPrivacyControlActive } from '@/lib/data-privacy-controls';
import {
  buildVendorStatusDraft,
  normalizeRequestBody,
  vendorInboxSide,
  type DayRequestRow,
  type DayRequestStatus,
} from '@/lib/day-requests';

/**
 * Persist the vendor's day-of module override for one booking.
 *
 * The client sends the full set of module ids it wants ON for `eventId`. We:
 *   1. Authenticate the vendor and confirm they are actually BOOKED on the event
 *      (defence-in-depth on top of the RLS insert gate).
 *   2. Intersect the requested set with the modules AVAILABLE to the vendor's
 *      family for THIS event's booked tiles — an override can never enable a
 *      module the vendor's category doesn't offer.
 *   3. Upsert the sparse `vendor_dayof_configs` row.
 */
export async function saveDayOfModules(
  eventId: string,
  requested: string[],
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return { ok: false, error: 'No vendor profile.' };

  const bookings = await fetchVendorPoolBookings(supabase, profile.vendor_profile_id);
  const booking = bookings.find((b) => b.eventId === eventId);
  if (!booking) return { ok: false, error: 'You are not booked on this event.' };

  // Event-scoped tiles for this booking (best-effort — the brief RPC carries
  // booked_categories; if unavailable we fall back to the vendor's services).
  let eventTiles: string[] | null = null;
  const { data: brief } = await supabase.rpc('get_vendor_event_brief', {
    p_event_id: eventId,
  });
  if (brief && Array.isArray((brief as { booked_categories?: unknown }).booked_categories)) {
    eventTiles = (brief as { booked_categories: string[] }).booked_categories;
  }

  // Only persist ids that are genuinely available to this vendor for this event.
  const available = new Set(
    resolveModules(profile.services, eventTiles, null).map((m) => m.id),
  );
  const sanitized = requested.filter((id) => available.has(id as never));

  const res = await saveDayOfOverride(
    supabase,
    profile.vendor_profile_id,
    eventId,
    sanitized,
  );
  if (!res.ok) return { ok: false, error: res.error ?? 'Could not save.' };

  revalidatePath('/vendor-dashboard/on-the-day');
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// The day-of REQUESTS STREAM (build plan §10 #2 + #6)
//
// One stream, four lanes, one inbox — table `public.event_day_requests`
// (migration 20271013100000). Every action below is gated on the
// `coordinator_requests_inbox` activation control: while it is inactive these
// return `{ ok: false, gated: true }` and the console keeps the shipped
// device-local issues log. Fail-closed — a missing control row reads inactive.
//
// RLS is the boundary, not these functions. The booking re-checks here exist to
// return a friendly error instead of an opaque policy violation, exactly as
// saveDayOfModules does above.
// ═══════════════════════════════════════════════════════════════════════════

export type DayRequestActionResult = {
  ok: boolean;
  /** True when the activation control is off — the caller should render the
   *  device-local fallback rather than an error. */
  gated?: boolean;
  error?: string;
};

/** Resolve the caller to a booked vendor on this event, or explain why not. */
async function requireBookedVendor(eventId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' as const };

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return { error: 'No vendor profile.' as const };

  const bookings = await fetchVendorPoolBookings(supabase, profile.vendor_profile_id);
  if (!bookings.some((b) => b.eventId === eventId)) {
    return { error: 'You are not booked on this event.' as const };
  }

  return { supabase, user, profile, side: vendorInboxSide(profile.services) };
}

export type DayRequestsView = {
  /** Whether the activation control is ON. `false` ⇒ the caller renders the
   *  shipped device-local issues log and never shows the inbox. */
  active: boolean;
  /** Which side of the inbox this vendor is on, or null when not booked. */
  side: 'coordinator' | 'vendor' | null;
  rows: DayRequestRow[];
};

/**
 * Everything the inbox needs, in one round-trip: is it switched on, which side
 * is the caller on, and the rows they may see.
 *
 * `active` is what makes gated distinguishable from empty — an inbox with no
 * rows and a dark control must render very different UI, so returning a bare
 * array would lose the distinction.
 *
 * The row read is deliberately unfiltered by lane: RLS already decides what
 * this caller may see — the coordinator gets the whole event, any other
 * supplier gets only the rows they authored. Re-narrowing here would be a
 * second, drift-prone copy of the boundary.
 */
export async function getDayRequestsView(eventId: string): Promise<DayRequestsView> {
  if (!(await isDataPrivacyControlActive('coordinator_requests_inbox'))) {
    return { active: false, side: null, rows: [] };
  }

  const ctx = await requireBookedVendor(eventId);
  if ('error' in ctx) return { active: true, side: null, rows: [] };

  const { data, error } = await ctx.supabase
    .from('event_day_requests')
    .select(
      'request_id, origin, kind, status, body, preset_key, author_user_id, author_vendor_profile_id, created_at',
    )
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
    .limit(200);

  return {
    active: true,
    side: ctx.side,
    rows: error || !data ? [] : (data as DayRequestRow[]),
  };
}

/**
 * §10 #2 — the one-tap vendor status preset.
 *
 * The body and kind come from the server-side catalogue keyed by `presetKey`,
 * never from the client: a caller cannot post arbitrary text through this door,
 * and "Running late" always files as an issue while "On site" always files as a
 * status ping.
 */
export async function submitVendorStatusPreset(
  eventId: string,
  presetKey: string,
): Promise<DayRequestActionResult> {
  if (!(await isDataPrivacyControlActive('coordinator_requests_inbox'))) {
    return { ok: false, gated: true };
  }

  const draft = buildVendorStatusDraft(presetKey);
  if (!draft) return { ok: false, error: 'Unknown status.' };

  const ctx = await requireBookedVendor(eventId);
  if ('error' in ctx) return { ok: false, error: ctx.error };

  const { error } = await ctx.supabase.from('event_day_requests').insert({
    event_id: eventId,
    origin: draft.origin,
    kind: draft.kind,
    body: draft.body,
    preset_key: draft.preset_key,
    author_user_id: ctx.user.id,
    author_vendor_profile_id: ctx.profile.vendor_profile_id,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/vendor-dashboard/on-the-day/live/${eventId}`);
  revalidatePath('/vendor-dashboard/on-the-day');
  return { ok: true };
}

/**
 * File a free-text note. The lane follows the caller's side — a supplier files
 * on the vendor lane, the booked coordinator on the coordinator lane — matching
 * the two RLS INSERT policies. The client never chooses its own origin.
 */
export async function submitDayRequest(
  eventId: string,
  rawBody: string,
): Promise<DayRequestActionResult> {
  if (!(await isDataPrivacyControlActive('coordinator_requests_inbox'))) {
    return { ok: false, gated: true };
  }

  const body = normalizeRequestBody(rawBody);
  if (!body) return { ok: false, error: 'Write something first.' };

  const ctx = await requireBookedVendor(eventId);
  if ('error' in ctx) return { ok: false, error: ctx.error };

  const isCoordinator = ctx.side === 'coordinator';
  const { error } = await ctx.supabase.from('event_day_requests').insert({
    event_id: eventId,
    origin: isCoordinator ? 'coordinator' : 'vendor',
    kind: 'issue',
    body,
    // The CHECK constraint pairs a vendor-lane row with its vendor and forbids
    // one anywhere else, so the coordinator lane must send NULL.
    author_vendor_profile_id: isCoordinator ? null : ctx.profile.vendor_profile_id,
    author_user_id: ctx.user.id,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/vendor-dashboard/on-the-day/live/${eventId}`);
  revalidatePath('/vendor-dashboard/on-the-day');
  return { ok: true };
}

/**
 * Triage — move a row through open → acknowledged → resolved.
 *
 * Only the event side and the booked coordinator hold an UPDATE policy, so a
 * plain supplier calling this gets zero rows back and an honest error rather
 * than a silent no-op. `resolved_at` is stamped by the table's trigger.
 */
export async function setDayRequestStatus(
  eventId: string,
  requestId: string,
  status: DayRequestStatus,
): Promise<DayRequestActionResult> {
  if (!(await isDataPrivacyControlActive('coordinator_requests_inbox'))) {
    return { ok: false, gated: true };
  }

  const ctx = await requireBookedVendor(eventId);
  if ('error' in ctx) return { ok: false, error: ctx.error };
  if (ctx.side !== 'coordinator') {
    return { ok: false, error: 'Only the coordinator can clear items.' };
  }

  const { data, error } = await ctx.supabase
    .from('event_day_requests')
    .update({
      status,
      resolved_by_user_id: status === 'resolved' ? ctx.user.id : null,
    })
    .eq('request_id', requestId)
    .eq('event_id', eventId)
    .select('request_id');

  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: 'Could not update that item.' };

  revalidatePath(`/vendor-dashboard/on-the-day/live/${eventId}`);
  revalidatePath('/vendor-dashboard/on-the-day');
  return { ok: true };
}

/**
 * Grant or revoke a team account's access to one event's launched day-of app
 * (launcher step 3 · per-event account grants, owner override 2026-07-16).
 *
 * Only the vendor owner/admin may manage grants (RLS enforces via
 * current_vendor_ids('admin'); we re-check the booking + membership here for a
 * friendly error). Grant = upsert an active row; revoke = soft-revoke.
 */
export async function setEventAccessGrant(
  eventId: string,
  granteeUserId: string,
  grant: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return { ok: false, error: 'No vendor profile.' };

  const bookings = await fetchVendorPoolBookings(supabase, profile.vendor_profile_id);
  if (!bookings.some((b) => b.eventId === eventId)) {
    return { ok: false, error: 'You are not booked on this event.' };
  }

  if (grant) {
    const { error } = await supabase.from('vendor_event_access_grants').upsert(
      {
        vendor_profile_id: profile.vendor_profile_id,
        event_id: eventId,
        grantee_user_id: granteeUserId,
        granted_by: user.id,
        revoked_at: null,
      },
      { onConflict: 'vendor_profile_id,event_id,grantee_user_id' },
    );
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from('vendor_event_access_grants')
      .update({ revoked_at: new Date().toISOString() })
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .eq('event_id', eventId)
      .eq('grantee_user_id', granteeUserId);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath('/vendor-dashboard/on-the-day');
  return { ok: true };
}
