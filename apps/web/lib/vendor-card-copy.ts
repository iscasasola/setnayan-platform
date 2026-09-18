import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  fetchBracketsByService,
  fetchDiscountsByService,
  fetchInclusionsByService,
  type VendorServiceRow,
} from './vendor-services';
import {
  bracketsToDrafts,
  discountsToDrafts,
  inclusionsToDrafts,
} from './vendor-service-drafts';
import { displayUrlForStoredAsset } from './uploads';
import { loadPackageDraft } from './package-draft-loader';
import {
  canonicalServiceForVendorCategory,
  rekeyCopiedItems,
} from './service-customization-draft';
import type { CanvasInitial } from './canvas-initial';

/**
 * "START FROM ONE OF YOUR CARDS" — reading a card back into the maker.
 *
 * Owner asked for this on 2026-07-28: *"can they copy what they created and
 * place it to the wizard to recreate it?"*, alongside the rule that
 * **events created for that card stay on that card**.
 *
 * ── WHAT IS COPIED, AND WHAT IS EMPHATICALLY NOT ────────────────────────────
 * COPIED: only what the vendor AUTHORED — the name, the price and its basis,
 * the pax brackets, inclusions, discounts, the Setnayan Exclusive, the crew
 * size, the lead-time rules, which coverage it sits in, which of their other
 * categories it comes with, and the media REFERENCES.
 *
 * NOT COPIED, and this is the owner's rule rather than an omission: anything
 * the card EARNED. Bookings, the Card Record, event assignments, its public id,
 * its address, its reviews — all of that belongs to the original card and stays
 * there. A copy is a blank card that starts out filled in; it is not a second
 * claim on the first one's history.
 *
 * 🖼 MEDIA IS REFERENCED, NEVER MOVED. The copy points at the SAME R2 objects.
 * Nothing is duplicated, nothing is re-uploaded, and above all nothing is
 * deleted — two cards naming one object is the normal state here, so a future
 * delete path must check for other referents before sweeping. (`logo_url`'s
 * `r2://` lesson applies to the display side: a raw ref in an <img> fails
 * SILENTLY, which is why the presigned URLs are resolved here and handed over
 * as a map.)
 *
 * ★ THE CUSTOMIZATION OPTIONS COME ACROSS TOO (SUP-40, 2026-09-18). They live
 * in a one-service `vendor_packages` row, and since migration 20271159436100
 * (2026-08-24) that row names its card in `vendor_service_id` — the link this
 * docblock used to say was missing. The package is found through THAT column
 * only, owner-scoped, read with the shipped `loadPackageDraft`, and re-keyed
 * (`rekeyCopiedItems`) so the new card carries no id of the old one's.
 * 🔒 STILL NEVER GUESSED. A card with no linked package — including every card
 * made before the link existed — comes across with no options, and the maker
 * says so. Matching by vendor + category + name would attach ANOTHER card's
 * options to this one. Two packages naming one card is not a state the maker
 * creates; if it happens, neither is picked. A failed read is reported as a
 * failed read, never as "no options".
 *
 * ── OWNER-SCOPED BY CONSTRUCTION ────────────────────────────────────────────
 * The source id is a query parameter, so it is hostile input. The read filters
 * on `vendor_profile_id` explicitly rather than leaning on RLS: the services
 * policy is the vendor's own rows, but leaning on a policy is how a widened one
 * later becomes a leak, and here a miss must simply degrade to a blank maker.
 * A foreign, deleted or malformed id therefore returns `null` — never an error
 * page, never someone else's card.
 */
