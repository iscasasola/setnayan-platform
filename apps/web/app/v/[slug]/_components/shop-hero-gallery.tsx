'use client';

import { useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { LayoutGrid } from 'lucide-react';
import { MarkedPhoto } from '@/app/_components/marked-photo';
import { recordVendorProfileView } from '@/lib/record-vendor-view';
import { formatCount } from '@/lib/format-number';
import { HERO_PHOTO_COUNT } from '@/lib/shop-hero-photos';

/**
 * 🖼 THE VERIFIED SHOP'S HERO PHOTOS (shop website v16, slice S2 — owner-approved 15 Nov 2026, DECISION_LOG "THE SHOP
 * WEBSITE HAS TWO LOOKS"; drawing `shop_website_two_looks_2026-11-15/site.src.html` `.hero .slides/.dots/.hall/.bento`
 * and `#lb`). Repositioned, not redrawn — the photos are the shop's own portfolio, and every open reuses shipped parts:
 *
 *   · PHONE — the hero's background is the first photos as SLIDES you swipe (scroll-snap, the browser's own swipe;
 *     nothing moves by itself), with DOTS on top that follow the swipe, and "All N photos" top right;
 *   · DESKTOP (lg) — a 5-photo BENTO (2fr · 1fr · 1fr, two rows) above the name, each photo a button, and
 *     "All N photos" on the mosaic;
 *   · a tap opens THE SHARED PHOTO VIEWER (`PhotoViewer` → `GalleryLightbox`'s `screen` layout: ✕ 44 px top left,
 *     "3 of 12 · <shop>", ‹ › and a sideways swipe, Esc and the phone's Back close, focus returns) — fetched with
 *     `next/dynamic` only on that tap, so the page's first load does not grow.
 *
 * Each photo shown in the viewer is ONE view of that photo, through the ONE door the portfolio grid already uses
 * (`recordVendorProfileView({ photoKey })`, Lane E item 11) — the shop's own people and admins never count, and
 * `count = false` (a demo shop, a team preview) opens without counting.
 *
 * A supplier photo carries the shop's mark, so every display is `MarkedPhoto` with its designed aspect (the mark is
 * never cropped off). "All N photos" counts the photos handed in — never a typed number.
 * 🔒 lib/the-shop-hero-follows-v16-s2.test.ts
 */
const LazyPhotoViewer = dynamic(() => import('@/app/_components/gallery/photo-viewer').then((m) => m.PhotoViewer), {
  ssr: false,
});


export type HeroPhoto = { key: string; url: string };

export function ShopHeroGallery({
  photos,
  shopName,
  vendorProfileId,
  count,
  bento,
}: {
  /** The shop's portfolio photos in page order (its chosen hero first). The viewer moves through ALL of them. */
  photos: readonly HeroPhoto[];
  shopName: string;
  vendorProfileId: string;
  /** Count each photo shown as a view (false: a demo shop or a team preview). */
  count: boolean;
  /** Draw the desktop mosaic — only with a full set of five (`HERO_PHOTO_COUNT`), never a half-empty grid. */
  bento: boolean;
}) {
  const [at, setAt] = useState<number | null>(null);
  const [dot, setDot] = useState(0);
  const slidesRef = useRef<HTMLDivElement | null>(null);
  const lead = photos.slice(0, HERO_PHOTO_COUNT);
  const total = photos.length;
  const allLabel = `All ${formatCount(total)} photos`;

  const show = (i: number) => {
    setAt(i);
    const p = photos[i];
    if (count && p) void recordVendorProfileView({ vendorProfileId, photoKey: p.key });
  };

  const onSlidesScroll = () => {
    const el = slidesRef.current;
    if (!el || el.clientWidth === 0) return;
    setDot(Math.round(el.scrollLeft / el.clientWidth));
  };

  const shown = at !== null ? photos[at] : undefined;

  return (
    <>
      {/* PHONE: the slides are the hero's background; the copy sits over their lower part. */}
      <div
        ref={slidesRef}
        onScroll={onSlidesScroll}
        tabIndex={0}
        aria-label={`${shopName} — photos, swipe`}
        data-shop-hero-slides=""
        className={`absolute inset-0 -z-20 flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${bento ? 'lg:hidden' : ''}`}
      >
        {lead.map((p, i) => (
          <div key={p.key} className="relative h-full w-full flex-none snap-start">
            {/* The SAME aspect the single hero photo declares (`ShopHero`), so a slide is drawn exactly as the hero was. */}
            <MarkedPhoto src={p.url} alt="" frame="square" displayAspect={16 / 9} priority={i === 0} sizes="100vw" />
          </div>
        ))}
      </div>
      {lead.length > 1 ? (
        <div aria-hidden className={`absolute inset-x-0 top-3.5 z-10 flex justify-center gap-1.5 ${bento ? 'lg:hidden' : ''}`} data-shop-hero-dots="">
          {lead.map((p, i) => (
            <i key={p.key} className={`h-[3px] w-[22px] rounded-sm ${i === dot ? 'bg-page' : 'bg-page/35'}`} />
          ))}
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => show(0)}
        className={`absolute right-3 top-2.5 z-10 inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full bg-ink/45 px-3.5 text-[13px] font-bold text-page backdrop-blur ${bento ? 'lg:hidden' : ''}`}
        data-shop-hero-all=""
      >
        <LayoutGrid aria-hidden className="h-4 w-4" strokeWidth={2} />
        {allLabel}
      </button>

      {/* DESKTOP: the mosaic above the name. */}
      {bento ? (
        <div className="relative mx-auto mt-5 hidden w-full max-w-screen-2xl px-10 lg:block" data-shop-hero-bento="">
          <div className="grid grid-cols-[2fr_1fr_1fr] grid-rows-[230px_230px] gap-2">
            {lead.map((p, i) => (
              <button
                key={p.key}
                type="button"
                onClick={() => show(i)}
                aria-label={`Open photo ${formatCount(i + 1)} of ${formatCount(total)}`}
                className={`group relative overflow-hidden bg-ink ${
                  i === 0 ? 'row-span-2 rounded-l-[22px] rounded-r-md' : i === 2 ? 'rounded-md rounded-tr-[22px]' : i === 4 ? 'rounded-md rounded-br-[22px]' : 'rounded-md'
                }`}
              >
                <span className="absolute inset-0 transition-transform duration-[var(--sn-dur-enter)] group-hover:scale-[1.04]">
                  <MarkedPhoto src={p.url} alt="" frame="square" displayAspect={i === 0 ? 1 : 1.2} priority={i === 0} sizes={i === 0 ? '50vw' : '25vw'} />
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => show(0)}
            className="absolute bottom-3 right-14 inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full border border-ink/10 bg-page px-3.5 text-[13px] font-bold text-ink shadow-md"
            data-shop-hero-all=""
          >
            <LayoutGrid aria-hidden className="h-4 w-4" strokeWidth={2} />
            {allLabel}
          </button>
        </div>
      ) : null}

      {shown && at !== null ? (
        <LazyPhotoViewer
          photo={{ src: shown.url, kind: 'photo', label: `${shopName} — photo ${formatCount(at + 1)}` }}
          at={at}
          total={total}
          album={shopName}
          onMove={show}
          onClose={() => setAt(null)}
          actions={[]}
        />
      ) : null}
    </>
  );
}
