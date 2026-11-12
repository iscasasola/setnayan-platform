import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { quoteFollowsGuestList, type FollowLine } from './quote-pax-follow';

/**
 * 👥💸 Does this shop's STANDING quote on the event (sent · viewed · accepted) follow the guest list? (Piece 1 · PR-2.)
 * Read by the supplier's thread page so the old added-guest surcharge is not proposed on top of it
 * (`fetchVendorPaxProposals`). null = the read was refused — the caller then proposes nothing, never a possible double
 * charge. Kept out of `lib/pax.ts`, which the shop page's tree imports: the shop page draws no quote.
 */
export async function standingQuoteFollowsGuestList(
  supabase: SupabaseClient,
  eventId: string,
  vendorProfileId: string,
): Promise<boolean | null> {
  const { data, error } = await supabase
    .from('vendor_proposals')
    .select('line_items')
    .eq('event_id', eventId)
    .eq('vendor_profile_id', vendorProfileId)
    .in('status', ['sent', 'viewed', 'accepted']);
  if (error) {
    console.error('[pax-follow] standing-quote read refused — no surcharge proposed:', error.message);
    return null;
  }
  return (data ?? []).some((p) => quoteFollowsGuestList(p.line_items as FollowLine[] | null));
}
