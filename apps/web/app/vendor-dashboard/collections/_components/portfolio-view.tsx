'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Play, Plus, Upload } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { PinWord } from '@/app/_components/pinned-row/pin-door';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { SupplierThumbRow } from '../../_components/supplier-thumb-row';
import { collectionRows, type CollectionKey, type CollectionsInput } from '@/lib/supplier-collections';
import type { PageSaved } from '@/lib/supplier-page-draft';
import { portfolioCountLabel } from '@/lib/portfolio-count-label';
import { CollectionsList, type AlbumPreview } from './collections-list';
import { PortfolioShow } from './portfolio-show';
import { PortfolioSettings } from './portfolio-settings';

/**
 * 🖼 THE PORTFOLIO TAB (THE ONE BUILD A3 W13–W15 Phase A, lane C4; v114 `?tab=portfolio`; spec §10 #24).
 *
 *   top band   — "PORTFOLIO · ALL YOUR MEDIA" · "64 photos · 12 video links" · "N of 50 free photos" (the uploader's own
 *                cap; no GB meter — storage is out of this build) · N collections · Upload · ⚙
 *   pinned row — "Portfolio · N of 50 free photos · Show · ⚙", fading in as the band leaves (CSS stand-in until L1's
 *                `CollapsingTop`)
 *   albums     — the shipped collection rows (`CollectionsList`), each album OPENING IN PLACE (3 columns, first 9, "+N")
 *                and its ✓ circle the separate "pick for Show" control — never rows named after clients
 *   Show       — greyed until an album is picked; full screen, swipe, no edit / price / caption (`PortfolioShow`)
 *   thumb row  — Sort ▾ (As listed · By name) · Show ▶ · ＋ Add photos (the shipped uploader's fold, `#gallery-media`).
 *                No "Search portfolio" (map row 69 INVENTED).
 * 🔒 collections/the-portfolio-is-all-media.test.ts
 */
export type ShowAlbum = { title: string; urls: string[] };

export function PortfolioView({
  vendorId,
  input,
  saved,
  gallery,
  previews,
  showAlbums,
  photos,
  videoLinks,
  free,
  allowanceUnread,
  walletBalance,
  igFlash,
}: {
  vendorId: string;
  input: CollectionsInput;
  saved: PageSaved;
  gallery: ReactNode;
  previews: Partial<Record<CollectionKey, AlbumPreview>>;
  /** Every photo each pickable album can Show (already loaded — no new read). */
  showAlbums: Partial<Record<CollectionKey, ShowAlbum>>;
  photos: number;
  videoLinks: number;
  free: number;
  allowanceUnread: boolean;
  walletBalance: number | null;
  igFlash: ReactNode;
}) {
  const [picked, setPicked] = useState<CollectionKey | null>(null);
  const [showing, setShowing] = useState(false);
  const [order, setOrder] = useState<'listed' | 'name'>('listed');
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
  const album = picked ? showAlbums[picked] : undefined;
  const canShow = Boolean(album && album.urls.length > 0);
  const settings = <PortfolioSettings photos={photos} free={free} allowanceUnread={allowanceUnread} walletBalance={walletBalance} />;
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
      <div className="sticky top-0 z-[6] -mb-11 h-11" data-pinned-row="" data-portfolio-pin="">
        <div
          className="flex h-11 items-center gap-2 px-4"
          style={{ opacity: pin, pointerEvents: pin < 0.5 ? 'none' : undefined, background: 'var(--sn-canvas)', boxShadow: pin > 0.5 ? '0 1px 0 color-mix(in srgb, var(--m-ink) 8%, transparent)' : undefined }}
          aria-hidden={pin < 0.5 ? true : undefined}
        >
          <PinWord barAbove>Portfolio</PinWord>
          <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink/60">{count}</span>
          {showButton}
          {pin >= 0.5 ? settings : null}
        </div>
      </div>

      {/* The band */}
      <div ref={bandRef} className="rounded-b-3xl px-4 pb-5 pt-5 text-white" style={{ background: 'linear-gradient(160deg, #6b5536 0%, #3b3026 70%)' }} data-portfolio-top="">
        <p className="text-[13px] font-medium text-white/80">Portfolio · all your media</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-[30px] font-semibold leading-[1.1]">
          {n(photos, 'photo', 'photos')} · {n(videoLinks, 'video link', 'video links')}
        </h1>
        <p className="mt-2 text-[13.5px] text-white/90">
          <b className="font-semibold">{count}</b>
          <span className="ml-3 text-white/75">{n(collections, 'collection', 'collections')}</span>
        </p>
        <div className="mt-4 flex items-center gap-2">
          <a href="#gallery-media" className="flex min-h-[48px] flex-1 items-center gap-2 rounded-2xl bg-[color:var(--m-paper)] px-4 text-[15px] font-semibold text-ink" data-portfolio-upload="">
            <Upload aria-hidden className="h-4 w-4" strokeWidth={2} />
            Upload
          </a>
          {pin < 0.5 ? settings : null}
        </div>
      </div>

      <section className="space-y-3 px-4 pt-4" data-supplier-collections="">
        {igFlash}
        <p className="sn-eye">Collections · tap one to open it · ✓ to pick it for Show</p>
        <CollectionsList
          vendorId={vendorId}
          input={input}
          saved={saved}
          gallery={gallery}
          previews={previews}
          picked={picked}
          onPick={(k) => setPicked((cur) => (cur === k ? null : k))}
          order={order}
        />
      </section>

      {showing && album ? <PortfolioShow title={album.title} urls={album.urls} onClose={() => setShowing(false)} /> : null}

      <SupplierThumbRow name="collections" label="Portfolio">
        <PickMenu
          label="Sort"
          value={order}
          options={[
            { key: 'listed', label: 'As listed' },
            { key: 'name', label: 'By name' },
          ]}
          onPick={(k) => setOrder(k as 'listed' | 'name')}
          compact
          buttonText={order === 'name' ? 'Sort · By name' : 'Sort'}
          dataAttr="data-portfolio-sort"
        />
        <ActionButton tone="neutral" iconOnly icon={<Play aria-hidden strokeWidth={1.9} />} label="Show" onClick={() => canShow && setShowing(true)} disabled={!canShow} />
        <ActionButton tone="brand" main icon={<Plus aria-hidden="true" strokeWidth={1.9} />} label="Add photos" href="#gallery-media" tour="collections-add" />
      </SupplierThumbRow>
    </>
  );
}
