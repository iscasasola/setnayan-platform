'use client';

import { Fragment, useRef, useState, type ReactNode } from 'react';
import {
  AtSign,
  BookImage,
  BookOpen,
  Camera,
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
  Star,
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
import { AddTile, EmptyRail, MorePill, MorePills, PortfolioSection, Rail, Tile, type Door, type GroupRise } from './portfolio-sections';
import { AlbumGrids, OpenedCollection, PhotoGrid, SONG_BANK_HREF, VideoLinks, type OpenedPhotos } from './portfolio-groups';
import { ReorderSections } from './reorder-sections';
import { bestWorkLine, type BestWorkPhoto } from '@/lib/portfolio-best-work';
import { orderPortfolioSections, type PortfolioSectionKey } from '@/lib/portfolio-section-order';

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
 *   REORDER    (ruling 5940) the closing row under More: ↑ ↓ per section, stored as `portfolio_section_order`
 *              (`reorder-sections.tsx`, `lib/portfolio-section-order.ts`). No stored order can hide a section.
 * 🔒 collections/the-portfolio-is-collections.test.ts
 */

const SECTION_NAME = COLLECTION_SECTION_NAME;

/** Every orderable section's title, as its head says it — the Reorder sheet's rows. */
const SECTION_TITLE: Record<PortfolioSectionKey, string> = {
  best: 'Your best work',
  page: SECTION_NAME.page,
  cards: SECTION_NAME.cards,
  albums: SECTION_NAME.albums,
  own: SECTION_NAME.own,
  delivered: SECTION_NAME.delivered,
  instagram: SECTION_NAME.instagram,
  moodboard: SECTION_NAME.moodboard,
  songs: 'Song bank',
  stories: 'Stories couples published',
  video: 'Video links',
};

type Open = { kind: 'photos'; key: string; photos: OpenedPhotos; origin: HTMLElement | null } | { kind: 'video'; origin: HTMLElement | null };

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
  order = 'listed',
  best = [],
  sectionOrder = null,
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
  /** Sort (the thumb row's ⇅): each rail as listed, or its tiles by name. */
  order?: 'listed' | 'name';
  /** ⭐ Your best work — most viewed first; `null` = the count could not be read. */
  best?: BestWorkPhoto[] | null;
  /** 🖼 The supplier's stored section order; `null`/absent = the shipped order. */
  sectionOrder?: readonly string[] | null;
}) {
  const [open, setOpen] = useState<Open | null>(null);
  // The stored order, kept here so a Reorder save redraws at once (the server revalidates behind it).
  const [sectionOrderNow, setSectionOrderNow] = useState<readonly string[] | null>(sectionOrder);
  const frame = useRef<HTMLElement | null>(null);
  const rootRef = (el: HTMLDivElement | null) => {
    if (el) frame.current = el.closest('[data-portfolio-tab],[data-portfolio-tab-lab]');
  };
  const sorted = <T,>(list: T[] | null, name: (x: T) => string): T[] | null =>
    list && order === 'name' ? [...list].sort((a, b) => name(a).localeCompare(name(b))) : list;
  const rows = Object.fromEntries(collectionRows(input).map((r) => [r.key, r]));
  const openPhotos = (key: string, photos: OpenedPhotos) => (origin: HTMLElement | null) => setOpen({ kind: 'photos', key, photos, origin });
  const openVideo = (origin: HTMLElement | null) => setOpen({ kind: 'video', origin });
  const albumPhotos = (a: PortfolioAlbum): OpenedPhotos => ({ title: a.title, sub: a.line, urls: a.urls, total: a.total, href: a.href });
  /** ⤴ What a group's head rises into: its count, the grid (photos · albums), and its own page as one row. */
  const riseOf = (line: string | null | undefined, body: ReactNode, page: GroupRise['page'] = null): GroupRise => ({ line: line ?? '', body, page });
  const albumsRise = (id: string, albums: PortfolioAlbum[] | null) => {
    const shown = (albums ?? []).filter((a) => a.urls.length > 0);
    return shown.length > 0 ? <AlbumGrids data={id} albums={shown.map((a) => ({ key: a.key, ...albumPhotos(a) }))} /> : null;
  };
  const headEl = (id: string) => document.querySelector<HTMLElement>(`[data-portfolio-open="${id}"]`);

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

  /* ── ⭐ YOUR BEST WORK — the page photos couples opened most (ruling 5940) ──── */
  const bestPhotos: OpenedPhotos = {
    title: 'Your best work',
    sub: 'Most viewed first',
    urls: (best ?? []).map((p) => p.url),
    total: best?.length ?? 0,
    href: null,
  };
  const bestSection = (
    <PortfolioSection
      id="best"
      title="Your best work"
      countLabel={best && best.length > 0 ? 'most viewed first' : null}
      rise={riseOf(best && best.length > 0 ? 'Most viewed first' : 'Nothing yet', best && best.length > 0 ? <PhotoGrid photos={bestPhotos} data="best" /> : null)}
    >
      {best === null || best.length === 0 ? (
        <EmptyRail id="best" line="Nothing yet · your most-viewed photos gather here" door={pageDoor} icon={ic(Star)} unread={best === null} />
      ) : (
        <Rail data="best">
          {best.map((p, i) => (
            <Tile key={p.key} name="" sub={bestWorkLine(p.views, i === 0, formatCount)} photo={p.url} open={openPhotos('best', bestPhotos)} data="best" hero />
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
            <Tile key={a.key} name={a.title} sub={a.line} photo={a.urls[0] ?? null} icon={icon} open={openPhotos(`${id}:${a.key}`, albumPhotos(a))} data={id} />
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

  /* ── Video links — the tiles; the shipped editor opens in the collection ─── */
  const videoSection = (
    <PortfolioSection
      id="video"
      title="Video links"
      pill={videoLinks.length > 0 ? { kind: 'press', label: 'Add a link', onPress: () => openVideo(headEl('video')), icon: Link2 } : null}
      rise={riseOf(
        videoLinks.length > 0 ? n(videoLinks.length, 'link', 'links') : 'No links yet',
        <div className="px-4">
          <VideoLinks initial={videoLinks} initialTitles={videoTitles} />
        </div>,
      )}
    >
      {videoLinks.length === 0 ? (
        <EmptyRail id="video" line="No links yet · YouTube, Vimeo or Facebook" door={{ kind: 'press', label: 'Add a link', onPress: () => openVideo(headEl('video')), icon: Link2 }} icon={ic(Play)} />
      ) : (
        <Rail data="video">
          {videoLinks.map((l, i) => (
            <Tile key={`${i}-${l}`} name={videoRowName(l, videoTitles)} sub={parseVideoLink(l)?.label ?? null} photo={null} icon={ic(Play)} open={(el) => openVideo(el)} data="video" />
          ))}
        </Rail>
      )}
    </PortfolioSection>
  );

  /* ── More — the utility collections as quiet pills ─────────────────────────── */
  const allLooks = Array.isArray(looks) ? looks : [];
  const lookUrls = allLooks.flatMap((a) => a.urls);
  const more = (
    <PortfolioSection id="more" title="More" rise={null}>
      <MorePills>
        <MorePill icon={ic(Images)} label="All photos" countLabel={formatCount(allPhotos.length)} open={(el) => openPhotos('all', { ...pagePhotos, title: 'All photos' })(el)} data="all" />
        <MorePill icon={ic(Play)} label="Video links" countLabel={formatCount(videoLinks.length)} open={(el) => openVideo(el)} data="video" />
        {looks !== 'off' && looks !== null ? (
          <MorePill
            icon={ic(Sparkles)}
            label="Inspiration you curated"
            countLabel={formatCount(allLooks.reduce((a, x) => a + x.total, 0))}
            open={(el) => openPhotos('inspiration', { title: 'Inspiration you curated', sub: 'looks Setnayan approved for couples', urls: lookUrls, total: lookUrls.length, href: null })(el)}
            data="inspiration"
          />
        ) : null}
      </MorePills>
    </PortfolioSection>
  );

  /* ── THE ORDER (ruling 5940): every section this shop draws, in the supplier's stored order, More last ──────── */
  const sections: Partial<Record<PortfolioSectionKey, ReactNode>> = {
    best: bestSection,
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
    video: videoSection,
  };
  const present = (Object.keys(sections) as PortfolioSectionKey[]).filter((k) => sections[k] != null);

  return (
    <div ref={rootRef} className="pb-2" data-collections-list="" data-tour="collections-list">
      {orderPortfolioSections(sectionOrderNow, present).map((k) => (
        <Fragment key={k}>{sections[k]}</Fragment>
      ))}
      {more}
      <ReorderSections order={orderPortfolioSections(sectionOrderNow, present)} names={SECTION_TITLE} onSaved={setSectionOrderNow} />

      <div className="mx-4 mt-6 border-t border-ink/10 pt-1">
        <Fold anchor="gallery-media" data="collections-add" title="Add photos" line="Your page's photos · videos · Instagram">
          <div className="pb-4">{gallery}</div>
        </Fold>
      </div>

      {open ? (
        open.kind === 'photos' ? (
          <OpenedCollection origin={open.origin} frame={frame.current} data={open.key.split(':')[0]!} photos={open.photos} onClose={() => setOpen(null)} />
        ) : (
          <OpenedCollection origin={open.origin} frame={frame.current} data="video" onClose={() => setOpen(null)}>
            <VideoLinks initial={videoLinks} initialTitles={videoTitles} />
          </OpenedCollection>
        )
      ) : null}
    </div>
  );
}
