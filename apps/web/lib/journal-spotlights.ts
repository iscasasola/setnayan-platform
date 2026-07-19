/**
 * Editorial & Journal Spotlights — read/write helpers (Wave 5 vendor benefit).
 *
 * A thin DB OVERLAY on the FILE-BASED Journal (apps/web/lib/blog.ts). The
 * Journal article bodies stay in code ("no DB, no CMS"); this module only reads
 * the `public.journal_vendor_spotlights` overlay that credits vendors inside an
 * article, joined by `blog_slug`. Nothing here migrates the Journal to a CMS.
 *
 * Three consumers:
 *   • PUBLIC  /blog/[slug] — fetchApprovedSpotlightsForSlug() renders the
 *     "Featured partner / In partnership with" credit block (sponsored rows
 *     carry an unambiguous "Sponsored" badge per the 0038 disclosure rule).
 *   • VENDOR  /vendor-dashboard — fetchVendorJournalSpotlights() powers the
 *     read-only "You're featured in the Journal" list.
 *   • ADMIN   /admin/journal-spotlights — fetchAllSpotlightsForAdmin() lists
 *     every row (drafts + approved) for the curation queue.
 *
 * VISIBILITY: a row is public only when `admin_approved_at IS NOT NULL`. The RLS
 * public-read policy enforces this in the database; the public + vendor reads
 * use the RLS-scoped session client, so a draft can never leak. The admin read
 * uses the service-role client to also see drafts/pending rows.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { findBlogArticle } from '@/lib/blog';

export type JournalPlacement = 'featured_partner' | 'recommended' | 'sponsored';

/** Human labels for the three placements (public credit-block heading). */
export const PLACEMENT_LABELS: Record<JournalPlacement, string> = {
  featured_partner: 'Featured partner',
  recommended: 'In partnership with',
  sponsored: 'Sponsored partner',
};

/** A public-facing spotlight row, enriched with the vendor's display fields. */
export type JournalSpotlightPublic = {
  spotlight_id: string;
  public_id: string;
  blog_slug: string;
  vendor_profile_id: string;
  placement: JournalPlacement;
  is_sponsored: boolean;
  sort_order: number;
  // Joined vendor display fields (null only if the profile row vanished — the
  // FK is ON DELETE CASCADE so this is effectively never null in practice).
  business_name: string | null;
  business_slug: string | null;
  logo_url: string | null;
};

/** An admin-queue row — adds the draft/approval fields the public view omits. */
export type JournalSpotlightAdminRow = JournalSpotlightPublic & {
  admin_approved_at: string | null;
  sponsored_sku_code: string | null;
  created_at: string;
};

/** A vendor "you're featured" row — the article it credits the vendor in. */
export type VendorJournalFeature = {
  spotlight_id: string;
  blog_slug: string;
  placement: JournalPlacement;
  is_sponsored: boolean;
  // Resolved from the file-based Journal registry (null if the slug no longer
  // maps to a live article — e.g. an article was renamed in code).
  article_title: string | null;
  article_cover: string | null;
};

const SELECT_WITH_VENDOR = `
  spotlight_id, public_id, blog_slug, vendor_profile_id, placement,
  is_sponsored, sort_order, admin_approved_at, sponsored_sku_code, created_at,
  vendor:vendor_profiles!inner ( business_name, business_slug, logo_url )
`;

type RawJoinedRow = {
  spotlight_id: string;
  public_id: string;
  blog_slug: string;
  vendor_profile_id: string;
  placement: JournalPlacement;
  is_sponsored: boolean;
  sort_order: number;
  admin_approved_at: string | null;
  sponsored_sku_code: string | null;
  created_at: string;
  vendor:
    | { business_name: string | null; business_slug: string | null; logo_url: string | null }
    | Array<{ business_name: string | null; business_slug: string | null; logo_url: string | null }>
    | null;
};

function normalizeVendor(v: RawJoinedRow['vendor']) {
  // PostgREST returns a to-one embed as an object, but type generators often
  // widen it to an array — normalize both shapes.
  return Array.isArray(v) ? v[0] : v;
}

function toPublic(r: RawJoinedRow): JournalSpotlightPublic {
  const v = normalizeVendor(r.vendor);
  return {
    spotlight_id: r.spotlight_id,
    public_id: r.public_id,
    blog_slug: r.blog_slug,
    vendor_profile_id: r.vendor_profile_id,
    placement: r.placement,
    is_sponsored: r.is_sponsored,
    sort_order: r.sort_order,
    business_name: v?.business_name ?? null,
    business_slug: v?.business_slug ?? null,
    logo_url: v?.logo_url ?? null,
  };
}

