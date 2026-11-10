import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { BOOKED_EVENT_VENDOR_STATUSES } from '@/lib/vendor-funnel';
import { manilaDay } from '@/lib/analytics-growing';
import { blockClosesDay, NOT_AVAILABLE_COLUMNS, notAvailableShapeOf, notAvailableWindowFilter } from '@/lib/not-available';
import {
  cardSells,
  lostDates,
  monthsAhead,
  quoteStates,
  replyVsBooked,
  type CardSell,
  type LostDates,
  type MonthCount,
  type NewGraphs,
  type QuoteStates,
  type ReplyVsBooked,
} from '@/lib/vendor-analytics-graphs';

/**
 * 📈 THE FIVE NEW ANALYTICS GRAPHS' READS (Build 6 Lane I) — one function each, all started at once by
 * `readNewGraphs`. The words and buckets are `vendor-analytics-graphs.ts` (pure, tested).
 *
 * TWO CLIENTS, ON PURPOSE:
 *   · `session` — the shop's own RLS session, for the tables a shop may read of itself (`vendor_date_waitlist`,
 *     `vendor_calendar_blocks`, `vendor_calendar_day_states`, `chat_threads`, `vendor_schedule_pool_bookings`,
 *     `vendor_proposals` — each has a vendor-own SELECT policy).
 *   · `admin` — ONLY for `event_vendors`, which has NO vendor SELECT policy: on the session it answers zero rows and
 *     nothing throws (`app/vendor-dashboard/a-shop-cannot-read-its-own-booking.test.ts`). Scoped by the
 *     `vendorProfileId` the page resolved from the shop's own session — the sanctioned shape.
 *
 * 🔑 HONEST: any refused page → that graph is `null` ("Couldn’t load"), never a zero and never the Example picture.
 */

const PAGE = 1000;
const MAX_PAGES = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

type Row = Record<string, unknown>;

/** Every row of a paged read, or null when any page was refused (or the read was too big to bucket here). */
async function pagedRows(label: string, vendorProfileId: string, page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>): Promise<Row[] | null> {
  const out: Row[] = [];
  for (let p = 0; p < MAX_PAGES; p++) {
    const { data, error } = await page(p * PAGE, p * PAGE + PAGE - 1);
    if (error || !data) {
      logQueryError(`AnalyticsGraphs.${label}`, error ?? new Error('no rows returned'), { vendorProfileId }, 'graceful_degrade');
      return null;
    }
    out.push(...(data as Row[]));
    if (data.length < PAGE) return out;
  }
  logQueryError(`AnalyticsGraphs.${label}`, new Error('too many rows to bucket'), { vendorProfileId }, 'graceful_degrade');
  return null;
}

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

