import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

import { fetchShopVerified } from '@/lib/own-clients.server';
import type { PlusGate } from '@/lib/shop-plus-gate';

/**
 * 🪪 The ＋ gate's I/O half (pure half and the ruling: `lib/shop-plus-gate.ts`). Called by every SHOP-side ＋ send at
 * the server, before anything is written. `fetchShopVerified` is the ONE verification test (`shopIsVerified`).
 */
export async function shopPlusGate(client: SupabaseClient, vendorProfileId: string): Promise<PlusGate> {
  const verified = await fetchShopVerified(client, vendorProfileId);
  if (verified === null) return 'unknown';
  return verified ? 'open' : 'unverified';
}

/**
 * The same gate, from a chat thread. A thread with no shop (a group chat) has no shop to verify — open. A refused
 * thread read is 'unknown' (refuse), never 'open'.
 */
export async function threadPlusGate(client: SupabaseClient, threadId: string): Promise<PlusGate> {
  const { data, error } = await client
    .from('chat_threads')
    .select('vendor_profile_id')
    .eq('thread_id', threadId)
    .maybeSingle();
  if (error) {
    console.error('[supabase-error] shop-plus-gate: thread read', error);
    return 'unknown';
  }
  if (!data) return 'unknown';
  const shop = (data as { vendor_profile_id?: string | null }).vendor_profile_id ?? null;
  if (!shop) return 'open';
  return shopPlusGate(client, shop);
}
