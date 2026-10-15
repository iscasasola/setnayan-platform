import 'server-only';

/**
 * lib/supplier-today.server.ts — THE FEW READS THE SIMPLER TODAY ADDS, AND THE TWO IT TAKES AWAY.
 *
 * 🧮 TODAY IS THE BUSIEST SUPPLIER SCREEN AND IT MUST NOT GROW (owner, simpler supplier dashboard brief
 * 2026-10-14; production Supabase is on the free plan). Every read below is paid for by one that left:
 *
 *   −2  `readTodayShopRow` — ONE `vendor_profiles` row read for what three single-column reads used to ask
 *       one at a time: `verification_state` (first steps), `in_business_since_date` (the milestone) and
 *       `subscription_credit_php` + `tier_expires_at` (the credit about to expire).
 *   +1  `readTodaySchedules` — the shop's schedules (their names: "Main team", "Hall A") with the bookings
 *       from OUTSIDE and the days marked not available still ahead, embedded — ONE request.
 *   +1  `readTodayViews` — how many looked at the shop in the last 28 days ("How is business"). Skipped for a
 *       shop not yet approved: no couple can see it, so there is nothing to count.
 *   ±0  `readEventDayFacts` — only on an event day, and only in place of the money read the event-day card does
 *       not show (the page skips `fetchVendorEarningsSummary` then): the next moment and how many checked in.
 *
 * Every read fails SOFT and says so: a refused read comes back `null` (or `complete: false`), and the screen
 * then prints no number at all — never a 0 that is not true.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { formatWallClock } from '@/lib/schedule-datetime-local';
import { NOT_AVAILABLE_COLUMNS, notAvailableFieldsOf, notAvailableWindowFilter } from '@/lib/not-available';

export type TodayShopRow = {
  verified: boolean;
  businessStartDate: string | null;
  creditPhp: number;
  tierExpiresAt: string | null;
};

/** ONE row read in place of three. Null when refused — each reader then degrades exactly as it did alone. */
export async function readTodayShopRow(supabase: SupabaseClient, vendorProfileId: string): Promise<TodayShopRow | null> {
  try {
    const { data, error } = await supabase
      .from('vendor_profiles')
      .select('verification_state, in_business_since_date, subscription_credit_php, tier_expires_at')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle();
    if (error) {
      logQueryError('supplier-today: shop row', error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
      return null;
    }
    if (!data) return null;
    const row = data as {
      verification_state?: string | null;
      in_business_since_date?: string | null;
      subscription_credit_php?: number | string | null;
      tier_expires_at?: string | null;
    };
    return {
      verified: row.verification_state === 'verified',
      businessStartDate: row.in_business_since_date ?? null,
      creditPhp: Number(row.subscription_credit_php ?? 0),
      tierExpiresAt: row.tier_expires_at ?? null,
    };
  } catch {
    return null;
  }
}

export type TodayOutsideBooking = {
  blockId: string;
  /** `YYYY-MM-DD` (Manila) of the first day. */
  date: string;
  clientName: string;
  poolId: string;
};

export type TodaySchedules = {
  /** The shop's schedules, oldest first: id → the name the supplier gave it, and how many a day it takes. */
  pools: Array<{ id: string; name: string; cap?: number | null }>;
  /** Bookings from outside still ahead (today included). */
  outside: TodayOutsideBooking[];
  /** Days marked not available on one schedule, still ahead (first steps' step 4). */
  notAvailableAhead: number;
  /** False when the read was refused — Coming up then shows the Setnayan bookings alone, and says nothing false. */
  complete: boolean;
};

/** PH civil date of a stored timestamptz (blocks are written in +08:00). Asia/Manila has no DST. */
function phDate(iso: string): string {
  return new Date(new Date(iso).getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
}

/** A Not-available block with a day still to come: a one-off not over, or a repeat whose end (if any) is not past. */
function stillAhead(b: { blocked_until: string; repeat_rule?: unknown; repeat_until?: unknown; day_part?: unknown }, todayIso: string): boolean {
  const f = notAvailableFieldsOf(b);
  if (f.repeat === 'once') return phDate(b.blocked_until) >= todayIso;
  return f.repeatUntil === null || f.repeatUntil >= todayIso;
}

/**
 * The schedules and what sits on them, in ONE request: `vendor_schedule_pools` with its `vendor_calendar_blocks`
 * embedded (one foreign key between the two — `vendor_calendar_blocks.pool_id`), the blocks narrowed to the two
 * the supplier writes (`manual` · `external_client`) and to the ones not yet over.
 *
 * ⚠ A shop-wide day off (`pool_id` null) belongs to no schedule, so it is not in this read; only the first-steps
 * rail needs it, and it counts those itself (`fetchVendorFirstStepsState`).
 */
export async function readTodaySchedules(
  supabase: SupabaseClient,
  vendorProfileId: string,
  todayIso: string,
): Promise<TodaySchedules> {
  const empty: TodaySchedules = { pools: [], outside: [], notAvailableAhead: 0, complete: false };
  try {
    const { data, error } = await supabase
      .from('vendor_schedule_pools')
      .select(`pool_id, pool_label, calendar_name, daily_booking_capacity, vendor_calendar_blocks(block_id, block_source, blocked_at, blocked_until, client_name, ${NOT_AVAILABLE_COLUMNS})`)
      .eq('vendor_profile_id', vendorProfileId)
      .eq('is_active', true)
      .in('vendor_calendar_blocks.block_source', ['manual', 'external_client'])
      // 🪤 A repeat (every Sunday …) stores only its FIRST day, so `blocked_until >= today` alone dropped every repeat
      // that began before today (supplier batch walk, W2). The ONE rule's window: a one-off not over, or any repeat —
      // whose own end is checked below (`stillAhead`).
      .or(notAvailableWindowFilter(`${todayIso}T00:00:00+08:00`), { referencedTable: 'vendor_calendar_blocks' })
      .order('created_at', { ascending: true });
    if (error) {
      logQueryError('supplier-today: schedules', error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
      return empty;
    }
    const rows = (data ?? []) as Array<{
      pool_id: string;
      pool_label: string | null;
      calendar_name: string | null;
      daily_booking_capacity: number | null;
      vendor_calendar_blocks: Array<{
        block_id: string;
        block_source: string;
        blocked_at: string;
        blocked_until: string;
        client_name: string | null;
        repeat_rule?: unknown;
        repeat_until?: unknown;
        day_part?: unknown;
      }> | null;
    }>;
    const out: TodaySchedules = { pools: [], outside: [], notAvailableAhead: 0, complete: true };
    for (const p of rows) {
      out.pools.push({
        id: p.pool_id,
        name: (p.calendar_name ?? p.pool_label ?? '').trim() || 'Your schedule',
        cap: typeof p.daily_booking_capacity === 'number' ? p.daily_booking_capacity : null,
      });
      for (const b of p.vendor_calendar_blocks ?? []) {
        if (b.block_source === 'external_client') {
          // An outside booking that started before today and runs on is still "today".
          const first = phDate(b.blocked_at);
          out.outside.push({
            blockId: b.block_id,
            date: first < todayIso ? todayIso : first,
            clientName: (b.client_name ?? '').trim() || 'A booking from outside',
            poolId: p.pool_id,
          });
        } else if (b.block_source === 'manual' && stillAhead(b, todayIso)) {
          out.notAvailableAhead += 1;
        }
      }
    }
    out.outside.sort((a, b) => a.date.localeCompare(b.date));
    return out;
  } catch {
    return empty;
  }
}

/** Couples who opened the shop's page in the last 28 days. Null when the count did not come back. */
export async function readTodayViews(supabase: SupabaseClient, vendorProfileId: string, sinceIso: string): Promise<number | null> {
  try {
    const { count, error } = await supabase
      .from('vendor_profile_views')
      .select('view_id', { count: 'exact', head: true })
      .eq('vendor_profile_id', vendorProfileId)
      .gte('viewed_at', sinceIso);
    if (error || count == null) {
      if (error) logQueryError('supplier-today: views', error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
      return null;
    }
    return count;
  } catch {
    return null;
  }
}

export type EventDayFacts = {
  /** The first moment of the day ("live since 12:00"), wall clock — or null. */
  startedAt: string | null;
  /** The next moment still ahead: its time ("3:30") and what it is. */
  next: { time: string; label: string } | null;
  /** A few of the day's moments for "Also today › Schedule" ("12:00 Ceremony · 3:30 Reception"). */
  line: string | null;
  /** Guests checked in so far; null when the count did not come back. */
  checkedIn: number | null;
};

/** "12:00 PM" → "12:00" — the number's place holds the digits only (the prototype's "3:30"). */
function bareTime(iso: string): string {
  return formatWallClock(iso).replace(/\s?[AP]M$/, '');
}

/**
 * 🌑 THE EVENT-DAY NUMBERS — next moment · checked in (prototype moment "Event day"). Read with the admin client
 * for ONE event the page already proved is this shop's booking today (`upcoming[0]`, the room read).
 *
 * ⏱ `start_at` holds the venue's WALL CLOCK in a UTC column (`a-schedule-time-reads-the-same-everywhere.test.ts`),
 * so "now" is compared as Manila wall-clock digits, and every time is printed with `formatWallClock`.
 */
export async function readEventDayFacts(admin: SupabaseClient, eventId: string, nowMs: number): Promise<EventDayFacts> {
  const nowWall = new Date(nowMs + 8 * 3_600_000).toISOString();
  const [blocksRes, checkinsRes] = await Promise.all([
    admin
      .from('event_schedule_blocks')
      .select('label, start_at')
      .eq('event_id', eventId)
      .order('start_at', { ascending: true }),
    admin.from('guest_checkins').select('checkin_id', { count: 'exact', head: true }).eq('event_id', eventId),
  ]);
  if (blocksRes.error) logQueryError('supplier-today: event-day schedule', blocksRes.error, { event_id: eventId }, 'graceful_degrade');
  if (checkinsRes.error) logQueryError('supplier-today: event-day check-ins', checkinsRes.error, { event_id: eventId }, 'graceful_degrade');
  const blocks = ((blocksRes.data ?? []) as Array<{ label: string | null; start_at: string | null }>).filter(
    (b): b is { label: string | null; start_at: string } => Boolean(b.start_at),
  );
  const today = nowWall.slice(0, 10);
  const todays = blocks.filter((b) => b.start_at.slice(0, 10) === today);
  const started = todays.filter((b) => b.start_at <= nowWall);
  const ahead = todays.find((b) => b.start_at > nowWall) ?? null;
  return {
    startedAt: started[0] ? bareTime(started[0].start_at) : null,
    next: ahead ? { time: bareTime(ahead.start_at), label: (ahead.label ?? '').trim() || 'Next' } : null,
    line: todays.length
      ? todays
          .slice(0, 3)
          .map((b) => `${bareTime(b.start_at)} ${(b.label ?? '').trim()}`.trim())
          .join(' · ')
      : null,
    checkedIn: checkinsRes.error || checkinsRes.count == null ? null : checkinsRes.count,
  };
}
