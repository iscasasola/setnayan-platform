import 'server-only';

import { createAdminClient } from './supabase/admin';
import { readInChunks } from './read-all-pages';
import { logQueryError } from './supabase/error-detect';
import { bookedRowHours, supplierTimeOf, type HoursChapter, type HoursMoment } from './schedule-hand-in-hand';
import type { PoolBookingEntry } from './vendor-schedule';

/**
 * 🗓 A BOOKED DAY'S HOURS ON THE SUPPLIER'S CALENDAR (SCHEDULES HAND-IN-HAND part (b), owner 2026-11-12; audit gap 1
 * "the supplier's calendar never shows the event's hours"). A booked day's row read "Booked here"; it now reads the
 * event's hours (first chapter → last) and, once the host OK'd them, the supplier's own arrive · done. A hall reads
 * ONLY the chapter held in that hall (rule 4) — `bookedRowHours` decides, this file only reads.
 *
 * Read with the service role, as the event's name already is (`fetchVendorPoolBookings` — the supplier holds no
 * `events` RLS): only the chapters' label, clock and links, and the moments that are this booking's own times — never
 * `notes` (couple-private, the 2026-06-12 lock), never anybody else's moments. Upcoming days only (from yesterday, in
 * Manila): a past day's row keeps its plain words, and a busy shop's history is never read for it.
 *
 * Best-effort: a refused read is logged and every row keeps "Booked here" — never a wrong hour.
 */
export type BookedDayHours = Map<string, { hours: string | null; mine: string | null }>;

export async function readBookedDayHours(
  bookings: readonly PoolBookingEntry[],
  hallPoolIds: ReadonlySet<string>,
  todayIso: string,
): Promise<BookedDayHours> {
  const out: BookedDayHours = new Map();
  const from = new Date(Date.parse(`${todayIso}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  const live = bookings.filter((b) => b.bookedDate >= from && b.eventVendorId);
  if (live.length === 0) return out;
  try {
    const admin = createAdminClient();
    const eventIds = [...new Set(live.map((b) => b.eventId))];
    const read = await readInChunks<HoursChapter & { event_id: string; parent_block_id: string | null; label: string }>(eventIds, (part) =>
      admin
        .from('event_schedule_blocks')
        .select('block_id, event_id, parent_block_id, label, start_at, end_at, time_tba, responsible_vendor_ids, hours_vendor_id')
        .in('event_id', part),
    );
    if (read.error) {
      logQueryError('readBookedDayHours', read.error, { events: eventIds.length }, 'graceful_degrade');
      return out;
    }
    const byEvent = new Map<string, { chapters: HoursChapter[]; moments: HoursMoment[] }>();
    for (const r of read.rows) {
      const e = byEvent.get(r.event_id) ?? { chapters: [], moments: [] };
      if (!r.parent_block_id) e.chapters.push(r);
      // Only a supplier's own arrive / done leaves this file — every other moment stays the couple's.
      else if (supplierTimeOf(r)) e.moments.push({ label: r.label, start_at: r.start_at, responsible_vendor_ids: r.responsible_vendor_ids, parent_block_id: r.parent_block_id });
      byEvent.set(r.event_id, e);
    }
    for (const b of live) {
      const e = byEvent.get(b.eventId);
      if (!e) continue;
      out.set(
        b.poolBookingId,
        bookedRowHours({ bookedDate: b.bookedDate, bookingId: b.eventVendorId!, isHall: hallPoolIds.has(b.poolId), chapters: e.chapters, moments: e.moments }),
      );
    }
  } catch (e) {
    logQueryError('readBookedDayHours (threw)', e, {}, 'graceful_degrade');
  }
  return out;
}
