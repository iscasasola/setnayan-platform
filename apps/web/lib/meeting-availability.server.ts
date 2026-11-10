import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readCalendarTruth } from '@/lib/calendar-truth.server';
import { getHostUserId } from '@/lib/host-gate';
import { resolveAppointmentLabel } from '@/lib/appointments';
import { NOT_AVAILABLE_COLUMNS, notAvailableShapeOf, notAvailableWindowFilter } from '@/lib/not-available';
import { logQueryError } from '@/lib/supabase/error-detect';
import type { CalendarDay } from '@/lib/calendar-grid';
import {
  foldMeetingAvailability,
  manilaDayAndTime,
  meetingWindowDays,
  type HeldMeeting,
  type MeetingAvailability,
  type MeetingViewer,
} from '@/lib/meeting-availability';

/**
 * meeting-availability.server — THE ONE READ behind a meeting's date sheet: the supplier's side and the hosts' side,
 * read together and folded by `lib/meeting-availability.ts` (which has the rules and the privacy line).
 *
 *   supplier   `vendor_calendar_blocks` (repeats + hours, `NOT_AVAILABLE_COLUMNS` + `notAvailableWindowFilter`) ·
 *              `readCalendarTruth` (the lock's refusal: booked / full / held; "Not set") · their meetings on OTHER events
 *   hosts      this event's meetings (with every supplier)
 *
 * No new table, no new RPC: every source is already read elsewhere the same way.
 *
 * 🔒 WHO MAY ASK. The viewer is PROVEN here on the caller's own session before anything is read with the admin client:
 *   host       `getHostUserId` (an accepted, non-viewer moderator or the couple row) — the house host gate;
 *   supplier   their shop (`vendor_profiles_self`, the owner/member view) — so nobody reads a shop's day but the shop;
 *   both       the two share a thread (`chat_threads`, RLS: each side sees only its own).
 * Not proven → null, and the caller draws no availability (never "free for everyone").
 *
 * ADMIN client after the proof: the supplier's other meetings belong to other couples, so RLS would hide them from a
 * host. Only "<supplier> is not available" leaves for those — their type, place and couple stay here.
 *
 * FAILS HONESTLY: a source that errors is `null` in the fold, so its side reads "could not be read" — never free.
 */
export async function readMeetingAvailability(args: {
  /** The caller's own session (the proof). */
  supabase: SupabaseClient;
  /** Reads both calendars once the viewer is proven. */
  admin: SupabaseClient;
  viewer: MeetingViewer;
  eventId: string;
  vendorProfileId: string;
  /** The window, Manila civil days: usually today → the day before the event. */
  from: CalendarDay;
  to: CalendarDay;
  supplierName: string;
  hostName: string;
  /** Anyone else included — named in the ⓘ (the platform holds no personal schedule). */
  alsoAsked?: readonly string[];
}): Promise<MeetingAvailability | null> {
  const { supabase, admin, viewer, eventId, vendorProfileId, from, to } = args;
  const days = meetingWindowDays(from, to);
  if (!eventId || !vendorProfileId || days.length === 0) return null;
  if (!(await proveMeetingViewer({ supabase, viewer, eventId, vendorProfileId }))) return null;

  const fromIso = `${days[0]}T00:00:00+08:00`;
  const toIso = `${days[days.length - 1]}T23:59:59+08:00`;

  const [blocks, calendar, supplierMeetings, eventMeetings] = await Promise.all([
    readBlocks(admin, vendorProfileId, fromIso, toIso),
    readCalendarTruth({ admin, supplierIds: [vendorProfileId], days }).then((t) => {
      const mine = t?.get(vendorProfileId);
      return mine ? { set: mine.set, refused: [...mine.refused] } : null;
    }),
    readMeetings(admin, { vendorProfileId, otherThan: eventId }, fromIso, toIso, vendorProfileId, viewer),
    readMeetings(admin, { eventId }, fromIso, toIso, vendorProfileId, viewer),
  ]);

  return foldMeetingAvailability({
    viewer,
    supplierName: args.supplierName,
    hostName: args.hostName,
    from: days[0]!,
    to: days[days.length - 1]!,
    blocks,
    calendar,
    supplierMeetings,
    eventMeetings,
    alsoAsked: args.alsoAsked,
  });
}

