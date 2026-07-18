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
  /** Aggregate public views (no PII) — the audience-layer counter. */
  view_count: number;
};

const CHAPTER_FIELDS =
  'chapter_id, public_id, title, kind, embed_url, embed_provider, teaser_r2_key, substrate, published_at, view_count';

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
    view_count:
      typeof row.view_count === 'number' ? row.view_count : Number(row.view_count ?? 0),
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

/**
 * Resolve a PUBLISHED chapter by its public_id alone, together with its owner —
 * for surfaces addressed by the chapter id without a profile slug (the
 * /api/og/chapter/[publicId] share card). Applies the FULL public gate in one
 * place: chapter published + carries an embed, AND the owner's profile is
 * public, non-deleted, and slugged (the same conditions the chapter page's
 * resolve() enforces via resolvePublicProfile). Anything short of that returns
 * null — a chapter title / storyteller name is never surfaced for a page that
 * isn't actually public.
 */
export async function fetchPublishedChapterForShare(publicId: string): Promise<{
  chapter: PublicChapter;
  ownerName: string;
  ownerSlug: string;
} | null> {
  if (!publicId) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from('creator_chapters')
    .select(`${CHAPTER_FIELDS}, user_id`)
    .eq('public_id', publicId)
    .eq('status', 'published')
    .maybeSingle();
  if (!data) return null;
  const row = data as Record<string, unknown>;
  const chapter = mapRow(row);
  if (!chapter.embed_url) return null;

  const { data: owner } = await admin
    .from('users')
    .select('slug, display_name, public_profile_enabled, deleted_at')
    .eq('user_id', row.user_id as string)
    .maybeSingle();
  const u = owner as {
    slug: string | null;
    display_name: string | null;
    public_profile_enabled: boolean | null;
    deleted_at: string | null;
  } | null;
  if (!u || u.public_profile_enabled !== true || u.deleted_at || !u.slug) return null;

  return {
    chapter,
    ownerName: u.display_name?.trim() || 'A Setnayan storyteller',
    ownerSlug: u.slug,
  };
}

/**
 * A substrate vendor surfaced behind a chapter. `linked` is the RELATIONSHIP
 * gate (CP-4 · GAP-3): TRUE only when a real creator↔vendor relationship backs
 * the mention — an accepted vendor_creator_offers collab with this chapter's
 * creator, OR a genuine booking tying the vendor to the chapter's event. Only a
 * `linked` vendor is rendered as a shoppable/bookable card (a 0%-commission lead
 * into /v/[slug]); an UNLINKED vendor (the creator merely typed the id, no
 * relationship) renders as PLAIN TEXT — no link, no Book CTA — so the page never
 * manufactures a commercial affordance a vendor never agreed to. `slug` is null
 * for an unlinked vendor with no linkable target.
 */
export type ShoppableVendor = {
  slug: string | null;
  name: string;
  city: string | null;
  logoUrl: string | null;
  /** Real-relationship gate — see the type doc. Drives card-vs-text rendering. */
  linked: boolean;
  /**
   * Internal vendor id (PR-C) — used SERVER-SIDE ONLY to join the chapter's
   * accepted collab offers for the viewer-promo line (audience_rate_terms
   * whitelist). Never rendered; the public link target stays /v/[slug].
   */
  vendorProfileId: string;
};

/** Server-side context that establishes whether a substrate vendor is REAL. */
export type ShoppableVendorContext = {
  /** The chapter owner (creator). Matched against vendor_creator_offers.creator_user_id. */
  creatorUserId: string | null | undefined;
  /** The chapter's event (substrate.papic_gallery_id) — the booking anchor. */
  eventId?: string | null;
};

/**
 * Resolve the substrate's `vendor_ids` (creator-typed — either a business_slug
 * or a public_id) into PUBLICLY-VISIBLE vendor entries (CP-4). Hidden / archived
 * vendors are dropped (never leak a suspended profile), and the name respects the
 * hybrid-anonymity mechanic via resolveVendorDisplayName. Order follows the
 * creator's input.
 *
 * GAP-3 (relationship gate): each entry is flagged `linked` ONLY when a real
 * creator↔vendor relationship exists — an ACCEPTED vendor_creator_offers collab
 * between this chapter's creator and the vendor, OR a genuine booking tying the
 * vendor to the chapter's event (event_vendors.linked_vendor_profile_id). The
 * page renders a shoppable/bookable card ONLY for `linked` vendors; unlinked ones
 * render as plain text. A self-asserted vendor_id with no relationship can no
 * longer manufacture a Setnayan-looking "book this vendor" affordance. Read-only
 * surfacing — no inquiry flow here.
 */
