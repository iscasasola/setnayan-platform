import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  candidateEvents,
  coverColumns,
  rememberedCoverRows,
  rememberedHostRows,
  rememberedPublicPeople,
  rememberedWorldCandidates,
  type CoverRow,
  type CoverRows,
  type HostRows,
} from '@/lib/home-public-reads';
import { ReadRefused, asRead, stableIds } from '@/lib/remembered-read-core';
import { peopleConnectionsEnabled } from '@/lib/people-connections';
import { confirmedConnectionUserIds } from '@/lib/your-people';
import { filterPubliclyVisibleEvents } from '@/lib/public-profile';
import { manilaTodayISO } from '@/lib/event-board';
import { regionBySlug } from '@/lib/region-source';
import { getEventTypeVocab } from '@/lib/event-types-db';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { renderableImageSrc } from '@/lib/event-card-art';
import { resolveHero } from '@/lib/event-hero';
import { sceneCoverFor } from '@/lib/event-poster';
import { resolveEventPoster } from '@/lib/event-poster.server';
import { resolveMonogram } from '@/lib/monogram';
import { resolveEventMonogramSvg } from '@/lib/monogram-svg-safe';
import { logoPlaysFor } from '@/lib/logo-plays.server';
import { guestMainGround } from '@/lib/guest-main-ground';
import { mainGroundIsNone, hubMainGround } from '@/lib/hub-canvas';
import { heroGroundNeedsOwnership, pageGround } from '@/lib/page-ground';
import { siteMediaServeRef } from '@/lib/site-media-ref';
import type { InviteThemeId } from '@/lib/invite-themes';
import { resolveHubTheme, websiteProActiveFor } from '@/app/[slug]/_lib/hub-look';
import { guestLookFrom, type EventShellRow } from '@/app/[slug]/_lib/loaders';
import {
  DISCOVER_CAPS,
  pickViewerRegion,
  selectDiscoverShelves,
  selectPeopleToFollow,
  type DiscoverEventCard,
  type DiscoverEventRow,
  type DiscoverPaper,
  type DiscoverScene,
  paperGroundOf,
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
 *
 * ─── ⚡ WHAT IS REMEMBERED, AND WHAT NEVER IS (2026-10-11) ─────────────────
 * The reads that are the same for every visitor live in
 * `lib/home-public-reads.ts` and are remembered for 60 s: the world's candidate
 * rows, the listed events' hosts, the rows a cover is drawn from, the public
 * profiles. They are ROWS — every decision still runs here, per view, over
 * them: the public gate, the layers, whether a host's name may be shown, the
 * cover (and the ownership read behind a paid look), every signed address.
 * ⛔ Never remembered: anything read with the viewer's id or session — their
 * follows, unfollows, memberships, connections, region, their people's events —
 * and nothing asked through the session client (the event-type gate and labels).
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

/** How many rows each viewer-shaped candidate read pulls before the core caps the shelf. */
const REGION_CANDIDATES = 24;
const PEOPLE_CANDIDATES = 60;
/** Same bound the People page lists at (`FOLLOW_LIST_LIMIT`). */
const MAX_PEOPLE_IDS = 300;
const MAX_MEMBERSHIPS = 500;

type Session = Awaited<ReturnType<typeof createClient>>;
type Admin = ReturnType<typeof createAdminClient>;

/* `candidateEvents` — the one candidate read — moved to `lib/home-public-reads.ts`
   with the world shelf's remembered read; the viewer-shaped reads below (their
   region, their people's events) still build on it, unremembered. */

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

/**
 * Hosts (`member_type = 'couple'`) of the listed events, with PUBLIC names only.
 * The two row reads are remembered (`rememberedHostRows`); the rule that a name
 * travels only with a public profile is applied HERE, on every view.
 */
async function readHosts(eventIds: string[]): Promise<Map<string, DiscoverHost[]> | null> {
  const out = new Map<string, DiscoverHost[]>();
  if (eventIds.length === 0) return out;
  let rows: HostRows;
  try {
    rows = await rememberedHostRows(stableIds(eventIds));
  } catch (caught) {
    // Refused ⇒ nothing was remembered. Logged under the name each read always had.
    const refused = caught instanceof ReadRefused ? caught : null;
    const reason = refused?.reason ?? caught;
    if (refused?.site === 'hostNames') logQueryError('discover-events.hostNames', reason, {}, 'graceful_degrade');
    else logQueryError('discover-events.hosts', reason, {}, 'graceful_degrade');
    return null;
  }
  const members = rows.members.filter(
    (r): r is { event_id: string; user_id: string } => !!r.user_id,
  );
  const profile = new Map<string, { name: string | null; slug: string | null }>();
  for (const u of rows.users) {
    // ⛔ A name travels ONLY with a public profile — see `pickHost` in the core.
    const isPublic = u.public_profile_enabled === true && !u.deleted_at && !!u.slug;
    profile.set(u.user_id, {
      name: isPublic ? u.display_name : null,
      slug: isPublic ? u.slug : null,
    });
  }
  for (const m of members) {
    const p = profile.get(m.user_id);
    const list = out.get(m.event_id) ?? [];
    list.push({ userId: m.user_id, name: p?.name ?? null, publicSlug: p?.slug ?? null });
    out.set(m.event_id, list);
  }
  return out;
}

/* `COVER_COLUMNS` and `CoverRow` — every column `resolveEventPoster` reads, the
   hero photo it is handed and the two logo columns — moved to
   `lib/home-public-reads.ts` with the shelved cards' remembered row read. */

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
 * 🃏 NO PICTURE → THE PAPER CARD. An `invitation` poster (Classic, no hero —
 * Classic never shows a photo) has no picture to wear, so the card draws the
 * dashboard's own paper invitation card from the SAME poster facts (owner
 * 2026-10-03, ruling A). A wake keeps its mark.
 *
 * 🎨 AND IT FOLLOWS WHAT THE COUPLE CUSTOMISED (owner 2026-10-03, amending A:
 * *"if they customized it and changed its main background, it should also
 * adjust"*). The card wears what the guest's Event Hub draws behind the event,
 * from the hub's own answers — never a second resolver:
 *   • their MAIN BACKGROUND (`guestMainGround`, the one gated answer the page
 *     ground asks; Pro media, never on Classic) → that picture, a video as its
 *     still;
 *   • their background COLOUR or ombré (`guestLookFrom` → `paperGroundOf`;
 *     free) → the paper card's ground; and where the hub draws no theme loop
 *     (an ombré, or "None — just the colour") neither does the card.
 * Only PUBLISHED values are read — the event's columns and the live hero row
 * in `invitation_widgets`; an unapplied Maker draft (`event_site_drafts`) never
 * reaches a guest, so it never reaches this card.
 *
 * ⛔ ONLY THE SHELVED CARDS. This runs AFTER `selectDiscoverShelves`, on the
 * ≤ 20 cards that passed the allow-list, so no event that is not public and
 * listed ever has its hero read or presigned here. A refused read costs only
 * the picture — the card keeps its mark, logged — never the card.
 */
async function dressCards(cards: DiscoverEventCard[]): Promise<void> {
  const ids = stableIds(cards.map((c) => c.key));
  if (ids.length === 0) return;
  /*
    ⚡ THE ROWS ARE REMEMBERED; THE COVER IS NOT. Both row reads — the published
    event columns and the LIVE hero rows (`config_json.main`) — are the same for
    every visitor (`rememberedCoverRows`). `dressEventCover` below still runs on
    every view, so the theme gate, the ownership read behind a paid look and
    each signed address are asked now, for this request.
  */
  let rows: CoverRows;
  try {
    rows = await rememberedCoverRows(ids);
  } catch (caught) {
    const partial = caught instanceof ReadRefused ? (caught.partial as CoverRows | undefined) : undefined;
    const reason = caught instanceof ReadRefused && caught.reason ? caught.reason : caught;
    if (!partial) {
      logQueryError('discover-events.covers', reason, {}, 'graceful_degrade');
      return;
    }
    // A refused hero read costs only the Main background — the rest of the card stands.
    logQueryError('discover-events.mainGrounds', reason, {}, 'graceful_degrade');
    rows = partial;
  }
  const heroConfigById = new Map<string, unknown>();
  for (const w of rows.heroes) heroConfigById.set(w.event_id, w.config_json);
  const scenes = new Map<string, DiscoverScene>();
  const papers = new Map<string, DiscoverPaper>();
  await Promise.all(
    rows.covers.map(async (r) => {
      const dressed = await dressEventCover(r, heroConfigById.get(r.event_id) ?? null);
      if (dressed.scene) scenes.set(r.event_id, dressed.scene);
      else if (dressed.paper) papers.set(r.event_id, dressed.paper);
    }),
  );
  for (const c of cards) {
    c.scene = scenes.get(c.key) ?? null;
    c.paper = papers.get(c.key) ?? null;
  }
}

/** What one event's cover wears — Discover's card and the event Home's header (owner 2026-10-07). */
export type DressedEventCover = {
  scene: DiscoverScene | null;
  paper: DiscoverPaper | null;
  /** The Main background's measured frame (`tint.frame`) when the scene IS it; [] = never measured. */
  mainFrame: string[] | null;
  /** The theme the hub wears (`resolveHubTheme`), or null when it could not be read. */
  theme: InviteThemeId | null;
};

/**
 * 🖼 ONE EVENT'S COVER, as the guest's Event Hub draws it — the body `dressCards`
 * runs per card, lifted out so the event Home's header asks the SAME answer
 * (owner 2026-10-07: *"i thought this will use the main background image of the
 * event hub maker?"*) instead of a second resolver. Published values only: the
 * event's columns and the live hero row's `config_json`.
 */
export async function dressEventCover(r: CoverRow, heroConfig: unknown): Promise<DressedEventCover> {
  // The theme the hub wears — the one gate (`resolveHubTheme`).
  const hub = await resolveHubTheme({
    event_id: r.event_id,
    display_name: r.display_name,
    invite_theme: r.invite_theme,
    monogram_text: r.monogram_text,
    monogram_color: r.monogram_color,
    site_button_color: r.site_button_color,
    event_type: r.event_type,
  }).catch(() => null);

  // 1 · THE MAIN BACKGROUND, as the guest's Event Hub draws it. Ownership
  //     is read only where it can change the answer, as the page reads it.
  if (hub) {
    const ownsPro = heroGroundNeedsOwnership(hub.theme)
      ? await websiteProActiveFor(r.event_id).catch(() => false)
      : false;
    const main = guestMainGround(hub.theme, ownsPro, heroConfig, r);
    const mainSrc = main?.stillRef
      ? renderableImageSrc(await displayUrlForStoredAsset(siteMediaServeRef(main.stillRef)).catch(() => null))
      : null;
    if (mainSrc) {
      return { scene: { kind: 'photo', src: mainSrc, ground: 'main', legibility: null }, paper: null, mainFrame: main?.tint?.frame ?? [], theme: hub.theme };
    }
  }

  // The paper the hub paints: their colour or ombré (free). `proActive`
  // only adds the Pro face (`proSiteVarsFor`), which the card never reads.
  const look = hub ? guestLookFrom(r as unknown as EventShellRow, hub, false) : null;

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
      role_palette: r.role_palette,
    },
    heroSrc,
  ).catch(() => null);
  let scene = sceneCoverFor(poster);
  let paperPoster = poster?.kind === 'invitation' ? poster : null;
  // 2 · NO THEME LOOP WHERE THE HUB DRAWS NONE — under an ombré
  //     (`pageGround`) or "None — just the colour": the card is then the
  //     invitation card, which `posterFor` words identically.
  if (
    poster &&
    scene?.kind === 'theme' &&
    hub &&
    (mainGroundIsNone(hubMainGround(heroConfig)) ||
      !pageGround({ theme: hub.theme, ombre: Boolean(look?.ombre), heroGround: false }).themeLoop)
  ) {
    scene = null;
    paperPoster = { ...poster, kind: 'invitation', dark: false, photoSrc: null, ground: null, legibility: null };
  }
  if (scene) return { scene, paper: null, mainFrame: null, theme: hub?.theme ?? null };
  if (paperPoster) {
    // SEC-3: both logo columns are host-writable — read through the gate.
    const markSvg = resolveEventMonogramSvg(r);
    const paper: DiscoverPaper = {
      poster: paperPoster,
      ground: paperGroundOf(look),
      markText: resolveMonogram(r).text,
      markSvg,
      // A logo that does not move costs no read (`logoPlaysFor`).
      markPlays: await logoPlaysFor(r.event_id, markSvg).catch(() => false),
    };
    return { scene: null, paper, mainFrame: null, theme: hub?.theme ?? null };
  }
  return { scene: null, paper: null, mainFrame: null, theme: hub?.theme ?? null };
}

