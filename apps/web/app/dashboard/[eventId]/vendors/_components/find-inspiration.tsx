'use client';

/**
 * 💡 FindInspiration — the Inspiration box of ONE open category in Suppliers › Find (owner 2026-10-29: *"where are
 * the inspiration box"*; approved prototype "Find at scale" v2 — `Part ▾`, a two-column photo wall, 24 at a time, a
 * full-screen viewer that names who made the photo and walks to their services).
 *
 * The photos are the suppliers' own gallery (`moodboard_library_assets`, approved + credited), read through the
 * SHIPPED `fetchGalleryAssets` — one ranged read over every part of this category (`slotKeys`), kept for the visit
 * (`INSPIRATION_SEEN`), so switching Services ⇄ Inspiration or folding the row asks nothing again. A failed read says
 * so in words with Try again — never "no photos" (reads honest).
 *
 * Rules: lib/find-inspiration.ts · guard: lib/find-inspiration.test.ts.
 */
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { fetchGalleryAssets } from '@/app/dashboard/[eventId]/studio/mood-board/actions';
import type { GalleryAsset, GalleryPage } from '@/lib/moodboard-gallery';
import {
  ALL_PARTS,
  FIND_INSPIRATION_PAGE,
  inspirationCountLine,
  inspirationPageKey,
  inspirationReadKeys,
  type FindInspirationPart,
} from '@/lib/find-inspiration';

type Read = (input: { slotKey: string; slotKeys: string[]; limit: number; offset: number }) => Promise<GalleryPage>;

/** `/dev/suppliers-lab` only: fixture photos (no session, no database). `null` everywhere else. */
export const InspirationReadStandInCtx = createContext<Read | null>(null);

/** What each category's photo pages answered, for this visit (a failed read is never kept). */
const INSPIRATION_SEEN = new Map<string, GalleryPage>();

