import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { chatHostsFrom, type ChatHost } from '@/lib/chat-hosts';
import { SUPPLIER_STRIP_ROLE } from '@/lib/chat-members';

/**
 * 👥 WHO THE COUPLE'S PICKED SUPPLIER CHAT SHOWS IN ITS STRIP (Supplier Build 3 · Lane A): the event's hosts
 * (`event_chat_hosts`, service-role only) with the SHOP in front — the strip's order is Supplier · coordinator(s) · You ·
 * the other hosts (`stripOrder`).
 *
 * The shop's face needs only the shop OWNER's user id (so presence and "Message privately" address a person); it is
 * read here by id and NOTHING else — the shop's NAME is the caller's `shopLabel`, which comes from the one honest
 * supplier-name reader (`readCoupleThreadSupplierNames`), never from `vendor_profiles`.
 *
 * NULL = the hosts read was refused (the strip says "Couldn't load", never an empty chat). A refused owner-id read keeps
 * the hosts and drops only the shop's face.
 *
 * TODO(Build 3 · Lane B): replace the event-wide hosts with Lane B's THREAD-scoped members read.
 */
export async function readCoupleChatStripPeople(
  admin: SupabaseClient,
  opts: { eventId: string; vendorProfileId: string; viewerId: string; shopLabel: Promise<string> | string },
): Promise<ChatHost[] | null> {
  try {
    const [res, shop, label] = await Promise.all([
      admin.rpc('event_chat_hosts', { p_event_id: opts.eventId }),
      admin.from('vendor_profiles').select('user_id').eq('vendor_profile_id', opts.vendorProfileId).maybeSingle(),
      opts.shopLabel,
    ]);
    if (res.error) {
      logQueryError('coupleThread.chatHosts', res.error, { eventId: opts.eventId }, 'graceful_degrade');
      return null;
    }
    const hosts = chatHostsFrom(res.data);
    if (hosts === null) return null;
    if (shop.error) {
      logQueryError('coupleThread.chatShopOwner', shop.error, { vendorProfileId: opts.vendorProfileId }, 'graceful_degrade');
    }
    const shopUser = (shop.data as { user_id?: string | null } | null)?.user_id ?? null;
    // 🏪 The shop stays in front EVEN WHEN ITS OWNER IS YOU (owner, 11 Nov: "It should be the shop and then you") — one
    // login can own the shop and host this event; `stripOrder` then draws the shop's face and "You" as the host.
    return shopUser
      ? [{ userId: shopUser, firstName: label, name: label, role: SUPPLIER_STRIP_ROLE, label: null }, ...hosts]
      : hosts;
  } catch {
    return null;
  }
}
