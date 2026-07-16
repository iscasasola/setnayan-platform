import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import {
  youtubeThumbFromEmbedUrl,
  type ChapterKind,
  type EmbedProvider,
  CHAPTER_KIND_LABEL,
} from '@/lib/creator-chapters';

// ============================================================================
// Storytellers — cross-creator chapter loaders (PR-D · council verdict
// 2026-07-16 §3–§5, owner-ratified).
// ============================================================================
// ROUTE-AGNOSTIC BY RULE: this module imports NOTHING from /realstories page
// code (the brand seat's escape hatch — a future standalone /storytellers page
// is loader + doorway kit only). Pages compose these loaders; the loaders never
// know which page called them.
//
// Deny-by-default: publish ≠ listed. The PUBLIC lane reads ONLY featured rows
// (showcase_featured_at IS NOT NULL — the owner's Feature click IS the
// moderation review); the ADMIN lane reads all published chapters on
// public-profile accounts, newest first.
//
// Reads run through the service-role admin client and filter in app code — the
// same public-read pattern as lib/creator-public.ts; the chapter RLS is
// defense-in-depth. Every loader is best-effort: any failure (including the
// featuring migration not yet applied) returns []/empty so /realstories and
// /v/[slug] degrade to exactly their pre-PR-D render and never crash.

/** One chapter as a Storyteller shelf/strip tile (byline-forward grammar). */
export type StorytellerTileItem = {
  /** Canonical chapter page — /u/[ownerSlug]/c/[publicId]. Never a new route. */
  href: string;
  publicId: string;
  title: string;
  kind: ChapterKind;
  kindLabel: string;
  /** The storyteller's public slug — the byline is "A chapter by @slug". */
  ownerSlug: string;
  ownerName: string;
  /** Aggregate public views (no PII). Chapters show views; editorials never do. */
  viewCount: number;
  /** YouTube-derived thumbnail (V1 rule) — always present on FEATURED rows. */
  thumbUrl: string | null;
  publishedAt: string | null;
  /** The chapter's linked Setnayan event (cross-rail join key), if any. */
  eventId: string | null;
  featureRank: number | null;
};

type ChapterRow = {
  chapter_id: string;
  public_id: string;
  user_id: string;
  event_id: string | null;
  title: string;
  kind: string;
  embed_url: string | null;
  embed_provider: string | null;
  published_at: string | null;
  view_count: number | null;
  showcase_featured_at?: string | null;
  showcase_feature_rank?: number | null;
};

type OwnerRow = {
  user_id: string;
  slug: string | null;
  display_name: string | null;
  public_profile_enabled: boolean | null;
  deleted_at: string | null;
};

/** Batch-resolve chapter owners → only PUBLIC, non-deleted profiles with a slug. */
async function fetchPublicOwners(
  admin: ReturnType<typeof createAdminClient>,
  userIds: string[],
): Promise<Map<string, { slug: string; name: string }>> {
  const out = new Map<string, { slug: string; name: string }>();
  if (userIds.length === 0) return out;
  const { data } = await admin
    .from('users')
    .select('user_id, slug, display_name, public_profile_enabled, deleted_at')
    .in('user_id', userIds);
  for (const u of (data ?? []) as OwnerRow[]) {
    if (u.public_profile_enabled !== true) continue;
    if (u.deleted_at) continue;
    if (!u.slug) continue; // no public /u page → no linkable byline
    out.set(u.user_id, {
      slug: u.slug,
      name: u.display_name?.trim() || 'A Setnayan storyteller',
    });
  }
  return out;
}

function toTile(
  row: ChapterRow,
  owner: { slug: string; name: string },
): StorytellerTileItem | null {
  const kind = row.kind as ChapterKind;
  if (!(kind in CHAPTER_KIND_LABEL)) return null;
  return {
    href: `/u/${owner.slug}/c/${row.public_id}`,
    publicId: row.public_id,
    title: row.title,
    kind,
    kindLabel: CHAPTER_KIND_LABEL[kind],
    ownerSlug: owner.slug,
    ownerName: owner.name,
    viewCount: typeof row.view_count === 'number' ? row.view_count : Number(row.view_count ?? 0),
    thumbUrl: youtubeThumbFromEmbedUrl(row.embed_url),
    publishedAt: row.published_at ?? null,
    eventId: row.event_id ?? null,
    featureRank: row.showcase_feature_rank ?? null,
  };
}

const FEATURED_FIELDS =
  'chapter_id, public_id, user_id, event_id, title, kind, embed_url, embed_provider, published_at, view_count, showcase_featured_at, showcase_feature_rank';

