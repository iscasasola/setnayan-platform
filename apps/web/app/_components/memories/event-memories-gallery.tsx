'use client';

/**
 * event-memories-gallery.tsx — THIS EVENT'S MEMORIES: the event bar's fifth tab (owner 2026-10-23, "Yes", on
 * `prototypes/event_bar_memories_tab_2026-10-23.html` frames 3–4, which copy the gallery of
 * `prototypes/papic_controller_one_page_2026-10-23.html` — "Gallery, revised").
 *
 *   · NO FRAME, EDGE TO EDGE (owner: *"gallery shouldn't be inside a frame. maximize width"*): square tiles with
 *     1.5 px gaps; the house gutter only where words sit.
 *   · THE COLUMNS FOLLOW THE ZOOM, LIKE APPLE PHOTOS: phone 3 ↔ 5 ↔ 7 ↔ 1 by pinch, desktop 6 · 9 · 12 · 16 with
 *     − / + (and a trackpad pinch), remembered on this device (`lib/gallery-zoom.ts`).
 *   · TOP ROW: the count, centred (Albums ▾ to its left and ⚙ to its right join with the gallery's own controls).
 *   · THE THUMB ROW: the shared `ThumbRow` — "Search memories" narrows the photos by who took them, on the device.
 *   · A tap opens the shipped lightbox (`PapicLightbox`, the couple's save / download) — the grid never re-renders.
 *
 * The page's own tokens throughout (light and the app's dark) — this is the event's page, not the obsidian
 * Papic surface. A failed read says so (`unreadable`), never an empty gallery.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Minus, Play, Plus } from 'lucide-react';
import { ThumbRow } from '@/components/thumb-row';
import { ActionButton } from '@/components/action-button';
import type { GalleryPhoto } from '@/lib/papic-gallery';
import { PapicLightbox } from '@/app/dashboard/[eventId]/studio/papic/_components/papic-gallery-grid';
import {
  DESK_FROM_PX,
  ZOOM_KEY_DESK,
  ZOOM_KEY_PHONE,
  defaultFor,
  isDense,
  readColumns,
  stepColumns,
  stepsFor,
  type ZoomScale,
} from '@/lib/gallery-zoom';
import { useGridPinch } from './use-grid-pinch';

function useScale(): ZoomScale {
  const [scale, setScale] = useState<ZoomScale>('phone');
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${DESK_FROM_PX}px)`);
    const on = () => setScale(mq.matches ? 'desk' : 'phone');
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return scale;
}

/** The remembered column count for this scale — localStorage may be refused (a private window); then the default. */
function useColumns(scale: ZoomScale): [number, (next: number) => void] {
  const key = scale === 'desk' ? ZOOM_KEY_DESK : ZOOM_KEY_PHONE;
  const [cols, setCols] = useState<number>(() => defaultFor(scale));
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      raw = null;
    }
    setCols(readColumns(raw, scale));
  }, [key, scale]);
  const setTo = useCallback(
    (next: number) => {
      setCols(next);
      try {
        window.localStorage.setItem(key, String(next));
      } catch {
        /* per-viewer convenience only */
      }
    },
    [key],
  );
  return [cols, setTo];
}

