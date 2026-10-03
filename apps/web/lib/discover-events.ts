import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { peopleConnectionsEnabled } from '@/lib/people-connections';
import { confirmedConnectionUserIds } from '@/lib/your-people';
import { filterPubliclyVisibleEvents } from '@/lib/public-profile';
import { manilaTodayISO } from '@/lib/event-board';
import { regionBySlug } from '@/lib/region-source';
import { getEventTypeVocab } from '@/lib/event-types-db';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { renderableImageSrc } from '@/lib/event-card-art';
import { resolveHero } from '@/lib/event-hero';
import { sceneCoverFor, type SceneCover } from '@/lib/event-poster';
import { resolveEventPoster } from '@/lib/event-poster.server';
import {
  DISCOVER_CAPS,
  pickViewerRegion,
  selectDiscoverShelves,
  selectPeopleToFollow,
  type DiscoverEventCard,
  type DiscoverEventRow,
  type DiscoverHost,
  type DiscoverRelation,
  type PersonCandidate,
} from '@/lib/discover-events-core';

/**
 * discover-events.ts — the I/O half of Discover's new shelves. It READS; the
 * pure `lib/discover-events-core.ts` DECIDES (allow-list, layers, order, caps).
 *
 * ─── WHO MAY SEE WHAT ─────────────────────────────────────────────────────
 * • Only PUBLIC events reach a card (the core's allow-list, after the same
 *   `filterPubliclyVisibleEvents` gate the public profile uses).
 * • The viewer's follows, unfollows, memberships and connections are read
 *   under THEIR OWN session and scoped to them explicitly
 *   (`follower_user_id = me`, `user_id = me`). RLS is a floor, not a scope:
 *   `user_follows` also admits `is_admin()`, and production's admin is the
 *   owner's own account — a policy-scoped read would hand him every follow in
 *   the database and look fine (the `your-people.ts` lesson).
 * • The admin client is used for PUBLIC lookups only: public events, their
 *   hosts, and public profiles. No user id, and no follow edge, ever reaches
 *   the page — a card carries a public slug and a name, nothing else. Who
 *   follows whom beyond the viewer's own list is never read at all.
 *
 * ─── A REFUSED READ IS NOT AN EMPTY SHELF ─────────────────────────────────
 * Every shelf is `{ status: 'ok', items }` or `{ status: 'unavailable' }`.
 * The render says "couldn't load" for the second and a written invitation for
 * an empty first — never "no events" for a read that failed. A rejected
 * Supabase query resolves `{ data: null, error }`; every read below checks
 * `error` explicitly, because there is nothing for a `catch` to catch.
 *
 * 💸 NAMED COST. Signed out: 4 reads (upcoming public events, their hosts'
 * names, the shelved cards' covers, public profiles) + the event-type
 * vocabulary (React-cached). Signed in: up to 5 more, each small and scoped to
 * the viewer's own ids. The covers add one presign per card with a hero photo,
 * and — only for a Pro theme — the hub's ownership read (`resolveHubLook`).
 */

export type ShelfState<T> = { status: 'ok'; items: T[] } | { status: 'unavailable' };

export type PersonToFollowCard = {
  key: string;
  name: string;
  slug: string;
  /** `users.public_id` — the handle the Follow button acts on. Never a user id. */
  publicId: string | null;
  followers: number;
  photoUrl: string | null;
};

export type DiscoverData = {
  signedIn: boolean;
  /** `null` for a stranger — the shelf never mounts for somebody who follows nobody. */
  people: ShelfState<DiscoverEventCard> | null;
  world: ShelfState<DiscoverEventCard>;
  /** The region the world shelf puts first, as a label, or null. */
  viewerRegionLabel: string | null;
  peopleToFollow: ShelfState<PersonToFollowCard>;
};

const UNAVAILABLE = { status: 'unavailable' } as const;

/** Every `events` column the core reads. `rsvp_ask_config` is reduced to one boolean there. */
const DISCOVER_EVENT_COLUMNS =
  'event_id, slug, display_name, event_date, event_end_date, event_date_precision, event_type, region, archived, landing_page_visibility, scheduled_launch_at, monogram_text, rsvp_ask_config';

/** How many rows each candidate read pulls before the core caps the shelf. */
const WORLD_CANDIDATES = 60;
const REGION_CANDIDATES = 24;
const PEOPLE_CANDIDATES = 60;
/** Same bound the People page lists at (`FOLLOW_LIST_LIMIT`). */
const MAX_PEOPLE_IDS = 300;
const MAX_MEMBERSHIPS = 500;