/** Is the caller really this side of this meeting? Only the caller's own session answers. */
export async function proveMeetingViewer(args: {
  supabase: SupabaseClient;
  viewer: MeetingViewer;
  eventId: string;
  vendorProfileId: string;
}): Promise<boolean> {
  const { supabase, viewer, eventId, vendorProfileId } = args;
  try {
    if (viewer === 'host') {
      if ((await getHostUserId(eventId)) === null) return false;
    } else {
      const { data, error } = await supabase.from('vendor_profiles_self').select('vendor_profile_id').eq('vendor_profile_id', vendorProfileId).maybeSingle();
      if (error) {
        logQueryError('meeting-availability: vendor_profiles_self', error);
        return false;
      }
      if (!data) return false;
    }
    const { data: thread, error } = await supabase
      .from('chat_threads')
      .select('thread_id')
      .eq('event_id', eventId)
      .eq('vendor_profile_id', vendorProfileId)
      .limit(1)
      .maybeSingle();
    if (error) {
      logQueryError('meeting-availability: chat_threads', error);
      return false;
    }
    return !!thread;
  } catch {
    return false;
  }
}

async function readBlocks(admin: SupabaseClient, vendorProfileId: string, fromIso: string, toIso: string) {
  const { data, error } = await admin
    .from('vendor_calendar_blocks')
    .select(`blocked_at, blocked_until, ${NOT_AVAILABLE_COLUMNS}`)
    .eq('vendor_profile_id', vendorProfileId)
    .lte('blocked_at', toIso)
    .or(notAvailableWindowFilter(fromIso));
  if (error) {
    logQueryError('meeting-availability: vendor_calendar_blocks', error);
    return null;
  }
  return ((data ?? []) as { blocked_at: string; blocked_until: string; repeat_rule?: unknown; repeat_until?: unknown; day_part?: unknown }[])
    .filter((r) => r.blocked_at && r.blocked_until)
    .map(notAvailableShapeOf);
}

type AppointmentRow = {
  vendor_profile_id: string | null;
  type: string;
  custom_label: string | null;
  scheduled_at: string | null;
  duration_min: number | null;
};

/** "the food tasting" — a preset's words in lower case; a custom name exactly as typed. */
function meetingLabel(row: AppointmentRow, withName: string | null): string {
  const base = resolveAppointmentLabel(row, {});
  const said = row.type === 'custom' ? base : base.toLowerCase();
  return withName ? `the ${said} with ${withName}` : `the ${said}`;
}

/**
 * The meetings that make a side busy: proposed or confirmed, in the window. One of
 *   { eventId }                      this event's meetings — the hosts' own;
 *   { vendorProfileId, otherThan }   the supplier's meetings on every OTHER event — the supplier's own.
 */
async function readMeetings(
  admin: SupabaseClient,
  scope: { eventId: string } | { vendorProfileId: string; otherThan: string },
  fromIso: string,
  toIso: string,
  thisSupplier: string,
  viewer: MeetingViewer,
): Promise<HeldMeeting[] | null> {
  let q = admin
    .from('event_appointments')
    .select('vendor_profile_id, type, custom_label, scheduled_at, duration_min')
    .in('status', ['proposed', 'confirmed'])
    .gte('scheduled_at', fromIso)
    .lte('scheduled_at', toIso)
    .limit(500);
  q = 'eventId' in scope ? q.eq('event_id', scope.eventId) : q.eq('vendor_profile_id', scope.vendorProfileId).neq('event_id', scope.otherThan);
  const { data, error } = await q;
  if (error) {
    logQueryError('meeting-availability: event_appointments', error);
    return null;
  }
  const rows = (data ?? []) as AppointmentRow[];

  /* A host's own meeting with ANOTHER supplier names that supplier ("the food tasting with Bloom"). */
  const names = new Map<string, string>();
  if ('eventId' in scope && viewer === 'host') {
    const others = [...new Set(rows.map((r) => r.vendor_profile_id).filter((v): v is string => !!v && v !== thisSupplier))];
    if (others.length) {
      const { data: v, error: vErr } = await admin
        .from('event_vendors')
        .select('vendor_name, marketplace_vendor_id')
        .eq('event_id', scope.eventId)
        .in('marketplace_vendor_id', others);
      if (vErr) logQueryError('meeting-availability: event_vendors', vErr, { eventId: scope.eventId }, 'graceful_degrade');
      for (const r of (v ?? []) as { vendor_name: string | null; marketplace_vendor_id: string | null }[]) {
        if (r.marketplace_vendor_id && r.vendor_name) names.set(r.marketplace_vendor_id, r.vendor_name);
      }
    }
  }

  const out: HeldMeeting[] = [];
  for (const r of rows) {
    if (!r.scheduled_at) continue;
    const at = manilaDayAndTime(r.scheduled_at);
    if (!at) continue;
    const withThisSupplier = 'eventId' in scope && r.vendor_profile_id === thisSupplier;
    const withName = 'eventId' in scope && !withThisSupplier && r.vendor_profile_id ? (names.get(r.vendor_profile_id) ?? null) : null;
    out.push({ day: at.day, start: at.start, minutes: r.duration_min, label: meetingLabel(r, withName), withThisSupplier });
  }
  return out;
}
