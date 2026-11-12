import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from './supabase/error-detect';
import {
  basisFromColumn,
  parsePriceTerms,
  selfAddedCardLine,
  type PriceTerms,
  type SelfAddedPriceLines,
} from './self-added-price-basis';

/**
 * The two numbers a self-added supplier's rate multiplies — `get_self_added_price_terms` under the CALLER's session
 * (the couple; it refuses anyone else). `'unread'` = refused or malformed — said, never turned into 0.
 */
export async function readSelfAddedPriceTerms(
  supabase: SupabaseClient,
  eventId: string,
  eventVendorId: string | null,
): Promise<PriceTerms | 'unread'> {
  const { data, error } = await supabase.rpc('get_self_added_price_terms', {
    p_event_id: eventId,
    p_event_vendor_id: eventVendorId,
  });
  if (error) {
    logQueryError('readSelfAddedPriceTerms', error, { event_id: eventId }, 'graceful_degrade');
    return 'unread';
  }
  return parsePriceTerms(data) ?? 'unread';
}

/**
 * THE SAVED CARD'S LINE for every self-added supplier priced per guest or per hour (prototype state 7):
 * "₱1,350 per guest · 120 counted · ₱162,000". One-price suppliers get no entry (their card is as shipped).
 * The total itself is the card's own (`v.totalCostPhp`); this says only the rate, the count, and whether a total
 * may be drawn. `null` = the facts could not be read — the cards then draw as shipped, never a made-up line.
 */
export async function readSelfAddedPriceLines(
  supabase: SupabaseClient,
  eventId: string,
): Promise<SelfAddedPriceLines | null> {
  const { data, error } = await supabase
    .from('event_vendors')
    .select('vendor_id, pricing_basis, pricing_rate_php')
    .eq('event_id', eventId)
    .is('marketplace_vendor_id', null)
    .is('archived_at', null)
    .not('pricing_basis', 'is', null);
  if (error) {
    logQueryError('readSelfAddedPriceLines', error, { event_id: eventId }, 'graceful_degrade');
    return null;
  }
  const rows = (data ?? []) as Array<{
    vendor_id: string;
    pricing_basis: string | null;
    pricing_rate_php: number | string | null;
  }>;
  const out: SelfAddedPriceLines = {};
  await Promise.all(
    rows.map(async (r) => {
      const terms = await readSelfAddedPriceTerms(supabase, eventId, r.vendor_id);
      const rate = r.pricing_rate_php == null ? null : Number(r.pricing_rate_php);
      const line = selfAddedCardLine({
        basis: basisFromColumn(r.pricing_basis),
        ratePhp: rate != null && Number.isFinite(rate) && rate > 0 ? rate : null,
        terms,
      });
      if (line) out[r.vendor_id] = line;
    }),
  );
  return out;
}
