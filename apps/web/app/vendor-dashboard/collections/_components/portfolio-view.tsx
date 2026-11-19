'use client';

import { useContext, useRef, useState, type ReactNode } from 'react';
import { Plus, SlidersHorizontal } from 'lucide-react';
import { ThumbRow } from '@/components/thumb-row';
import { SupplierThumbRow } from '../../_components/supplier-thumb-row';
import type { CollectionKey, CollectionsInput } from '@/lib/supplier-collections';
import type { PageSaved } from '@/lib/supplier-page-draft';
import type { PortfolioUploadFacts } from '@/lib/portfolio-upload-facts';
import { CollectionsList } from './collections-list';
import { PortfolioShow } from './portfolio-show';
import { PortfolioSettings, type ShowChoice } from './portfolio-settings';
import type { PortfolioGroups } from '@/lib/portfolio-groups';
import {
  ALBUM_STATS_UNREAD,
  PORTFOLIO_SHOW_CHOICES,
  PORTFOLIO_SHOW_DEFAULT,
  PORTFOLIO_SORT_CHOICES,
  PORTFOLIO_SORT_DEFAULT,
  portfolioSortIsOn,
  type AlbumStats,
  type PortfolioShow as ShowFilter,
  type PortfolioSort,
} from '@/lib/portfolio-albums';
import { PortfolioUploadDoor } from '../../_components/portfolio-upload';
import { actionButtonClass } from '@/components/action-button';
import { PhotoChatContext, type PhotoChatShare } from './send-photo-to-chat';
import { UndoToastHost } from '@/app/dashboard/[eventId]/guests/_components/undo-toast';

/**
 * 🖼 THE PORTFOLIO TAB — SIMPLER (owner 2026-11-19, verbatim: *"simple (no header) just the way to cleanly access his
 * shop's photos … First row would be the most viewed albums and recently viewed albums"* · *"portfolio simpler
 * approved"* · *"just one: show and sort"* · *"no word just icon"* · *"B · Sliders"*; drawing artifact
 * 7SfMdJW9mryK59pm7bKa5A). The shipped parts, REPOSITIONED — no second Portfolio:
 *
 *   NO HEADER  the photo band, its "Latest" pill, the counts and the pinned row are gone. The counts moved into each
 *              way-in line; the free-photo line stays in the ⚙.
 *   ROW 1      the shop's ALBUMS, in the Sort's order (`lib/portfolio-albums.ts`), "All N albums" last; the house ⚙
 *              (`PortfolioSettings`, "a ⚙ per page") at the right end of its heading — the screen's top row.
 *   WAYS IN    From events · From services · From inspiration · Video links — one row each; a tap rises the group full
 *              screen (`CollectionsList`), ✕ comes back.
 *   THUMB ROW  Search or add · ONE round (sliders) that opens ONE dropdown: Show (a FILTER — All · Events · Services ·
 *              Inspiration · Videos) then Sort (Most viewed · Opened by you · Newest); a dot while anything is not the
 *              default. ＋ shows only when the words match nothing — it opens the device's picker in place.
 *   SEARCH     narrows albums and ways by name AND BY PLACE (owner: *"when i type a place, example tagaytay, i see all
 *              event albums from tagaytay, services inspiration and videos taken there"*) — from what is already
 *              linked: an event's venue and address, the cards booked at it, a look's tagged event; a video by its
 *              title. Nothing is tagged by hand.
 *
 * ⏭ TODO(#7792 — the motion lane's growing search icon and shared Sort round): at rest the search is the shipped
 * `ThumbRow` FIELD (a box), not yet the 48-px icon that grows on one tap and morphs 🔍→＋. When that component lands,
 * this row swaps to it — do not build a second one here. 🔒 collections/the-portfolio-is-simpler.test.ts holds the note.
 * 🔒 collections/the-portfolio-is-all-media.test.ts
 */
export type ShowAlbum = { title: string; urls: string[] };