type Session = Awaited<ReturnType<typeof createClient>>;
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
function candidateEvents(admin: Admin, todayISO: string) {
  return admin
    .from('events')
    .select(DISCOVER_EVENT_COLUMNS)
    .eq('landing_page_visibility', 'public')
    .not('slug', 'is', null)
    .not('archived', 'is', true)
    .or(`event_date.gte.${todayISO},event_end_date.gte.${todayISO}`)
    .order('event_date', { ascending: true });
}

type ViewerGraph =
  | { ok: false }
  | {
      ok: true;
      people: Map<string, DiscoverRelation>;
      followed: Set<string>;
      unfollowed: Set<string>;
      memberEventIds: Set<string>;
      memberships: Array<{ event_id: string; joined_at: string | null }>;
    };

/** The viewer's own rows, read under their own session and scoped to them. */
async function readViewerGraph(supabase: Session, me: string): Promise<ViewerGraph> {
  const [follows, unfollows, members, connected] = await Promise.all([
    supabase
      .from('user_follows')
      .select('followed_user_id')
      .eq('follower_user_id', me)
      .limit(MAX_PEOPLE_IDS),
    supabase
      .from('user_unfollows')
      .select('followed_user_id')
      .eq('follower_user_id', me)
      .limit(MAX_PEOPLE_IDS),
    supabase
      .from('event_members')
      .select('event_id, joined_at')
      .eq('user_id', me)
      .limit(MAX_MEMBERSHIPS),
    peopleConnectionsEnabled()
      ? confirmedConnectionUserIds(supabase, me)
      : Promise.resolve([] as string[]),
  ]);

  if (follows.error) {
    logQueryError('discover-events.follows', follows.error, {}, 'graceful_degrade');
    return { ok: false };
  }
  if (members.error) {
    // Without it the shelf could list the viewer's OWN events and could not
    // find their region — so it says it could not load rather than guess.
    logQueryError('discover-events.memberships', members.error, {}, 'graceful_degrade');
    return { ok: false };
  }
  if (connected === null) return { ok: false };
  // The tombstones only QUIET the People-to-follow shelf; losing them costs a
  // suggestion the viewer once unfollowed, never a wrong claim.
  if (unfollows.error) {
    logQueryError('discover-events.unfollows', unfollows.error, {}, 'graceful_degrade');
  }

  const people = new Map<string, DiscoverRelation>();
  const followed = new Set<string>();
  for (const r of (follows.data ?? []) as Array<{ followed_user_id: string | null }>) {
    if (r.followed_user_id && r.followed_user_id !== me) {
      followed.add(r.followed_user_id);
      people.set(r.followed_user_id, 'follow');
    }
  }
  for (const id of connected) if (id && id !== me) people.set(id, 'connected');

  const unfollowed = new Set<string>();
  for (const r of (unfollows.data ?? []) as Array<{ followed_user_id: string | null }>) {
    if (r.followed_user_id) unfollowed.add(r.followed_user_id);
  }

  const memberships = ((members.data ?? []) as Array<{ event_id: string; joined_at: string | null }>)
    .filter((m) => !!m.event_id);
  return {
    ok: true,
    people,
    followed,
    unfollowed,
    memberEventIds: new Set(memberships.map((m) => m.event_id)),
    memberships,
  };
}

/** The viewer's region: their most recent membership's `events.region`. */
async function readViewerRegion(
  admin: Admin,
  memberships: Array<{ event_id: string; joined_at: string | null }>,
): Promise<string | null> {
  if (memberships.length === 0) return null;
  const { data, error } = await admin
    .from('events')
    .select('event_id, region')
    // Ids from the viewer's OWN membership read — never an unscoped scan.
    .in('event_id', memberships.map((m) => m.event_id))
    .not('region', 'is', null);
  if (error) {
    // Region only ORDERS the world shelf; unknown falls back to soonest first.
    logQueryError('discover-events.viewerRegion', error, {}, 'graceful_degrade');
    return null;
  }
  const regionOf = new Map(
    ((data ?? []) as Array<{ event_id: string; region: string | null }>).map((r) => [
      r.event_id,
      r.region,
    ]),
  );
  return pickViewerRegion(
    memberships.map((m) => ({ region: regionOf.get(m.event_id) ?? null, joined_at: m.joined_at })),
  );
}

