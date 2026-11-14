import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { fetchVendorPoolBookings } from '@/lib/vendor-schedule';
import { loadVendorFeaturedStories, type VendorFeaturedStory } from '@/lib/realstories-vendor';
import { readOverdueTopUpEventIds } from '@/lib/booking-fee-top-up.server';
import { manilaToday } from '@/lib/std-views';
import { shopPageGate, type ShopPageGateRow } from '@/lib/own-shop-preview';
import { effectiveSeoTier } from '@/lib/vendor-seo-tier';
import { displayServiceLabel } from '@/lib/vendors';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { hasStoryPages } from '@/lib/ultra-story-pages';

/**
 * ULTRA STORY PAGES — the reads (owner 2026-11-14, SIMPLER SUPPLIER PLANS item 8; pure half: `lib/ultra-story-pages.ts`).
 *
 * 🔒 THE PAGE SHOWS NOTHING THE PUBLISHED STORY DOES NOT ALREADY SHOW, plus the shop's own words. Every fact below is
 * read through a gate that already exists:
 *   · WHICH events — the shop's PAID bookings (`fetchVendorPoolBookings`, never the agreed-but-unpaid room read; the
 *     shop page's own ⛔ rule), minus the events whose booking-fee top-up is overdue (`readOverdueTopUpEventIds`, the
 *     same "unlisted" set the shop page leaves out), then the public-showcase gate (`loadVendorFeaturedStories`:
 *     the host's consent, a public slug, past the 30-day wait). A private or unpublished event never resolves.
 *   · The names, place and month — exactly the story card's own fields (`VendorFeaturedStory`), nothing more.
 *   · The photos — the shop's OWN media that the host ACCEPTED onto their published story (`editorial_vendor_media`,
 *     clean · approved · not hidden · still the recommended pick), the same filters `app/[slug]/_components/editorial/
 *     data.ts` reads with. Nothing the couple did not choose to show.
 *   · What it did — the booked card's title and kind (`event_vendors.service_id` → `vendor_services`), no price.
 *   · The review — the one the couple already left this shop for this event, unless it was voided as fraud.
 *   · "In our words" — `vendor_event_story_notes`, the one new fact, written by the shop.
 * And the page opens only while the shop is on Ultra (EFFECTIVE tier — a lapsed Ultra reads as Free) and its page is
 * public (`shopPageGate`). Every miss is the not-found page, which never says why.
 */

export type ShopStoryPhoto = { url: string; caption: string | null };

export type ShopStoryPage = {
  shop: { vendorProfileId: string; name: string; slug: string; kind: string | null };
  story: VendorFeaturedStory;
  photos: ShopStoryPhoto[];
  /** The booked card — its title (the shop's own words) and kind. Null when the booking names no card. */
  work: { title: string; kind: string | null } | null;
  note: string | null;
  review: { stars: number | null; body: string | null } | null;
};

const SHOP_COLS =
  'vendor_profile_id, business_name, business_slug, services, public_visibility, verification_state, next_renewal_due_at, is_demo, self_published_at, name_revealed_at, screen_name, tier_state, tier_expires_at';

type ShopRow = {
  vendor_profile_id: string;
  business_name: string | null;
  business_slug: string | null;
  services: string[] | null;
  tier_state: string | null;
  tier_expires_at: string | null;
} & Record<string, unknown>;

/** The shop's published-story events — the shop page's own set, before it is cut to three. */
export async function publishedStoriesOfShop(
  admin: SupabaseClient,
  vendorProfileId: string,
): Promise<{ stories: VendorFeaturedStory[]; eventVendorByEvent: Map<string, string | null> }> {
  const [bookings, unlisted] = await Promise.all([
    fetchVendorPoolBookings(admin, vendorProfileId),
    readOverdueTopUpEventIds(vendorProfileId, manilaToday()).catch(() => new Set<string>()),
  ]);
  const eventVendorByEvent = new Map<string, string | null>();
  for (const b of bookings) if (!eventVendorByEvent.has(b.eventId)) eventVendorByEvent.set(b.eventId, b.eventVendorId ?? null);
  const stories = await loadVendorFeaturedStories(bookings.map((b) => b.eventId).filter((id) => !unlisted.has(id)));
  return { stories, eventVendorByEvent };
}

