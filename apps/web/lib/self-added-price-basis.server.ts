import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from './supabase/error-detect';
import { agreedCountFromRow, basisFromColumn, type SelfAddedPriceLines } from './self-added-price-basis';
import { followFromRows } from './claimed-per-guest-follow';

/**
 * THE SAVED CARD'S LINE for every self-added supplier priced per guest or per hour (v2): "₱162,000 · 120 guests
 * agreed". The total is the card's own (`v.totalCostPhp`); this says only the basis and the agreed count. One-price
 * suppliers get an entry too (the card's "After they claim" line). `null` = the read was refused — the cards then
 * draw as shipped, never a made-up line.
 *
 * 👥 AFTER THE CLAIM (20271343652941): a claimed booking the couple priced per guest gets an entry with `follow` — the
 * guests agreed and the guests it bills now (`event_vendor_guest_follow`, hosts-only) — so its card says why its total
 * moved. If that read is refused, the claimed cards get no entry (drawn as shipped), never a guessed count.
 */
export async function readSelfAddedPriceLines(
  supabase: SupabaseClient,
  eventId: string,
): Promise<SelfAddedPriceLines | null> {
  const { data, error } = await supabase
    .from('event_vendors')
    .select('vendor_id, pricing_basis, pax_quote_base, agreed_hours, marketplace_vendor_id')
    .eq('event_id', eventId)
    .or('marketplace_vendor_id.is.null,pricing_basis.eq.per_pax')
    .is('archived_at', null);
  if (error) {
    logQueryError('readSelfAddedPriceLines', error, { event_id: eventId }, 'graceful_degrade');
    return null;
  }
  const rows = (data ?? []) as Array<{
    vendor_id: string;
    pricing_basis: string | null;
    pax_quote_base: number | string | null;
    agreed_hours: number | string | null;
    marketplace_vendor_id: string | null;
  }>;
  const claimed = rows.filter((r) => r.marketplace_vendor_id != null && r.pricing_basis === 'per_pax');
  let follows: Map<string, { agreed_guests: number | null; billed_guests: number | null }> | null = new Map();
  if (claimed.length > 0) {
    const res = await supabase
      .from('event_vendor_guest_follow')
      .select('event_vendor_id, agreed_guests, billed_guests')
      .eq('event_id', eventId);
    if (res.error) {
      logQueryError('readSelfAddedPriceLines · event_vendor_guest_follow', res.error, { event_id: eventId }, 'graceful_degrade');
      follows = null;
    } else {
      for (const f of (res.data ?? []) as Array<{ event_vendor_id: string; agreed_guests: number | null; billed_guests: number | null }>) {
        follows.set(f.event_vendor_id, f);
      }
    }
  }
  const out: SelfAddedPriceLines = {};
  for (const r of rows) {
    const basis = basisFromColumn(r.pricing_basis);
    if (r.marketplace_vendor_id != null) {
      if (follows == null) continue;
      const follow = followFromRows(agreedCountFromRow('per_pax', r), follows.get(r.vendor_id));
      if (follow) out[r.vendor_id] = { basis: 'per_pax', count: follow.agreedGuests, follow };
      continue;
    }
    out[r.vendor_id] = { basis, count: agreedCountFromRow(basis, r) };
  }
  return out;
}
