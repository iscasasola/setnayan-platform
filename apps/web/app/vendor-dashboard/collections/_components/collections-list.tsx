'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AtSign,
  BookImage,
  BookOpen,
  Camera,
  ChevronRight,
  Images,
  LayoutGrid,
  Link2,
  Music,
  Palette,
  Pencil,
  Play,
  Send,
  Share,
  Sparkles,
  Users,
} from 'lucide-react';
import { Fold } from '@/app/_components/fold';
import { COLLECTION_SECTION_NAME, collectionRows, type CollectionsInput } from '@/lib/supplier-collections';
import { formatCount } from '@/lib/format-number';
import { parseVideoLink } from '@/lib/video-embed';
import { videoRowName } from '@/lib/video-link-titles';
import type { PortfolioAlbum, PortfolioGroups } from '@/lib/portfolio-groups';
import type { PortfolioUploadFacts } from '@/lib/portfolio-upload-facts';
import { INSPIRATION_LIBRARY_HREF, INSPIRATION_LIBRARY_ROW } from '@/lib/inspiration-library-entry';
import { AddTile, EmptyRail, PortfolioSection, Rail, Tile, WayBody, type Door, type GroupRise } from './portfolio-sections';
import { TOP_UP_WORDS } from '@/lib/booking-fee-top-up';
import { AlbumGrids, OpenedCollection, PhotoGrid, SONG_BANK_HREF, VideoLinks, type OpenedPhotos } from './portfolio-groups';
import { RiseScreen } from '@/app/_components/rise/rise-screen';
import { InfoTip } from '@/app/_components/info-tip';
import {
  ALBUM_STATS_UNREAD,
  ALBUM_UNCOUNTED_NOTE,
  PLACES_UNREAD_LINE,
  albumMatches,
  albumRowHeading,
  albumRowLine,
  albumViewsLabel,
  portfolioAlbums,
  showKeepsAlbum,
  showKeepsWay,
  sortAlbums,
  type AlbumStats,
  type PortfolioShow,
  type PortfolioSort,
  type PortfolioWay,
  type RowAlbum,
} from '@/lib/portfolio-albums';
import { recordAlbumOpen } from '@/lib/portfolio-album-opens';

/**
 * 🖼 PORTFOLIO — THE COLLECTIONS, AS THE CONTENT ITSELF (owner 9 Nov: *"Shouldnt this be in settings?"* · *"we need to
 * improve the look"* · *"And the content"* · *"This is my apple photos"*; DECISION_LOG 2026-11-09 "PORTFOLIO IS
 * REDESIGNED AFTER APPLE PHOTOS › COLLECTIONS" + "PORTFOLIO PROTOTYPE APPROVED FOR BUILD 5"; 2026-11-11 "SUPPLIER ASKS
 * b–e ANSWERED" (c)(d)). The contract is the approved prototype
 * `prototypes/shop_discounts_bundle_card_open_2026-11-09/portfolio.html` (artifact SwnvjGzHNhgHML7X34F3fL v3).
 *
 *   SECTIONS   one per collection, in the prototype's order: On my page · Service cards · Albums by event · Your own
 *              shots · Delivered to couples · Instagram · Moodboard library · Song bank · Stories couples published ·
 *              Video links — each a titled section (› opens, ˅ folds) holding a rail of large photo tiles with the
 *              name on the photo (`portfolio-sections.tsx`). EVERY COLLECTION IS KEPT: Lane E's cards are reorganized
 *              into these rails, none dropped (Moodboard library and Song bank stay their own categories' only).
 *   EMPTY      a section is never hidden: the greyed Example tile + the placeholder tile with its one door. On my page's
 *              door is Upload — the device's picker in place (owner 11 Nov "c. yes").
 *   MORE       the utility collections as a 2-column pill grid: All photos · Video links · Inspiration you curated.
 *   WHO SEES IT the who-pills, the "show on my page" switch and the ✓ "pick for Show" LEFT this list for the Portfolio's
 *              OWN ⚙ (`portfolio-settings.tsx`) — owner 11 Nov (d): collections stay in Portfolio, their settings in
 *              its ⚙, NOT Shop › Settings. The "Everything" filter and "7 collections · one place" are dropped (approved
 *              (6)): Search photos narrows every rail, and who-sees-it is a setting.
 *   RISE       every titled head (› ) RISES ITS WHOLE GROUP FULL SCREEN from where it sits — the one `RiseScreen`,
 *              title + count, the group as a full-screen grid, ✕ falls back into the head (owner 10 Nov, "FULLY
 *              ANIMATED MOSTLY MEANS RISE FULL SCREEN"). A tile still opens its one collection in the body panel.
 *   ADD PHOTOS the shipped gallery editors stay at the foot, in the `#gallery-media` fold the thumb row's ＋ and
 *              Instagram's OAuth callback open.
 *
 * 🔑 NO NEW READ AND NO NEW TABLE — every tile is a store `collections-data.ts` already reads. 🔑 A REFUSED READ SAYS
 * "Couldn't load" and never wears an Example.
 *   BEST WORK  (ruling 5940) the FIRST section: the page photos couples opened most (`lib/portfolio-best-work.ts`, the
 *              shipped view counter). Empty = its title, the placeholder tile and the Upload door.
 *   REORDER    (removed 2026-11-19, Portfolio simpler — four fixed ways in leave nothing to reorder; `portfolio_section_order` stays stored, unused)
 *              The ↑ ↓ sheet was removed with it; `lib/portfolio-section-order.ts` stays for the stored column.
 * 🔒 collections/the-portfolio-is-collections.test.ts
 */

