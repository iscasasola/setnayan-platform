import { createAdminClient } from '@/lib/supabase/admin';
import { LIVE_SHOP_GATE } from '@/lib/live-shops';
import { ReadRefused } from '@/lib/remembered-read-core';
import { HOME_SHELF_TAGS } from '@/lib/home-shelf-tags';
import type { DiscoverEventRow } from '@/lib/discover-events-core';

/**
 * home-public-reads-core.ts — THE HOME PAGE'S SAME-FOR-EVERYONE READS, remembered.
 *
 * `/` asked the database for the same public rows on every view — measured
 * 2026-10-11: 27 calls a view, and one caller asking every 60 seconds. These
 * are the reads whose answer does not depend on who is looking: the listed
 * public events, their hosts, the rows a card's cover is drawn from, the public
 * profiles, the live shops, the featured chapters.
 *
 * ─── WHAT THIS FILE MAY HOLD, AND WHAT IT MAY NEVER REACH ────────────────────
 * • Every read here is made with the SERVICE client and takes no viewer: its
 *   arguments are a date, a list of PUBLIC event ids, or a limit.
 * • ROWS, NOT ANSWERS. Nothing here decides who may see what, what a card says,
 *   or whether an event owns a paid look — those run per request, in the files
 *   that always ran them (`lib/discover-events.ts`, `frontdoor/data.ts`), over
 *   these rows. A host's name still travels only with a public profile because
 *   that rule is applied AFTER this read, on every view.
 * • ROWS, NOT ADDRESSES. A picture's stored ref is remembered; its signed
 *   address (24 h) is made per request by the code that already made it.
 * • ⛔ NO SESSION, NO COOKIE, NO VIEWER-SCOPED CLIENT — not in this file, not
 *   in `lib/home-public-reads.ts`, and not in anything either imports.
 *   `lib/home-reads-remember-nobody.test.ts` walks their import graph and
 *   fails if `next/headers`, the session client, `lib/auth` or the view-as-free
 *   switch is reachable from either.
 *
 * ─── WHY A FACTORY ───────────────────────────────────────────────────────────
 * The reads are built from two things handed in — the store that remembers and
 * the chapters loader (both server-only) — so a test can run every one of them
 * and COUNT the requests a cold view and a warm view send to the database
 * (`lib/home-public-reads.test.ts`). The app's own instance is
 * `lib/home-public-reads.ts`, which hands in the real two and nothing else.
 * ⚠ The SERVICE CLIENT IS NOT HANDED IN. Every read below builds it in place
 * with `createAdminClient()`, so the guards that prove which client makes a
 * read (`lib/security/shop-contact-is-not-session-readable.test.ts`) can see
 * it — a client passed in as a parameter is exactly what they cannot certify.
 *
 * ─── A REFUSED READ IS NEVER REMEMBERED ──────────────────────────────────────
 * Each reader throws `ReadRefused` when the database did not answer. The caller
 * logs it under the name it always logged and says "couldn't load".
 */

/** A storyteller's tile — structurally `StorytellerTileItem` (`lib/storytellers.ts`, a server-only module). */
export type FeaturedChapter = {
  href: string;
  publicId: string;
  title: string;
  kind: string;
  kindLabel: string;
  ownerSlug: string;
  ownerName: string;
  viewCount: number;
  thumbUrl: string | null;
  excerpt: string | null;
  readingMinutes: number | null;
  hasVideo: boolean;
  publishedAt: string | null;
  eventId: string | null;
  featureRank: number | null;
};

/** The two things the reads are built from. */
export type HomePublicReadDeps<C extends FeaturedChapter = FeaturedChapter> = {
  /** `rememberPublicRead` (`lib/remembered-read.ts`) in the app. */
  remember: <A extends unknown[], T>(
    load: (...args: A) => Promise<T>,
    opts: { key: string; tags: string[] },
  ) => (...args: A) => Promise<T>;
  /** `loadFeaturedChaptersResult` (`lib/storytellers.ts`). */
  featuredChapters: (limit: number) => Promise<{ items: C[]; ok: boolean }>;
};

