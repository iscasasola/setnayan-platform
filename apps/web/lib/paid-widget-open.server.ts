import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import type { PaidStoreTool } from '@/lib/supplier-store';
import type { Read } from '@/lib/cake-maker.server';

/**
 * 🧰 Is a paid widget OPEN for this shop — THE one answer (DECISION_LOG a02673ac, owner 23 Nov 2026): bought once in the
 * Toolkit AND on Plus, Pro or Ultra, from the database (`vendor_store_tool_open`, service role). The plan alone no
 * longer opens it, and neither does the admin's old open-to-all start date. A refused read is `unread`, never "open".
 * Read by the Cake Maker (editor, save, the couple's chat; via `readShopCakeToolOpen`), the Song bank (page, actions,
 * public set list).
 *
 * Its own small file on purpose: the Song bank's actions sit in the Maker's first-load walk (through the stay registry)
 * and the public shop page imports it, so it must pull in neither the Cake Maker's colour tables
 * (every-studio-colour-opens-the-one-picker § H) nor the Toolkit's badge and graph reads (the-shop-page-stays-cacheable § 5).
 */
export async function readShopSpecialToolOpen(
  admin: SupabaseClient,
  vendorProfileId: string,
  tool: PaidStoreTool,
  eventId: string | null = null,
): Promise<Read<boolean>> {
  try {
    const { data, error } = await admin.rpc('vendor_store_tool_open', { p_vendor_profile_id: vendorProfileId, p_tool: tool, p_event_id: eventId });
    if (error) {
      logQueryError('readShopSpecialToolOpen', error, { vendor_profile_id: vendorProfileId, tool }, 'graceful_degrade');
      return { status: 'unread' };
    }
    return { status: 'ok', data: data === true };
  } catch {
    return { status: 'unread' };
  }
}
