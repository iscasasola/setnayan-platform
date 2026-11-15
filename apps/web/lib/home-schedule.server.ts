import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { CHAPTER_FIELDS, TASK_COLUMNS, type TaskRow } from '@/lib/schedule-chapters';
import { BOOKED_BY_PAYMENT_EMBED } from '@/lib/booked-by-payment';
import { scheduleSuppliersFrom, type ScheduleSupplierRow } from '@/lib/schedule-suppliers';
import { homeScheduleFrom, type HomeScheduleBlock, type HomeScheduleFacts } from '@/lib/home-schedule';

/**
 * lib/home-schedule.server.ts — THE READ BEHIND HOME'S SCHEDULE WIDGET (owner 2026-11-01; the pure half is
 * `lib/home-schedule.ts`). Four reads in ONE round (started together, awaited together — Home's one batched read):
 *
 *   · the event's blocks — chapters and their moments, `CHAPTER_FIELDS` (the chapters reader's own list) plus the
 *     suppliers tagged on each (`responsible_vendor_ids`);
 *   · the moments' tasks (`TASK_COLUMNS`) — who does what, where: the clash check;
 *   · the open supplier requests (`event_schedule_suggestions`, status open — the Schedule page's own queue filter);
 *   · the event's suppliers, so the booked ones the schedule names on nothing yet are counted (`scheduleSuppliersFrom`,
 *     the ONE booked-if-paid word).
 *
 * Every read runs on the CALLER's client: RLS decides. 🛑 ANY REFUSED READ IS `'unread'` — the widget says "Schedule
 * couldn't load" with ⟳ Reload, never "No chapters yet", never a door that reads 0 (`home-control-reads-honestly`).
 */

/** The block fields the widget reads — the chapters reader's list plus the suppliers tagged on each. */
// `responsible_vendor_ids` is in CHAPTER_FIELDS itself now (the moment sheet's Suppliers and crew row reads it).
export const HOME_SCHEDULE_FIELDS = `${CHAPTER_FIELDS}`;

/** The venue's calendar day now ("2026-12-12") — the day a wall clock is compared on. */
export function venueToday(nowMs: number, tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(nowMs));
  } catch {
    return new Date(nowMs).toISOString().slice(0, 10);
  }
}

export async function readHomeSchedule(
  supabase: SupabaseClient,
  eventId: string,
  opts: { show: boolean; tz: string | null; nowMs?: number; undated?: boolean },
): Promise<HomeScheduleFacts | 'unread' | null> {
  if (!opts.show) return null;
  const [blocksRes, tasksRes, requestsRes, vendorsRes] = await Promise.all([
    supabase
      .from('event_schedule_blocks')
      .select(HOME_SCHEDULE_FIELDS)
      .eq('event_id', eventId)
      .order('start_at', { ascending: true })
      .order('sort_order', { ascending: true }),
    supabase.from('event_schedule_tasks').select(TASK_COLUMNS).eq('event_id', eventId),
    supabase
      .from('event_schedule_suggestions')
      .select('suggestion_id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('status', 'open')
      // 🔁 A supplier's requests only — the hosts' own asks of a supplier (`to_supplier`, D2) are not theirs to approve.
      .eq('direction', 'to_host')
      // A change or removal whose moment is gone has nothing left to approve (the Schedule page's own filter).
      .or('kind.eq.new,block_id.not.is.null'),
    supabase
      .from('event_vendors')
      .select(`vendor_id, vendor_name, status, marketplace_vendor_id, manual_vendor_id, ${BOOKED_BY_PAYMENT_EMBED}`)
      .eq('event_id', eventId)
      .is('archived_at', null),
  ]);
  const refused = blocksRes.error ?? tasksRes.error ?? requestsRes.error ?? vendorsRes.error;
  if (refused || !blocksRes.data || !tasksRes.data || !vendorsRes.data || requestsRes.count === null) {
    if (refused) logQueryError('HomeSchedule', refused, { event_id: eventId }, 'graceful_degrade');
    return 'unread';
  }
  const tz = opts.tz || 'Asia/Manila';
  const nowMs = opts.nowMs ?? Date.now();
  const booked = scheduleSuppliersFrom(vendorsRes.data as unknown as ScheduleSupplierRow[], new Map())
    .filter((s) => s.standing === 'Booked')
    .map((s) => s.vendor_id);
  return homeScheduleFrom({
    blocks: blocksRes.data as unknown as HomeScheduleBlock[],
    tasks: tasksRes.data as unknown as TaskRow[],
    openRequests: requestsRes.count ?? 0,
    bookedVendorIds: booked,
    nowMs,
    tz,
    today: venueToday(nowMs, tz),
    undated: opts.undated,
  });
}
