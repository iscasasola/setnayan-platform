'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchVendorPoolBookings } from '@/lib/vendor-schedule';
import { saveDayOfOverride } from '@/lib/vendor-dayof-config';
import { resolveModules } from '@/lib/vendor-dayof-modules';
import { isDataPrivacyControlActive } from '@/lib/data-privacy-controls';
import { resolveVendorSpecializationAccessForVendor } from '@/lib/vendor-specialization-gate.server';
import { holdsSpecialization } from '@/lib/vendor-specialization-gate';
import {
  buildVendorStatusDraft,
  normalizeRequestBody,
  vendorInboxSide,
  type DayRequestRow,
  type DayRequestStatus,
} from '@/lib/day-requests';

/**
 * The taxonomy tiles this vendor is actually BOOKED under on this event, or
 * null when the brief can't say — in which case callers fall back to the
 * vendor's full `services[]`, the same best-effort the live console uses.
 */
async function fetchBookedTiles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
): Promise<string[] | null> {
  const { data: brief } = await supabase.rpc('get_vendor_event_brief', {
    p_event_id: eventId,
  });
  const tiles = (brief as { booked_categories?: unknown } | null)?.booked_categories;
  return Array.isArray(tiles) ? (tiles as string[]) : null;
}

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  THE SONG DESK GATE — one definition, because it is now the paywall.      ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Owner-locked 2026-07-30: guest song requests are ALWAYS ON, and **seeing the
 * requests** is the paid part. That moved the sale off the open/close switch and
 * onto the inbox, so migration 20271020224218 removed the booked-vendor leg from
 * `event_song_requests_read` / `_decide` — booked is not paid, and RLS is
 * row-level so it can never ask the paid question.
 *
 * Everything an act does with its song desk therefore comes through here:
 * signed in → owns the profile → booked on this event → HOLDS `song_desk` →
 * service_role. Three callers share this one gate rather than keeping three
 * copies of the check, because three copies of a paywall is three chances for
 * one of them to drift open.
 *
 * WHY THE ENTITLEMENT STAYS IN TYPESCRIPT (settled by PR #3876, restated because
 * it is the reason this function exists at all):
 * `resolveVendorSpecializationAccessForVendor` folds in the admin free-window
 * promotion and the mid-event lapse. A SQL copy of those rules would drift from
 * the copy every render path already uses, and a drifting paywall fails open.
 *
 * ⚠ THE FRAME IS NOT AUTHORISATION. `resolveVendorSpecializationAccess` is
 * imported by the render path (`vendor-dayof-frame.ts` · `specialization-slot.tsx`
 * · `live/[eventId]/page.tsx`); a mounted component proves nothing about a query.
 * That gap WAS the PR #3876 defect. Do not add a fourth caller that re-implements
 * this — call it.
 *
 * ⚠ OWNER PATH ONLY, deliberately, and unchanged from PR #3876: a day-of
 * *grantee* (crew) cannot pause requests or decide them. Widening that is a
 * product call, not a side effect of a security fix.
 */
type SongDeskGate =
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createClient>>;
      profile: { vendor_profile_id: string; services: string[] };
      /** The tiles this vendor is booked under — reused by callers that seed a
       *  `vendor_dayof_configs` row, so the brief is fetched once. */
      eventTiles: string[] | null;
    }
  | { ok: false; error: string };

async function requireSongDeskAct(eventId: string): Promise<SongDeskGate> {
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

  const eventTiles = await fetchBookedTiles(supabase, eventId);
  const access = await resolveVendorSpecializationAccessForVendor(
    supabase,
    profile.vendor_profile_id,
    { services: profile.services, eventTiles },
  );
  if (!holdsSpecialization(access, 'song_desk')) {
    return { ok: false, error: 'The song desk is part of a paid plan.' };
  }

  return { ok: true, supabase, profile, eventTiles };
}

/** One guest request, as the act's inbox reads it. */
export type ActSongRequest = {
  requestId: string;
  title: string;
  /** May be '' — a guest can type a title with no artist. */
  artist: string;
  /** 'guest' = an RSVP'd wedding guest · 'open' = a scanned walk-in. */
  origin: 'guest' | 'open';
  /** The name they gave, or '' when they gave none. */
  requesterName: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
};

/**
 * The act's request inbox — the surface the owner made the paid part.
 *
 * Reads as service_role because {@link requireSongDeskAct} has already answered
 * every question RLS used to answer, plus the one it could not (did you pay).
 * Ordered pending-first then newest-first: on a venue floor the undecided rows
 * are the only ones anyone can act on, which is the same opinion `buildSongDesk`
 * applies to gaps.
 *
 * Returns [] rather than throwing on a denied gate — a day-of surface renders a
 * short list far better than it renders an exception. Callers that need to tell
 * "not entitled" from "no requests yet" should call the gate themselves.
 */
