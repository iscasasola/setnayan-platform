'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ListFilter, Plus } from 'lucide-react';
import { PinWord } from '@/app/_components/pinned-row/pin-door';
import { ThumbRow } from '@/components/thumb-row';
import { SupplierThumbRow } from '../../_components/supplier-thumb-row';
import { SupplierHero, type SupplierHeroPicture } from '../../_components/supplier-hero';
import { collectionRows, type CollectionKey, type CollectionsInput } from '@/lib/supplier-collections';
import type { PageSaved } from '@/lib/supplier-page-draft';
import { portfolioCountLabel } from '@/lib/portfolio-count-label';
import type { PortfolioUploadFacts } from '@/lib/portfolio-upload-facts';
import { CollectionsList } from './collections-list';
import { PortfolioShow } from './portfolio-show';
import { PortfolioSettings, type ShowChoice } from './portfolio-settings';
import type { PortfolioGroups } from '@/lib/portfolio-groups';

/**
 * 🖼 THE PORTFOLIO TAB (THE ONE BUILD A3 W13–W15 Phase A, lane C4; v114 `?tab=portfolio`; spec §10 #24).
 *
 *   top band   — "PORTFOLIO · ALL YOUR MEDIA" · "64 photos · 12 video links" · "N of 50 free photos" (the uploader's own
 *                cap; no GB meter — storage is out of this build) · N collections · Upload · ⚙
 *   pinned row — "Portfolio · N of 50 free photos · Show · ⚙", fading in as the band leaves (CSS stand-in until L1's
 *                `CollapsingTop`)
 *   sections   — THE APPROVED PORTFOLIO (owner 9 Nov, Apple Photos › Collections; DECISION_LOG "PORTFOLIO PROTOTYPE
 *                APPROVED FOR BUILD 5"): every collection a titled section (› opens, ˅ folds) with a rail of large
 *                photo tiles (`CollectionsList`); an opened one is a full-bleed photo grid. Who sees each collection,
 *                the page switch and the album Show plays live in the Portfolio's OWN ⚙ (`PortfolioSettings`, owner
 *                11 Nov (d)) — never rows named after clients, never a ✓ per row.
 *   Show       — greyed until an album is picked (in the ⚙); full screen, swipe, no edit / price / caption (`PortfolioShow`)
 *   thumb row  — Search photos · ⇅ (Sort: As listed · By name, and Show ▶) · ＋ Add photos (the shipped uploader's fold,
 *                `#gallery-media`) — the shape of Shop's row (Lane E item 4, owner 9 Nov: "There should be a search bar
 *                there that could help them find on their photos"). Search narrows every album, story and collection IN
 *                PLACE by its words (the house move, no request).
 *
 * Lane E (Build 3): the band is the ONE supplier hero (`SupplierHero`, item 10) wearing the LATEST photo (item 11) or
 * the category placeholder (item 12); its Upload pill is gone — the thumb row's ＋ is the one add (item 3), surfaced on
 * the hero only while it is a placeholder. Every section draws as a finished card, empty or not (item 1).
 *
 * Build 2 (lane B2-B, §10 #35/#40): the three groups the owner named — All your events · Your services · Inspiration
 * you curated — then Stories couples published, All photos and Video links, are REORGANIZED into the sections' rails
 * (approved Portfolio (3): same sections, same doors, none dropped). An album opens INTO THE BODY (the shared panel).
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
  videoLinks,
  free,
  allowanceUnread,
  walletBalance,
  igFlash,
  groups,
  allPhotos,
  libraryOpen,
  videoLinkUrls,
  videoTitles = {},
  hero = null,
  moodboard = null,
  songs = 'off',
  instagramPhotos = [],
  uploadFacts = null,
}: {
  vendorId: string;
  input: CollectionsInput;
  saved: PageSaved;
  gallery: ReactNode;
  /** Every photo each pickable album can Show (already loaded — no new read). */
  showAlbums: Partial<Record<CollectionKey, ShowAlbum>>;
  photos: number;
  videoLinks: number;
  free: number;
  allowanceUnread: boolean;
  walletBalance: number | null;
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
  /** 🖼 The latest upload, or the category placeholder (`lib/supplier-hero.ts`). Null = the shipped placeholder file. */
  hero?: SupplierHeroPicture | null;
  moodboard?: { looks: number; declined: number } | null;
  songs?: { count: number; withVideo: number } | null | 'off';
  /** The connected Instagram's posts (display URLs) — the Instagram section's tiles. */
  instagramPhotos?: string[];
  /** The ONE uploader's facts — an empty On my page's Upload opens the device picker in place. Null = no door facts. */
  uploadFacts?: PortfolioUploadFacts | null;
}) {
  // One pick for Show (the ⚙'s "Show plays" dropdown): a collection's key, or a group album's "<group>:<key>".
  const [picked, setPicked] = useState<string | null>(null);
  const [showing, setShowing] = useState(false);
  const [order, setOrder] = useState<'listed' | 'name'>('listed');
  const [words, setWords] = useState('');
  // Every album that holds photos — the choices Show can play (no new read: the collections' and the groups' own URLs).
  const albums = new Map<string, ShowAlbum>();
  for (const [k, a] of Object.entries(showAlbums) as [CollectionKey, ShowAlbum | undefined][]) if (a && a.urls.length > 0) albums.set(k, a);
  for (const [g, list] of [['events', groups?.events], ['services', groups?.services], ['inspiration', groups?.inspiration]] as const) {
    if (Array.isArray(list)) for (const a of list) if (a.urls.length > 0) albums.set(`${g}:${a.key}`, { title: a.title, urls: a.urls });
  }
  const showChoices: ShowChoice[] = [...albums.entries()].map(([key, a]) => ({ key, title: a.title }));
  const bandRef = useRef<HTMLDivElement>(null);
  const [pin, setPin] = useState(0);

  useEffect(() => {
    const el = bandRef.current;
    if (!el) return;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const v = Math.max(0, Math.min(1, (48 + 44 - el.getBoundingClientRect().bottom) / 48));
      setPin((p) => (Math.abs(p - v) < 0.01 ? p : v));
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', on, { passive: true });
    return () => {
      window.removeEventListener('scroll', on);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const count = allowanceUnread ? 'Couldn’t read your photo allowance' : portfolioCountLabel(photos, free);
  const n = (x: number, one: string, many: string) => `${x.toLocaleString('en-PH')} ${x === 1 ? one : many}`;
  const collections = collectionRows(input).length;
  const album = picked ? albums.get(picked) : undefined;
  const canShow = Boolean(album && album.urls.length > 0);
  const settings = (cover: boolean) => (
    <PortfolioSettings
      cover={cover}
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
    />
  );
  const showButton = (
    <button
      type="button"
      onClick={() => canShow && setShowing(true)}
      disabled={!canShow}
      aria-label={canShow ? `Show ${album!.title}` : 'Show — pick an album first'}
      className="inline-flex h-9 items-center rounded-full bg-ink px-3.5 text-[13px] font-semibold text-[color:var(--m-paper)] disabled:opacity-35"
      data-portfolio-show-button=""
    >
      Show
    </button>
  );

  return (
    <>
      {/* 📌 Pinned row */}
      {/* 🪤 The pinned row lies over the band's top 44 px while it is hidden — it lets taps through to the band's ⚙ then
          (measured 2026-11-10: the hidden row swallowed every tap on the ⚙). */}
      <div className="pointer-events-none sticky top-0 z-[6] -mb-11 h-11" data-pinned-row="" data-portfolio-pin="">
        <div
          className="flex h-11 items-center gap-2 px-4"
          style={{ opacity: pin, pointerEvents: pin < 0.5 ? 'none' : 'auto', background: 'var(--sn-canvas)', boxShadow: pin > 0.5 ? '0 1px 0 color-mix(in srgb, var(--m-ink) 8%, transparent)' : undefined }}
          aria-hidden={pin < 0.5 ? true : undefined}
        >
          <PinWord barAbove>Portfolio</PinWord>
          <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink/60">{count}</span>
          {showButton}
          {pin >= 0.5 ? settings(false) : null}
        </div>
      </div>

      {/* 🖼 The band = THE ONE SUPPLIER HERO (Lane E item 10). The pinned row above fades in as it leaves. */}
      <div ref={bandRef} data-portfolio-top="">
        <SupplierHero
          eyebrow="Portfolio · all your media"
          gear={
            pin < 0.5 ? (
              // 🔦 The tour's "Who sees what" stop: who sees each collection and what Show plays live in this ⚙ now.
              <span className="inline-flex" data-tour="collections-gear">
                {settings(true)}
              </span>
            ) : null
          }
          title={
            <>
              {n(photos, 'photo', 'photos')} · {n(videoLinks, 'video link', 'video links')}
            </>
          }
          sub={
            <>
              <b className="font-semibold">{count}</b>
              <span className="text-white/75">{n(collections, 'collection', 'collections')}</span>
            </>
          }
          picture={hero}
          caption="Latest"
          upload={{ href: '#gallery-media' }}
          data={{ 'portfolio-hero': '' }}
        />
      </div>

      <section className="pt-1" data-supplier-collections="">
        {igFlash}
        <p hidden className="px-4 py-3 text-[14px] text-ink/65" data-portfolio-search-none="">
          Nothing here matches “{words.trim()}”.
        </p>
        <CollectionsList
          input={input}
          gallery={gallery}
          groups={groups ?? { events: [], services: [], inspiration: 'off', stories: [] }}
          allPhotos={allPhotos ?? []}
          order={order}
          instagramPhotos={instagramPhotos}
          libraryOpen={libraryOpen ?? false}
          videoLinks={videoLinkUrls ?? []}
          videoTitles={videoTitles}
          moodboard={moodboard}
          songs={songs}
          uploadFacts={uploadFacts}
        />
      </section>

      {showing && album ? <PortfolioShow title={album.title} urls={album.urls} onClose={() => setShowing(false)} /> : null}

      {/* 👍 THE THUMB ROW — Shop's shape (Lane E item 4): Search photos · ⇅ Sort and Show · ＋ Add photos. */}
      <SupplierThumbRow
        name="collections"
        label="Portfolio"
        row={
          <ThumbRow
            name="collections"
            field={{
              placeholder: 'Search photos',
              input: {
                onInput: (e) => {
                  const v = e.currentTarget.value;
                  setWords(v);
                  findInPortfolio(v);
                },
                'data-portfolio-search': '',
              },
              onClear: () => {
                setWords('');
                findInPortfolio('');
              },
            }}
            right={[
              {
                menu: [
                  { key: 'sort:listed', label: 'As listed', group: 'Sort' },
                  { key: 'sort:name', label: 'By name', group: 'Sort' },
                  { key: 'show', label: canShow ? `Show ▶ ${album!.title}` : 'Show ▶ · pick an album first', group: 'Show' },
                ],
                label: 'Sort and Show',
                value: `sort:${order}`,
                onPick: (k: string) => {
                  if (k === 'show') {
                    if (canShow) setShowing(true);
                    return;
                  }
                  setOrder(k === 'sort:name' ? 'name' : 'listed');
                },
                mark: 'data-portfolio-sort',
                face: (
                  <span aria-hidden className="inline-flex">
                    <ListFilter className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                ),
              },
            ]}
            action={{ icon: Plus, label: 'Add photos', href: '#gallery-media', tour: 'collections-add' }}
          />
        }
      />
    </>
  );
}

/**
 * 🔎 Search photos — narrows every rail IN PLACE by its words (the house move: Shop's Search services, no request). A
 * section whose own name matches keeps all its tiles; otherwise only its matching tiles stay, and a section left with
 * nothing steps aside. "Nothing here matches" says so.
 */
function findInPortfolio(words: string) {
  const needle = words.trim().toLowerCase();
  const root = document.querySelector<HTMLElement>('[data-portfolio-tab],[data-portfolio-tab-lab]');
  if (!root) return;
  let shown = 0;
  root.querySelectorAll<HTMLElement>('[data-portfolio-section]').forEach((sec) => {
    const head = sec.querySelector('[data-portfolio-section-head]')?.textContent?.toLowerCase() ?? '';
    const whole = !needle || head.includes(needle);
    let any = false;
    sec.querySelectorAll<HTMLElement>('[data-portfolio-tile],[data-portfolio-pill]').forEach((el) => {
      const hit = whole || (el.getAttribute('aria-label') ?? el.textContent ?? '').toLowerCase().includes(needle);
      el.style.display = hit ? '' : 'none';
      if (hit) any = true;
    });
    sec.style.display = whole || any ? '' : 'none';
    if (whole || any) shown += 1;
  });
  const none = root.querySelector<HTMLElement>('[data-portfolio-search-none]');
  if (none) none.hidden = !needle || shown > 0;
}