// ─── Discover: the listed public events ─────────────────────────────────────

/** Every `events` column the core reads. `rsvp_ask_config` is reduced to one boolean there. */
const DISCOVER_EVENT_COLUMNS =
  'event_id, slug, display_name, event_date, event_end_date, event_date_precision, event_type, region, archived, landing_page_visibility, scheduled_launch_at, monogram_text, rsvp_ask_config';

/** How many rows the world read pulls before the core caps the shelf. */
const WORLD_CANDIDATES = 60;

type Admin = ReturnType<typeof createAdminClient>;

/**
 * The candidate read, written once. ⚠ Only the SHAPE of the allow-list is
 * pushed into SQL (public · not archived · has a slug · last day not before
 * today) so the limit spends itself on real candidates; the core re-checks
 * every condition, so this cannot widen anything on its own.
 *
 * A private event whose scheduled launch is due but whose page nobody has
 * opened yet is not fetched: `/{slug}` flips the stored value on its first
 * read (`publishSaveTheDate`), and the event lists from then on.
 */
export function candidateEvents(admin: Admin, todayISO: string) {
  return admin
    .from('events')
    .select(DISCOVER_EVENT_COLUMNS)
    .eq('landing_page_visibility', 'public')
    .not('slug', 'is', null)
    .not('archived', 'is', true)
    .or(`event_date.gte.${todayISO},event_end_date.gte.${todayISO}`)
    .order('event_date', { ascending: true });
}

async function readWorldCandidates(todayISO: string): Promise<DiscoverEventRow[]> {
  const { data, error } = await candidateEvents(createAdminClient(), todayISO).limit(WORLD_CANDIDATES);
  if (error) throw new ReadRefused('world', error);
  return (data ?? []) as unknown as DiscoverEventRow[];
}

// ─── Discover: who hosts them ───────────────────────────────────────────────

export type HostMemberRow = { event_id: string; user_id: string | null };
export type HostUserRow = {
  user_id: string;
  display_name: string | null;
  slug: string | null;
  public_profile_enabled: boolean | null;
  deleted_at: string | null;
};
export type HostRows = { members: HostMemberRow[]; users: HostUserRow[] };

/**
 * The `couple` members of the given events and those users' profile rows.
 * ⚠ RAW ROWS. Whether a name may be shown (`public_profile_enabled`, not
 * deleted, has a slug) is decided by the caller on every view — never here.
 */
async function readHostRows(eventIds: string[]): Promise<HostRows> {
  if (eventIds.length === 0) return { members: [], users: [] };
  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from('event_members')
    .select('event_id, user_id, joined_at')
    .in('event_id', eventIds)
    .eq('member_type', 'couple')
    .order('joined_at', { ascending: true });
  if (error) throw new ReadRefused('hosts', error);
  const members = ((rows ?? []) as HostMemberRow[]).map((r) => ({ event_id: r.event_id, user_id: r.user_id }));
  const ids = [...new Set(members.map((m) => m.user_id).filter((id): id is string => !!id))];
  if (ids.length === 0) return { members, users: [] };
  const { data: users, error: usersError } = await admin
    .from('users')
    .select('user_id, display_name, slug, public_profile_enabled, deleted_at')
    .in('user_id', ids);
  if (usersError) throw new ReadRefused('hostNames', usersError);
  return { members, users: (users ?? []) as HostUserRow[] };
}

// ─── Discover: the rows a card's cover is drawn from ────────────────────────

/**
 * Every column `resolveEventPoster` reads, plus the hero photo it is handed and
 * the two logo columns the paper card's mark is resolved from
 * (`resolveEventMonogramSvg` — custom, then uploaded; both read, always).
 */
const COVER_COLUMNS =
  'event_id, display_name, event_date, venue_name, event_type, monogram_text, monogram_color, invite_theme, std_background, landing_page_hero_image_url, landing_page_hero_video_r2_key, monogram_custom_svg, monogram_uploaded_svg, role_palette, site_bg_color, site_button_color, site_font_key, site_art_direction';