/**
 * One event's cover, read and dressed — the event Home's header (owner
 * 2026-10-07). The PUBLISHED event columns and the LIVE hero row, exactly as
 * `dressCards` reads them; null when the event row could not be read (the
 * caller keeps today's colour). A refused hero read costs only the Main
 * background, as on Discover.
 */
export async function readEventCover(admin: Admin, eventId: string): Promise<DressedEventCover | null> {
  const [ev, hero] = await Promise.all([
    admin.from('events').select(coverColumns()).eq('event_id', eventId).maybeSingle(),
    admin.from('invitation_widgets').select('config_json').eq('event_id', eventId).eq('widget_type', 'hero').maybeSingle(),
  ]);
  if (ev.error || !ev.data) {
    if (ev.error) logQueryError('event-cover.event', ev.error, { event_id: eventId }, 'graceful_degrade');
    return null;
  }
  if (hero.error) logQueryError('event-cover.hero', hero.error, { event_id: eventId }, 'graceful_degrade');
  const heroConfig = (hero.data as { config_json: unknown } | null)?.config_json ?? null;
  return dressEventCover(ev.data as unknown as CoverRow, heroConfig);
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
    // ⚡ The world's candidates are the same for every visitor — remembered.
    // The two reads beside it are shaped by the viewer and are asked every time.
    asRead(rememberedWorldCandidates(todayISO)),
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
    ...(world.data ?? []),
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
    readHosts([...new Set(gated.map((e) => e.event_id))]),
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
  await dressCards([...shelves.people, ...shelves.world]).catch((caught) =>
    logQueryError('discover-events.covers', caught, {}, 'graceful_degrade'),
  );
  return { ok: true, ...shelves };
}