export async function resolveShoppableVendors(
  vendorIds: string[] | undefined,
  context: ShoppableVendorContext = { creatorUserId: null },
): Promise<ShoppableVendor[]> {
  const ids = (vendorIds ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 50);
  if (ids.length === 0) return [];

  const admin = createAdminClient();
  const { data } = await admin
    .from('vendor_profiles')
    .select(
      'vendor_profile_id, public_id, business_name, business_slug, logo_url, location_city, public_visibility, name_revealed_at, tier_state, services, screen_name',
    )
    .or(`business_slug.in.(${ids.join(',')}),public_id.in.(${ids.join(',')})`);

  const rows = (data ?? []) as Array<{
    vendor_profile_id: string;
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

  // Index by both keys so we can preserve the creator's input order. A vendor with
  // no business_slug is still INCLUDED (it can render as plain text) — the slug is
  // only required to LINK, not to name.
  const byKey = new Map<string, (typeof rows)[number]>();
  const visibleProfileIds: string[] = [];
  for (const r of rows) {
    if (!isPubliclyVisible(parseVisibility(r.public_visibility))) continue;
    if (r.business_slug) byKey.set(r.business_slug, r);
    if (r.public_id) byKey.set(r.public_id, r);
    visibleProfileIds.push(r.vendor_profile_id);
  }

  // RELATIONSHIP gate — which of these vendors actually has a real tie to this
  // creator / this chapter's event. Fail-closed: any read error → the set stays
  // empty → those vendors downgrade to plain text (never a fake shoppable card).
  const linkedProfileIds = await resolveLinkedVendorProfileIds(
    admin,
    visibleProfileIds,
    context,
  );

  const out: ShoppableVendor[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const r = byKey.get(id);
    if (!r || seen.has(r.vendor_profile_id)) continue;
    seen.add(r.vendor_profile_id);
    const linked = Boolean(r.business_slug) && linkedProfileIds.has(r.vendor_profile_id);
    out.push({
      // Only a linked vendor exposes its /v/[slug] link target.
      slug: linked ? r.business_slug : null,
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
      linked,
      vendorProfileId: r.vendor_profile_id,
    });
  }
  return out;
}

/**
 * The subset of `profileIds` that carry a REAL relationship for GAP-3's card
 * gate: an ACCEPTED vendor_creator_offers collab with `creatorUserId`, OR a
 * booking on `eventId` (event_vendors.linked_vendor_profile_id). Best-effort —
 * each read is independently wrapped; an error contributes nothing (fail-closed).
 */
async function resolveLinkedVendorProfileIds(
  admin: ReturnType<typeof createAdminClient>,
  profileIds: string[],
  context: ShoppableVendorContext,
): Promise<Set<string>> {
  const linked = new Set<string>();
  const ids = [...new Set(profileIds.filter(Boolean))];
  if (ids.length === 0) return linked;

  // 1. Accepted creator↔vendor collab (the offer row IS the relationship).
  const creatorUserId = context.creatorUserId?.trim?.() || context.creatorUserId || null;
  if (creatorUserId) {
    try {
      const { data } = await admin
        .from('vendor_creator_offers')
        .select('vendor_id')
        .eq('creator_user_id', creatorUserId)
        .eq('status', 'accepted')
        .in('vendor_id', ids);
      for (const row of (data ?? []) as Array<{ vendor_id: string }>) {
        if (row.vendor_id) linked.add(row.vendor_id);
      }
    } catch {
      /* fail-closed — no collab evidence */
    }
  }

  // 2. Genuine booking tying the vendor to the chapter's event.
  const eventId = context.eventId?.trim() || null;
  if (eventId) {
    try {
      const { data } = await admin
        .from('event_vendors')
        .select('linked_vendor_profile_id')
        .eq('event_id', eventId)
        .in('linked_vendor_profile_id', ids);
      for (const row of (data ?? []) as Array<{ linked_vendor_profile_id: string | null }>) {
        if (row.linked_vendor_profile_id) linked.add(row.linked_vendor_profile_id);
      }
    } catch {
      /* fail-closed — no booking evidence */
    }
  }

  return linked;
}
