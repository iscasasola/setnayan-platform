import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import {
  fetchBracketsByService,
  fetchDiscountsByService,
  fetchInclusionsByService,
} from '@/lib/vendor-services';
import { snapshotFromService, type Snapshot } from '@/lib/service-card-snapshot';
import {
  decideOfferedServiceCard,
  type OfferedServiceCardResult,
} from '@/lib/offered-service-card-decide';

export type {
  OfferedServiceCardData,
  OfferedServiceCardResult,
} from '@/lib/offered-service-card-decide';

/**
 * offered-service-card.ts — turns a chat message that OFFERS a service into the
 * supplier's own card: cover photograph, showcase clip, price, what is included.
 *
 * ── WHY IT EXISTS (owner 2026-09-09) ───────────────────────────────────────
 * *"the service card of each service still needs that photo/image/video."*
 * Offering a service used to record a thread_service_interests row and nothing
 * else, so the couple's entire evidence of the pitch was one word in the
 * "Inquiring about" chip row. A couple choosing between three caterers is
 * choosing on what they can see.
 *
 * 🔑 THE PRICE IS NOT COMPUTED HERE. `snapshotFromService` is the ONE
 * derivation of "from ₱X", of which discount wins, and of what counts as not
 * included — the vendor's own list and editor already render it. A second
 * implementation would agree on the day it was written and drift at the first
 * pricing change, and this one would drift toward the couple, who are deciding
 * on it. This module resolves media and refuses foreign services; it does not
 * do money.
 *
 * ⚠ THE NAME DOES NOT COME FROM THE SNAPSHOT, AND THAT IS DELIBERATE.
 * `readSnapshot` falls back to "Untitled service" when `title` is null — and
 * MEASURED ON PRODUCTION 2026-09-09, `title` is NULL on BOTH live services. The
 * chip row this card replaces falls back to `displayServiceLabel(category)`
 * instead, so a couple offered a live band reads "Live band". Taking the
 * snapshot's name would have made the new card read "Untitled service" and been
 * a REGRESSION on every service that ships today. The card and the chip resolve
 * the name through the same two-step so the two can never disagree.
 *
 * ⚠ MEDIA IS A STORED REF, NEVER A URL. `primary_photo_r2_key` and
 * `showcase_video_r2_key` hold `r2://bucket/key`. Put one in an <img src> and
 * it renders a broken glyph — the failure lib/uploads.ts's own docblock says
 * has already shipped four times. Every ref here goes through
 * `displayUrlForStoredAsset`, which hands back a short-lived presigned URL.
 */

type ServiceRow = {
  vendor_service_id: string;
  vendor_profile_id: string;
  title: string | null;
  category: string | null;
  pricing_basis: string | null;
  starting_price_php: number | null;
  per_pax_price_php: number | null;
  min_pax: number | null;
  hour_base_php: number | null;
  min_hours: number | null;
  extra_hour_php: number | null;
  crew_meal_included: boolean | null;
  transport_included: boolean | null;
  transport_flat_fee_php: number | null;
  exclusive_perk_text: string | null;
  primary_photo_r2_key: string | null;
  showcase_video_r2_key: string | null;
};

const SERVICE_COLS =
  'vendor_service_id,vendor_profile_id,title,category,pricing_basis,starting_price_php,' +
  'per_pax_price_php,min_pax,hour_base_php,min_hours,extra_hour_php,crew_meal_included,' +
  'transport_included,transport_flat_fee_php,exclusive_perk_text,primary_photo_r2_key,' +
  'showcase_video_r2_key';


/**
 * The card for ONE offer message, resolved for THIS viewer.
 *
 * 🔑 MEMBERSHIP IS PROVED BY THE FIRST READ, NOT ASSERTED AFTER IT. The message
 * is read through the caller's own RLS-scoped client, and the chat_messages
 * SELECT policy admits only the two parties to that thread. A stranger's read
 * returns no row and leaves here as `not_found`; there is no branch in which a
 * non-party reaches the media below.
 *
 * 🔑 AND THE SERVICE MUST BELONG TO THIS THREAD'S SUPPLIER. `authenticated`
 * holds INSERT on `offered_service_id` (it has to — the vendor writes the row
 * under their own session), so a COUPLE can post a message naming ANY service
 * id, including a rival supplier's. RLS cannot refuse that: it is row-level,
 * never value-level. This comparison is the whole refusal. Deleting it turns
 * any thread into a viewer for arbitrary suppliers' private media.
 */
export async function resolveOfferedServiceCard(
  supabase: SupabaseClient,
  messageId: string,
): Promise<OfferedServiceCardResult> {
  if (!messageId) return { status: 'not_found' };

  const { data: msg, error: msgError } = await supabase
    .from('chat_messages')
    .select('message_id,vendor_profile_id,offered_service_id')
    .eq('message_id', messageId)
    .maybeSingle();
  // A refusal and an absence are DIFFERENT answers and this app renders them
  // identically unless they are separated here.
  if (msgError) {
    console.error('[offered-service-card] message read refused', msgError);
    return { status: 'error' };
  }
  if (!msg) return { status: 'not_found' };

  const row = msg as {
    vendor_profile_id: string;
    offered_service_id: string | null;
  };
  if (!row.offered_service_id) return { status: 'not_found' };

  // The service itself is read with the admin client on purpose: a COUPLE holds
  // no RLS read on vendor_services, and the fields below are exactly the ones
  // the supplier already publishes to them on the shop page. The ownership
  // comparison two lines down is what keeps that from being a leak.
  const admin = createAdminClient();
  const { data: svcData, error: svcError } = await admin
    .from('vendor_services')
    .select(SERVICE_COLS)
    .eq('vendor_service_id', row.offered_service_id)
    .maybeSingle();
  if (svcError) {
    console.error('[offered-service-card] service read failed', svcError);
    return { status: 'error' };
  }
  if (!svcData) return { status: 'not_found' };
  const svc = svcData as unknown as ServiceRow;

  if (svc.vendor_profile_id !== row.vendor_profile_id) {
    // Not an error the viewer caused — a message naming a service that is not
    // this conversation's supplier's. Nothing renders and nothing is said.
    // decideOfferedServiceCard refuses it again below; this early exit only
    // avoids reading and SIGNING media we are about to throw away.
    console.warn(
      '[offered-service-card] refused a service outside the thread vendor',
      { message_id: messageId },
    );
    return { status: 'not_found' };
  }

  const [discounts, inclusions, brackets] = await Promise.all([
    fetchDiscountsByService(admin, [svc.vendor_service_id]),
    fetchInclusionsByService(admin, [svc.vendor_service_id]),
    fetchBracketsByService(admin, [svc.vendor_service_id]),
  ]);

  const snapshot: Snapshot = snapshotFromService(svc, {
    discounts: discounts.get(svc.vendor_service_id) ?? [],
    inclusions: inclusions.get(svc.vendor_service_id) ?? [],
    brackets: brackets.get(svc.vendor_service_id) ?? [],
  });

  // Two refs, signed in parallel — each is its own round trip on the AWS SDK.
  const [coverUrl, clipUrl] = await Promise.all([
    displayUrlForStoredAsset(svc.primary_photo_r2_key),
    displayUrlForStoredAsset(svc.showcase_video_r2_key),
  ]);

  return decideOfferedServiceCard({
    threadVendorProfileId: row.vendor_profile_id,
    serviceVendorProfileId: svc.vendor_profile_id,
    title: svc.title,
    category: svc.category,
    snapshot,
    coverUrl,
    clipUrl,
    serviceId: svc.vendor_service_id,
  });
}