/**
 * PUBLIC read — approved spotlights crediting vendors in one article, ordered
 * by sort_order then creation. Read with the RLS-scoped session client; the
 * public-read policy (admin_approved_at IS NOT NULL) means drafts never appear.
 * Fail-soft: returns [] on any error so the article still renders.
 */
export async function fetchApprovedSpotlightsForSlug(
  client: SupabaseClient,
  blogSlug: string,
): Promise<JournalSpotlightPublic[]> {
  const { data, error } = await client
    .from('journal_vendor_spotlights')
    .select(SELECT_WITH_VENDOR)
    .eq('blog_slug', blogSlug)
    .not('admin_approved_at', 'is', null)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[journal-spotlights] public fetch failed', error.message);
    return [];
  }
  return ((data ?? []) as unknown as RawJoinedRow[]).map(toPublic);
}

/**
 * VENDOR read — the approved articles that credit THIS vendor. Resolves each
 * row's article title + cover from the file-based Journal registry (lib/blog.ts)
 * so the dashboard can link to the live article. Read with the vendor's own
 * RLS-scoped client (public-read policy resolves the approved rows). Fail-soft.
 */
export async function fetchVendorJournalSpotlights(
  client: SupabaseClient,
  vendorProfileId: string,
): Promise<VendorJournalFeature[]> {
  const { data, error } = await client
    .from('journal_vendor_spotlights')
    .select('spotlight_id, blog_slug, placement, is_sponsored')
    .eq('vendor_profile_id', vendorProfileId)
    .not('admin_approved_at', 'is', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[journal-spotlights] vendor fetch failed', error.message);
    return [];
  }

  return ((data ?? []) as Array<{
    spotlight_id: string;
    blog_slug: string;
    placement: JournalPlacement;
    is_sponsored: boolean;
  }>).map((r) => {
    const article = findBlogArticle(r.blog_slug);
    return {
      spotlight_id: r.spotlight_id,
      blog_slug: r.blog_slug,
      placement: r.placement,
      is_sponsored: r.is_sponsored,
      article_title: article?.title ?? null,
      article_cover: article?.cover ?? null,
    };
  });
}

/**
 * ADMIN read — every spotlight row (drafts + approved) for the curation queue,
 * enriched with vendor display fields. Newest first. Pass the SERVICE-ROLE admin
 * client so drafts/pending rows are visible (the RLS public-read policy hides
 * unapproved rows from the session client). Fail-soft.
 */
export async function fetchAllSpotlightsForAdmin(
  admin: SupabaseClient,
): Promise<JournalSpotlightAdminRow[]> {
  const { data, error } = await admin
    .from('journal_vendor_spotlights')
    .select(SELECT_WITH_VENDOR)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[journal-spotlights] admin fetch failed', error.message);
    return [];
  }

  return ((data ?? []) as unknown as RawJoinedRow[]).map((r) => ({
    ...toPublic(r),
    admin_approved_at: r.admin_approved_at,
    sponsored_sku_code: r.sponsored_sku_code,
    created_at: r.created_at,
  }));
}

/**
 * Reads the admin-managed price (in centavos) for the sponsored-slot SKU from
 * service_catalog. The price is NEVER hardcoded in app code — this is the single
 * lookup point. Returns null when the SKU is missing/inactive (e.g. pre-owner-
 * sign-off, the seed ships is_active=FALSE), which the admin UI treats as
 * "sponsored selling not enabled yet".
 */
export const JOURNAL_SPONSORED_SKU = 'journal_sponsored_spotlight';

export async function fetchSponsoredSlotPrice(
  admin: SupabaseClient,
): Promise<{ priceCentavos: number; isActive: boolean; displayName: string } | null> {
  const { data, error } = await admin
    .from('service_catalog')
    .select('display_name, price_centavos, is_active')
    .eq('sku_code', JOURNAL_SPONSORED_SKU)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error('[journal-spotlights] sku price fetch failed', error.message);
    return null;
  }
  return {
    priceCentavos: Number(data.price_centavos ?? 0),
    isActive: Boolean(data.is_active),
    displayName: String(data.display_name ?? 'Journal Sponsored Spotlight'),
  };
}

/** Format centavos → "₱1,999" style peso string (no decimals for whole pesos). */
export function formatCentavos(centavos: number): string {
  const pesos = centavos / 100;
  return `₱${pesos.toLocaleString('en-PH', {
    minimumFractionDigits: Number.isInteger(pesos) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}
