import 'server-only';

import { Camera } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { getMenuLifecyclePhase } from '@/lib/day-of-mode';
import {
  SUPPLIER_BOOKED_STATUSES,
  SUPPLIER_WAY_IN_BLURB,
  supplierWayInLabel,
  supplierWayInState,
} from '@/lib/papic-supplier-way-in';
import { SourceRow } from './source-row';

/**
 * "Suppliers" — the way into the library a booked supplier's day-of shots take, saying the TRUE reason it
 * is or is not open. The reasoning, and why "Not open yet" was false, is in `lib/papic-supplier-way-in.ts`.
 *
 * Three reads, asked together, each mirroring the gate it reports on:
 *   · the `vendor_papic_capture` Data Privacy control — `isVendorPapicCaptureEnabled()`'s own read, but
 *     TRI-STATE: that helper turns a failed read into `false` ("closed"), which is right for a gate and
 *     wrong for a sentence; here a failed read is "Couldn't check";
 *   · the suppliers BOOKED on this event — `current_vendor_booked_event_ids()`'s own predicate;
 *   · the event's lifecycle phase — the capture route's own "the lane closes with the day" rule.
 *
 * ⚠ INERT, NO SHEET: nothing on this row is the couple's to set (hiding a supplier's photos is
 * `VendorMediaControls`, beside the gallery). A row with nothing behind it renders as a line.
 */
export async function SupplierWayInRow({ eventId }: { eventId: string }) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const [controlRes, bookedRes, eventRes] = await Promise.all([
    process.env.VENDOR_PAPIC_CAPTURE_ENABLED === '1'
      ? Promise.resolve({ data: { status: 'active' }, error: null })
      : admin.from('data_privacy_controls').select('status').eq('control_key', 'vendor_papic_capture').maybeSingle(),
    supabase
      .from('event_vendors')
      .select('vendor_id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .in('status', [...SUPPLIER_BOOKED_STATUSES])
      .not('marketplace_vendor_id', 'is', null),
    supabase
      .from('events')
      .select('event_date, event_end_date, timezone, cleared_at')
      .eq('event_id', eventId)
      .maybeSingle(),
  ]);

  if (controlRes.error) logQueryError('SupplierWayInRow.control', controlRes.error, { eventId }, 'graceful_degrade');
  if (bookedRes.error) logQueryError('SupplierWayInRow.booked', bookedRes.error, { eventId }, 'graceful_degrade');
  if (eventRes.error) logQueryError('SupplierWayInRow.event', eventRes.error, { eventId }, 'graceful_degrade');

  // An absent control row is not a refusal: the gate reads it as inactive, and so does this.
  const laneOn = controlRes.error ? null : (controlRes.data as { status?: string } | null)?.status === 'active';
  const booked = bookedRes.error ? null : (bookedRes.count ?? null);
  const ev = eventRes.error || !eventRes.data
    ? null
    : (eventRes.data as {
        event_date: string | null;
        event_end_date: string | null;
        timezone: string | null;
        cleared_at: string | null;
      });
  const over = ev
    ? getMenuLifecyclePhase(ev.event_date, ev.cleared_at, ev.timezone ?? undefined, undefined, ev.event_end_date) ===
      'after'
    : null;

  const state = supplierWayInState({ laneOn, booked, over });
  return (
    <SourceRow
      icon={<Camera aria-hidden className="h-4 w-4" strokeWidth={1.75} />}
      label="Suppliers"
      blurb={SUPPLIER_WAY_IN_BLURB}
      state={supplierWayInLabel(state)}
    />
  );
}