/**
 * The cover's columns, for the one other reader of them (`readEventCover`, the
 * event Home's header). ⚠ A FUNCTION, NOT AN EXPORTED `*_COLUMNS` CONSTANT: an
 * exported one is read by `lint:dup-rule` as the canonical list for `events`,
 * and every narrower select of that table in the app would then be reported as
 * a copy that dropped columns. This list was module-private before it moved
 * here and it still is.
 */
export const coverColumns = (): typeof COVER_COLUMNS => COVER_COLUMNS;

export type CoverRow = {
  event_id: string;
  display_name: string | null;
  event_date: string | null;
  venue_name: string | null;
  event_type: string | null;
  monogram_text: string | null;
  monogram_color: string | null;
  invite_theme: string | null;
  std_background: unknown;
  landing_page_hero_image_url: string | null;
  monogram_custom_svg: string | null;
  monogram_uploaded_svg: string | null;
  landing_page_hero_video_r2_key: string | null;
  role_palette: unknown;
  site_bg_color: string | null;
  site_button_color: string | null;
  site_font_key: string | null;
  site_art_direction: string | null;
};

export type HeroConfigRow = { event_id: string; config_json: unknown };
export type CoverRows = { covers: CoverRow[]; heroes: HeroConfigRow[] };

/**
 * The PUBLISHED event columns and the LIVE hero rows of the shelved cards.
 * ⚠ The cover itself is NOT drawn here: which theme the event may wear and
 * whether it owns a paid look are asked per request (`dressEventCover`), so a
 * purchase, a refund or an internal viewer's "view as free" is never remembered.
 *
 * A refused hero read costs only the Main background, as before — so it is
 * thrown WITH the cover rows it did get, and nothing is remembered.
 */
async function readCoverRows(eventIds: string[]): Promise<CoverRows> {
  if (eventIds.length === 0) return { covers: [], heroes: [] };
  const admin = createAdminClient();
  const [cover, hero] = await Promise.all([
    admin.from('events').select(COVER_COLUMNS).in('event_id', eventIds),
    admin
      .from('invitation_widgets')
      .select('event_id, config_json')
      .eq('widget_type', 'hero')
      .in('event_id', eventIds),
  ]);
  if (cover.error) throw new ReadRefused('covers', cover.error);
  const covers = (cover.data ?? []) as unknown as CoverRow[];
  if (hero.error) throw new ReadRefused<CoverRows>('mainGrounds', hero.error, { covers, heroes: [] });
  return { covers, heroes: (hero.data ?? []) as HeroConfigRow[] };
}

// ─── Discover: people to follow ─────────────────────────────────────────────

export type PublicPersonRow = {
  user_id: string;
  slug: string | null;
  display_name: string | null;
  followers_count: number | null;
  public_id: string | null;
  public_profile_enabled: boolean | null;
  deleted_at: string | null;
  profile_photo_url: string | null;
};

/** The most-followed PUBLIC profiles. `profile_photo_url` is a stored ref — signed per request. */
async function readPublicPeople(limit: number): Promise<PublicPersonRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('users')
    .select('user_id, slug, display_name, followers_count, public_id, public_profile_enabled, deleted_at, profile_photo_url')
    .eq('public_profile_enabled', true)
    .is('deleted_at', null)
    .not('slug', 'is', null)
    .order('followers_count', { ascending: false })
    .limit(limit);
  if (error) throw new ReadRefused('peopleToFollow', error);
  return (data ?? []) as PublicPersonRow[];
}

// ─── The front door: live shops ─────────────────────────────────────────────

/** The columns both shop readers need, named once. */
const SHOP_COLUMNS =
  'business_name, business_slug, location_city, services, verification_state, next_renewal_due_at, logo_url';

/** The same list for the front door's shop SEARCH — a function for the reason `coverColumns` is one. */
export const shopColumns = (): typeof SHOP_COLUMNS => SHOP_COLUMNS;

export type LiveShopRows = { rows: Record<string, unknown>[]; count: number | null };
/** What a refused shop read still knows: either half may have answered. */
export type LiveShopRefusal = LiveShopRows & { countError: unknown; rowsError: unknown };

