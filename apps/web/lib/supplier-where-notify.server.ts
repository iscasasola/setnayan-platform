import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import { logQueryError } from '@/lib/supabase/error-detect';
import { whereChangeNotice } from '@/lib/supplier-where';

/**
 * 📍 TELL A BOOKED SUPPLIER THAT WHERE THEY GO CHANGED (owner 2026-11-01, DECISION_LOG "MANY VENUES PER EVENT;
 * SUPPLIERS PICK THEIR CHAPTERS; COORDINATORS ARE EVERYWHERE"; plan §12 Step 4: "a change after booking sends the
 * supplier an in-app notice (no email), and the price never changes by itself").
 *
 * Called once per save of `set_supplier_where`, with the before/after it returned. The words — and whether anybody is
 * told at all (not booked → nobody; nothing changed → nobody) — are `whereChangeNotice`'s, so the rule is pure and
 * executed in `supplier-where.test.ts`. One in-app notice to the shop's owner (`supplier_where_changed`, NOT on the email
 * allowlist), opening their client page. The person who saved it is never told their own change. A supplier the couple
 * added by hand (no shop) has nobody to tell.
 *
 * Best-effort by contract: the Where is already written, and a failed notice must never undo it or throw into the row.
 * A refused read is LOGGED, never read as "nobody to tell".
 *
 * Admin client: the couple cannot read another shop's `vendor_profiles.user_id`.
 */
export async function notifySupplierWhereChanged(input: {
  eventId: string;
  /** `event_vendors.marketplace_vendor_id` — null for a supplier the couple added by hand. */
  shopId: string | null;
  booked: boolean;
  before: readonly string[] | null;
  after: readonly string[];
  afterNames: readonly string[];
  /** The in-house group's label ("Catering"), when the change was to one. */
  inHouse?: string | null;
  actorUserId: string;
}): Promise<'told' | 'nobody'> {
  try {
    if (!input.shopId) return 'nobody';
    const admin = createAdminClient();
    const [ownerRes, eventRes] = await Promise.all([
      admin.from('vendor_profiles').select('user_id').eq('vendor_profile_id', input.shopId).maybeSingle(),
      admin.from('events').select('display_name').eq('event_id', input.eventId).maybeSingle(),
    ]);
    if (ownerRes.error) {
      logQueryError('notifySupplierWhereChanged.owner', ownerRes.error, { eventId: input.eventId }, 'graceful_degrade');
      return 'nobody';
    }
    const userId = (ownerRes.data as { user_id: string | null } | null)?.user_id ?? null;
    if (!userId || userId === input.actorUserId) return 'nobody';
    const notice = whereChangeNotice({
      booked: input.booked,
      before: input.before,
      after: input.after,
      hostName: (eventRes.data as { display_name?: string | null } | null)?.display_name ?? '',
      afterNames: input.afterNames,
      inHouse: input.inHouse ?? null,
    });
    if (!notice) return 'nobody';
    await emitNotification({
      userId,
      type: 'supplier_where_changed',
      title: notice.title,
      body: notice.body,
      relatedUrl: `/vendor-dashboard/clients/${input.eventId}`,
      eventId: input.eventId,
    });
    return 'told';
  } catch (e) {
    console.error('[notifySupplierWhereChanged] best-effort notice failed:', e);
    return 'nobody';
  }
}
