import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { R2_BUCKETS } from '@/lib/r2';
import { parseR2Ref } from '@/lib/nsfw-screen';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { viewerRunsShop } from '@/lib/service-card-hides.server';
import { kindMonthLabel } from '@/lib/card-portfolio-albums';
import { supplierPageNoticeState } from '@/lib/supplier-page-notice';
import type { ServicePrivatePhoto, ServicePrivatePhotos } from '@/lib/couple-photo-share';

/** At most this many private album photos per card in one view (two screens of tiles). */
const PRIVATE_PER_CARD_MAX = 48;

/**
 * 📸 PHOTOS BY SERVICE — THE SHOP'S OWN VIEW (owner 2026-11-14, prototype frame "The supplier's own view"): when the
 * shop opens its own page, the service view also shows its PRIVATE event album (`vendor_papic_portfolio_photos`) for
 * the events that service's cards were booked on, marked "Only you". Couples never receive these: this is asked AFTER
 * the page (the shop page is cached), through the shop's door, and refused to anyone who does not run the shop.
 *
 *   · the events are the SAME (card, event) pairs as the card's portfolio (`card_portfolio_booked_events`, arm's length)
 *   · a photo the album hid (a honoured takedown) or never screened is left out
 *   · a photo already ON the page (its 7-day notice ran out) is left out here — it is drawn as a public photo already
 *   · "Your own shots taken at a couple's event" (`vendor_papic_captures`) stay OUT on purpose: the couple can take
 *     those down, and the shipped Collections already refuses them a page path (prototype's map card)
 *
 * 🔑 A refused read is `unread` — said in the view — never an empty album.
 */
export async function readServicePrivatePhotos(vendorProfileId: string, serviceKey: string): Promise<ServicePrivatePhotos> {
  if (!vendorProfileId || !serviceKey) return { status: 'not_owner' };
  if (!(await viewerRunsShop(vendorProfileId).catch(() => false))) return { status: 'not_owner' };
  const admin = createAdminClient();
  const cardsRes = await admin
    .from('vendor_services')
    .select('vendor_service_id')
    .eq('vendor_profile_id', vendorProfileId)
    .eq('category', serviceKey)
    .eq('is_active', true);
  if (cardsRes.error) {
    logQueryError('servicePrivate.cards', cardsRes.error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
    return { status: 'unread' };
  }
  const cardIds = ((cardsRes.data ?? []) as { vendor_service_id: string }[]).map((r) => r.vendor_service_id);
  if (cardIds.length === 0) return { status: 'ok', byCard: {} };

  const pairsRes = await admin.rpc('card_portfolio_booked_events', { p_service_ids: cardIds });
  if (pairsRes.error) {
    logQueryError('servicePrivate.pairs', pairsRes.error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
    return { status: 'unread' };
  }
  const cardsOfEvent = new Map<string, string[]>();
  for (const p of (pairsRes.data ?? []) as { vendor_service_id: string; event_id: string }[]) {
    cardsOfEvent.set(p.event_id, [...(cardsOfEvent.get(p.event_id) ?? []), p.vendor_service_id]);
  }
  const eventIds = [...cardsOfEvent.keys()];
  if (eventIds.length === 0) return { status: 'ok', byCard: {} };

  const [eventsRes, photosRes] = await Promise.all([
    admin.from('events').select('event_id, event_type, event_date').in('event_id', eventIds),
    admin
      .from('vendor_papic_portfolio_photos')
      .select('photo_id, event_id, r2_object_key, created_at')
      .eq('vendor_profile_id', vendorProfileId)
      .in('event_id', eventIds)
      .is('hidden_at', null)
      .eq('nsfw_checked', true)
      .order('created_at', { ascending: false }),
  ]);
  const err = eventsRes.error ?? photosRes.error;
  if (err) {
    logQueryError('servicePrivate.album', err, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
    return { status: 'unread' };
  }
  const photos = (photosRes.data ?? []) as { photo_id: string; event_id: string; r2_object_key: string; created_at: string }[];
  const noticesRes = photos.length
    ? await admin
        .from('supplier_page_photo_notices')
        .select('notice_id, photo_id, public_from, published_at, removed_at, removed_by')
        .eq('vendor_profile_id', vendorProfileId)
        .in('photo_id', photos.map((p) => p.photo_id))
    : { data: [], error: null };
  if (noticesRes.error) {
    logQueryError('servicePrivate.notices', noticesRes.error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
    return { status: 'unread' };
  }
  const noticeOf = new Map(
    ((noticesRes.data ?? []) as { notice_id: string; photo_id: string; public_from: string; published_at: string | null; removed_at: string | null; removed_by: string | null }[]).map(
      (n) => [n.photo_id, { state: supplierPageNoticeState(n), publicFrom: n.public_from }] as const,
    ),
  );
  const caption = new Map(
    ((eventsRes.data ?? []) as { event_id: string; event_type: string | null; event_date: string | null }[]).map((e) => [
      e.event_id,
      kindMonthLabel({ eventId: e.event_id, eventType: e.event_type, eventDate: e.event_date, venueName: null, isPrivate: true }),
    ]),
  );

  const byCard: Record<string, ServicePrivatePhoto[]> = {};
  for (const p of photos) {
    const notice = noticeOf.get(p.photo_id) ?? null;
    // Already up on the page: it is a public photo now, drawn with the others — not "Only you".
    if (notice?.state === 'on_page') continue;
    const cards = (cardsOfEvent.get(p.event_id) ?? []).filter((id) => (byCard[id]?.length ?? 0) < PRIVATE_PER_CARD_MAX);
    if (cards.length === 0) continue;
    // The album lives in the PUBLIC media bucket; the shared signer signs that bucket only (never a private one).
    const { key } = parseR2Ref(p.r2_object_key);
    const url = await displayUrlForStoredAsset(`r2://${R2_BUCKETS.media}/${key}`).catch((e) => {
      logQueryError('servicePrivate.sign', e, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
      return null;
    });
    if (!url) continue;
    const photo: ServicePrivatePhoto = { photoId: p.photo_id, url, caption: caption.get(p.event_id) ?? 'A booked event', notice };
    for (const id of cards) (byCard[id] ??= []).push(photo);
  }
  return { status: 'ok', byCard };
}
