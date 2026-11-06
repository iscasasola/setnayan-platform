import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { buildCustomerCalendarMonth } from '@/lib/vendor-customers';
import { manilaDate, type SchedulePool } from '@/lib/vendor-schedule';
import { threadDayAnswerOf, type ThreadDayAnswer } from '@/lib/thread-day-answer';
import { NOT_AVAILABLE_COLUMNS, blockClosesDay, notAvailableFieldsOf, notAvailableWindowFilter } from '@/lib/not-available';

/**
 * thread-day-answer.server — the ONE read behind the supplier conversation's answer line (`thread-day-answer.ts`).
 *
 * ⚡ FOUR NARROW READS FOR ONE DAY, started together — not the Dates screen's whole-history fetchers. Those read every
 * booking and every block the shop ever had (paged) plus the names behind them, and `fetchVendorPools` can WRITE
 * (`resolve_schedule_pool`); a conversation needs one date's facts:
 *   1. the shop's active schedules and their "How many a day" (`vendor_schedule_pools`);
 *   2. Setnayan bookings held ON that date (`vendor_schedule_pool_bookings`, not released);
 *   3. blocks that touch that date — Not available AND outside bookings (`vendor_calendar_blocks`);
 *   4. the shop's own day state on that date — hard hold / approve first (`vendor_calendar_day_states`).
 * The four are then handed to `buildCustomerCalendarMonth` — the SAME derivation the supplier's Dates screen draws — so
 * the line and the month can never disagree about a day.
 *
 * Under the SUPPLIER'S OWN session: every one of these tables is the shop's own rows (the Dates screen reads them the
 * same way). The caller passes its proven `vendorProfileId`.
 *
 * FAILS TOWARD SILENCE: any refused read → null, and the page draws the date with no answer — never "Free".
 */
export async function readThreadDayAnswer(
  supabase: SupabaseClient,
  args: { vendorProfileId: string; date: string; todayIso: string },
): Promise<ThreadDayAnswer | null> {
  const { vendorProfileId, date, todayIso } = args;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  try {
    const [poolsRes, bookingsRes, blocksRes, statesRes] = await Promise.all([
      supabase
        .from('vendor_schedule_pools')
        .select('pool_id, daily_booking_capacity')
        .eq('vendor_profile_id', vendorProfileId)
        .eq('is_active', true),
      supabase
        .from('vendor_schedule_pool_bookings')
        .select('pool_id')
        .eq('vendor_profile_id', vendorProfileId)
        .eq('booked_date', date)
        .is('released_at', null),
      supabase
        .from('vendor_calendar_blocks')
        .select(`pool_id, block_source, blocked_at, blocked_until, ${NOT_AVAILABLE_COLUMNS}`)
        .eq('vendor_profile_id', vendorProfileId)
        // A block touches the day when it starts on/before the day's end and — a one-off — ends on/after its start, or
        // is a REPEAT that began earlier (every Sunday …; lib/not-available.ts, step 2). The exact civil-day test is the
        // month builder's own (`blockOnDay`), after `manilaDate` below.
        .lte('blocked_at', `${date}T23:59:59.999+08:00`)
        .or(notAvailableWindowFilter(`${date}T00:00:00+08:00`)),
      supabase
        .from('vendor_calendar_day_states')
        .select('pool_id, state_date, day_state')
        .eq('vendor_profile_id', vendorProfileId)
        .eq('state_date', date),
    ]);
    for (const [what, res] of [
      ['pools', poolsRes],
      ['bookings', bookingsRes],
      ['blocks', blocksRes],
      ['day states', statesRes],
    ] as const) {
      if (res.error) {
        logQueryError(`readThreadDayAnswer: ${what}`, res.error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
        return null;
      }
    }

    const pools: SchedulePool[] = ((poolsRes.data ?? []) as { pool_id: string; daily_booking_capacity: number | null }[]).map(
      (p) => ({
        poolId: p.pool_id,
        label: '',
        capacity: Number(p.daily_booking_capacity) || 0,
        categories: [],
        calendarName: null,
        isVendorCreated: false,
        serviceIds: [],
      }),
    );
    const bookings = ((bookingsRes.data ?? []) as { pool_id: string }[]).map((b) => ({
      poolId: b.pool_id,
      bookedDate: date,
      eventName: '',
    }));
    const blocks = (
      (blocksRes.data ?? []) as {
        pool_id: string | null;
        block_source: string;
        blocked_at: string;
        blocked_until: string;
        repeat_rule?: unknown;
        repeat_until?: unknown;
        day_part?: unknown;
      }[]
    ).map((b) => ({
      poolId: b.pool_id,
      source: b.block_source as 'manual' | 'setnayan_booking' | 'synced_calendar' | 'external_client',
      startDate: manilaDate(b.blocked_at),
      endDate: manilaDate(b.blocked_until),
      ...notAvailableFieldsOf(b),
    }));
    const dayStates = ((statesRes.data ?? []) as { pool_id: string | null; state_date: string; day_state: 'locked' | 'whitelist' }[]).map(
      (s) => ({ dayStateId: '', poolId: s.pool_id, stateDate: s.state_date, dayState: s.day_state, note: null }),
    );

    const month = buildCustomerCalendarMonth(pools, bookings, blocks, dayStates, [], date.slice(0, 7), todayIso);
    const day = month.days.find((d) => d.date === date) ?? null;
    // A shop with no schedule still has its typed closures: the builder only marks days per schedule, so a closure
    // on a schedule-less shop is read straight off the blocks.
    if (pools.length === 0) {
      const closed = blocks.some((b) => b.source !== 'external_client' && blockClosesDay(b, date));
      return threadDayAnswerOf({
        day: { state: closed ? 'blocked' : null, consumed: 0, capacity: 0 },
        hasSchedule: false,
      });
    }
    return threadDayAnswerOf({ day, hasSchedule: true });
  } catch {
    return null;
  }
}