export async function fetchActSongRequests(eventId: string): Promise<ActSongRequest[]> {
  const gate = await requireSongDeskAct(eventId);
  if (!gate.ok) return [];

  const { data, error } = await createAdminClient()
    .from('event_song_requests')
    .select('request_id, origin, requester_name, status, created_at, songs(title, artist)')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];

  const rows = (data as unknown[]).flatMap((row) => {
    const r = row as {
      request_id: string;
      origin: string;
      requester_name: string | null;
      status: string;
      created_at: string;
      songs: unknown;
    };
    const song = (Array.isArray(r.songs) ? r.songs[0] : r.songs) as
      | { title?: string; artist?: string }
      | undefined;
    const title = song?.title?.trim();
    if (!title) return []; // a request with no resolvable song is not a row anyone can act on
    return [
      {
        requestId: r.request_id,
        title,
        artist: song?.artist?.trim() ?? '',
        origin: r.origin === 'open' ? ('open' as const) : ('guest' as const),
        requesterName: r.requester_name?.trim() ?? '',
        status:
          r.status === 'accepted'
            ? ('accepted' as const)
            : r.status === 'declined'
              ? ('declined' as const)
              : ('pending' as const),
        createdAt: r.created_at,
      },
    ];
  });

  // Pending first, then newest — a stable two-key sort so the list does not
  // reshuffle under the act's thumb between renders.
  const rank = (s: ActSongRequest['status']) => (s === 'pending' ? 0 : 1);
  return rows.sort((a, b) => rank(a.status) - rank(b.status) || b.createdAt.localeCompare(a.createdAt));
}

/**
 * Accept or decline one request.
 *
 * ACCEPT IS THE SETLIST (owner, 2026-07-27) and accepting does NOT file the song
 * into a set (owner, 2026-07-30) — a request lands mid-song, and making a
 * musician answer "which set?" in that moment is a decision they do not need. So
 * this writes a status and nothing else: no ordering table, no `played` state.
 *
 * `event_id` is re-asserted in the WHERE clause even though `request_id` is a
 * primary key, so a request from another event cannot be decided by id alone —
 * service_role bypasses RLS, which means every scope the policy used to enforce
 * has to be written out here.
 */
export async function decideActSongRequest(
  eventId: string,
  requestId: string,
  decision: 'accepted' | 'declined',
): Promise<{ ok: boolean; error?: string }> {
  const gate = await requireSongDeskAct(eventId);
  if (!gate.ok) return { ok: false, error: gate.error };

  const { error } = await createAdminClient()
    .from('event_song_requests')
    .update({
      status: decision,
      decided_by_vendor_profile_id: gate.profile.vendor_profile_id,
      // The CHECK constraint pairs these: a non-pending row MUST carry a
      // decided_at, so writing the status without it fails the insert.
      decided_at: new Date().toISOString(),
    })
    .eq('request_id', requestId)
    .eq('event_id', eventId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/vendor-dashboard/on-the-day/live/${eventId}`);
  return { ok: true };
}

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

  const eventTiles = await fetchBookedTiles(supabase, eventId);

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

/**
 * PAUSE or resume the act's guest song requests for one booking.
 *
 * ⚠ THE MEANING OF THIS FUNCTION INVERTED ON 2026-07-30. It used to OPEN a window
 * that defaulted closed; requests are now ALWAYS ON (owner-locked, migration
 * 20271020224218) and `song_requests_open` means **not paused**. `open: false` is
 * therefore a pause the act applies on the night — a flood during dinner, a set
 * they want undisturbed — not a feature they forgot to switch on. The parameter
 * keeps its name because the column does; the UI copy says "Pause requests".
 *
 * ⚠ A PAUSE PAUSES THE ROOM, not just this act's view. The request pool is
 * per-EVENT (one inbox, `UNIQUE (event_id, song_id)`), so with two acts booked a
 * paused quartet also silences the band. That is the safe direction — over-pausing
 * disappoints a guest, under-pausing floods a band that asked for silence — and
 * splitting it per-act means splitting the inbox first. See the migration header.
 *
 * THE ONLY WRITE PATH to `vendor_dayof_configs.song_requests_open`. Migration
 * 20271020159662 withdrew that column's INSERT/UPDATE privilege from
 * `authenticated`, because RLS is row-level and could only ask "is this your
 * row" — never "did you pay for the song desk". A free-tier band could PATCH
 * the column straight through PostgREST. That gate still stands and still
 * matters: always-on retired the window as a *setup step*, but the pause is a
 * paid control.
 *
 * Entitlement + booking + identity all come from {@link requireSongDeskAct};
 * because service_role bypasses RLS entirely, that gate is the only thing
 * standing between a caller and this write.
 */
export async function setSongRequestsOpen(
  eventId: string,
  open: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const gate = await requireSongDeskAct(eventId);
  if (!gate.ok) return { ok: false, error: gate.error };
  const { profile, eventTiles } = gate;

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: updated, error: updateError } = await admin
    .from('vendor_dayof_configs')
    .update({ song_requests_open: open, updated_at: now })
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .eq('event_id', eventId)
    .select('config_id');
  if (updateError) return { ok: false, error: updateError.message };
  if (updated && updated.length > 0) {
    revalidatePath(`/vendor-dashboard/on-the-day/live/${eventId}`);
    return { ok: true };
  }

  // No override row yet. It must be seeded with the vendor's CURRENT defaults,
  // never with the column default of `[]`: `enabled_modules` is a present-row
  // override that `resolveModules` treats as authoritative, so an empty array
  // means "every module off". Inserting the bare flag would silently switch off
  // this vendor's entire generic day-of kit as a side effect of opening the
  // requests window.
  const defaults = resolveModules(profile.services, eventTiles, null)
    .filter((m) => m.enabled)
    .map((m) => m.id);

  const { error: insertError } = await admin.from('vendor_dayof_configs').insert({
    vendor_profile_id: profile.vendor_profile_id,
    event_id: eventId,
    enabled_modules: defaults,
    song_requests_open: open,
    updated_at: now,
  });
  if (insertError) return { ok: false, error: insertError.message };

  revalidatePath(`/vendor-dashboard/on-the-day/live/${eventId}`);
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