/**
 * The PUBLIC shelf read — ONLY owner-featured, published chapters on public
 * profiles, rank order (lower first, NULLs last, then most-recently featured).
 * Empty ⇒ the "From Our Storytellers" shelf renders NOTHING (not even a
 * heading) — the self-gate that keeps PR-D dark until the owner's first
 * Feature click. Best-effort: a pre-migration DB (42703) returns [].
 */
export async function loadFeaturedChapters(limit = 24): Promise<StorytellerTileItem[]> {
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return [];
  }
  try {
    const { data, error } = await admin
      .from('creator_chapters')
      .select(FEATURED_FIELDS)
      .eq('status', 'published')
      .not('showcase_featured_at', 'is', null)
      .order('showcase_feature_rank', { ascending: true, nullsFirst: false })
      .order('showcase_featured_at', { ascending: false })
      .limit(limit);
    if (error) return []; // incl. 42703 pre-migration — shelf stays absent
    const rows = (data ?? []) as ChapterRow[];
    if (rows.length === 0) return [];

    const owners = await fetchPublicOwners(
      admin,
      Array.from(new Set(rows.map((r) => r.user_id))),
    );
    const out: StorytellerTileItem[] = [];
    for (const r of rows) {
      const owner = owners.get(r.user_id);
      if (!owner) continue; // profile hidden/deleted since featuring → drop
      const tile = toTile(r, owner);
      // Featured rows are YouTube-only by the curation rule, but re-assert at
      // read time: no derivable thumb → no tile (never a broken card).
      if (tile && tile.thumbUrl) out.push(tile);
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Cross-rail (editorial → chapter): for a set of event ids, the newest
 * PUBLISHED chapter (public-profile owner) linked to each event — powers the
 * "Watch the storyteller's cut" chip on editorial cards. A join over
 * creator_chapters.event_id, not machinery. Best-effort → empty map.
 */
export async function loadChapterCutsForEvents(
  eventIds: ReadonlyArray<string>,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = Array.from(new Set(eventIds)).filter(Boolean);
  if (ids.length === 0) return out;
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return out;
  }
  try {
    const { data } = await admin
      .from('creator_chapters')
      .select('public_id, user_id, event_id, published_at')
      .eq('status', 'published')
      .in('event_id', ids)
      .order('published_at', { ascending: false });
    const rows = (data ?? []) as Pick<
      ChapterRow,
      'public_id' | 'user_id' | 'event_id' | 'published_at'
    >[];
    if (rows.length === 0) return out;
    const owners = await fetchPublicOwners(
      admin,
      Array.from(new Set(rows.map((r) => r.user_id))),
    );
    for (const r of rows) {
      if (!r.event_id || out.has(r.event_id)) continue; // newest-first → keep first
      const owner = owners.get(r.user_id);
      if (!owner) continue;
      out.set(r.event_id, `/u/${owner.slug}/c/${r.public_id}`);
    }
    return out;
  } catch {
    return out;
  }
}

/**
 * Vendor backlink ("Featured in these stories" on /v/[slug]): the FEATURED,
 * published chapters whose shoppable substrate credits this vendor (by
 * business_slug or public_id — the two keys creators type). Joins over the
 * already-featured set (owner-curated, bounded), filtered in app code — free
 * for every visible vendor (Simplicity Canon rule 2: you never pay to be
 * named in a story). Best-effort → [].
 */
export async function loadFeaturedChaptersCreditingVendor(vendorKeys: {
  businessSlug: string | null;
  publicId: string | null;
}): Promise<StorytellerTileItem[]> {
  const keys = [vendorKeys.businessSlug, vendorKeys.publicId].filter(
    (k): k is string => Boolean(k && k.trim()),
  );
  if (keys.length === 0) return [];
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return [];
  }
  try {
    const { data, error } = await admin
      .from('creator_chapters')
      .select(`${FEATURED_FIELDS}, substrate`)
      .eq('status', 'published')
      .not('showcase_featured_at', 'is', null)
      .order('showcase_feature_rank', { ascending: true, nullsFirst: false })
      .order('showcase_featured_at', { ascending: false })
      .limit(100);
    if (error) return [];
    const rows = (data ?? []) as (ChapterRow & { substrate: unknown })[];
    const credited = rows.filter((r) => {
      const sub = r.substrate as { vendor_ids?: unknown } | null;
      const ids = Array.isArray(sub?.vendor_ids) ? (sub.vendor_ids as unknown[]) : [];
      return ids.some((v) => typeof v === 'string' && keys.includes(v.trim()));
    });
    if (credited.length === 0) return [];
    const owners = await fetchPublicOwners(
      admin,
      Array.from(new Set(credited.map((r) => r.user_id))),
    );
    const out: StorytellerTileItem[] = [];
    for (const r of credited) {
      const owner = owners.get(r.user_id);
      if (!owner) continue;
      const tile = toTile(r, owner);
      if (tile && tile.thumbUrl) out.push(tile);
    }
    return out.slice(0, 6);
  } catch {
    return [];
  }
}

