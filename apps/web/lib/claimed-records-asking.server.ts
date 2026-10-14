import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The events whose couple wrote THIS supplier down by hand, shared their link,
 * and whom the supplier has not agreed to yet — the "asking" a hand-typed record
 * shows on the supplier's calendar (owner 2026-10-10; counted by `askingDates`
 * in `lib/vendor-inquiry-dates.ts`).
 *
 * "By hand, through their link" is read from `vendor_invites`: a `claimed` row
 * whose `claimed_vendor_profile_id` is this shop. "Not agreed yet" is
 * `event_vendors.lock_request_state <> 'agreed'` — the value `vendor_agree_to_lock`
 * writes with the supplier's yes. A booking the couple marked by hand is NOT a
 * yes from the supplier, so it keeps asking.
 *
 * ⚠ ADMIN CLIENT, SCOPED BY THE CALLER'S OWN PROFILE ID — the same shape and
 * the same reason as the roster's own `event_vendors` read on the Customers
 * page: no policy on `event_vendors` admits a supplier. The id must come from
 * the caller's session; this function verifies nothing.
 *
 * A failed read is REPORTED (`error`), never returned as "nobody is asking".
 */
export async function readClaimedRecordEventsStillAsking(
  admin: SupabaseClient,
  vendorProfileId: string,
): Promise<{ eventIds: Set<string>; error: string | null }> {
  const eventIds = new Set<string>();
  if (!vendorProfileId) return { eventIds, error: null };

  const { data: invites, error: inviteErr } = await admin
    .from('vendor_invites')
    .select('vendor_id')
    .eq('claimed_vendor_profile_id', vendorProfileId)
    .eq('status', 'claimed')
    .not('vendor_id', 'is', null);
  if (inviteErr) return { eventIds, error: inviteErr.message };
  const vendorIds = [...new Set((invites ?? []).map((r) => r.vendor_id as string).filter(Boolean))];
  if (vendorIds.length === 0) return { eventIds, error: null };

  const { data: rows, error: rowErr } = await admin
    .from('event_vendors')
    .select('event_id, lock_request_state')
    .in('vendor_id', vendorIds)
    .eq('marketplace_vendor_id', vendorProfileId)
    .is('archived_at', null);
  if (rowErr) return { eventIds, error: rowErr.message };
  for (const r of (rows ?? []) as { event_id: string | null; lock_request_state: string | null }[]) {
    if (r.event_id && r.lock_request_state !== 'agreed') eventIds.add(r.event_id);
  }
  return { eventIds, error: null };
}
