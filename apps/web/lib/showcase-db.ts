// ============================================================================
// Real Weddings — published-showcase DB browse (iteration 0046)
// ============================================================================
// Server-only. Returns the consent-gated set of REAL weddings to surface on
// /realstories, newest first. A wedding qualifies ONLY when ALL hold:
//   • it's a wedding (events.event_type = 'wedding') with a public slug,
//   • it's past the T+30d grace window (event_date <= today − 30 days),
//   • a couple member's account opted in to public showcase inclusion
//     (users.public_summary_consent_at IS NOT NULL, account not deleted).
//
// That is the RA 10173 consent gate (CLAUDE.md decision-log rows 426 + 428; the
// `users.public_summary_consent_at` column shipped in
// 20260519000000_phase_a_event_editorial_consent.sql). Read via the admin
// client because /realstories is anonymous and these rows sit behind RLS — exactly
// how the editorial data layer reads.
//
// Best-effort: ANY failure or missing data returns [] so the /realstories page
// falls back to the curated sample (lib/real-weddings.ts) and never crashes.
// Today this returns [] — no consented past weddings exist yet (the first real
// one is the founder's Dec 2026 wedding → editorial ~Jan 2027), so the page
// shows the sample until then, at which point real weddings take over
// automatically. Each entry links to the couple's OWN canonical editorial at
// /[slug] (0002 Phase 4) — never a duplicate copy under /realstories.

import { createAdminClient } from '@/lib/supabase/admin';
import { displayUrlForStoredAsset } from '@/lib/uploads';

export type ShowcaseEntry = {
  href: string; // canonical editorial — the couple's own /[slug] page
  coupleNames: string;
  city: string | null;
  dateLabel: string | null; // display, e.g. "February 2026"
  eventDate: string | null; // ISO — sitemap lastmod
  monogramColor: string | null;
  // Admin curation (PR D · Real Stories featuring). `featured` = an admin pinned
  // this wedding to /realstories. The list is returned featured-first, so the
  // page can render the leading featured entry as the hero slot.
  featured: boolean;
  // Editor rank (`events.showcase_feature_rank`) — drives the /realstories
  // cascade: lowest rank = the Cover, the next ranks = "Most loved" picks.
  featureRank: number | null;
  // Hero still for the card's "front page" look — the couple's website hero
  // (events.landing_page_hero_image_url), resolved to a display URL. Null →
  // the card falls back to the monogram/palette treatment.
  heroImageUrl: string | null;
  // Optional 5-second hero CLIP that plays live (ping-pong) on the card. Null
  // on the DB path today — a clip-as-hero needs a dedicated pick (the editorial
  // hero excludes clips); wired here so real editorials can opt in later.
  heroVideoUrl: string | null;
};

const GRACE_DAYS = 30;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function monthYear(iso: string | null): string | null {
  if (!iso) return null;
  const [y, m] = iso.split('-').map(Number);
  if (!y || !m) return null;
  return `${MONTHS[m - 1]} ${y}`;
}

function deriveCity(venueName: string | null, venueAddress: string | null): string | null {
  const addr = venueAddress?.trim();
  if (addr) {
    const parts = addr.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const candidate = parts[parts.length - 2];
      if (candidate && !/^\d+$/.test(candidate)) return candidate;
    }
  }
  return venueName?.trim() || null;
}

export async function loadPublishedShowcases(limit = 24): Promise<ShowcaseEntry[]> {
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return [];
  }
  try {
    const cutoff = new Date(Date.now() - GRACE_DAYS * 86_400_000)
      .toISOString()
      .slice(0, 10); // YYYY-MM-DD

    // 1 · customers who opted in to public showcase inclusion (RA 10173 gate).
    const { data: consenters } = await admin
      .from('users')
      .select('user_id')
      .not('public_summary_consent_at', 'is', null)
      .is('deleted_at', null);
    const userIds = (consenters ?? []).map((u) => u.user_id as string);
    if (userIds.length === 0) return [];

    // 2 · the events those couples belong to.
    const { data: members } = await admin
      .from('event_members')
      .select('event_id')
      .eq('member_type', 'couple')
      .in('user_id', userIds);
    const eventIds = Array.from(
      new Set((members ?? []).map((m) => m.event_id as string)),
    );
    if (eventIds.length === 0) return [];

    // 3 · their weddings, past the grace window, with a public slug.
    //
    // Order: admin-FEATURED first (PR D · Real Stories featuring) — by manual
    // rank (lower = higher; NULLs last), then most-recently featured, then
    // newest wedding. Non-featured rows fall through to newest-first. The
    // leading entry of this ordered list becomes the hero on /realstories.
    //
    // Graceful-degrade (mirrors fix-graceful-fallback-0043): the featuring
    // columns ship in migration 20261221000000. If the migration hasn't been
    // applied yet, the featured-aware select 400s on the unknown columns — we
    // detect that and fall back to the original newest-first read (every row
    // featured:false), so /realstories keeps surfacing real showcases even
    // before the owner runs `supabase db push`.
    type EventRow = {
      slug: string | null;
      display_name: string | null;
      event_date: string | null;
      venue_name: string | null;
      venue_address: string | null;
      monogram_color: string | null;
      landing_page_hero_image_url?: string | null;
      showcase_featured_at?: string | null;
      showcase_feature_rank?: number | null;
    };

    const featuredAware = await admin
      .from('events')
      .select(
        'slug, display_name, event_date, venue_name, venue_address, monogram_color, landing_page_hero_image_url, showcase_featured_at, showcase_feature_rank',
      )
      .eq('event_type', 'wedding')
      .in('event_id', eventIds)
      .lte('event_date', cutoff)
      .not('slug', 'is', null)
      .order('showcase_feature_rank', { ascending: true, nullsFirst: false })
      .order('showcase_featured_at', { ascending: false, nullsFirst: false })
      .order('event_date', { ascending: false })
      .limit(limit);

    let events = featuredAware.data as EventRow[] | null;
    if (featuredAware.error) {
      // Pre-migration fallback — drop the featuring columns + ordering.
      const legacy = await admin
        .from('events')
        .select('slug, display_name, event_date, venue_name, venue_address, monogram_color, landing_page_hero_image_url')
        .eq('event_type', 'wedding')
        .in('event_id', eventIds)
        .lte('event_date', cutoff)
        .not('slug', 'is', null)
        .order('event_date', { ascending: false })
        .limit(limit);
      events = legacy.data as EventRow[] | null;
    }

    return await Promise.all(
      (events ?? []).map(async (e) => ({
        href: `/${e.slug as string}`,
        coupleNames: e.display_name?.trim() || 'A Setnayan wedding',
        city: deriveCity(e.venue_name, e.venue_address),
        dateLabel: monthYear(e.event_date),
        eventDate: e.event_date ?? null,
        monogramColor: e.monogram_color ?? null,
        featured: e.showcase_featured_at != null,
        featureRank: e.showcase_feature_rank ?? null,
        // Resolve r2:// / relative refs to a display URL; plain http passes through.
        heroImageUrl: e.landing_page_hero_image_url
          ? await displayUrlForStoredAsset(e.landing_page_hero_image_url)
          : null,
        // Clip-as-hero is opt-in and not yet selectable on the DB path.
        heroVideoUrl: null,
      })),
    );
  } catch {
    return [];
  }
}