export async function loadShopStoryPage(
  shopSlug: string,
  eventSlug: string,
): Promise<{ kind: 'missing' } | { kind: 'ok'; page: ShopStoryPage }> {
  if (!shopSlug || !eventSlug || eventSlug.length > 200) return { kind: 'missing' };
  let admin: SupabaseClient;
  try {
    admin = createAdminClient();
  } catch {
    return { kind: 'missing' };
  }

  const shopRead = await admin.from('vendor_profiles').select(SHOP_COLS).ilike('business_slug', shopSlug).maybeSingle();
  if (shopRead.error) logQueryError('loadShopStoryPage.shop', shopRead.error, { shopSlug }, 'graceful_degrade');
  const shop = shopRead.data as ShopRow | null;
  if (!shop || !shop.business_slug) return { kind: 'missing' };
  if (shopPageGate(shop as ShopPageGateRow, { isTeam: false, adminDemoMode: false }).open !== 'public') return { kind: 'missing' };
  if (!hasStoryPages(effectiveSeoTier({ tier_state: shop.tier_state, tier_expires_at: shop.tier_expires_at }))) {
    return { kind: 'missing' };
  }
  const vendorProfileId = shop.vendor_profile_id;

  let stories: VendorFeaturedStory[];
  let eventVendorByEvent: Map<string, string | null>;
  try {
    ({ stories, eventVendorByEvent } = await publishedStoriesOfShop(admin, vendorProfileId));
  } catch (err) {
    logQueryError('loadShopStoryPage.stories', err, { vendorProfileId }, 'graceful_degrade');
    return { kind: 'missing' };
  }
  const story = stories.find((s) => s.slug.toLowerCase() === eventSlug.toLowerCase());
  if (!story) return { kind: 'missing' };
  const eventId = story.eventId;
  const eventVendorId = eventVendorByEvent.get(eventId) ?? null;

  const [mediaRead, noteRead, reviewRead, bookingRead] = await Promise.all([
    admin
      .from('editorial_vendor_media')
      .select('event_vendor_id, media_type, still_r2_key, caption, sort_order')
      .eq('event_id', eventId)
      .eq('vendor_profile_id', vendorProfileId)
      .eq('moderation_state', 'clean')
      .eq('status', 'approved')
      .eq('hidden_by_couple', false)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(24),
    admin
      .from('vendor_event_story_notes')
      .select('body')
      .eq('vendor_profile_id', vendorProfileId)
      .eq('event_id', eventId)
      .maybeSingle(),
    admin
      .from('vendor_reviews')
      .select('rating_overall, body, voided_by_fraud')
      .eq('vendor_profile_id', vendorProfileId)
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    eventVendorId
      ? admin
          .from('event_vendors')
          .select('vendor_id, service_id, category, selection_match_rank')
          .eq('vendor_id', eventVendorId)
          .eq('event_id', eventId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (mediaRead.error) logQueryError('loadShopStoryPage.media', mediaRead.error, { eventId }, 'graceful_degrade');
  if (noteRead.error) logQueryError('loadShopStoryPage.note', noteRead.error, { eventId }, 'graceful_degrade');
  if (reviewRead.error) logQueryError('loadShopStoryPage.review', reviewRead.error, { eventId }, 'graceful_degrade');
  if (bookingRead.error) logQueryError('loadShopStoryPage.booking', bookingRead.error, { eventId }, 'graceful_degrade');

  // The photos: only while their booking row is still the host's recommended pick (the editorial's own live check).
  const booking = bookingRead.data as { vendor_id: string; service_id: string | null; category: string | null; selection_match_rank: number | null } | null;
  const recommended = new Set<string>();
  const mediaRows = (mediaRead.data ?? []) as Array<{ event_vendor_id: string | null; still_r2_key: string | null; caption: string | null }>;
  const evIds = Array.from(new Set(mediaRows.map((r) => r.event_vendor_id).filter((v): v is string => !!v)));
  if (evIds.length > 0) {
    const { data, error } = await admin.from('event_vendors').select('vendor_id').in('vendor_id', evIds).eq('selection_match_rank', 1);
    if (error) logQueryError('loadShopStoryPage.recommended', error, { eventId }, 'graceful_degrade');
    for (const r of (data ?? []) as Array<{ vendor_id: string }>) recommended.add(r.vendor_id);
  }
  const photos: ShopStoryPhoto[] = [];
  for (const r of mediaRows) {
    if (!r.event_vendor_id || !recommended.has(r.event_vendor_id)) continue;
    const url = await displayUrlForStoredAsset(r.still_r2_key);
    if (url) photos.push({ url, caption: r.caption?.trim() || null });
  }

  let work: ShopStoryPage['work'] = null;
  if (booking?.service_id) {
    const { data, error } = await admin
      .from('vendor_services')
      .select('title, category')
      .eq('vendor_service_id', booking.service_id)
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle();
    if (error) logQueryError('loadShopStoryPage.card', error, { eventId }, 'graceful_degrade');
    const card = data as { title: string | null; category: string | null } | null;
    const kind = card?.category ? displayServiceLabel(card.category) : booking.category ? displayServiceLabel(booking.category) : null;
    if (card?.title?.trim()) work = { title: card.title.trim(), kind };
    else if (kind) work = { title: kind, kind: null };
  }

  const reviewRow = reviewRead.data as { rating_overall: number | null; body: string | null; voided_by_fraud: boolean | null } | null;
  const review =
    reviewRow && reviewRow.voided_by_fraud !== true
      ? { stars: reviewRow.rating_overall ?? null, body: reviewRow.body?.trim() || null }
      : null;

  const services = Array.isArray(shop.services) ? shop.services : [];
  return {
    kind: 'ok',
    page: {
      shop: {
        vendorProfileId,
        name: shop.business_name?.trim() || 'This shop',
        slug: shop.business_slug,
        kind: services[0] ? displayServiceLabel(services[0]) : null,
      },
      story,
      photos,
      work,
      note: (noteRead.data as { body: string } | null)?.body ?? null,
      review,
    },
  };
}
