import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { shopVerifiedNote, type ShopVerifiedNote } from '@/lib/findable-shop';

/**
 * 💬 Does the couple's chat with this shop carry "This shop is not yet verified by Setnayan"? DECISION_LOG
 * 2026-11-07 ruling (4), the chat half: *"When they chat the business. we will also message them that this shop is
 * not yet verified."* In-app only, never an email.
 *
 * Takes the ADMIN client: the couple's own RLS does not return an unverified shop's `vendor_profiles` row (the same
 * reason the thread's NAME comes from `readCoupleThreadSupplierNames`, not from this table). It reads three columns —
 * the state, the demo flag and `papers_current` — never the name, so nothing here can leak an unrevealed shop's identity.
 *
 * An unreadable row draws NOTHING (the line is a claim about the shop, never drawn from an absence), and the fault
 * is logged.
 *
 * Returns WHICH line (`shopVerifiedNote`): not verified · renewing its papers (a lapse after 30 March, owner 16 Nov
 * "11.yes") · nothing.
 */
export async function readThreadShopVerifiedNote(
  admin: SupabaseClient,
  vendorProfileId: string,
): Promise<ShopVerifiedNote> {
  const { data, error } = await admin
    .from('vendor_profiles')
    .select('verification_state, is_demo, papers_current')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  if (error) {
    logQueryError('readThreadShopVerifiedNote', error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
    return null;
  }
  return shopVerifiedNote(data);
}