export function FindInspiration({
  eventId,
  tile,
  label,
  parts,
  onOpenShop,
}: {
  eventId: string;
  tile: string;
  /** The category's own name ("Catering"). */
  label: string;
  parts: readonly FindInspirationPart[];
  /** "View their services" — opens the supplier's sheet (the shipped one). */
  onOpenShop: (asset: GalleryAsset) => void;
}) {
  const standIn = useContext(InspirationReadStandInCtx);
  const read: Read = standIn ?? ((input) => fetchGalleryAssets(input));
  const [picked, setPicked] = useState<string>(ALL_PARTS);
  const keys = useMemo(() => inspirationReadKeys(parts, picked), [parts, picked]);
  const [pages, setPages] = useState<GalleryPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [tryN, setTryN] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);
  const partLabel = (k: string) => parts.find((p) => p.slotKey === k)?.label ?? '';

  // Page 0 for the current part (and again on Try again). Later pages append on the sentinel.
  useEffect(() => {
    let live = true;
    const key = inspirationPageKey(eventId, tile, keys, 0);
    const kept = INSPIRATION_SEEN.get(key);
    if (kept) {
      setPages([kept]);
      setLoading(false);
      setFailed(false);
      return;
    }
    setPages([]);
    setLoading(true);
    setFailed(false);
    read({ slotKey: keys[0]!, slotKeys: keys, limit: FIND_INSPIRATION_PAGE, offset: 0 })
      .then((page) => {
        if (!live) return;
        INSPIRATION_SEEN.set(key, page);
        setPages([page]);
        setLoading(false);
      })
      .catch(() => {
        if (!live) return;
        setFailed(true);
        setLoading(false);
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, tile, keys.join(','), tryN]);

  const assets: GalleryAsset[] = pages.flatMap((p) => p.assets);
  const last = pages[pages.length - 1] ?? null;
  const total = pages[0]?.total ?? null;
  const hasMore = Boolean(last?.hasMore);

  // 24 more when the end of the wall comes near — one read at a time.
  const sentinel = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting) || busy.current || !last) return;
        const offset = last.offset + last.limit;
        const key = inspirationPageKey(eventId, tile, keys, offset);
        const kept = INSPIRATION_SEEN.get(key);
        if (kept) {
          setPages((cur) => [...cur, kept]);
          return;
        }
        busy.current = true;
        read({ slotKey: keys[0]!, slotKeys: keys, limit: FIND_INSPIRATION_PAGE, offset })
          .then((page) => {
            INSPIRATION_SEEN.set(key, page);
            setPages((cur) => [...cur, page]);
          })
          .catch(() => setFailed(true))
          .finally(() => {
            busy.current = false;
          });
      },
      { rootMargin: '400px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, last, keys.join(',')]);

  const options = [
    { key: ALL_PARTS, label: 'All parts' },
    ...parts.map((p) => ({ key: p.slotKey, label: p.label })),
  ];

  return (
    <div className="fi" data-find-inspiration={tile}>
      <div className="fi-row">
        <PickMenu label="Part" value={picked} options={options} onPick={setPicked} dataAttr="find-inspiration-part" />
        <span className="fi-sp" />
        <InfoTip label="" ariaLabel={`About ${label} inspiration`} align="end">
          Suppliers’ own {label.toLowerCase()} photos, grouped by part. Tap one to see who made it and their services.
        </InfoTip>
      </div>
      <p className="fi-count" role="status">
        {inspirationCountLine(total, picked === ALL_PARTS ? null : partLabel(picked), label)}
      </p>

      {failed && assets.length === 0 ? (
        <p className="fi-note" role="alert">
          We couldn’t load the photos just now.{' '}
          <button type="button" className="fi-link" onClick={() => setTryN((n) => n + 1)}>
            Try again
          </button>
        </p>
      ) : loading ? (
        <div className="fi-wall" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className="fi-skel" style={{ aspectRatio: i % 3 ? '3/4' : '1/1' }} />
          ))}
        </div>
      ) : total === 0 ? (
        <p className="fi-note">No supplier has added {picked === ALL_PARTS ? `${label.toLowerCase()} photos` : `“${partLabel(picked)}” photos`} yet.</p>
      ) : (
        <>
          {assets.length === 0 && (pages[0]?.withheld ?? 0) > 0 ? (
            <p className="fi-note">These photos are waiting for their supplier to be verified.</p>
          ) : null}
          <div className="fi-wall">
            {assets.map((a, i) => (
              <button key={a.assetId} type="button" className="fi-tile" onClick={() => setViewer(i)} data-asset={a.assetId}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.imageUrl} alt={a.label || partLabel(a.partKey)} loading="lazy" decoding="async" />
                <span className="fi-part">{partLabel(a.partKey)}</span>
                <span className="fi-cap">{a.credit}</span>
              </button>
            ))}
          </div>
          <div ref={sentinel} className="fi-end">
            {failed ? (
              <button type="button" className="fi-link" onClick={() => setFailed(false)}>
                Couldn’t load more · Try again
              </button>
            ) : hasMore ? (
              'Loading more…'
            ) : assets.length > 0 ? (
              `That’s all ${assets.length}`
            ) : null}
          </div>
        </>
      )}

      {viewer != null && assets[viewer] ? (
        <InspirationViewer
          assets={assets}
          index={viewer}
          partLabel={partLabel}
          onIndex={setViewer}
          onClose={() => setViewer(null)}
          onOpenShop={(asset) => {
            setViewer(null);
            onOpenShop(asset);
          }}
        />
      ) : null}
      <style>{FI_CSS}</style>
    </div>
  );
}

