import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { CONFIRMED_VENDOR_STATUSES } from '@/lib/events';
import { blocksWithAClock } from '@/lib/supplier-schedule';
import { TASK_COLUMNS } from '@/lib/schedule-chapters';
import { logQueryError } from '@/lib/supabase/error-detect';
import { fetchDriveSpeed } from '@/lib/platform-settings';
import { crewElsewhere, type CrewClash, type CrewStint } from '@/lib/crew-elsewhere';

/**
 * 🚗 THE READS BEHIND "ONE CREW, TWO EVENTS" (event chapters slice 5, owner 2026-11-04) — `lib/crew-elsewhere.ts`
 * holds the rule. This finds the shop's OTHER booked events on the same day, their crews' moments, both events'
 * reception pins and the owner's drive speed, and returns the clashes keyed by the moment on THIS event.
 *
 *   · Which events: this shop's bookings (`event_vendors.marketplace_vendor_id`, contracted onward, not archived) whose
 *     event shares this event's date. Admin read, scoped to this shop — a supplier has no read on `event_vendors`.
 *   · Their moments and crews: the supplier's own session (RLS — a booked supplier reads a booked event's schedule),
 *     only their own bookings' tasks that name a crew.
 *   · The pins and the speed: admin, the pins only of events this shop is booked on.
 *
 * null = something could not be read, so "no clash" is not a fact — the screen says so (never drawn as clear).
 */
export async function readCrewElsewhere(input: {
  admin: SupabaseClient;
  supabase: SupabaseClient;
  vendorProfileId: string;
  eventId: string;
  eventDate: string | null;
  /** This event's crew moments (already read for the supplier's day). */
  here: ReadonlyArray<Pick<CrewStint, 'blockId' | 'crew' | 'startIso' | 'endIso'>>;
}): Promise<Record<string, CrewClash[]> | null> {
  const { admin, supabase, vendorProfileId, eventId, eventDate } = input;
  if (!eventDate || input.here.length === 0) return {};

  const { data: bookings, error: bookingsErr } = await admin
    .from('event_vendors')
    .select('event_id, vendor_id')
    .eq('marketplace_vendor_id', vendorProfileId)
    .in('status', CONFIRMED_VENDOR_STATUSES as unknown as string[])
    .is('archived_at', null);
  if (bookingsErr) {
    logQueryError('readCrewElsewhere (bookings)', bookingsErr, { event_id: eventId }, 'graceful_degrade');
    return null;
  }
  const rows = (bookings ?? []) as Array<{ event_id: string; vendor_id: string }>;
  const candidateIds = [...new Set(rows.map((r) => r.event_id).filter((id) => id !== eventId))];
  if (candidateIds.length === 0) return {};

  // Two narrow reads: which day and what name, and where (the reception pin).
  const ids = [eventId, ...candidateIds];
  const [namesRes, pinsRes] = await Promise.all([
    admin.from('events').select('event_id, event_date, display_name').in('event_id', ids),
    admin.from('events').select('event_id, venue_latitude, venue_longitude').in('event_id', ids),
  ]);
  if (namesRes.error || pinsRes.error) {
    logQueryError('readCrewElsewhere (events)', namesRes.error ?? pinsRes.error, { event_id: eventId }, 'graceful_degrade');
    return null;
  }
  type EventRow = { event_id: string; event_date: string | null; display_name: string | null; venue_latitude?: number | string | null; venue_longitude?: number | string | null };
  const byId = new Map(((namesRes.data ?? []) as EventRow[]).map((e) => [e.event_id, { ...e }]));
  for (const p of (pinsRes.data ?? []) as Array<Pick<EventRow, 'event_id' | 'venue_latitude' | 'venue_longitude'>>) {
    const e = byId.get(p.event_id);
    if (e) Object.assign(e, { venue_latitude: p.venue_latitude, venue_longitude: p.venue_longitude });
  }
  const sameDay = candidateIds.filter((id) => byId.get(id)?.event_date === eventDate);
  if (sameDay.length === 0) return {};

  const myBookingIds = rows.filter((r) => sameDay.includes(r.event_id)).map((r) => r.vendor_id);
  const [blocksRes, tasksRes, speedRes] = await Promise.all([
    supabase.from('event_schedule_blocks').select('block_id, event_id, parent_block_id, start_at, end_at, time_tba').in('event_id', sameDay),
    supabase
      .from('event_schedule_tasks')
      .select(`${TASK_COLUMNS}, event_id`)
      .in('event_id', sameDay)
      .in('vendor_id', myBookingIds)
      .not('crew', 'is', null),
    fetchDriveSpeed(admin),
  ]);
  if (blocksRes.error || tasksRes.error) {
    logQueryError('readCrewElsewhere (schedules)', blocksRes.error ?? tasksRes.error, { event_id: eventId }, 'graceful_degrade');
    return null;
  }
  // The speed is the owner's; a failed read (logged by `fetchDriveSpeed`) only turns the drive estimate off — overlaps
  // are still checked.
  const speed = speedRes.read ? speedRes.kmh : null;

  const pinOf = (id: string): CrewStint['pin'] => {
    const e = byId.get(id);
    const lat = e?.venue_latitude === null || e?.venue_latitude === undefined ? NaN : Number(e.venue_latitude);
    const lon = e?.venue_longitude === null || e?.venue_longitude === undefined ? NaN : Number(e.venue_longitude);
    return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
  };
  const nameOf = (id: string) => byId.get(id)?.display_name?.trim() || 'another event';

  // ⏰ A Time-TBA chapter's 00:00 is only its day — never a time that clashes (`blocksWithAClock`).
  type BlockRow = { block_id: string; event_id: string; parent_block_id: string | null; start_at: string | null; end_at: string | null; time_tba: boolean | null };
  const timed = new Map(blocksWithAClock((blocksRes.data ?? []) as BlockRow[]).map((b) => [b.block_id, b]));
  const there: CrewStint[] = [];
  for (const t of (tasksRes.data ?? []) as Array<{ event_id: string; block_id: string; crew: string | null; call_at: string | null }>) {
    const b = timed.get(t.block_id);
    const startIso = t.call_at ?? b?.start_at ?? null;
    if (!b || !startIso || !t.crew) continue;
    there.push({ eventId: t.event_id, blockId: t.block_id, crew: t.crew, startIso, endIso: b.end_at, pin: pinOf(t.event_id), eventName: nameOf(t.event_id) });
  }
  const herePin = pinOf(eventId);
  const found = crewElsewhere(
    input.here.map((h) => ({ ...h, eventId, pin: herePin, eventName: nameOf(eventId) })),
    there,
    speed,
  );
  return Object.fromEntries(found);
}
