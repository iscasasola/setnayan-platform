import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from './supabase/error-detect';
import { earliestTaggedBlock } from './coordinator-broadcasts';
import type { RosMetaMap } from './schedule-ros';
import type { TaggedMoment } from './booked-rows';
import {
  VENUE_CATEGORIES,
  WHERE_BOOKED_STATUSES,
  supplierWhere,
  whereChaptersFrom,
  type SupplierWhere,
  type WhereChapter,
} from './supplier-where';

/**
 * EVERY BOOKED SUPPLIER'S CALL TIME, IN ONE READ — for the Booked Team row's "Call time 8:00 AM · Ingress & setup ·
 * from your Schedule" (owner 2026-10-27: *"call times live in the Schedule"*; the approved final Suppliers design,
 * 2026-10-30).
 *
 * The Schedule's moments with the suppliers tagged on them (`responsible_vendor_ids`, P2's lens), folded by the ONE
 * rule every call-time reader uses (`earliestTaggedBlock`, lib/coordinator-broadcasts.ts). Tagging a supplier on a
 * moment in Booked › Schedule is what gives their Team row its call time; nothing here keeps a copy.
 *
 * Couple-scoped by RLS (the same rows the Schedule page reads).
 *
 * 🛑 `null` = THE READ WAS REFUSED. Not "no call times": a caller that turned it into an empty map would tell every
 * supplier row "No call time yet" on a day that has them.
 */
export async function readBookedCallTimes(
  supabase: SupabaseClient,
  eventId: string,
  vendorIds: readonly string[],
): Promise<Map<string, TaggedMoment> | null> {
  const read = await readBookedSchedule(supabase, eventId, vendorIds);
  return read === null ? null : read.callTimes;
}

/**
 * 📍 THE CALL TIMES AND THE CHAPTERS, FROM THE SAME ONE READ (owner 2026-11-01, "suppliers pick their chapters"): the
 * Team row's Where is the chapters (top-level blocks) whose `responsible_vendor_ids` hold the supplier
 * (`lib/supplier-where.ts`) — the same column the call time folds, so both come from one request. `null` = the read
 * was refused: neither the call time nor Where is known (never "no chapters").
 */
export async function readBookedSchedule(
  supabase: SupabaseClient,
  eventId: string,
  vendorIds: readonly string[],
): Promise<{ callTimes: Map<string, TaggedMoment>; chapters: WhereChapter[] } | null> {
  const out = new Map<string, TaggedMoment>();
  // Nobody booked: no row draws a call time or a Where, so nothing is asked.
  if (vendorIds.length === 0) return { callTimes: out, chapters: [] };
  const { data, error } = await supabase
    .from('event_schedule_blocks')
    .select('block_id, parent_block_id, label, start_at, location, responsible_vendor_ids, time_tba, block_type')
    .eq('event_id', eventId);
  if (error) {
    logQueryError('readBookedCallTimes', error, { event_id: eventId }, 'graceful_degrade');
    return null;
  }
  const rows = (data ?? []) as Array<{
    block_id: string;
    parent_block_id: string | null;
    label: string;
    start_at: string | null;
    location: string | null;
    responsible_vendor_ids: string[] | null;
    time_tba: boolean | null;
  }>;
  const chapters = whereChaptersFrom(rows);
  // `time_tba` travels: a supplier tagged on a Time-TBA chapter has NO call time from it (plan §3), never 12:00 AM —
  // nor from a MOMENT inside one (the flag is the chapter's; its moments sit on the same placeholder day).
  const tbaChapters = new Set(rows.filter((r) => !r.parent_block_id && r.time_tba === true).map((r) => r.block_id));
  const blocks = rows.flatMap((r) =>
    r.start_at
      ? [{ block_id: r.block_id, label: r.label, start_at: r.start_at, time_tba: r.time_tba === true || (r.parent_block_id !== null && tbaChapters.has(r.parent_block_id)) }]
      : [],
  );
  const meta: RosMetaMap = new Map(
    rows.map((r) => [r.block_id, { responsible_party: null, responsible_vendor_ids: r.responsible_vendor_ids ?? [] }]),
  );
  for (const vendorId of new Set(vendorIds)) {
    const b = earliestTaggedBlock(blocks, meta, vendorId);
    if (b) out.set(vendorId, { startAt: b.start_at, label: b.label });
  }
  return { callTimes: out, chapters };
}

/**
 * 📍 WHERE, ON THE QUOTE (owner 2026-11-01: *"The can set it even on quotation"*; plan: best set on the quote, since it
 * changes the price). The supplier whose shop sent this quote, on this event: their Where, from the same two facts the
 * Team row reads — the event's chapters with who is on each, and which bookings are venues (a chapter with no venue
 * typed takes the venue that picked it). Two reads, together.
 *
 *   none     this shop is not on the couple's list for the event yet — nothing to pick on
 *   unread   a read was refused — said, never drawn as "no chapters"
 *   ok       `where` as the Team row would draw it; `booked` keeps at least one chapter
 *
 * `client` is the couple's own session (RLS), or — for the supplier's own copy of the page — the admin client the page
 * already uses for the supplier side (a shop holds no row under the couple's policies).
 */
export async function readQuoteWhere(
  client: SupabaseClient,
  eventId: string,
  shopId: string,
): Promise<{ kind: 'none' } | { kind: 'unread' } | { kind: 'ok'; vendorId: string; booked: boolean; where: SupplierWhere }> {
  const [vendorsRes, blocksRes] = await Promise.all([
    client
      .from('event_vendors')
      .select('vendor_id, vendor_name, category, status, archived_at, marketplace_vendor_id')
      .eq('event_id', eventId),
    client
      .from('event_schedule_blocks')
      .select('block_id, parent_block_id, label, start_at, location, responsible_vendor_ids, time_tba, block_type')
      .eq('event_id', eventId),
  ]);
  if (vendorsRes.error || blocksRes.error) {
    logQueryError('readQuoteWhere', vendorsRes.error ?? blocksRes.error, { event_id: eventId }, 'graceful_degrade');
    return { kind: 'unread' };
  }
  type V = { vendor_id: string; vendor_name: string | null; category: string; status: string; archived_at: string | null; marketplace_vendor_id: string | null };
  const vendors = ((vendorsRes.data ?? []) as V[]).filter((v) => v.archived_at === null);
  const mine = vendors.find((v) => v.marketplace_vendor_id === shopId);
  if (!mine) return { kind: 'none' };
  const isBooked = (v: V) => WHERE_BOOKED_STATUSES.has(v.status);
  const venues = new Map(
    vendors.filter((v) => VENUE_CATEGORIES.has(v.category) && isBooked(v)).map((v) => [v.vendor_id, v.vendor_name ?? 'Venue'] as const),
  );
  const booked = isBooked(mine);
  return {
    kind: 'ok',
    vendorId: mine.vendor_id,
    booked,
    where: supplierWhere({
      vendorId: mine.vendor_id,
      groupId: null,
      category: mine.category,
      booked,
      chapters: whereChaptersFrom((blocksRes.data ?? []) as Parameters<typeof whereChaptersFrom>[0]),
      venues,
    }),
  };
}