export async function buildCanvasInitialFromCard(
  supabase: SupabaseClient,
  vendorProfileId: string,
  sourceServiceId: string,
  category: string,
): Promise<CanvasInitial | null> {
  if (!sourceServiceId || !/^[0-9a-fA-F-]{36}$/.test(sourceServiceId)) return null;

  const { data, error } = await supabase
    .from('vendor_services')
    .select(
      'vendor_service_id,category,title,pricing_basis,starting_price_php,base_pax,added_pax_price_php,per_pax_price_php,min_pax,hour_base_php,min_hours,extra_hour_php,crew_size,crew_meal_included,transport_included,transport_flat_fee_php,recommended_lead_time_months,last_minute_end_months,last_minute_surcharge_pct,includes_setnayan_gift,coverage_id,primary_photo_r2_key,showcase_video_r2_key,showcase_photo_r2_keys',
    )
    .eq('vendor_service_id', sourceServiceId)
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  // Supabase does not throw; it resolves with { error }. A refused read is not
  // an absent card, but for this feature both mean the same thing to the
  // vendor — the maker opens blank — so the branch is one line, not a guess.
  if (error || !data) return null;

  const src = data as Pick<
    VendorServiceRow,
    | 'vendor_service_id'
    | 'category'
    | 'title'
    | 'pricing_basis'
    | 'starting_price_php'
    | 'base_pax'
    | 'added_pax_price_php'
    | 'per_pax_price_php'
    | 'min_pax'
    | 'hour_base_php'
    | 'min_hours'
    | 'extra_hour_php'
    | 'crew_size'
    | 'crew_meal_included'
    | 'transport_included'
    | 'transport_flat_fee_php'
    | 'recommended_lead_time_months'
    | 'last_minute_end_months'
    | 'last_minute_surcharge_pct'
    | 'includes_setnayan_gift'
    | 'coverage_id'
    | 'primary_photo_r2_key'
    | 'showcase_video_r2_key'
    | 'showcase_photo_r2_keys'
  >;

  // ⚠ THE CATEGORY IS THE ROUTE'S, NOT THE SOURCE'S. A card's category decides
  // which editors render and which canonical service its lines sit under, and
  // the route already fixed it. Copying a Photography card into the Catering
  // route must therefore carry the WORDS and the MONEY, not the taxonomy — so a
  // cross-category copy is allowed and simply lands in the route's category.
  const sameCategory = src.category === category;

  const [discounts, inclusions, brackets, links, customization] = await Promise.all([
    fetchDiscountsByService(supabase, [sourceServiceId]),
    fetchInclusionsByService(supabase, [sourceServiceId]),
    fetchBracketsByService(supabase, [sourceServiceId]),
    supabase
      .from('vendor_service_links')
      .select('linked_canonical_service,display_order')
      .eq('vendor_service_id', sourceServiceId)
      .eq('vendor_profile_id', vendorProfileId)
      .order('display_order', { ascending: true }),
    copyCardOptions(supabase, vendorProfileId, sourceServiceId, category),
  ]);

  const mediaRefs = [
    src.primary_photo_r2_key,
    src.showcase_video_r2_key,
    ...(src.showcase_photo_r2_keys ?? []),
  ].filter((k): k is string => typeof k === 'string' && k.length > 0);

  // A stored ref is NOT a URL — an `r2://` value in an <img> fails silently.
  // Resolve every one here, and let a failure drop that thumbnail rather than
  // take the page down: an unpreviewable copy is still a usable copy.
  const displayUrls: Record<string, string> = {};
  await Promise.all(
    mediaRefs.map(async (ref) => {
      const url = await displayUrlForStoredAsset(ref).catch(() => null);
      if (url) displayUrls[ref] = url;
    }),
  );

  return {
    sourceServiceId,
    sourceTitle: src.title?.trim() || null,
    sourceWasOtherCategory: !sameCategory,
    title: src.title?.trim() || '',
    includesSetnayanGift: src.includes_setnayan_gift === true,
    coverageId: src.coverage_id != null ? String(src.coverage_id) : '',
    crewSize: src.crew_size != null ? String(src.crew_size) : '',
    recommendedLeadTimeMonths:
      src.recommended_lead_time_months != null
        ? String(src.recommended_lead_time_months)
        : '',
    lastMinuteEndMonths:
      src.last_minute_end_months != null ? String(src.last_minute_end_months) : '',
    lastMinuteSurchargePct:
      src.last_minute_surcharge_pct != null ? String(src.last_minute_surcharge_pct) : '',
    pricing: {
      pricing_basis: src.pricing_basis,
      starting_price_php: src.starting_price_php,
      base_pax: src.base_pax,
      added_pax_price_php: src.added_pax_price_php,
      per_pax_price_php: src.per_pax_price_php,
      min_pax: src.min_pax,
      hour_base_php: src.hour_base_php,
      min_hours: src.min_hours,
      extra_hour_php: src.extra_hour_php,
    },
    included: {
      crew_meal_included: src.crew_meal_included,
      transport_included: src.transport_included,
      transport_flat_fee_php: src.transport_flat_fee_php,
    },
    brackets: bracketsToDrafts(brackets.get(sourceServiceId) ?? []),
    discounts: discountsToDrafts(discounts.get(sourceServiceId) ?? []),
    inclusions: inclusionsToDrafts(inclusions.get(sourceServiceId) ?? []),
    linkedCategories: ((links.data ?? []) as { linked_canonical_service: string }[]).map(
      (l) => l.linked_canonical_service,
    ),
    coverPhotoR2Key: src.primary_photo_r2_key ?? null,
    showcaseVideoR2Key: src.showcase_video_r2_key ?? null,
    showcasePhotoR2Keys: src.showcase_photo_r2_keys ?? [],
    mediaDisplayUrls: displayUrls,
    customization,
  };
}

/**
 * The source card's ★ lines, through the link and nothing else.
 *
 * Owner-scoped on the package read (the vendor's own packages only) and again
 * inside `loadPackageDraft`, so a foreign card id cannot surface a foreign
 * package even if RLS were widened.
 */
async function copyCardOptions(
  supabase: SupabaseClient,
  vendorProfileId: string,
  sourceServiceId: string,
  category: string,
): Promise<CanvasInitial['customization']> {
  const { data, error } = await supabase
    .from('vendor_packages')
    .select('package_id')
    .eq('vendor_service_id', sourceServiceId)
    .eq('vendor_profile_id', vendorProfileId)
    .limit(2);
  if (error) return { status: 'unreadable' };
  const rows = (data ?? []) as { package_id: string }[];
  // Zero: nothing linked. Two: ambiguous — never pick one.
  if (rows.length !== 1) return { status: 'none_linked' };

  const read = await loadPackageDraft(supabase, vendorProfileId, rows[0]!.package_id);
  if (!read.ok) {
    return read.reason === 'read_failed' ? { status: 'unreadable' } : { status: 'none_linked' };
  }
  const items = read.loaded.draft.items;
  if (items.length === 0) return { status: 'none_linked' };
  return {
    status: 'copied',
    items: rekeyCopiedItems(items, canonicalServiceForVendorCategory(category)),
  };
}