/** Hosts (`member_type = 'couple'`) of the listed events, with PUBLIC names only. */
async function readHosts(
  admin: Admin,
  eventIds: string[],
): Promise<Map<string, DiscoverHost[]> | null> {
  const out = new Map<string, DiscoverHost[]>();
  if (eventIds.length === 0) return out;
  const { data: rows, error } = await admin
    .from('event_members')
    .select('event_id, user_id, joined_at')
    .in('event_id', eventIds)
    .eq('member_type', 'couple')
    .order('joined_at', { ascending: true });
  if (error) {
    logQueryError('discover-events.hosts', error, {}, 'graceful_degrade');
    return null;
  }
  const members = ((rows ?? []) as Array<{ event_id: string; user_id: string | null }>).filter(
    (r): r is { event_id: string; user_id: string } => !!r.user_id,
  );
  const ids = [...new Set(members.map((m) => m.user_id))];
  const profile = new Map<string, { name: string | null; slug: string | null }>();
  if (ids.length > 0) {
    const { data: users, error: usersError } = await admin
      .from('users')
      .select('user_id, display_name, slug, public_profile_enabled, deleted_at')
      .in('user_id', ids);
    if (usersError) {
      logQueryError('discover-events.hostNames', usersError, {}, 'graceful_degrade');
      return null;
    }
    for (const u of (users ?? []) as Array<{
      user_id: string;
      display_name: string | null;
      slug: string | null;
      public_profile_enabled: boolean | null;
      deleted_at: string | null;
    }>) {
      // ⛔ A name travels ONLY with a public profile — see `pickHost` in the core.
      const isPublic = u.public_profile_enabled === true && !u.deleted_at && !!u.slug;
      profile.set(u.user_id, {
        name: isPublic ? u.display_name : null,
        slug: isPublic ? u.slug : null,
      });
    }
  }
  for (const m of members) {
    const p = profile.get(m.user_id);
    const list = out.get(m.event_id) ?? [];
    list.push({ userId: m.user_id, name: p?.name ?? null, publicSlug: p?.slug ?? null });
    out.set(m.event_id, list);
  }
  return out;
}

/** Every column `resolveEventPoster` reads, plus the hero photo it is handed. */
const COVER_COLUMNS =
  'event_id, display_name, event_date, venue_name, event_type, monogram_text, monogram_color, invite_theme, std_background, landing_page_hero_image_url';

type CoverRow = {
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
};

/**
 * 🖼 THE CARD WEARS THE EVENT'S COVER — the dashboard card's, not a second one.
 *
 * Owner, 2026-10-03, on the cale-ice card: *"why is the cover like this? it
 * should have adjusted."* Discover drew only the mark. The cover is now read
 * through `resolveEventPoster` — the ONE resolver the home board, the Overview
 * and the Maker ask (hero photo → Save-the-Date background, Pro-gated by the
 * hub → the theme's still) — and narrowed by `sceneCoverFor`, the form a card
 * with its words printed beside the picture (not on it) wears.
 *
 * ⛔ ONLY THE SHELVED CARDS. This runs AFTER `selectDiscoverShelves`, on the
 * ≤ 20 cards that passed the allow-list, so no event that is not public and
 * listed ever has its hero read or presigned here. A refused read costs only
 * the picture — the card keeps its mark, logged — never the card.
 */
async function dressCards(admin: Admin, cards: DiscoverEventCard[]): Promise<void> {
  const ids = [...new Set(cards.map((c) => c.key))];
  if (ids.length === 0) return;
  const { data, error } = await admin.from('events').select(COVER_COLUMNS).in('event_id', ids);
  if (error) {
    logQueryError('discover-events.covers', error, {}, 'graceful_degrade');
    return;
  }
  const scenes = new Map<string, SceneCover>();
  await Promise.all(
    ((data ?? []) as unknown as CoverRow[]).map(async (r) => {
      // The column is host-writable; only a real image URL reaches an <img>.
      const heroSrc = renderableImageSrc(
        await displayUrlForStoredAsset(resolveHero(r).photoRef).catch(() => null),
      );
      const poster = await resolveEventPoster(
        {
          event_id: r.event_id,
          display_name: r.display_name ?? '',
          event_date: r.event_date,
          venue_name: r.venue_name,
          event_type: r.event_type ?? '',
          monogram_text: r.monogram_text,
          monogram_color: r.monogram_color,
          invite_theme: r.invite_theme,
          std_background: r.std_background,
        },
        heroSrc,
      ).catch(() => null);
      const scene = sceneCoverFor(poster);
      if (scene) scenes.set(r.event_id, scene);
    }),
  );
  for (const c of cards) c.scene = scenes.get(c.key) ?? null;
}