const SECTION_NAME = COLLECTION_SECTION_NAME;

type Open = { kind: 'photos'; key: string; photos: OpenedPhotos; origin: HTMLElement | null };

const n = (x: number, one: string, many: string) => `${formatCount(x)} ${x === 1 ? one : many}`;
const ic = (Icon: typeof Images) => <Icon aria-hidden strokeWidth={1.9} />;

export function CollectionsList({
  input,
  gallery,
  groups,
  allPhotos = [],
  instagramPhotos = [],
  libraryOpen = false,
  videoLinks = [],
  videoTitles = {},
  moodboard = null,
  songs = 'off',
  uploadFacts = null,
  vendorId,
  albumStats = ALBUM_STATS_UNREAD,
  show = 'all',
  sort = 'most',
  words = '',
  gear = null,
  editOpen = false,
  placesUnread = false,
  onNothing,
  drawAll = false,
}: {
  input: CollectionsInput;
  /** The shipped gallery editors (portfolio · videos · Instagram), mounted in the Add photos fold. */
  gallery: ReactNode;
  /** The albums by event · by service card · the curated looks · the stories (`lib/portfolio-groups.ts`). */
  groups: PortfolioGroups;
  /** The page gallery's display URLs, newest first. */
  allPhotos?: string[];
  /** The connected Instagram's posts (display URLs) — already read for the gallery editor. */
  instagramPhotos?: string[];
  libraryOpen?: boolean;
  videoLinks?: string[];
  videoTitles?: Record<string, string> | null;
  moodboard?: { looks: number; declined: number } | null;
  songs?: { count: number; withVideo: number } | null | 'off';
  /** The ONE uploader's facts (free room, wallet) — the empty On my page's Upload opens the picker in place. */
  uploadFacts?: PortfolioUploadFacts | null;
  /** The shop — whose album opens are recorded ("Opened by you"). A lab's "lab" records nothing. */
  vendorId: string;
  /** Row 1's numbers — the two shipped counters and the shop's own opens (`lib/portfolio-albums.ts`). */
  albumStats?: AlbumStats;
  /** The one Sort button's two picks, and the search words — the thumb row owns them (`PortfolioView`). */
  show?: PortfolioShow;
  sort?: PortfolioSort;
  words?: string;
  /** ⚙ The house settings button — at the right end of Row 1's heading (the screen's top row; there is no header). */
  gear?: ReactNode;
  /** Open "All albums" on arrival (Instagram's OAuth callback lands on `#gallery-media`, which lives in it). */
  editOpen?: boolean;
  /** 📍 The events' venues (or the looks' tagged events) could not be read — Search then says it is by name only. */
  placesUnread?: boolean;
  /**
   * Draw every way in's body IN PLACE under the rows as well — for the guards' static render only (a risen screen is a
   * portal, which `renderToStaticMarkup` cannot see). Never passed by the page.
   */
  drawAll?: boolean;
  /** Told whenever "the search words match nothing here" changes — the thumb row then offers ＋ Add photos. */
  onNothing?: (nothing: boolean) => void;
}) {
  const [open, setOpen] = useState<Open | null>(null);
  // 🚪 The way in that is risen full screen ('all' = every album), or none.
  const [way, setWay] = useState<PortfolioWay | 'all' | null>(editOpen ? 'all' : null);
  // `#gallery-media` (the page gallery's editor, Instagram's callback, every "Edit" and "Add photos" door) lives inside
  // "All albums" now — an address ending in it rises that screen, and the shipped Fold opens itself on the same hash.
  useEffect(() => {
    const open = () => {
      if (window.location.hash === '#gallery-media') setWay('all');
    };
    open();
    window.addEventListener('hashchange', open);
    return () => window.removeEventListener('hashchange', open);
  }, []);
  const frame = useRef<HTMLElement | null>(null);
  const rootRef = (el: HTMLDivElement | null) => {
    if (el) frame.current = el.closest('[data-portfolio-tab],[data-portfolio-tab-lab]');
  };
  // (The old ⇅ "By name" left with the one Sort button; every group is drawn as listed.)
  const sorted = <T,>(list: T[] | null, _name: (x: T) => string): T[] | null => list;
  const rows = Object.fromEntries(collectionRows(input).map((r) => [r.key, r]));
  const openPhotos = (key: string, photos: OpenedPhotos) => (origin: HTMLElement | null) => setOpen({ kind: 'photos', key, photos, origin });
  const albumPhotos = (a: PortfolioAlbum): OpenedPhotos => ({ title: a.title, sub: a.line, note: a.services && a.services.length > 0 ? a.services.join(' · ') : null, urls: a.urls, total: a.total, href: a.href, unlisted: a.unlisted ?? null });
  /** ⤴ What a group's head rises into: its count, the grid (photos · albums), and its own page as one row. */
  const riseOf = (line: string | null | undefined, body: ReactNode, page: GroupRise['page'] = null): GroupRise => ({ line: line ?? '', body, page });
  const albumsRise = (id: string, albums: PortfolioAlbum[] | null) => {
    const shown = (albums ?? []).filter((a) => a.urls.length > 0);
    return shown.length > 0 ? <AlbumGrids data={id} albums={shown.map((a) => ({ key: a.key, ...albumPhotos(a) }))} /> : null;
  };

  /* ── ON MY PAGE — the page gallery ─────────────────────────────────────────── */
  const pagePhotos: OpenedPhotos = { title: SECTION_NAME.page, sub: rows.page?.line ?? '', urls: allPhotos, total: allPhotos.length, href: null };
  const pageDoor: Door = uploadFacts ? { kind: 'upload', facts: uploadFacts } : { kind: 'link', label: 'Add photos', href: '#gallery-media', icon: Images };
  const onMyPage = (
    <PortfolioSection
      id="page"
      title={SECTION_NAME.page}
      pill={allPhotos.length > 0 ? { kind: 'link', label: 'Edit', href: '#gallery-media', icon: Pencil } : null}
      rise={riseOf(rows.page?.line, allPhotos.length > 0 ? <PhotoGrid photos={pagePhotos} data="page" /> : null)}
    >
      {allPhotos.length === 0 ? (
        <EmptyRail id="page" line="Nothing yet · your photos show here and on your page" door={pageDoor} icon={ic(Images)} />
      ) : (
        <Rail data="page">
          {allPhotos.slice(0, 12).map((u, i) => (
            <Tile key={`${i}-${u}`} name={i === 0 ? 'Latest' : ''} sub={i === 0 ? rows.page?.line : null} photo={u} open={openPhotos('page', pagePhotos)} data="page" />
          ))}
        </Rail>
      )}
    </PortfolioSection>
  );

  /* ── an album group (cards · events): one tile per album ──────────────────── */
  const albumSection = (
    id: 'cards' | 'albums',
    albums: PortfolioAlbum[] | null,
    href: string,
    empty: string,
    door: Door | null,
    icon: ReactNode,
    count: string | null,
  ) => (
    <PortfolioSection
      id={id}
      title={SECTION_NAME[id]}
      countLabel={count}
      rise={riseOf(count ?? empty, albumsRise(id, albums), { title: id === 'cards' ? 'Your service cards' : 'Every event album', line: 'Its own screen', href })}
    >
      {albums === null || albums.length === 0 ? (
        <EmptyRail id={id} line={empty} door={door} icon={icon} unread={albums === null} />
      ) : (
        <Rail data={id}>
          {albums.map((a) => (
            <Tile key={a.key} name={a.title} sub={a.unlisted ? TOP_UP_WORDS.unlisted : a.line} photo={a.urls[0] ?? null} icon={icon} open={openPhotos(`${id}:${a.key}`, albumPhotos(a))} data={id} />
          ))}
        </Rail>
      )}
    </PortfolioSection>
  );

  /* ── a counted store with its own screen (own shots · delivered): one tile ─ */
  const countSection = (id: 'own' | 'delivered', href: string, filled: string | null, empty: string, door: Door, icon: ReactNode) => {
    const r = rows[id];
    return (
      <PortfolioSection id={id} title={SECTION_NAME[id]} countLabel={filled} rise={riseOf(filled ?? empty, null, { title: door.kind === 'link' ? door.label : SECTION_NAME[id], line: 'Its own screen', href })}>
        {!r || r.unread || !filled ? (
          <EmptyRail id={id} line={empty} door={door} icon={icon} unread={!r || r.unread} />
        ) : (
          <Rail data={id}>
            <Tile name={SECTION_NAME[id]} sub={filled} photo={null} icon={icon} open={{ href }} data={id} />
          </Rail>
        )}
      </PortfolioSection>
    );
  };
  const own = input.own;
  const delivered = input.delivered;

  /* ── Instagram (only where the product switches it on) ─────────────────────── */
  const ig = input.instagram;
  const igSection =
    ig === null || ig.configured ? (
      <PortfolioSection
        id="instagram"
        title={SECTION_NAME.instagram}
        countLabel={ig?.connected ? rows.instagram?.line.replace(/^Connected · /, '') ?? null : null}
        rise={riseOf(
          rows.instagram?.line,
          ig?.connected && instagramPhotos.length > 0 ? (
            <PhotoGrid photos={{ title: SECTION_NAME.instagram, sub: rows.instagram?.line ?? '', urls: instagramPhotos, total: instagramPhotos.length, href: null }} data="instagram" />
          ) : null,
        )}
      >
        {ig && ig.connected && instagramPhotos.length > 0 ? (
          <Rail data="instagram">
            {instagramPhotos.slice(0, 12).map((u, i) => (
              <Tile
                key={`${i}-${u}`}
                name=""
                photo={u}
                open={openPhotos('instagram', { title: SECTION_NAME.instagram, sub: rows.instagram?.line ?? '', urls: instagramPhotos, total: instagramPhotos.length, href: null })}
                data="instagram"
              />
            ))}
          </Rail>
        ) : (
          <EmptyRail
            id="instagram"
            line={ig?.connected ? 'Connected · no posts pulled yet' : 'Not connected'}
            door={{ kind: 'link', label: ig?.connected ? 'Sync now' : 'Connect', href: '#gallery-media', icon: AtSign }}
            icon={ic(AtSign)}
            unread={ig === null}
          />
        )}
      </PortfolioSection>
    ) : null;

  /* ── Moodboard library — the looks you curated, and the library's one door ─── */
  const looks = groups.inspiration === 'off' ? 'off' : sorted(groups.inspiration, (a) => a.title);
  const libraryDoor: Extract<Door, { kind: 'link' }> = { kind: 'link', label: INSPIRATION_LIBRARY_ROW.label, href: INSPIRATION_LIBRARY_HREF, icon: Sparkles };
  const moodboardSection =
    looks === 'off' ? null : (
      <PortfolioSection
        id="moodboard"
        title={SECTION_NAME.moodboard}
        countLabel={moodboard && moodboard.looks > 0 ? n(moodboard.looks, 'set', 'sets') : null}
        rise={riseOf(moodboard && moodboard.looks > 0 ? n(moodboard.looks, 'set', 'sets') : null, albumsRise('moodboard', Array.isArray(looks) ? looks : null), {
          title: INSPIRATION_LIBRARY_ROW.label,
          line: 'Its own screen',
          href: INSPIRATION_LIBRARY_HREF,
        })}
      >
        {looks === null || looks.length === 0 ? (
          <EmptyRail
            id="moodboard"
            line={libraryOpen ? 'No sets yet · couples match your sets to their palette' : 'None approved yet'}
            door={libraryOpen ? libraryDoor : null}
            icon={ic(Palette)}
            unread={looks === null}
          />
        ) : (
          <Rail data="moodboard">
            {looks.map((a) => (
              <Tile key={a.key} name={a.title} sub={a.line} photo={a.urls[0] ?? null} icon={ic(Palette)} open={openPhotos(`inspiration:${a.key}`, albumPhotos(a))} data="moodboard" />
            ))}
            {libraryOpen ? <AddTile door={libraryDoor} data="moodboard" /> : null}
          </Rail>
        )}
      </PortfolioSection>
    );

  /* ── Song bank — music categories only ─────────────────────────────────────── */
  const songsSection =
    songs === 'off' ? null : (
      <PortfolioSection id="songs" title="Song bank" countLabel={songs && songs.count > 0 ? n(songs.count, 'song', 'songs') : null} rise={riseOf(songs && songs.count > 0 ? n(songs.count, 'song', 'songs') : null, null, { title: 'Your repertoire', line: 'Its own screen', href: SONG_BANK_HREF })}>
        {songs === null || songs.count === 0 ? (
          <EmptyRail
            id="songs"
            line="No songs yet · couples request and preview from it"
            door={{ kind: 'link', label: 'Add a song', href: SONG_BANK_HREF, icon: Music }}
            icon={ic(Music)}
            unread={songs === null}
          />
        ) : (
          <Rail data="songs">
            <Tile
              name="Your repertoire"
              sub={songs.withVideo > 0 ? `${n(songs.count, 'song', 'songs')} · ${formatCount(songs.withVideo)} with video` : n(songs.count, 'song', 'songs')}
              photo={null}
              icon={ic(Music)}
              open={{ href: SONG_BANK_HREF }}
              data="songs"
            />
          </Rail>
        )}
      </PortfolioSection>
    );

  /* ── Stories couples published (your shop credited) ──────────────────────── */
  const stories = sorted(groups.stories, (x) => x.hostNames);
  const storiesSection = (
    <PortfolioSection
      id="stories"
      title="Stories couples published"
      pill={stories && stories.length > 0 ? { kind: 'link', label: 'Share them', href: '/vendor-dashboard/shop/promote#share', icon: Share } : null}
      rise={riseOf(stories && stories.length > 0 ? n(stories.length, 'story', 'stories') : null, null, { title: 'Share them', line: 'Promote', href: '/vendor-dashboard/shop/promote#share' })}
    >
      {stories === null || stories.length === 0 ? (
        <EmptyRail id="stories" line="None yet · a couple you worked with publishes their event to Stories" door={null} icon={ic(BookOpen)} unread={stories === null} />
      ) : (
        <Rail data="stories">
          {stories.map((s) => (
            <Tile key={s.eventId} name={s.hostNames} sub={s.line || null} photo={null} icon={ic(BookOpen)} open={{ href: `/${s.slug}`, external: true }} data="stories" />
          ))}
        </Rail>
      )}
    </PortfolioSection>
  );

  const sections = {
    page: onMyPage,
    cards: albumSection(
        'cards',
        sorted(groups.services, (a) => a.title),
        '/vendor-dashboard/shop#services',
        'No service card has a photo yet',
        { kind: 'link', label: 'Add a cover', href: '/vendor-dashboard/shop#services', icon: LayoutGrid },
        ic(LayoutGrid),
        groups.services && groups.services.length > 0 ? n(groups.services.length, 'card', 'cards') : null,
      ),
    albums: albumSection(
        'albums',
        sorted(groups.events, (a) => a.title),
        '/vendor-dashboard/collections/albums',
        'Nothing yet · fills when a couple shares their Papic photos with you',
        { kind: 'link', label: 'Open Clients', href: '/vendor-dashboard/customers', icon: Users },
        ic(BookImage),
        groups.events && groups.events.length > 0 ? n(groups.events.length, 'event', 'events') : null,
      ),
    own: countSection(
        'own',
        '/vendor-dashboard/on-the-day',
        own && own.items > 0 ? n(own.items, 'shot', 'shots') : null,
        'Nothing yet · what you shoot with Papic at an event lands here',
        { kind: 'link', label: 'Open On the day', href: '/vendor-dashboard/on-the-day', icon: Camera },
        ic(Camera),
      ),
    delivered: countSection(
        'delivered',
        '/vendor-dashboard/customers',
        delivered && delivered.items > 0 ? n(delivered.couples, 'couple', 'couples') : null,
        'Nothing yet · what you send a couple lands here',
        { kind: 'link', label: 'Open Clients', href: '/vendor-dashboard/customers', icon: Send },
        ic(Send),
      ),
    instagram: igSection,
    moodboard: moodboardSection,
    songs: songsSection,
    stories: storiesSection,
  };

  /* ── ROW 1 — the albums, in the Sort's order, kept by the Show filter and the search words ─────────────────── */
  const everyAlbum = portfolioAlbums(groups, { title: SECTION_NAME.page, line: rows.page?.line ?? '', urls: allPhotos }, albumStats);
  const rowAlbums = sortAlbums(
    everyAlbum.filter((a) => showKeepsAlbum(show, a.kind) && albumMatches(a, words)),
    sort,
    albumStats,
  );
  const openAlbum = (a: RowAlbum) => (origin: HTMLElement | null) => {
    void recordAlbumOpen(vendorId, a.kind, a.key);
    setOpen({ kind: 'photos', key: `${a.kind}:${a.key}`, photos: a.album ? albumPhotos(a.album) : pagePhotos, origin });
  };
  const needle = words.trim().toLowerCase();
  const hit = (...texts: (string | null | undefined)[]) => !needle || texts.some((t) => (t ?? '').toLowerCase().includes(needle));
  const kindHit = (kind: RowAlbum['kind']) => everyAlbum.some((a) => a.kind === kind && albumMatches(a, words));

  /* ── THE FOUR WAYS IN — one row each; a tap rises its group full screen ─────────────────────────────────────── */
  const mosaic = (list: PortfolioAlbum[] | null | 'off') => (Array.isArray(list) ? list.flatMap((a) => a.urls.slice(0, 1)).concat(Array.isArray(list) ? list.flatMap((a) => a.urls.slice(1, 3)) : []).slice(0, 3) : []);
  const unreadLine = 'Couldn’t load this just now';
  const eventsLine =
    groups.events === null
      ? unreadLine
      : [
          n(groups.events.length, 'event', 'events'),
          own && own.items > 0 ? `${n(own.items, 'shot', 'shots')} of your own` : null,
          delivered && delivered.items > 0 ? `${formatCount(delivered.couples)} delivered` : null,
        ]
          .filter(Boolean)
          .join(' · ');
  const servicesLine = groups.services === null ? unreadLine : `${n(groups.services.length, 'service card', 'service cards')} · ${n(groups.services.reduce((a, x) => a + x.total, 0), 'photo', 'photos')}`;
  const inspirationLine = looks === null ? unreadLine : looks === 'off' ? '' : looks.length === 0 ? 'No sets yet' : `${n(looks.length, 'set', 'sets')} in the moodboard library`;
  const videoLine = [n(videoLinks.length, 'link', 'links'), songs !== 'off' && songs ? n(songs.count, 'song', 'songs') : null].filter(Boolean).join(' · ');
  const ways: { key: PortfolioWay; title: string; line: string; photos: string[]; icon: ReactNode; found: boolean; body: ReactNode }[] = [
    {
      key: 'events',
      title: 'From events',
      line: eventsLine,
      photos: mosaic(groups.events),
      icon: ic(BookImage),
      found: hit('From events', 'events') || kindHit('event') || (groups.stories ?? []).some((x) => hit(x.hostNames, x.line)),
      body: (
        <>
          {sections.albums}
          {sections.own}
          {sections.delivered}
          {sections.stories}
        </>
      ),
    },
    { key: 'services', title: 'From services', line: servicesLine, photos: mosaic(groups.services), icon: ic(LayoutGrid), found: hit('From services', 'services') || kindHit('service'), body: sections.cards },
    ...(looks === 'off'
      ? []
      : [{ key: 'inspiration' as const, title: 'From inspiration', line: inspirationLine, photos: mosaic(looks), icon: ic(Palette), found: hit('From inspiration', 'inspiration') || kindHit('inspiration'), body: sections.moodboard }]),
    {
      key: 'videos',
      title: 'Video links',
      line: videoLine,
      photos: [],
      icon: ic(Play),
      found: hit('Video links', 'videos', 'songs') || videoLinks.some((l) => hit(videoRowName(l, videoTitles), l)),
      body: (
        <>
          <div className="px-4 pt-3">
            <VideoLinks initial={videoLinks} initialTitles={videoTitles} />
          </div>
          {sections.songs}
        </>
      ),
    },
  ];
  const shownWays = ways.filter((w) => showKeepsWay(show, w.key) && w.found);
  const risen = way && way !== 'all' ? ways.find((w) => w.key === way) : null;
  const nothing = Boolean(needle) && rowAlbums.length === 0 && shownWays.length === 0;
  useEffect(() => {
    onNothing?.(nothing);
  }, [nothing, onNothing]);
  const allAlbums = everyAlbum.filter((a) => a.album).map((a) => ({ key: `${a.kind}:${a.key}`, ...albumPhotos(a.album!) }));

  return (
    <div ref={rootRef} className="pb-2" data-collections-list="" data-tour="collections-list" data-portfolio-nothing={nothing ? '' : undefined}>
      {/* ROW 1 — the screen's top row: the albums' heading, its ⓘ, and the house ⚙ at the right end. Videos have no albums. */}
      <section aria-label={albumRowHeading(sort, albumStats)} className="pt-3" data-portfolio-albums-row={sort}>
        <div className="flex min-h-11 items-start gap-2 px-4 pb-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-[20px] font-semibold leading-[1.15] tracking-[-0.01em] text-ink" data-portfolio-albums-heading="">
              {albumRowHeading(sort, albumStats)}
            </h2>
            <InfoTip label={albumRowLine(sort, albumStats)} labelClassName="text-[12.5px] text-ink/60" align="start">
              {ALBUM_UNCOUNTED_NOTE}
            </InfoTip>
          </div>
          {gear ? <span className="flex-none">{gear}</span> : null}
        </div>
        {/* 📍 The places were not read: a search by place would miss its matches without a word — so it says so. */}
        {placesUnread && needle ? (
          <p role="status" className="px-4 pb-2 text-[13px] text-ink/65" data-portfolio-places-unread="">
            {PLACES_UNREAD_LINE}
          </p>
        ) : null}
        {show === 'videos' ? null : everyAlbum.length === 0 ? (
          <EmptyRail id="page" line="Nothing yet · your photos show here and on your page" door={pageDoor} icon={ic(Images)} />
        ) : rowAlbums.length === 0 ? nothing ? null : (
          <p className="px-4 pb-2 text-[14px] text-ink/65" data-portfolio-albums-none="">
            {needle ? `No album matches “${words.trim()}”.` : 'No albums of this kind yet.'}
          </p>
        ) : (
          <Rail data="albums">
            {rowAlbums.map((a) => (
              <Tile key={`${a.kind}:${a.key}`} name={a.title} sub={albumViewsLabel(a.views)} photo={a.cover} icon={ic(Images)} open={openAlbum(a)} data="albums" />
            ))}
            <button
              type="button"
              onClick={() => setWay('all')}
              className="sn-press flex h-[150px] w-[112px] flex-none snap-start items-center justify-center rounded-card bg-ink/[0.05] px-3 text-center text-[13.5px] font-semibold text-sn-accent"
              aria-haspopup="dialog"
              data-portfolio-all-albums=""
            >
              All {n(everyAlbum.length, 'album', 'albums')}
            </button>
          </Rail>
        )}
      </section>

      {/* THE FOUR WAYS IN — tap opens, full screen. */}
      <ul className="mx-4 mt-2 divide-y divide-ink/10" data-portfolio-ways="">
        {shownWays.map((w) => (
          <li key={w.key}>
            <button
              type="button"
              onClick={() => setWay(w.key)}
              className="sn-press grid min-h-[76px] w-full grid-cols-[64px_minmax(0,1fr)_20px] items-center gap-3 py-1.5 text-left"
              aria-haspopup="dialog"
              data-portfolio-way={w.key}
            >
              <span aria-hidden className="grid h-16 w-16 grid-cols-2 grid-rows-2 gap-[2px] overflow-hidden rounded-xl bg-ink/[0.06] text-ink/45">
                {w.photos.length === 0 ? (
                  <span className="col-span-2 row-span-2 grid place-items-center [&_svg]:h-6 [&_svg]:w-6">{w.icon}</span>
                ) : (
                  w.photos.map((u, i) => (
                    // eslint-disable-next-line @next/next/no-img-element -- presigned display URLs
                    <img key={`${i}-${u}`} src={u} alt="" loading="lazy" className={`h-full w-full object-cover ${i === 0 ? (w.photos.length === 1 ? 'col-span-2 row-span-2' : 'row-span-2') : w.photos.length === 2 ? 'row-span-2' : ''}`} />
                  ))
                )}
              </span>
              <span className="min-w-0">
                <b className="block truncate text-[16px] font-semibold text-ink">{w.title}</b>
                <span className="block truncate text-[13px] text-ink/60">{w.line}</span>
              </span>
              <ChevronRight aria-hidden className="h-4 w-4 justify-self-end text-sn-accent" strokeWidth={2} />
            </button>
          </li>
        ))}
      </ul>

      {drawAll ? (
        <div data-portfolio-drawn-all="">
          <WayBody>
            {sections.page}
            {sections.instagram}
            {ways.map((w) => (
              <div key={w.key} data-portfolio-way-open={w.key}>
                {/* The Video links editor needs the app's toast provider, which a static render has not got. */}
                {w.key === 'videos' ? sections.songs : w.body}
              </div>
            ))}
          </WayBody>
        </div>
      ) : null}
      {risen ? (
        <RiseScreen title={risen.title} line={risen.line} onClose={() => setWay(null)} data={`portfolio-way-${risen.key}`}>
          <div className="pb-6" data-portfolio-way-open={risen.key}>
            <WayBody>{risen.body}</WayBody>
          </div>
        </RiseScreen>
      ) : null}
      {way === 'all' ? (
        <RiseScreen title="All albums" line={n(everyAlbum.length, 'album', 'albums')} onClose={() => setWay(null)} data="portfolio-way-all">
          <div className="pb-6" data-portfolio-way-open="all">
            <WayBody>
              {sections.page}
              {sections.instagram}
              {allAlbums.length > 0 ? (
                <div className="pt-5">
                  <AlbumGrids data="all" albums={allAlbums} />
                </div>
              ) : null}
            </WayBody>
            <div className="mx-4 mt-6 border-t border-ink/10 pt-1">
              <Fold anchor="gallery-media" data="collections-add" title="Edit my page photos" line="Your page's photos · Instagram">
                <div className="pb-4">{gallery}</div>
              </Fold>
            </div>
          </div>
        </RiseScreen>
      ) : null}

      {open ? <OpenedCollection origin={open.origin} frame={frame.current} data={open.key.split(':')[0]!} photos={open.photos} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}