// ============================================================================
// Admin curation (PR D · Real Stories featuring program)
// ============================================================================
// The Setnayan HQ surface at /admin/real-stories curates which published,
// consent-gated weddings get FEATURED (pinned) and in what ORDER on the public
// /realstories index — and which one fills the hero slot.
//
// Same RA 10173 gate as loadPublishedShowcases (only consented, past-grace,
// public-slug weddings can ever appear) PLUS the event_id + current feature
// state so the admin can act on each row. Featured rows sort first (rank, then
// featured-at), then the rest newest-first — identical to the public order, so
// the admin list mirrors exactly what the public page shows. Unlike the public
// loader this does NOT silently degrade the featuring columns away: the admin
// surface needs them present, so if the migration hasn't run the page shows a
// clear "run the migration" empty state rather than a half-working list.

export type ShowcaseAdminRow = {
  eventId: string;
  slug: string;
  coupleNames: string;
  city: string | null;
  dateLabel: string | null;
  eventDate: string | null;
  featured: boolean;
  featuredAt: string | null;
  featureRank: number | null;
};

export type ShowcaseAdminResult =
  | { ok: true; rows: ShowcaseAdminRow[] }
  // `migration` = the featuring columns don't exist yet (owner hasn't run the
  // db push). `error` = any other read failure. Both render an honest message.
  | { ok: false; reason: 'migration' | 'error' };

export async function loadShowcaseCandidatesForAdmin(
  limit = 100,
): Promise<ShowcaseAdminResult> {
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, reason: 'error' };
  }
  try {
    const cutoff = new Date(Date.now() - GRACE_DAYS * 86_400_000)
      .toISOString()
      .slice(0, 10);

    const { data: consenters } = await admin
      .from('users')
      .select('user_id')
      .not('public_summary_consent_at', 'is', null)
      .is('deleted_at', null);
    const userIds = (consenters ?? []).map((u) => u.user_id as string);
    if (userIds.length === 0) return { ok: true, rows: [] };

    const { data: members } = await admin
      .from('event_members')
      .select('event_id')
      .eq('member_type', 'couple')
      .in('user_id', userIds);
    const eventIds = Array.from(
      new Set((members ?? []).map((m) => m.event_id as string)),
    );
    if (eventIds.length === 0) return { ok: true, rows: [] };

    const { data, error } = await admin
      .from('events')
      .select(
        'event_id, slug, display_name, event_date, venue_name, venue_address, showcase_featured_at, showcase_feature_rank',
      )
      .eq('event_type', 'wedding')
      .in('event_id', eventIds)
      .lte('event_date', cutoff)
      .not('slug', 'is', null)
      .order('showcase_feature_rank', { ascending: true, nullsFirst: false })
      .order('showcase_featured_at', { ascending: false, nullsFirst: false })
      .order('event_date', { ascending: false })
      .limit(limit);

    if (error) {
      // 42703 = undefined_column. PostgREST surfaces it as a 400 with this code
      // when the migration hasn't been applied — tell the admin to run it.
      if (error.code === '42703' || /showcase_featured_at|showcase_feature_rank/.test(error.message)) {
        return { ok: false, reason: 'migration' };
      }
      return { ok: false, reason: 'error' };
    }

    const rows: ShowcaseAdminRow[] = (data ?? []).map((e) => ({
      eventId: e.event_id as string,
      slug: e.slug as string,
      coupleNames: (e.display_name as string | null)?.trim() || 'A Setnayan wedding',
      city: deriveCity(e.venue_name as string | null, e.venue_address as string | null),
      dateLabel: monthYear(e.event_date as string | null),
      eventDate: (e.event_date as string | null) ?? null,
      featured: (e.showcase_featured_at as string | null) != null,
      featuredAt: (e.showcase_featured_at as string | null) ?? null,
      featureRank: (e.showcase_feature_rank as number | null) ?? null,
    }));
    return { ok: true, rows };
  } catch {
    return { ok: false, reason: 'error' };
  }
}