export function EventMemoriesGallery({
  photos,
  countLine,
  footLine,
  cappedLine,
  emptyLine,
  unreadable,
  timeZone,
}: {
  photos: GalleryPhoto[];
  /** "1,284 photos" — the album's count, or null when the count could not be read (no number is guessed). */
  countLine: string | null;
  /** The cameras' state for the foot line: "opens in 51 days" · "cameras open now" · "cameras closed" · null. */
  footLine: string | null;
  /** "1,284 kept · showing the newest 240" — only when the page holds fewer than there are. */
  cappedLine: string | null;
  /** What an empty, readable gallery says. */
  emptyLine: string;
  /** The read was refused — say so, never "nothing yet". */
  unreadable: boolean;
  timeZone: string | null;
}) {
  const scale = useScale();
  const [cols, setCols] = useColumns(scale);
  const dense = isDense(cols);
  const [opened, setOpened] = useState<GalleryPhoto | null>(null);
  const [q, setQ] = useState('');

  const shown = useMemo(() => {
    const words = q.trim().toLowerCase();
    if (!words) return photos;
    return photos.filter((p) => (p.capturedBy ?? '').toLowerCase().includes(words));
  }, [photos, q]);

  // ── PINCH (phone) and ⌃ + WHEEL (desktop): ONE step per gesture, the grid scaling live in between ──────────
  const gridRef = useRef<HTMLDivElement>(null);
  const stepFrom = useCallback((c: number, dir: 1 | -1) => stepColumns(c, dir, scale), [scale]);
  const { snap } = useGridPinch({ gridRef, cols, stepFrom, setCols });

  const steps = stepsFor(scale);
  const zoomWords =
    scale === 'desk' ? '+ / − change the columns' : 'Pinch to change the columns — 3 · 5 · 7, or one large';

  return (
    <section data-event-memories="" data-memories-columns={cols} className="pb-24">
      <h1 className="sr-only">Memories</h1>

      {/* TOP ROW — the count, centred; − / + on a desktop. */}
      <div className="flex min-h-[48px] items-center gap-2 pb-2.5" data-memories-top="">
        <p className="min-w-0 flex-1 truncate text-center text-[13px] text-ink/60" data-memories-count="">
          {unreadable ? (
            'couldn’t load'
          ) : countLine ? (
            <span className="font-medium text-ink">{countLine}</span>
          ) : null}
        </p>
        {scale === 'desk' ? (
          <span className="inline-flex gap-1.5" data-memories-zoom="">
            <ActionButton
              tone="neutral"
              iconOnly
              icon={Minus}
              label="Fewer columns"
              disabled={cols === steps[0]}
              onClick={() => snap(-1)}
            />
            <ActionButton
              tone="neutral"
              iconOnly
              icon={Plus}
              label="More columns"
              disabled={cols === steps[steps.length - 1]}
              onClick={() => snap(1)}
            />
          </span>
        ) : null}
      </div>

      {unreadable ? (
        <p role="status" className="px-4 py-10 text-center text-[14px] text-ink/65" data-memories-unreadable="">
          We couldn’t load your photos just now. Nothing has changed — refresh to see them.
        </p>
      ) : photos.length === 0 ? (
        <p className="px-4 py-10 text-center text-[14px] text-ink/60" data-memories-empty="">
          {emptyLine}
        </p>
      ) : (
        /* EDGE TO EDGE: the grid cancels the event layout's gutter (px-4 · sm:px-6 · lg:px-8). */
        <div
          ref={gridRef}
          data-memories-grid=""
          className="-mx-4 grid touch-pan-y gap-[1.5px] bg-ink/[0.08] sm:-mx-6 lg:-mx-8"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {shown.map((p) => (
            <Tile key={p.id} photo={p} dense={dense} large={cols === 1} roomy={cols <= 3} onOpen={() => setOpened(p)} />
          ))}
        </div>
      )}

      {q.trim() && shown.length === 0 && photos.length > 0 ? (
        <p role="status" className="py-3 text-center text-[14px] text-ink/60" data-memories-no-match="">
          No photos from “{q.trim()}” here.
        </p>
      ) : null}

      <p className="pt-2.5 text-[12px] text-ink/55" data-memories-foot="">
        {zoomWords} · remembered on this device{footLine ? ` · ${footLine}` : ''}
      </p>
      {cappedLine ? (
        <p className="pt-1 text-[12px] text-ink/55" data-memories-capped="">
          {cappedLine}
        </p>
      ) : null}

      <MemoriesThumbRow q={q} onSearch={setQ} />

      {opened ? <PapicLightbox photo={opened} onClose={() => setOpened(null)} timeZone={timeZone} /> : null}
    </section>
  );
}

function Tile({ photo, dense, large, roomy, onOpen }: { photo: GalleryPhoto; dense: boolean; large: boolean; roomy: boolean; onOpen: () => void }) {
  const who = photo.capturedBy ?? null;
  const src = large ? (photo.largeUrl ?? photo.url) : photo.url;
  const label = `${photo.kind === 'clip' ? 'Clip' : 'Photo'}${who ? ` from ${who}` : ''}`;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      data-memories-tile=""
      className="relative block aspect-square w-full overflow-hidden bg-ink/[0.06] p-0"
    >
      {/* 🗜 The small copy — the tile copy only one-across, where 320 px falls apart. Never an original. */}
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" decoding="async" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
      {photo.kind === 'clip' ? (
        <span
          aria-hidden
          data-tile-clip=""
          className={`absolute inline-flex items-center justify-center rounded-full bg-black/55 text-white ${dense ? 'right-1 top-1 h-3.5 w-3.5' : 'right-1.5 top-1.5 h-[22px] w-[22px]'}`}
        >
          <Play className={dense ? 'h-2 w-2 fill-current' : 'h-3 w-3 fill-current'} strokeWidth={0} />
        </span>
      ) : null}
      {who && !dense ? (
        <span
          aria-hidden
          className={`absolute bottom-[3px] right-1 max-w-[calc(100%-8px)] truncate text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.6)] ${roomy ? 'text-[11px]' : 'text-[9.5px]'}`}
        >
          {who}
        </span>
      ) : null}
    </button>
  );
}

/**
 * The one thumb row, drawn into <body> (the dashboard's page wrapper captures `position: fixed`), above the dock —
 * the Find row's seat (`find-thumb-row.tsx`). "Search memories" narrows by who took a photo, on the device.
 */
function MemoriesThumbRow({ q, onSearch }: { q: string; onSearch: (v: string) => void }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [up, setUp] = useState(false);
  useEffect(() => {
    setHost(document.body);
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setUp(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, []);
  if (!host) return null;
  return createPortal(
    <div
      data-memories-thumb=""
      data-on={up ? 'true' : 'false'}
      className={`pointer-events-none fixed inset-x-0 bottom-[var(--sn-bottomdock-h,64px)] z-[25] pl-[max(1rem,var(--sn-safe-l))] pr-[max(1rem,var(--sn-safe-r))] py-2.5 transition-transform duration-300 ease-out motion-reduce:transition-none tab:bottom-7 tab:left-auto tab:right-[max(1.75rem,var(--sn-safe-r))] tab:w-[min(720px,calc(100vw-128px))] tab:px-0 ${
        up ? 'translate-y-0' : 'translate-y-[calc(100%_+_32px)]'
      }`}
    >
      <ThumbRow
        name="memories-event"
        field={{
          placeholder: 'Search memories',
          label: 'Search memories — by who took them',
          input: { value: q, onChange: (e) => onSearch(e.target.value), 'data-memories-search': '' },
        }}
      />
    </div>,
    host,
  );
}