/**
 * The shelf's shop rows and the exact count of live shops.
 *
 * The COUNT is its own exact read — the shelf is capped at `limit`, so counting
 * the returned rows would silently under-report the moment a thirteenth shop
 * opens, which is precisely when the threshold matters.
 *
 * ⚠ `logo_url` is the stored `r2://` tag; the card's address is resolved per
 * request (`toFrontDoorShop`). If EITHER half is refused nothing is remembered
 * and the half that answered travels on the refusal.
 */
async function readLiveShopRows(limit: number): Promise<LiveShopRows> {
  const admin = createAdminClient();
  const [counted, listed] = await Promise.all([
    admin.from('vendor_profiles').select('vendor_profile_id', { count: 'exact', head: true }).match(LIVE_SHOP_GATE),
    admin
      .from('vendor_profiles')
      .select(SHOP_COLUMNS)
      .match(LIVE_SHOP_GATE)
      .order('created_at', { ascending: false })
      .limit(limit),
  ]);
  const count = counted.error ? null : (counted.count ?? null);
  const rows = listed.error ? [] : ((listed.data ?? []) as unknown as Record<string, unknown>[]);
  if (counted.error || listed.error || count === null) {
    throw new ReadRefused<LiveShopRefusal>('liveShops', counted.error ?? listed.error, {
      rows,
      count,
      countError: counted.error ?? null,
      rowsError: listed.error ?? null,
    });
  }
  return { rows, count };
}

// ─── The front door: featured storyteller chapters ──────────────────────────

/**
 * The public shelf read, whole — `loadFeaturedChaptersResult` already refuses a
 * chapter whose owner has no public profile, and its poster is a YouTube
 * address, never a signed one. A failed read (`ok: false`) is thrown, so it is
 * never remembered as "no stories".
 */
async function readFeaturedChapters<C extends FeaturedChapter>(deps: HomePublicReadDeps<C>, limit: number): Promise<C[]> {
  const result = await deps.featuredChapters(limit);
  if (!result.ok) throw new ReadRefused('featuredChapters');
  return result.items;
}

// ─── The remembered reads ───────────────────────────────────────────────────

/**
 * Builds the six remembered reads. Ids are passed through `stableIds` by the
 * caller — one spelling of a set is one entry.
 */
export function makeHomePublicReads<C extends FeaturedChapter>(deps: HomePublicReadDeps<C>) {
  return {
    /** The world shelf's candidates for one Manila day — the same rows for every visitor. */
    rememberedWorldCandidates: deps.remember((todayISO: string) => readWorldCandidates(todayISO), {
      key: 'home:discover-world-v1',
      tags: [HOME_SHELF_TAGS.events],
    }),
    /** The listed events' `couple` members and their profile rows. */
    rememberedHostRows: deps.remember((eventIds: string[]) => readHostRows(eventIds), {
      key: 'home:discover-hosts-v1',
      tags: [HOME_SHELF_TAGS.events, HOME_SHELF_TAGS.people],
    }),
    /** The rows a shelved card's cover is drawn from. */
    rememberedCoverRows: deps.remember((eventIds: string[]) => readCoverRows(eventIds), {
      key: 'home:discover-covers-v1',
      tags: [HOME_SHELF_TAGS.events],
    }),
    /** The most-followed public profiles. */
    rememberedPublicPeople: deps.remember((limit: number) => readPublicPeople(limit), {
      key: 'home:discover-people-v1',
      tags: [HOME_SHELF_TAGS.people],
    }),
    /** The shop shelf's rows and the exact live count. */
    rememberedLiveShopRows: deps.remember((limit: number) => readLiveShopRows(limit), {
      key: 'home:live-shops-v1',
      tags: [HOME_SHELF_TAGS.shops],
    }),
    /** The featured storyteller chapters. */
    rememberedFeaturedChapters: deps.remember((limit: number) => readFeaturedChapters(deps, limit), {
      key: 'home:featured-chapters-v1',
      tags: [HOME_SHELF_TAGS.stories, HOME_SHELF_TAGS.people],
    }),
  };
}
