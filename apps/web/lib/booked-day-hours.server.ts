import 'server-only';

import { createAdminClient } from './supabase/admin';
import { readInChunks } from './read-all-pages';
import { logQueryError } from './supabase/error-detect';
import { TIMES_SUFFIX, bookedRowHours, type HoursChapter, type HoursMoment } from './schedule-hand-in-hand';
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
 * A refused read is logged and every upcoming row keeps "Booked here" — never a wrong hour — AND says so: `unread`
 * draws "Couldn't read the hours · Try again" under it (the approved prototype), never a silent plain row.
 */
export type BookedDayHours = Map<string, { hours: string | null; mine: string | null; unread?: true }>;

export async function readBookedDayHours(
  bookings: readonly PoolBookingEntry[],
  hallPoolIds: ReadonlySet<string>,
  todayIso: string,
): Promise<BookedDayHours> {
  const out: BookedDayHours = new Map();
  const from = new Date(Date.parse(`${todayIso}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  const live = bookings.filter((b) => b.bookedDate >= from && b.eventVendorId);
  if (live.length === 0) return out;
  const unread = () => {
    for (const b of live) out.set(b.poolBookingId, { hours: null, mine: null, unread: true });
    return out;
  };
  try {
    const admin = createAdminClient();
    const eventIds = [...new Set(live.map((b) => b.eventId))];
    const bookingIds = [...new Set(live.map((b) => b.eventVendorId!))];
    // 🗓 The booking's shop name(s): only "<that shop> arrives / is done" is the shop's own time (ruling 5574 #7).
    const [read, booked] = await Promise.all([
      readInChunks<HoursChapter & { event_id: string; parent_block_id: string | null; label: string }>(eventIds, (part) =>
        admin
          .from('event_schedule_blocks')
          .select('block_id, event_id, parent_block_id, label, start_at, end_at, time_tba, responsible_vendor_ids, hours_vendor_id')
          .in('event_id', part),
      ),
      readInChunks<{ vendor_id: string; vendor_name: string | null; marketplace_vendor_id: string | null }>(bookingIds, (part) =>
        admin.from('event_vendors').select('vendor_id, vendor_name, marketplace_vendor_id').in('vendor_id', part),
      ),
    ]);
    if (read.error || booked.error) {
      logQueryError('readBookedDayHours', read.error ?? booked.error, { events: eventIds.length }, 'graceful_degrade');
      return unread();
    }
    const shopIds = [...new Set(booked.rows.map((r) => r.marketplace_vendor_id).filter((x): x is string => Boolean(x)))];
    const shopName = new Map<string, string>();
    if (shopIds.length > 0) {
      const shops = await admin.from('vendor_profiles').select('vendor_profile_id, business_name').in('vendor_profile_id', shopIds);
      if (shops.error) {
        logQueryError('readBookedDayHours.shops', shops.error, { shops: shopIds.length }, 'graceful_degrade');
        return unread();
      }
      for (const p of (shops.data ?? []) as { vendor_profile_id: string; business_name: string | null }[]) {
        if (p.business_name?.trim()) shopName.set(p.vendor_profile_id, p.business_name.trim());
      }
    }
    const namesOf = new Map<string, string[]>();
    for (const r of booked.rows) {
      const names = [r.marketplace_vendor_id ? shopName.get(r.marketplace_vendor_id) : null, r.vendor_name?.trim() || null].filter(
        (n): n is string => Boolean(n),
      );
      namesOf.set(r.vendor_id, [...new Set(names)]);
    }
    const byEvent = new Map<string, { chapters: HoursChapter[]; moments: HoursMoment[] }>();
    const timesWords = Object.values(TIMES_SUFFIX);
    for (const r of read.rows) {
      const e = byEvent.get(r.event_id) ?? { chapters: [], moments: [] };
      if (!r.parent_block_id) e.chapters.push(r);
      // Only moments in My times' words with a booking on them leave this file — `bookedRowHours` then keeps only those
      // that start with THIS booking's shop name. Every other moment stays the couple's.
      else if ((r.responsible_vendor_ids ?? []).length > 0 && timesWords.some((w) => (r.label ?? '').trim().endsWith(w)))
        e.moments.push({ label: r.label, start_at: r.start_at, responsible_vendor_ids: r.responsible_vendor_ids, parent_block_id: r.parent_block_id });
      byEvent.set(r.event_id, e);
    }
    for (const b of live) {
      const e = byEvent.get(b.eventId);
      if (!e) continue;
      out.set(
        b.poolBookingId,
        bookedRowHours({
          bookedDate: b.bookedDate,
          bookingId: b.eventVendorId!,
          isHall: hallPoolIds.has(b.poolId),
          chapters: e.chapters,
          moments: e.moments,
          shops: new Map([[b.eventVendorId!, namesOf.get(b.eventVendorId!) ?? []]]),
        }),
      );
    }
  } catch (e) {
    logQueryError('readBookedDayHours (threw)', e, {}, 'graceful_degrade');
    return unread();
  }
  return out;
}
