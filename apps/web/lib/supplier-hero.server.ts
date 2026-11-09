import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getTaxonomy } from '@/lib/taxonomy-db';
import { displayUrlForCatalogueArt, displayUrlForStoredAsset } from '@/lib/uploads';
import { logQueryError } from '@/lib/supabase/error-detect';
import { HERO_PLACEHOLDER_FILE, placeholderRefs } from '@/lib/supplier-hero';

/**
 * 🖼 The reads behind the supplier hero (`lib/supplier-hero.ts` decides; this only fetches). Every read is
 * best-effort and HONEST: a failed view read is `null` (Today then shows the latest photo — the same picture a shop
 * with no views gets, said by its caption as "Latest", never "Most viewed · 0 views").
 */

export type HeroPicture = { url: string; kind: 'photo' } | { url: string; kind: 'placeholder' };

/** Per-photo views for one shop — `null` when the read failed (or the table is not there yet). */
export async function readPortfolioPhotoViews(supabase: SupabaseClient, vendorId: string): Promise<Map<string, number> | null> {
  try {
    const { data, error } = await supabase
      .from('vendor_portfolio_photo_views')
      .select('photo_key, views')
      .eq('vendor_profile_id', vendorId)
      .order('views', { ascending: false })
      .limit(200);
    if (error) {
      logQueryError('supplierHero.photoViews', error, { vendorId }, 'graceful_degrade');
      return null;
    }
    return new Map((data ?? []).map((r: { photo_key: string; views: number | string }) => [r.photo_key, Number(r.views) || 0]));
  } catch (err) {
    logQueryError('supplierHero.photoViews', err, { vendorId }, 'graceful_degrade');
    return null;
  }
}

/** A stored portfolio key → its display URL, or null when it will not sign. */
export async function heroPhotoUrl(key: string | null): Promise<string | null> {
  if (!key) return null;
  try {
    return (await displayUrlForStoredAsset(key)) ?? null;
  } catch {
    return null;
  }
}

/**
 * The placeholder picture for a shop with no photo: its category's picture (Admin › Categories), else the parent
 * group's, else the shipped file. `services` is `vendor_profiles.services` — its first entry is the shop's category.
 */
export async function heroPlaceholderUrl(services: readonly string[] | null | undefined): Promise<string> {
  try {
    const first = (services ?? [])[0];
    // The LIVE map (Admin › Categories), the same snapshot the photos come from — never the code constant, so a
    // service an admin moves or renames lands on its new category's picture with no code change (Build 3, 9 Nov).
    const tax = await getTaxonomy();
    const tile = first ? (tax.map[first]?.tile ?? first) : null;
    for (const ref of placeholderRefs(tile, tax.categoryPhotos, tax.tileParent)) {
      const url = await displayUrlForCatalogueArt(ref).catch(() => null);
      if (url) return url;
    }
  } catch {
    /* the chain ends on the shipped file */
  }
  return HERO_PLACEHOLDER_FILE;
}

/** A photo when there is one that signs, else the placeholder chain. */
export async function heroPicture(key: string | null, services: readonly string[] | null | undefined): Promise<HeroPicture> {
  const url = await heroPhotoUrl(key);
  return url ? { url, kind: 'photo' } : { url: await heroPlaceholderUrl(services), kind: 'placeholder' };
}