// ============================================================================
// Admin curation (the /admin/studio Storytellers tab)
// ============================================================================

export type StorytellerAdminRow = {
  publicId: string;
  title: string;
  kind: ChapterKind | null;
  kindLabel: string;
  embedProvider: EmbedProvider | null;
  /** Canonical chapter page for preview (null when the owner slug is missing). */
  href: string | null;
  ownerSlug: string | null;
  ownerName: string;
  viewCount: number;
  /** YouTube-derived thumb. null ⇒ NOT FEATURABLE (V1 thumbnail rule). */
  thumbUrl: string | null;
  publishedAt: string | null;
  featured: boolean;
  featureRank: number | null;
  /** Open user_reports rows targeting this chapter — moderation-at-a-glance. */
  openReportCount: number;
};

export type StorytellerAdminResult =
  | { ok: true; rows: StorytellerAdminRow[] }
  // `migration` = the featuring columns don't exist yet. `error` = other failure.
  | { ok: false; reason: 'migration' | 'error' };

/**
 * The admin candidate list — ALL published chapters on public-profile accounts,
 * newest first (the global published index), with the featured set sorted to
 * the top exactly as the public shelf orders it. The featuring click IS the
 * moderation review, so each row carries its open-report count inline.
 */
export async function loadStorytellerCandidatesForAdmin(
  limit = 100,
): Promise<StorytellerAdminResult> {
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, reason: 'error' };
  }
  try {
    const { data, error } = await admin
      .from('creator_chapters')
      .select(FEATURED_FIELDS)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(limit);
    if (error) {
      if (
        error.code === '42703' ||
        /showcase_featured_at|showcase_feature_rank/.test(error.message)
      ) {
        return { ok: false, reason: 'migration' };
      }
      return { ok: false, reason: 'error' };
    }
    const rows = (data ?? []) as ChapterRow[];
    if (rows.length === 0) return { ok: true, rows: [] };

    const owners = await fetchPublicOwners(
      admin,
      Array.from(new Set(rows.map((r) => r.user_id))),
    );

    // Open-report counts (S0 target_type='chapter', target_id=public_id).
    // Best-effort — a failed read leaves every count at 0, never blocks.
    const reportCounts = new Map<string, number>();
    try {
      const { data: reports } = await admin
        .from('user_reports')
        .select('target_id')
        .eq('target_type', 'chapter')
        .eq('status', 'open')
        .in('target_id', rows.map((r) => r.public_id));
      for (const rep of (reports ?? []) as { target_id: string }[]) {
        reportCounts.set(rep.target_id, (reportCounts.get(rep.target_id) ?? 0) + 1);
      }
    } catch {
      /* counts stay 0 */
    }

    const adminRows: StorytellerAdminRow[] = [];
    for (const r of rows) {
      const owner = owners.get(r.user_id) ?? null;
      if (!owner) continue; // hidden/deleted profile → not a candidate (publish gate)
      const kind = (r.kind as ChapterKind) in CHAPTER_KIND_LABEL ? (r.kind as ChapterKind) : null;
      adminRows.push({
        publicId: r.public_id,
        title: r.title,
        kind,
        kindLabel: kind ? CHAPTER_KIND_LABEL[kind] : r.kind,
        embedProvider: (r.embed_provider as EmbedProvider | null) ?? null,
        href: `/u/${owner.slug}/c/${r.public_id}`,
        ownerSlug: owner.slug,
        ownerName: owner.name,
        viewCount:
          typeof r.view_count === 'number' ? r.view_count : Number(r.view_count ?? 0),
        thumbUrl: youtubeThumbFromEmbedUrl(r.embed_url),
        publishedAt: r.published_at ?? null,
        featured: r.showcase_featured_at != null,
        featureRank: r.showcase_feature_rank ?? null,
        openReportCount: reportCounts.get(r.public_id) ?? 0,
      });
    }
    // Featured first (rank asc, NULLs last), then the rest newest-first —
    // mirrors the public shelf so the admin list reads exactly what renders.
    adminRows.sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      if (a.featured && b.featured) {
        const ar = a.featureRank ?? Number.POSITIVE_INFINITY;
        const br = b.featureRank ?? Number.POSITIVE_INFINITY;
        if (ar !== br) return ar - br;
      }
      return (a.publishedAt ?? '') < (b.publishedAt ?? '') ? 1 : -1;
    });
    return { ok: true, rows: adminRows };
  } catch {
    return { ok: false, reason: 'error' };
  }
}
