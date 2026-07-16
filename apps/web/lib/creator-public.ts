/**
 * Creator "Adventure Chapter" — PUBLIC read path (CP-3 / CP-4).
 *
 * Reads run through the service-role admin client and filter in app code — the
 * SAME pattern app/u/[userSlug]/page.tsx uses for public reads. The
 * `creator_chapters` public-read RLS is defense-in-depth, not the gate we rely
 * on here; callers MUST first confirm the owner's public profile is enabled
 * (users.public_profile_enabled) before surfacing anything. Creator is
 * user-native (2026-07-16): a published chapter on a public profile IS the
 * creator signal — there is no is_creator flag.
 *
 * Red lines honored:
 *   • embed only — we return the stored NORMALIZED embed_url (produced by
 *     lib/creator-chapters `normalizeEmbed`); rendering always goes through the
 *     sandboxed, allowlisted ChapterEmbedFrame. Setnayan never hosts the edit.
 *   • timeline, not a feed — chapters come back newest-first, published only.
 *   • owned-music-only — teaser render is a different agent; teaser_r2_key is
 *     surfaced optional/absent here and never fabricated.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { resolveVendorDisplayName } from '@/lib/vendors';
import { isPubliclyVisible, parseVisibility } from '@/lib/vendor-visibility';
import { isTrueNameTier } from '@/lib/vendor-tier-caps';
import type { ChapterKind, EmbedProvider } from '@/lib/creator-chapters';

/** The parsed, app-owned shape of `creator_chapters.substrate` (a bag of refs). */
export type ChapterSubstrate = {
  papic_gallery_id?: string;
  itinerary?: string;
  vendor_ids?: string[];
};

export type PublicChapter = {
  chapter_id: string;
  public_id: string;
  title: string;
  kind: ChapterKind;
  embed_url: string | null;
  embed_provider: EmbedProvider | null;
  teaser_r2_key: string | null;
  substrate: ChapterSubstrate;
  published_at: string | null;
};

const CHAPTER_FIELDS =
  'chapter_id, public_id, title, kind, embed_url, embed_provider, teaser_r2_key, substrate, published_at';

function coerceSubstrate(raw: unknown): ChapterSubstrate {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>;
  const out: ChapterSubstrate = {};
  if (typeof r.papic_gallery_id === 'string' && r.papic_gallery_id.trim()) {
    out.papic_gallery_id = r.papic_gallery_id;
  }
  if (typeof r.itinerary === 'string' && r.itinerary.trim()) {
    out.itinerary = r.itinerary;
  }
  if (Array.isArray(r.vendor_ids)) {
    const ids = r.vendor_ids
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      .slice(0, 50);
    if (ids.length > 0) out.vendor_ids = ids;
  }
  return out;
}

function mapRow(row: Record<string, unknown>): PublicChapter {
  return {
    chapter_id: row.chapter_id as string,
    public_id: row.public_id as string,
    title: row.title as string,
    kind: row.kind as ChapterKind,
    embed_url: (row.embed_url as string | null) ?? null,
    embed_provider: (row.embed_provider as EmbedProvider | null) ?? null,
    teaser_r2_key: (row.teaser_r2_key as string | null) ?? null,
    substrate: coerceSubstrate(row.substrate),
    published_at: (row.published_at as string | null) ?? null,
  };
}

/**
 * A creator's PUBLISHED chapters, newest-first — the profile timeline (CP-3).
 * Only rows that actually carry an embed (a chapter's whole point) are returned,
 * so the timeline never renders an empty card.
 */
export async function fetchPublishedChapters(
  userId: string,
): Promise<PublicChapter[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('creator_chapters')
    .select(CHAPTER_FIELDS)
    .eq('user_id', userId)
    .eq('status', 'published')
    .order('published_at', { ascending: false });
  return ((data ?? []) as Record<string, unknown>[])
    .map(mapRow)
    .filter((c) => !!c.embed_url);
}

/**
 * A single PUBLISHED chapter of a creator, resolved by its human-facing
 * public_id (S89C-…) — the chapter-detail page. Scoped to the owner so a
 * public_id from another account can't be surfaced under the wrong profile.
 */
export async function fetchPublishedChapterByPublicId(
  userId: string,
  publicId: string,
): Promise<PublicChapter | null> {
  if (!publicId) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from('creator_chapters')
    .select(CHAPTER_FIELDS)
    .eq('user_id', userId)
    .eq('public_id', publicId)
    .eq('status', 'published')
    .maybeSingle();
  if (!data) return null;
  const chapter = mapRow(data as Record<string, unknown>);
  return chapter.embed_url ? chapter : null;
}

/** A shoppable substrate vendor card — a 0%-commission lead into /v/[slug]. */
export type ShoppableVendor = {
  slug: string;
  name: string;
  city: string | null;
  logoUrl: string | null;
};

/**
 * Resolve the substrate's `vendor_ids` (creator-typed — either a business_slug
 * or a public_id) into linkable, PUBLICLY-VISIBLE vendor cards (CP-4). Hidden /
 * archived vendors are dropped (never leak a suspended profile), and the name
 * respects the hybrid-anonymity mechanic via resolveVendorDisplayName. Order
 * follows the creator's input. Read-only surfacing — no inquiry flow here; the
 * card links to the vendor's existing public page (0% commission lead).
 */
export async function resolveShoppableVendors(
  vendorIds: string[] | undefined,
): Promise<ShoppableVendor[]> {
  const ids = (vendorIds ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 50);
  if (ids.length === 0) return [];

  const admin = createAdminClient();
  const { data } = await admin
    .from('vendor_profiles')
    .select(
      'public_id, business_name, business_slug, logo_url, location_city, public_visibility, name_revealed_at, tier_state, services, screen_name',
    )
    .or(`business_slug.in.(${ids.join(',')}),public_id.in.(${ids.join(',')})`);

  const rows = (data ?? []) as Array<{
    public_id: string | null;
    business_name: string | null;
    business_slug: string | null;
    logo_url: string | null;
    location_city: string | null;
    public_visibility: string | null;
    name_revealed_at: string | null;
    tier_state: string | null;
    services: string[] | null;
    screen_name: string | null;
  }>;

  // Index by both keys so we can preserve the creator's input order.
  const byKey = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    if (!isPubliclyVisible(parseVisibility(r.public_visibility))) continue;
    if (!r.business_slug) continue; // no linkable /v/[slug] target
    if (r.business_slug) byKey.set(r.business_slug, r);
    if (r.public_id) byKey.set(r.public_id, r);
  }

  const out: ShoppableVendor[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const r = byKey.get(id);
    if (!r || !r.business_slug || seen.has(r.business_slug)) continue;
    seen.add(r.business_slug);
    out.push({
      slug: r.business_slug,
      name: resolveVendorDisplayName({
        business_name: r.business_name,
        name_revealed_at: r.name_revealed_at ?? null,
        primary_canonical_service: r.services?.[0] ?? null,
        location_city: r.location_city,
        services: r.services ?? null,
        screen_name: r.screen_name ?? null,
        isPaidTier: isTrueNameTier(r.tier_state ?? null),
      }),
      city: r.location_city,
      logoUrl: r.logo_url,
    });
  }
  return out;
}