export function PortfolioView({
  vendorId,
  input,
  saved,
  gallery,
  showAlbums,
  photos,
  free,
  allowanceUnread,
  walletBalance,
  igFlash,
  groups,
  allPhotos,
  libraryOpen,
  videoLinkUrls,
  videoTitles = {},
  moodboard = null,
  songs = 'off',
  instagramPhotos = [],
  uploadFacts = null,
  chats = null,
  albumStats = ALBUM_STATS_UNREAD,
  placesUnread = false,
}: {
  vendorId: string;
  input: CollectionsInput;
  saved: PageSaved;
  gallery: ReactNode;
  /** Every photo each pickable album can Show (already loaded — no new read). */
  showAlbums: Partial<Record<CollectionKey, ShowAlbum>>;
  photos: number;
  free: number;
  allowanceUnread: boolean;
  walletBalance: number | null;
  /** Instagram's OAuth answer — said at the top, and it opens "All albums" where the Instagram editor lives. */
  igFlash: ReactNode;
  /** The three groups + stories (`collections-data.ts`); absent in callers that draw only the collections. */
  groups?: PortfolioGroups;
  /** The page gallery's photos, newest first. */
  allPhotos?: string[];
  libraryOpen?: boolean;
  /** The shipped `gallery_video_links`, edited row by row under Video links. */
  videoLinkUrls?: string[];
  /** Each link's title, keyed by the link; null = unread (no Title field then). Absent = none yet (the lab). */
  videoTitles?: Record<string, string> | null;
  moodboard?: { looks: number; declined: number } | null;
  songs?: { count: number; withVideo: number } | null | 'off';
  /** The connected Instagram's posts (display URLs) — the Instagram section's tiles. */
  instagramPhotos?: string[];
  /** The ONE uploader's facts — ＋ and an empty Row 1's Upload open the device picker in place. Null = no door facts. */
  uploadFacts?: PortfolioUploadFacts | null;
  /** 💬 Send to a chat (ruling 5951): this shop's client chats + the shipped post. `null` = no such button (a lab). */
  chats?: PhotoChatShare | null;
  /** 🖼 Row 1's numbers: the two shipped view counters and the shop's own opens. Absent = unread. */
  albumStats?: AlbumStats;
  /** 📍 The places Search matches on could not be read (`collections-data.ts`) — said while searching. */
  placesUnread?: boolean;
}) {
  // One pick for Show ▶ (the ⚙'s "Show plays" dropdown): a collection's key, or a group album's "<group>:<key>".
  // 💬 The page hands its chats in; a lab may provide them around the view instead (never both).
  const inheritedChats = useContext(PhotoChatContext);
  const [picked, setPicked] = useState<string | null>(null);
  const [showing, setShowing] = useState(false);
  const [show, setShow] = useState<ShowFilter>(PORTFOLIO_SHOW_DEFAULT);
  const [sort, setSort] = useState<PortfolioSort>(PORTFOLIO_SORT_DEFAULT);
  const [words, setWords] = useState('');
  const [nothing, setNothing] = useState(false);
  const pickerRef = useRef<HTMLSpanElement>(null);
  // Every album that holds photos — the choices Show ▶ can play (no new read: the collections' and the groups' own URLs).
  const albums = new Map<string, ShowAlbum>();
  for (const [k, a] of Object.entries(showAlbums) as [CollectionKey, ShowAlbum | undefined][]) if (a && a.urls.length > 0) albums.set(k, a);
  for (const [g, list] of [['events', groups?.events], ['services', groups?.services], ['inspiration', groups?.inspiration]] as const) {
    if (Array.isArray(list)) for (const a of list) if (a.urls.length > 0) albums.set(`${g}:${a.key}`, { title: a.title, urls: a.urls });
  }
  const showChoices: ShowChoice[] = [...albums.entries()].map(([key, a]) => ({ key, title: a.title }));
  const album = picked ? albums.get(picked) : undefined;
  const canShow = Boolean(album && album.urls.length > 0);
  // The list owns the matching and says whether the words match nothing (`onNothing`).
  const typed = setWords;
  // ＋ and Enter on words that match nothing: the device's own picker, in place (the shipped uploader's door).
  const openPicker = () => pickerRef.current?.querySelector<HTMLInputElement>('input[type="file"]')?.click();
  const on = portfolioSortIsOn(show, sort);
  const gear = (
    // 🔦 The tour's "Who sees what" stop: who sees each collection and what Show ▶ plays live in this ⚙.
    <span className="inline-flex" data-tour="collections-gear">
      <PortfolioSettings
        photos={photos}
        free={free}
        allowanceUnread={allowanceUnread}
        walletBalance={walletBalance}
        vendorId={vendorId}
        input={input}
        saved={saved}
        showChoices={showChoices}
        picked={picked}
        onPick={setPicked}
        onPlay={canShow ? () => setShowing(true) : null}
      />
    </span>
  );

  return (
    <>
      <PhotoChatContext.Provider value={chats ?? inheritedChats}>
        <section className="pt-1" data-supplier-collections="">
          {igFlash}
          <CollectionsList
            vendorId={vendorId}
            input={input}
            gallery={gallery}
            groups={groups ?? { events: [], services: [], inspiration: 'off', stories: [] }}
            allPhotos={allPhotos ?? []}
            instagramPhotos={instagramPhotos}
            libraryOpen={libraryOpen ?? false}
            videoLinks={videoLinkUrls ?? []}
            videoTitles={videoTitles}
            moodboard={moodboard}
            songs={songs}
            uploadFacts={uploadFacts}
            albumStats={albumStats}
            show={show}
            sort={sort}
            words={words}
            gear={gear}
            editOpen={Boolean(igFlash)}
            placesUnread={placesUnread}
            onNothing={setNothing}
          />
          {nothing ? (
            <div className="px-4 pt-3" data-portfolio-search-none="">
              <p className="pb-2 text-[14px] text-ink/65">Nothing here matches “{words.trim()}”.</p>
              {uploadFacts ? (
                <PortfolioUploadDoor facts={uploadFacts} className={actionButtonClass('brand', { main: true })} data="portfolio-upload-search">
                  <Plus aria-hidden strokeWidth={1.9} />
                  <span className="lbl">Add photos</span>
                </PortfolioUploadDoor>
              ) : null}
            </div>
          ) : null}
        </section>
      </PhotoChatContext.Provider>
      {/* The approved toast for Send to a chat ("Posted in …’s chat"). */}
      <UndoToastHost />

      {showing && album ? <PortfolioShow title={album.title} urls={album.urls} onClose={() => setShowing(false)} /> : null}

      {/* 👍 THE THUMB ROW — Search or add · ONE Show-and-sort round. ＋ only when the words match nothing. */}
      <SupplierThumbRow
        name="collections"
        label="Portfolio"
        row={
          <ThumbRow
            name="collections"
            field={{
              placeholder: 'Search or add',
              label: 'Search your albums by name or place, or add photos',
              hints: ['Search an event', 'Search a place', 'Search a service'],
              input: {
                onInput: (e) => typed(e.currentTarget.value),
                onKeyDown: (e) => {
                  if (e.key === 'Enter' && nothing) openPicker();
                },
                'data-portfolio-search': '',
              },
              onClear: () => typed(''),
            }}
            right={[
              {
                menu: [
                  ...PORTFOLIO_SHOW_CHOICES.map((c) => ({ key: `show:${c.key}`, label: c.label, group: 'Show', trail: c.key === show ? { text: '✓', tone: 'ok' as const, label: 'shown now' } : undefined })),
                  ...PORTFOLIO_SORT_CHOICES.map((c) => ({ key: `sort:${c.key}`, label: c.label, group: 'Sort', trail: c.key === sort ? { text: '✓', tone: 'ok' as const, label: 'sorted this way' } : undefined })),
                ],
                label: 'Sort',
                value: null,
                onPick: (k: string) => {
                  const [what, key] = k.split(':');
                  if (what === 'show') setShow(key as ShowFilter);
                  else setSort(key as PortfolioSort);
                },
                mark: 'data-portfolio-sort',
                menuMinWidth: 200,
                face: (
                  <span aria-hidden className="relative inline-flex h-5 w-5" data-portfolio-sort-face={on ? 'on' : 'off'}>
                    <SlidersHorizontal className="h-5 w-5" strokeWidth={1.75} />
                    {on ? <i className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-terracotta" /> : null}
                  </span>
                ),
              },
            ]}
            action={
              nothing && uploadFacts
                ? {
                    node: (
                      <span ref={pickerRef} className="inline-flex">
                        <PortfolioUploadDoor facts={uploadFacts} className={actionButtonClass('brand', { filled: true, iconOnly: true })} data="portfolio-upload-thumb">
                          <Plus aria-hidden strokeWidth={2} />
                          <span className="sr-only">Add photos</span>
                        </PortfolioUploadDoor>
                      </span>
                    ),
                  }
                : null
            }
          />
        }
      />
    </>
  );
}