async function readTypeLabels(): Promise<Map<string, string>> {
  try {
    const vocab = await getEventTypeVocab();
    return new Map(vocab.map((t) => [t.key, t.label]));
  } catch {
    // A missing label drops the tag from the card; it never hides the card.
    return new Map();
  }
}

type EventShelves =
  | { ok: false }
  | { ok: true; people: DiscoverEventCard[]; world: DiscoverEventCard[] };

async function readEventShelves(
  admin: Admin,
  graph: Extract<ViewerGraph, { ok: true }> | null,
  viewerRegion: string | null,
  todayISO: string,
): Promise<EventShelves> {
  const region = regionBySlug(viewerRegion);
  const peopleIds = graph ? [...graph.people.keys()].slice(0, MAX_PEOPLE_IDS) : [];

  const [world, inRegion, hostedByPeople] = await Promise.all([
    candidateEvents(admin, todayISO).limit(WORLD_CANDIDATES),
    region
      ? candidateEvents(admin, todayISO)
          .in('region', [region.slug, ...region.aliases])
          .limit(REGION_CANDIDATES)
      : null,
    peopleIds.length > 0
      ? admin
          .from('event_members')
          .select('event_id')
          .in('user_id', peopleIds)
          .eq('member_type', 'couple')
          .limit(MAX_MEMBERSHIPS)
      : null,
  ]);

  if (world.error) {
    logQueryError('discover-events.world', world.error, {}, 'graceful_degrade');
    return { ok: false };
  }
  if (inRegion?.error) {
    logQueryError('discover-events.region', inRegion.error, {}, 'graceful_degrade');
    return { ok: false };
  }
  if (hostedByPeople?.error) {
    logQueryError('discover-events.peopleHosted', hostedByPeople.error, {}, 'graceful_degrade');
    return { ok: false };
  }

  let peopleRows: DiscoverEventRow[] = [];
  const hostedIds = [
    ...new Set(
      ((hostedByPeople?.data ?? []) as Array<{ event_id: string | null }>)
        .map((r) => r.event_id)
        .filter((id): id is string => !!id),
    ),
  ];
  if (hostedIds.length > 0) {
    const { data, error } = await candidateEvents(admin, todayISO)
      .in('event_id', hostedIds)
      .limit(PEOPLE_CANDIDATES);
    if (error) {
      logQueryError('discover-events.peopleEvents', error, {}, 'graceful_degrade');
      return { ok: false };
    }
    peopleRows = (data ?? []) as unknown as DiscoverEventRow[];
  }

  const all: DiscoverEventRow[] = [
    ...peopleRows,
    ...((inRegion?.data ?? []) as unknown as DiscoverEventRow[]),
    ...((world.data ?? []) as unknown as DiscoverEventRow[]),
  ];

  // THE public gate — the same function the public profile asks. Adds the
  // event type's website surface: a type with no public page is never listed.
  const gated = await filterPubliclyVisibleEvents(
    all.map((e) => ({
      ...e,
      landing_page_visibility: e.landing_page_visibility as 'public' | 'unlisted' | 'private' | null,
    })),
  );

  const [hosts, typeLabels] = await Promise.all([
    readHosts(admin, [...new Set(gated.map((e) => e.event_id))]),
    readTypeLabels(),
  ]);
  // Without the hosts no event can be placed in its layer honestly.
  if (!hosts) return { ok: false };

  const shelves = selectDiscoverShelves({
    events: gated,
    hostsByEvent: hosts,
    people: graph?.people ?? new Map(),
    memberEventIds: graph?.memberEventIds ?? new Set(),
    viewerRegion,
    todayISO,
    now: Date.now(),
    typeLabels,
  });
  await dressCards(admin, [...shelves.people, ...shelves.world]).catch((caught) =>
    logQueryError('discover-events.covers', caught, {}, 'graceful_degrade'),
  );
  return { ok: true, ...shelves };
}

