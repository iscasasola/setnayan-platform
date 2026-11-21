import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { safeMonogramSvg } from '@/lib/monogram-svg-safe';
import { centreLogoOnItsInk } from '@/lib/logo-layers';
import { bespokeSvgToDataUri } from '@/lib/bespoke-monogram-shared';
import type { AreaLevel, DelegateArea } from '@/lib/delegate-areas';
import { theirEventRows, type TheirEventRow } from '@/lib/their-event';

/** One guest of the booking group, as `supplier_booking_group` hands it. */
export type GroupGuest = { name: string; rsvp: string | null; diet: string | null };

/**
 * The booking's one group (`supplier_booking_group`, migration 20271357741892): `null` = the read was REFUSED or
 * failed — said as "couldn't load", never as an empty group (reads-are-honest).
 */
export type BookingGroupRead =
  | { status: 'ok'; label: string; booked: number | null; guests: GroupGuest[] }
  | { status: 'no_group' | 'not_booked' | 'is_host' | 'not_signed_in' }
  | null;

export async function readBookingGroup(supabase: SupabaseClient, eventId: string): Promise<BookingGroupRead> {
  const { data, error } = await supabase.rpc('supplier_booking_group', { p_event_id: eventId });
  if (error) {
    logQueryError('readBookingGroup', error, { event_id: eventId }, 'graceful_degrade');
    return null;
  }
  const r = (data ?? null) as { status?: string; label?: string; booked?: number | null; guests?: GroupGuest[] } | null;
  if (!r?.status) return null;
  if (r.status === 'ok') {
    return { status: 'ok', label: r.label ?? 'Your group', booked: typeof r.booked === 'number' ? r.booked : null, guests: Array.isArray(r.guests) ? r.guests : [] };
  }
  if (r.status === 'no_group' || r.status === 'not_booked' || r.status === 'is_host' || r.status === 'not_signed_in') {
    return { status: r.status };
  }
  return null;
}

/** The Logo as a plain download (a data: URI of the event's own monogram, framed on its ink), or null. */
export function logoDownloadHref(customSvg: string | null | undefined): string | null {
  const svg = centreLogoOnItsInk(safeMonogramSvg(customSvg ?? null));
  return svg ? bespokeSvgToDataUri(svg) : null;
}

/**
 * Everything the "Their event" list needs, for a BOOKED supplier who is not the coordinator: the booked row's
 * category, the shop's leaf services, the seat's grants (handed in — the page already read them), the Logo, the seat
 * plan's size and the booking group. Fails soft per part: a refused category read draws everybody's three only.
 */
export async function readTheirEvent(
  supabase: SupabaseClient,
  i: {
    eventId: string;
    vendorProfileId: string;
    services: readonly string[] | null;
    grants: Partial<Record<DelegateArea, AreaLevel>>;
    monogramSvg: string | null;
    tables: number | null;
  },
): Promise<{ rows: TheirEventRow[]; group: BookingGroupRead }> {
  const admin = createAdminClient();
  const [rowRes, group] = await Promise.all([
    admin
      .from('event_vendors')
      .select('category')
      .eq('event_id', i.eventId)
      .eq('marketplace_vendor_id', i.vendorProfileId)
      .in('status', ['contracted', 'deposit_paid', 'delivered', 'complete'])
      .limit(1)
      .maybeSingle(),
    readBookingGroup(supabase, i.eventId),
  ]);
  if (rowRes.error) logQueryError('readTheirEvent.category', rowRes.error, { event_id: i.eventId }, 'graceful_degrade');
  const category = (rowRes.data as { category: string | null } | null)?.category ?? null;
  const rows = theirEventRows({
    eventId: i.eventId,
    category,
    services: i.services,
    grants: i.grants,
    logoHref: logoDownloadHref(i.monogramSvg),
    tables: i.tables,
    group: group?.status === 'ok' ? { label: group.label, count: group.guests.length } : null,
  });
  return { rows, group };
}