async function readPeopleToFollow(
  me: string | null,
  graph: Extract<ViewerGraph, { ok: true }> | null,
): Promise<ShelfState<PersonToFollowCard>> {
  const exclude = new Set<string>([
    ...(graph?.followed ?? []),
    ...(graph?.unfollowed ?? []),
  ]);
  // ⚡ The most-followed public profiles are the same rows for every visitor —
  // remembered, keyed by how many are asked for. Who is left out (the viewer,
  // anybody they follow or once unfollowed) is decided below, per view; each
  // photo's address is signed per view.
  // Enough rows that excluding everybody already followed still fills the shelf.
  const { data, error } = await asRead(
    rememberedPublicPeople(DISCOVER_CAPS.peopleToFollow + exclude.size + 1),
  );
  if (error || !data) {
    logQueryError('discover-events.peopleToFollow', error, {}, 'graceful_degrade');
    return UNAVAILABLE;
  }
  const rows = data;
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
      readPeopleToFollow(null, null).catch(() => UNAVAILABLE),
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
    readPeopleToFollow(me, graph).catch(() => UNAVAILABLE),
  ]);

  return {
    signedIn: true,
    people: shelves.ok ? { status: 'ok', items: shelves.people } : UNAVAILABLE,
    world: shelves.ok ? { status: 'ok', items: shelves.world } : UNAVAILABLE,
    viewerRegionLabel: regionBySlug(viewerRegion)?.display_label ?? null,
    peopleToFollow,
  };
}
