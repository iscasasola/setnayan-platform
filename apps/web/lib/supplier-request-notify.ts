import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * Tell a SHOP, in the app only, how Setnayan answered something it sent (admin supplier slice, owner 2026-10-28):
 * a name / web-address request (Approve · Decline + reason) or a flagged service-card photo (Needs a fix + reason).
 *
 * ⛔ IN-APP ONLY. `supplier_request_answered` is NOT on the email allowlist (lib/notification-emit.ts) — owner rule
 * 2026-10-11: no new emails without his word. Fail-soft: the decision already committed; a lost notice is logged,
 * never thrown back over a decision that happened.
 *
 * The recipient is read from the SHOP row (its owner), never from anything the form posted.
 */
export async function tellShopRequestAnswered(args: {
  vendorProfileId: string;
  title: string;
  body: string;
  relatedUrl?: string;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('vendor_profiles')
      .select('user_id')
      .eq('vendor_profile_id', args.vendorProfileId)
      .maybeSingle();
    if (error) {
      logQueryError('tellShopRequestAnswered', error, { vendor_profile_id: args.vendorProfileId }, 'graceful_degrade');
      return;
    }
    const owner = (data as { user_id?: string | null } | null)?.user_id;
    if (!owner) return;
    await emitNotification({
      userId: owner,
      type: 'supplier_request_answered',
      title: args.title,
      body: args.body,
      relatedUrl: args.relatedUrl ?? '/vendor-dashboard',
    });
  } catch (e) {
    console.error('[supplier-request-notify] failed', e);
  }
}
