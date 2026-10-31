import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from './supabase/error-detect';
import { earliestTaggedBlock } from './coordinator-broadcasts';
import type { RosMetaMap } from './schedule-ros';
import type { TaggedMoment } from './booked-rows';

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
  const out = new Map<string, TaggedMoment>();
  if (vendorIds.length === 0) return out;
  const { data, error } = await supabase
    .from('event_schedule_blocks')
    .select('block_id, label, start_at, responsible_vendor_ids')
    .eq('event_id', eventId);
  if (error) {
    logQueryError('readBookedCallTimes', error, { event_id: eventId }, 'graceful_degrade');
    return null;
  }
  const rows = (data ?? []) as Array<{
    block_id: string;
    label: string;
    start_at: string | null;
    responsible_vendor_ids: string[] | null;
  }>;
  const blocks = rows.flatMap((r) => (r.start_at ? [{ block_id: r.block_id, label: r.label, start_at: r.start_at }] : []));
  const meta: RosMetaMap = new Map(
    rows.map((r) => [r.block_id, { responsible_party: null, responsible_vendor_ids: r.responsible_vendor_ids ?? [] }]),
  );
  for (const vendorId of new Set(vendorIds)) {
    const b = earliestTaggedBlock(blocks, meta, vendorId);
    if (b) out.set(vendorId, { startAt: b.start_at, label: b.label });
  }
  return out;
}
