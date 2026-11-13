import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from './supabase/error-detect';
import { agreedCountFromRow, basisFromColumn, type SelfAddedPriceLines } from './self-added-price-basis';

/**
 * THE SAVED CARD'S LINE for every self-added supplier priced per guest or per hour (v2): "₱162,000 · 120 guests
 * agreed". The total is the card's own (`v.totalCostPhp`); this says only the basis and the agreed count. One-price
 * suppliers get an entry too (the card's "After they claim" line). `null` = the read was refused — the cards then
 * draw as shipped, never a made-up line.
 */
export async function readSelfAddedPriceLines(
  supabase: SupabaseClient,
  eventId: string,
): Promise<SelfAddedPriceLines | null> {
  const { data, error } = await supabase
    .from('event_vendors')
    .select('vendor_id, pricing_basis, pax_quote_base, agreed_hours')
    .eq('event_id', eventId)
    .is('marketplace_vendor_id', null)
    .is('archived_at', null);
  if (error) {
    logQueryError('readSelfAddedPriceLines', error, { event_id: eventId }, 'graceful_degrade');
    return null;
  }
  const out: SelfAddedPriceLines = {};
  for (const r of (data ?? []) as Array<{
    vendor_id: string;
    pricing_basis: string | null;
    pax_quote_base: number | string | null;
    agreed_hours: number | string | null;
  }>) {
    const basis = basisFromColumn(r.pricing_basis);
    out[r.vendor_id] = { basis, count: agreedCountFromRow(basis, r) };
  }
  return out;
}