async function readPeopleToFollow(
  admin: Admin,
  me: string | null,
  graph: Extract<ViewerGraph, { ok: true }> | null,
): Promise<ShelfState<PersonToFollowCard>> {
  const exclude = new Set<string>([
    ...(graph?.followed ?? []),
    ...(graph?.unfollowed ?? []),
  ]);
  const { data, error } = await admin
    .from('users')
    .select('user_id, slug, display_name, followers_count, public_id, public_profile_enabled, deleted_at, profile_photo_url')
    .eq('public_profile_enabled', true)
    .is('deleted_at', null)
    .not('slug', 'is', null)
    .order('followers_count', { ascending: false })
    // Enough rows that excluding everybody already followed still fills the shelf.
    .limit(DISCOVER_CAPS.peopleToFollow + exclude.size + 1);
  if (error) {
    logQueryError('discover-events.peopleToFollow', error, {}, 'graceful_degrade');
    return UNAVAILABLE;
  }
  const rows = (data ?? []) as Array<{
    user_id: string;
    slug: string | null;
    display_name: string | null;
    followers_count: number | null;
    public_id: string | null;
    public_profile_enabled: boolean | null;
    deleted_at: string | null;
    profile_photo_url: string | null;
  }>;
  const photoRef = new Map(rows.map((r) => [r.user_id, r.profile_photo_url]));
  const candidates: PersonCandidate[] = rows.map((r) => ({
    userId: r.user_id,
    slug: r.slug,
    displayName: r.display_name,
    followersCount: r.followers_count,
    publicId: r.public_id,
    publicProfileEnabled: r.public_profile_enabled,
    deletedAt: r.deleted_at,
  }));
  const picked = selectPeopleToFollow(candidates, { viewerId: me, exclude });
  const items: PersonToFollowCard[] = [];
  for (const p of picked) {
    // Owner 2026-09-23: turning the public profile ON is the consent to show
    // the photo. A private-bucket ref resolves to null, and the initials show.
    const photoUrl = renderableImageSrc(
      await displayUrlForStoredAsset(photoRef.get(p.userId) ?? null).catch(() => null),
    );
    items.push({
      key: p.slug as string,
      name: (p.displayName ?? '').trim(),
      slug: p.slug as string,
      publicId: p.publicId,
      followers: Math.max(0, Number(p.followersCount ?? 0)),
      photoUrl,
    });
  }
  return { status: 'ok', items };
}

/**
 * Everything Discover's new shelves render. Each shelf degrades on its own: a
 * broken follow read never blanks the world, and a broken world read never
 * blanks People to follow.
 */
export async function loadDiscover(): Promise<DiscoverData> {
  let admin: Admin;
  let supabase: Session;
  try {
    admin = createAdminClient();
    supabase = await createClient();
  } catch (e) {
    logQueryError('discover-events.clients', e, {}, 'graceful_degrade');
    return {
      signedIn: false,
      people: null,
      world: UNAVAILABLE,
      viewerRegionLabel: null,
      peopleToFollow: UNAVAILABLE,
    };
  }

  let me: string | null = null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    me = user?.id ?? null;
  } catch {
    me = null;
  }

  const todayISO = manilaTodayISO();

  if (!me) {
    const [shelves, peopleToFollow] = await Promise.all([
      readEventShelves(admin, null, null, todayISO).catch(() => ({ ok: false }) as const),
      readPeopleToFollow(admin, null, null).catch(() => UNAVAILABLE),
    ]);
    return {
      signedIn: false,
      people: null,
      world: shelves.ok ? { status: 'ok', items: shelves.world } : UNAVAILABLE,
      viewerRegionLabel: null,
      peopleToFollow,
    };
  }

  const graph = await readViewerGraph(supabase, me).catch(() => ({ ok: false }) as const);
  if (!graph.ok) {
    // Without the viewer's own rows no shelf can keep its promises: the people
    // shelf cannot find their people, the world could list their own events,
    // and People to follow could suggest somebody they already follow.
    return {
      signedIn: true,
      people: UNAVAILABLE,
      world: UNAVAILABLE,
      viewerRegionLabel: null,
      peopleToFollow: UNAVAILABLE,
    };
  }

  const viewerRegion = await readViewerRegion(admin, graph.memberships).catch(() => null);
  const [shelves, peopleToFollow] = await Promise.all([
    readEventShelves(admin, graph, viewerRegion, todayISO).catch(() => ({ ok: false }) as const),
    readPeopleToFollow(admin, me, graph).catch(() => UNAVAILABLE),
  ]);

  return {
    signedIn: true,
    people: shelves.ok ? { status: 'ok', items: shelves.people } : UNAVAILABLE,
    world: shelves.ok ? { status: 'ok', items: shelves.world } : UNAVAILABLE,
    viewerRegionLabel: regionBySlug(viewerRegion)?.display_label ?? null,
    peopleToFollow,
  };
}