/** a · the asks you couldn't take in the last 12 months, each landed on closed or full. */
export async function readLostDates(session: SupabaseClient, vendorProfileId: string, nowMs: number): Promise<LostDates | null> {
  const since = new Date(nowMs - 365 * DAY_MS).toISOString();
  const asks = await pagedRows('lost.waitlist', vendorProfileId, (a, b) =>
    session
      .from('vendor_date_waitlist')
      .select('user_id, requested_date')
      .eq('vendor_profile_id', vendorProfileId)
      // `converted` = the couple got the date after all — not lost. Pending, notified and cancelled all asked for a
      // date that was not free.
      .in('status', ['pending', 'notified', 'cancelled'])
      .gte('created_at', since)
      .order('requested_date', { ascending: true })
      .range(a, b),
  );
  if (asks === null) return null;
  // One ask per couple and date (a couple who cancelled and re-joined is one ask).
  const seen = new Set<string>();
  const unique: { date: string }[] = [];
  for (const r of asks) {
    const d = str(r.requested_date)?.slice(0, 10);
    if (!d) continue;
    const k = `${str(r.user_id) ?? ''}|${d}`;
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push({ date: d });
  }
  if (unique.length === 0) return lostDates([], new Set());

  const first = unique[0]!.date;
  const last = unique[unique.length - 1]!.date;
  const startIso = new Date(Date.parse(`${first}T00:00:00+08:00`)).toISOString();
  const endIso = new Date(Date.parse(`${last}T00:00:00+08:00`) + DAY_MS).toISOString();
  const [blocks, locked] = await Promise.all([
    pagedRows('lost.blocks', vendorProfileId, (a, b) =>
      session
        .from('vendor_calendar_blocks')
        .select(`blocked_at, blocked_until, ${NOT_AVAILABLE_COLUMNS}`)
        .eq('vendor_profile_id', vendorProfileId)
        .in('block_source', ['manual', 'synced_calendar'])
        // Every block that can touch the asks: a one-off overlapping them, or a REPEAT that began on or before the
        // last one (its first day may be months back) — then the ONE rule (`lib/not-available.ts`) says which days it
        // closes. A part of the day (a morning) leaves the date open, so it is not "closed".
        .lt('blocked_at', endIso)
        .or(notAvailableWindowFilter(startIso))
        .order('blocked_at', { ascending: true })
        .range(a, b),
    ),
    pagedRows('lost.locked', vendorProfileId, (a, b) =>
      session
        .from('vendor_calendar_day_states')
        .select('state_date')
        .eq('vendor_profile_id', vendorProfileId)
        .eq('day_state', 'locked')
        .gte('state_date', first)
        .lte('state_date', last)
        .order('state_date', { ascending: true })
        .range(a, b),
    ),
  ]);
  if (blocks === null || locked === null) return null;

  const closed = new Set<string>();
  for (const r of locked) {
    const d = str(r.state_date)?.slice(0, 10);
    if (d) closed.add(d);
  }
  const askDates = [...new Set(unique.map((u) => u.date))];
  for (const r of blocks) {
    const at = str(r.blocked_at);
    const until = str(r.blocked_until);
    if (!at || !until) continue;
    const shape = notAvailableShapeOf({ ...r, blocked_at: at, blocked_until: until });
    for (const d of askDates) if (blockClosesDay(shape, d)) closed.add(d);
  }
  return lostDates(unique, closed);
}

/** b · asked and booked per service card, the last 12 months (event_vendors → admin). */
export async function readCardSells(
  admin: SupabaseClient,
  vendorProfileId: string,
  cards: readonly { serviceId: string; name: string }[],
  nowMs: number,
): Promise<CardSell[] | null> {
  const since = new Date(nowMs - 365 * DAY_MS).toISOString();
  const rows = await pagedRows('cardsell.event_vendors', vendorProfileId, (a, b) =>
    admin
      .from('event_vendors')
      .select('service_id, requested_service_ids, status')
      .eq('marketplace_vendor_id', vendorProfileId)
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .range(a, b),
  );
  if (rows === null) return null;
  const booked = new Set<string>(BOOKED_EVENT_VENDOR_STATUSES);
  return cardSells(
    cards,
    rows.map((r) => ({
      serviceId: str(r.service_id),
      requested: Array.isArray(r.requested_service_ids) ? (r.requested_service_ids as unknown[]).filter((x): x is string => typeof x === 'string') : [],
      booked: booked.has(str(r.status) ?? ''),
    })),
  );
}

