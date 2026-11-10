'use client';

import { useRef, useState, type ReactNode } from 'react';
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
import { AddTile, EmptyRail, MorePill, MorePills, PortfolioSection, Rail, Tile, type Door } from './portfolio-sections';
import { OpenedCollection, SONG_BANK_HREF, VideoLinks, type OpenedPhotos } from './portfolio-groups';

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
 *   ADD PHOTOS the shipped gallery editors stay at the foot, in the `#gallery-media` fold the thumb row's ＋ and
 *              Instagram's OAuth callback open.
 *
 * 🔑 NO NEW READ AND NO NEW TABLE — every tile is a store `collections-data.ts` already reads. 🔑 A REFUSED READ SAYS
 * "Couldn't load" and never wears an Example. Deferred, as the approval flags them NEW: "Your best work" (per-photo view
 * counts) and Reorder (a stored section order).
 * 🔒 collections/the-portfolio-is-collections.test.ts
 */

const SECTION_NAME = COLLECTION_SECTION_NAME;

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
}) {
  const [open, setOpen] = useState<Open | null>(null);
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
  const headEl = (id: string) => document.querySelector<HTMLElement>(`[data-portfolio-open="${id}"]`);

  /* ── ON MY PAGE — the page gallery ─────────────────────────────────────────── */
  const pagePhotos: OpenedPhotos = { title: SECTION_NAME.page, sub: rows.page?.line ?? '', urls: allPhotos, total: allPhotos.length, href: null };
  const pageDoor: Door = uploadFacts ? { kind: 'upload', facts: uploadFacts } : { kind: 'link', label: 'Add photos', href: '#gallery-media', icon: ic(Images) };
  const onMyPage = (
    <PortfolioSection
      id="page"
      title={SECTION_NAME.page}
      pill={allPhotos.length > 0 ? { kind: 'link', label: 'Edit', href: '#gallery-media', icon: ic(Pencil) } : null}
      onOpen={() => openPhotos('page', pagePhotos)(headEl('page'))}
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
    <PortfolioSection id={id} title={SECTION_NAME[id]} count={count} onOpen={{ href }}>
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
      <PortfolioSection id={id} title={SECTION_NAME[id]} count={filled} onOpen={{ href }}>
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
      <PortfolioSection id="instagram" title={SECTION_NAME.instagram} count={ig?.connected ? rows.instagram?.line.replace(/^Connected · /, '') ?? null : null} onOpen={{ href: '#gallery-media' }}>
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
            door={{ kind: 'link', label: ig?.connected ? 'Sync now' : 'Connect', href: '#gallery-media', icon: ic(AtSign) }}
            icon={ic(AtSign)}
            unread={ig === null}
          />
        )}
      </PortfolioSection>
    ) : null;

  /* ── Moodboard library — the looks you curated, and the library's one door ─── */
  const looks = groups.inspiration === 'off' ? 'off' : sorted(groups.inspiration, (a) => a.title);
  const libraryDoor: Extract<Door, { kind: 'link' }> = { kind: 'link', label: INSPIRATION_LIBRARY_ROW.label, href: INSPIRATION_LIBRARY_HREF, icon: ic(Sparkles) };
  const moodboardSection =
    looks === 'off' ? null : (
      <PortfolioSection
        id="moodboard"
        title={SECTION_NAME.moodboard}
        count={moodboard && moodboard.looks > 0 ? n(moodboard.looks, 'set', 'sets') : null}
        onOpen={{ href: INSPIRATION_LIBRARY_HREF }}
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
      <PortfolioSection id="songs" title="Song bank" count={songs && songs.count > 0 ? n(songs.count, 'song', 'songs') : null} onOpen={{ href: SONG_BANK_HREF }}>
        {songs === null || songs.count === 0 ? (
          <EmptyRail
            id="songs"
            line="No songs yet · couples request and preview from it"
            door={{ kind: 'link', label: 'Add a song', href: SONG_BANK_HREF, icon: ic(Music) }}
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
      pill={stories && stories.length > 0 ? { kind: 'link', label: 'Share them', href: '/vendor-dashboard/shop/promote#share', icon: ic(Share) } : null}
      onOpen={{ href: '/vendor-dashboard/shop/promote#share' }}
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
      pill={videoLinks.length > 0 ? { kind: 'press', label: 'Add a link', onPress: () => openVideo(headEl('video')), icon: ic(Link2) } : null}
      onOpen={() => openVideo(headEl('video'))}
    >
      {videoLinks.length === 0 ? (
        <EmptyRail id="video" line="No links yet · YouTube, Vimeo or Facebook" door={{ kind: 'press', label: 'Add a link', onPress: () => openVideo(headEl('video')), icon: ic(Link2) }} icon={ic(Play)} />
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
    <PortfolioSection id="more" title="More" onOpen={null}>
      <MorePills>
        <MorePill icon={ic(Images)} label="All photos" count={formatCount(allPhotos.length)} open={(el) => openPhotos('all', { ...pagePhotos, title: 'All photos' })(el)} data="all" />
        <MorePill icon={ic(Play)} label="Video links" count={formatCount(videoLinks.length)} open={(el) => openVideo(el)} data="video" />
        {looks !== 'off' && looks !== null ? (
          <MorePill
            icon={ic(Sparkles)}
            label="Inspiration you curated"
            count={formatCount(allLooks.reduce((a, x) => a + x.total, 0))}
            open={(el) => openPhotos('inspiration', { title: 'Inspiration you curated', sub: 'looks Setnayan approved for couples', urls: lookUrls, total: lookUrls.length, href: null })(el)}
            data="inspiration"
          />
        ) : null}
      </MorePills>
    </PortfolioSection>
  );

  return (
    <div ref={rootRef} className="pb-2" data-collections-list="" data-tour="collections-list">
      {onMyPage}
      {albumSection(
        'cards',
        sorted(groups.services, (a) => a.title),
        '/vendor-dashboard/shop#services',
        'No service card has a photo yet',
        { kind: 'link', label: 'Add a cover', href: '/vendor-dashboard/shop#services', icon: ic(LayoutGrid) },
        ic(LayoutGrid),
        groups.services && groups.services.length > 0 ? n(groups.services.length, 'card', 'cards') : null,
      )}
      {albumSection(
        'albums',
        sorted(groups.events, (a) => a.title),
        '/vendor-dashboard/collections/albums',
        'Nothing yet · fills when a couple shares their Papic photos with you',
        { kind: 'link', label: 'Open Clients', href: '/vendor-dashboard/customers', icon: ic(Users) },
        ic(BookImage),
        groups.events && groups.events.length > 0 ? n(groups.events.length, 'event', 'events') : null,
      )}
      {countSection(
        'own',
        '/vendor-dashboard/on-the-day',
        own && own.items > 0 ? n(own.items, 'shot', 'shots') : null,
        'Nothing yet · what you shoot with Papic at an event lands here',
        { kind: 'link', label: 'Open On the day', href: '/vendor-dashboard/on-the-day', icon: ic(Camera) },
        ic(Camera),
      )}
      {countSection(
        'delivered',
        '/vendor-dashboard/customers',
        delivered && delivered.items > 0 ? n(delivered.couples, 'couple', 'couples') : null,
        'Nothing yet · what you send a couple lands here',
        { kind: 'link', label: 'Open Clients', href: '/vendor-dashboard/customers', icon: ic(Send) },
        ic(Send),
      )}
      {igSection}
      {moodboardSection}
      {songsSection}
      {storiesSection}
      {videoSection}
      {more}

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