/** The full-screen viewer — swipe or ‹ › through the wall, the supplier credit, and the walk to their services. */
function InspirationViewer({
  assets,
  index,
  partLabel,
  onIndex,
  onClose,
  onOpenShop,
}: {
  assets: readonly GalleryAsset[];
  index: number;
  partLabel: (k: string) => string;
  onIndex: (i: number) => void;
  onClose: () => void;
  onOpenShop: (asset: GalleryAsset) => void;
}) {
  const a = assets[index]!;
  const go = (d: number) => onIndex((index + d + assets.length) % assets.length);
  const x0 = useRef<number | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  });
  // Portalled to <body>: full screen means OVER the app's top bar, the thumb row and the dock — and no ancestor's
  // transform may become its containing block.
  return createPortal(
    <div className="fi-viewer" role="dialog" aria-modal="true" aria-label={`${partLabel(a.partKey)} — ${a.credit}`}>
      <div className="fi-vt">
        <button type="button" className="fi-vx" onClick={onClose} aria-label="Close">
          <X size={20} aria-hidden />
        </button>
        <span>
          {index + 1} of {assets.length}
        </span>
        <span className="fi-vx" aria-hidden />
      </div>
      <div
        className="fi-vp"
        onTouchStart={(e) => {
          x0.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const start = x0.current;
          x0.current = null;
          const end = e.changedTouches[0]?.clientX;
          if (start == null || end == null || Math.abs(end - start) < 40) return;
          go(end < start ? 1 : -1);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={a.assetId} src={a.imageUrl} alt={a.label || partLabel(a.partKey)} />
        {assets.length > 1 ? (
          <>
            <button type="button" className="fi-arr fi-l" onClick={() => go(-1)} aria-label="Previous photo">
              <ChevronLeft size={22} aria-hidden />
            </button>
            <button type="button" className="fi-arr fi-r" onClick={() => go(1)} aria-label="Next photo">
              <ChevronRight size={22} aria-hidden />
            </button>
          </>
        ) : null}
      </div>
      <div className="fi-vc">
        <b>{partLabel(a.partKey)}</b>
        <p>
          Made by {a.credit}
          {a.label ? ` · ${a.label}` : ''}
        </p>
        <button type="button" className="fi-view" onClick={() => onOpenShop(a)}>
          View their services
        </button>
      </div>
      <style>{FI_CSS}</style>
    </div>,
    document.body,
  );
}

const FI_CSS = `
.fi{padding:2px 0 8px}
.fi-row{display:flex;align-items:center;gap:8px;padding:2px 0 6px}
.fi-sp{flex:1}
.fi-count{margin:0;padding:2px 0 8px;font-size:12.5px;color:rgb(var(--color-ink)/.6);min-height:1.2em}
.fi-note{margin:6px 0 10px;font-size:13px;color:rgb(var(--color-ink)/.7)}
.fi-link{background:none;border:0;padding:0;font:inherit;font-weight:600;color:rgb(var(--sn-accent));cursor:pointer;min-height:44px}
.fi-wall{columns:2;column-gap:10px}
@media (min-width:768px){.fi-wall{columns:3}}
@media (min-width:1280px){.fi-wall{columns:4}}
.fi-tile{position:relative;display:block;width:100%;margin:0 0 10px;padding:0;border:0;background:none;break-inside:avoid;text-align:left;cursor:pointer;font:inherit;color:inherit}
.fi-tile img{display:block;width:100%;height:auto;border-radius:14px;background:rgb(var(--color-ink)/.06)}
.fi-part{position:absolute;left:8px;top:8px;max-width:calc(100% - 16px);padding:2px 8px;border-radius:999px;background:rgba(30,26,18,.66);color:#fff;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fi-cap{display:block;padding:5px 2px 0;font-size:12.5px;line-height:1.3;color:rgb(var(--color-ink)/.75)}
.fi-skel{display:block;width:100%;margin:0 0 10px;border-radius:14px;background:rgb(var(--color-ink)/.07);break-inside:avoid}
.fi-end{padding:12px 0 18px;text-align:center;font-size:13px;color:rgb(var(--color-ink)/.6)}
.fi-viewer{position:fixed;inset:0;z-index:110;display:flex;flex-direction:column;background:#141210;color:#F1ECE3}
.fi-vt{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;padding-top:max(10px,env(safe-area-inset-top,0px));font-size:13.5px;color:#C9C1B4}
.fi-vx{display:grid;place-items:center;width:44px;height:44px;border:0;border-radius:999px;background:none;color:inherit;cursor:pointer}
.fi-vp{position:relative;flex:1;min-height:0;display:flex;align-items:center;justify-content:center;touch-action:pan-y}
.fi-vp img{max-width:100%;max-height:100%;object-fit:contain;border-radius:18px}
.fi-arr{position:absolute;top:50%;transform:translateY(-50%);display:grid;place-items:center;width:44px;height:44px;border:0;border-radius:999px;background:rgba(255,255,255,.14);color:#fff;cursor:pointer}
.fi-l{left:12px}.fi-r{right:12px}
.fi-vc{padding:12px 16px;padding-bottom:max(16px,env(safe-area-inset-bottom,0px))}
.fi-vc b{display:block;font-size:17px;font-weight:600}
.fi-vc p{margin:2px 0 12px;font-size:13.5px;color:#C9C1B4}
.fi-view{width:100%;min-height:44px;border:0;border-radius:999px;background:rgb(var(--sn-accent));color:rgb(var(--sn-on-accent));font:inherit;font-weight:600;cursor:pointer}
`;