/** c · first-reply time per inquiry, the last 12 months, against the events that booked you (event_vendors → admin). */
export async function readReplyVsBooked(session: SupabaseClient, admin: SupabaseClient, vendorProfileId: string, nowMs: number): Promise<ReplyVsBooked | null> {
  const since = new Date(nowMs - 365 * DAY_MS).toISOString();
  const [threads, bookedRows] = await Promise.all([
    pagedRows('replyvs.chat_threads', vendorProfileId, (a, b) =>
      session
        .from('chat_threads')
        .select('event_id, created_at, vendor_first_reply_at')
        .eq('vendor_profile_id', vendorProfileId)
        .gte('created_at', since)
        .order('created_at', { ascending: true })
        .range(a, b),
    ),
    pagedRows('replyvs.event_vendors', vendorProfileId, (a, b) =>
      admin
        .from('event_vendors')
        .select('event_id')
        .eq('marketplace_vendor_id', vendorProfileId)
        .in('status', BOOKED_EVENT_VENDOR_STATUSES as unknown as string[])
        .order('created_at', { ascending: true })
        .range(a, b),
    ),
  ]);
  if (threads === null || bookedRows === null) return null;
  const bookedEvents = new Set<string>();
  for (const r of bookedRows) {
    const e = str(r.event_id);
    if (e) bookedEvents.add(e);
  }
  return replyVsBooked(
    threads.map((t) => ({ eventId: str(t.event_id), createdAt: str(t.created_at) ?? '', firstReplyAt: str(t.vendor_first_reply_at) })),
    bookedEvents,
  );
}

/** d · live booked dates by month, this month and the next 11 (the rows `vendor_upcoming_load` counts). */
export async function readMonthsAhead(session: SupabaseClient, vendorProfileId: string, nowMs: number): Promise<MonthCount[] | null> {
  const today = manilaDay(nowMs);
  const first = `${today.slice(0, 7)}-01`;
  const y = Number(today.slice(0, 4)) + 1;
  const end = `${y}${today.slice(4, 7)}-01`;
  const rows = await pagedRows('slow.pool_bookings', vendorProfileId, (a, b) =>
    session
      .from('vendor_schedule_pool_bookings')
      .select('booked_date')
      .eq('vendor_profile_id', vendorProfileId)
      .is('released_at', null)
      .gte('booked_date', first)
      .lt('booked_date', end)
      .order('booked_date', { ascending: true })
      .range(a, b),
  );
  if (rows === null) return null;
  return monthsAhead(
    rows.map((r) => str(r.booked_date)).filter((d): d is string => d !== null),
    today,
  );
}

/** e · quotations sent in the last 12 months, by state. */
export async function readQuoteStates(session: SupabaseClient, vendorProfileId: string, nowMs: number): Promise<QuoteStates | null> {
  const since = new Date(nowMs - 365 * DAY_MS).toISOString();
  const rows = await pagedRows('quotes.vendor_proposals', vendorProfileId, (a, b) =>
    session
      .from('vendor_proposals')
      .select('status, valid_until, valid_until_legacy')
      .eq('vendor_profile_id', vendorProfileId)
      .in('status', ['sent', 'viewed', 'accepted', 'declined', 'expired'])
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .range(a, b),
  );
  if (rows === null) return null;
  return quoteStates(
    rows.map((r) => ({ status: str(r.status) ?? '', validUntil: str(r.valid_until), legacy: r.valid_until_legacy === true })),
    manilaDay(nowMs),
  );
}

/** All five at once; each degrades to its own `null`, never the page. */
export async function readNewGraphs(input: {
  session: SupabaseClient;
  admin: SupabaseClient;
  vendorProfileId: string;
  cards: readonly { serviceId: string; name: string }[];
  nowMs: number;
}): Promise<NewGraphs> {
  const { session, admin, vendorProfileId, cards, nowMs } = input;
  const soft = <T>(p: Promise<T | null>, label: string): Promise<T | null> =>
    p.catch((err: unknown) => {
      logQueryError(`AnalyticsGraphs.${label}`, err, { vendorProfileId }, 'graceful_degrade');
      return null;
    });
  const [lost, cardsell, replyvs, slow, quotes] = await Promise.all([
    soft(readLostDates(session, vendorProfileId, nowMs), 'lost'),
    soft(readCardSells(admin, vendorProfileId, cards, nowMs), 'cardsell'),
    soft(readReplyVsBooked(session, admin, vendorProfileId, nowMs), 'replyvs'),
    soft(readMonthsAhead(session, vendorProfileId, nowMs), 'slow'),
    soft(readQuoteStates(session, vendorProfileId, nowMs), 'quotes'),
  ]);
  return { lost, cardsell, replyvs, slow, quotes };
}
