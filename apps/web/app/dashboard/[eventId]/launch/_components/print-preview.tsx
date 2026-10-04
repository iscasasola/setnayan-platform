'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { printPreviewBox, printPreviewLoad, printPreviewView, type PrintPreviewStatus } from '@/lib/print-preview-view';
import { PRINT_FIELD_LABEL, parsePrintFields, useDetailsTap, type PrintFieldsHeader } from './details-tap';

/**
 * PrintPreview — the one place a Prints & Tickets sample is drawn on screen
 * (Maker phone-polish sweep, 2026-09-26).
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────
 * Each piece is `<img src="/api/hub-print/<piece>?mode=screen">`, and that
 * route renders an SVG or a flattened JPEG server-side — real work, not a
 * cached asset. On a slow render or a slow phone connection the plain `<img>`
 * sat as an empty `bg-ink/[0.04]` box for several seconds with NOTHING telling
 * the couple a picture was even coming. Grey-and-silent reads as "broken",
 * not "loading" — the exact shape of the disease this build's own `CLAUDE.md`
 * names: a measurement (the fetch is in flight) that never reaches the pixel.
 *
 * Three states, one box, so the layout never jumps:
 *   loading — a soft shimmer + "Drawing your <piece>…", announced for anyone
 *             not watching the screen (`role="status"`);
 *   loaded  — the real image, faded in;
 *   error   — an honest line (`role="alert"`) plus a Retry button. Never a
 *             silent grey box — the couple should never wonder whether the
 *             app is still trying.
 *
 * ⚡ THE FIRST PREVIEW DRAWS FIRST (owner 2026-09-28: the boarding-pass
 * preview took ~8 s). Every preview used to ask the server at once, at the
 * same priority. Now (`printPreviewLoad`) the first piece asks eagerly with
 * `fetchpriority="high"` and the others lazily at low priority; and once a
 * piece has drawn, its OTHER sizes are fetched while the page is idle, so
 * picking a size from the dropdown finds the picture already here (the
 * addresses are versioned and immutable — `lib/print-preview-cache.ts`).
 *
 * The status → copy/flags mapping is `lib/print-preview-view.ts`, a PURE
 * function, so the loading and error states are provable in the unit suite
 * without a DOM (this repo's `tsx --test` has none). This component only
 * wires that mapping to `useState` and the `<img>`'s own events.
 *
 * ✍ TAPPABLE (owner 2026-09-28: the print-only words are edited by tapping
 * them on the card — "tap it, edit it on the right"). The words are outlines
 * inside one picture, so the picture is FETCHED once instead of handed to an
 * `<img>`: the route's `x-print-fields` header says where each field landed,
 * and a tap target is laid over it (`details-tap.ts`). The same address, so the
 * same cache; a picture without the header just has no targets.
 *
 * Client component ONLY for this box; the panel around it stays a server
 * component with no writes (`maker-prints.tsx`'s own rule).
 */

export function PrintPreview({
  src,
  alt,
  label,
  priority = false,
  prefetch = [],
  tappable = false,
  aspect = null,
}: {
  /** `/api/hub-print/<piece>?event=…&mode=screen…` */
  src: string;
  alt: string;
  /** The piece's own name, lowercased into the sentence — "invitation", "poster". */
  label: string;
  /** The first piece on the panel — asked for at once, ahead of the rest. */
  priority?: boolean;
  /** The same piece in its OTHER sizes — warmed once this one has drawn. */
  prefetch?: readonly string[];
  /** Its print-only words open their field on the right (Details only). */
  tappable?: boolean;
  /** The piece's shape, width ÷ height — the box takes it (`printPreviewBox`). */
  aspect?: number | null;
}) {
  const tap = useDetailsTap();
  const fetched = tappable && tap !== null;
  const [shown, setShown] = useState<{ src: string; url: string; fields: PrintFieldsHeader | null } | null>(null);
  // The status belongs to ONE address: a new size (a new `src`) starts at
  // "loading" by construction, never by an effect that could run after the
  // cached image had already fired `load`.
  const [state, setState] = useState<{ src: string; status: PrintPreviewStatus }>({ src, status: 'loading' });
  const status: PrintPreviewStatus = state.src === src ? state.status : 'loading';
  // Bumped on Retry so the <img> gets a fresh element (a new `key`) instead of
  // re-requesting a URL the browser may have already cached as a failure.
  const [attempt, setAttempt] = useState(0);
  const plan = printPreviewLoad(priority);
  const view = printPreviewView(status, label);
  const box = printPreviewBox(aspect);

  // Warm the other sizes once this one is on screen — idle time only.
  const prefetchKey = prefetch.join('\n');
  useEffect(() => {
    if (status !== 'loaded' || !prefetchKey) return;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (conn?.saveData) return;
    const run = () => {
      for (const url of prefetchKey.split('\n')) {
        const img = new Image();
        img.decoding = 'async';
        img.src = url;
      }
    };
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(run);
      return () => w.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(run, 800);
    return () => window.clearTimeout(t);
  }, [status, prefetchKey]);

  const settle = (next: PrintPreviewStatus) => setState({ src, status: next });

  /* ✍ The tappable picture: fetched once (the same cached address), its boxes read from the header. */
  useEffect(() => {
    if (!fetched) return;
    let dead = false;
    let url: string | null = null;
    fetch(src)
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        const fields = parsePrintFields(r.headers.get('x-print-fields'));
        const blob = await r.blob();
        if (dead) return;
        url = URL.createObjectURL(blob);
        setShown({ src, url, fields });
      })
      .catch(() => {
        if (!dead) setState({ src, status: 'error' });
      });
    return () => {
      dead = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [fetched, src, attempt]);
  const imgSrc = fetched ? (shown?.src === src ? shown.url : null) : src;
  const boxes = fetched && shown?.src === src ? shown.fields : null;

  /* 🧊 A PICTURE THAT WAS ALREADY THERE. The previews are cached for good now
     (versioned addresses), so an `<img>` in the page's HTML often finishes
     from the cache BEFORE React has hydrated — and a `load` that fired before
     hydration is never delivered to `onLoad`. The box would then hold the
     picture at opacity 0 under "Drawing your…" forever. So on mount, and on
     every new address, ask the element itself. */
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete) setState({ src, status: el.naturalWidth > 0 ? 'loaded' : 'error' });
  }, [src, attempt]);

  return (
    <div
      data-print-preview={priority ? 'first' : 'later'}
      data-print-preview-src={src}
      data-print-prefetch={prefetch.join(' ')}
      style={box.style}
      className={`relative flex ${box.className} w-full items-center justify-center overflow-hidden rounded-xl bg-ink/[0.04] p-4`}
    >
      {view.showImage && imgSrc ? (
        fetched ? (
          <span className="relative inline-flex max-w-full">
            {/* eslint-disable-next-line @next/next/no-img-element -- the piece IS a generated SVG/JPEG from our own route, fetched for its field boxes */}
            <img
              key={attempt}
              ref={imgRef}
              src={imgSrc}
              alt={alt}
              loading={plan.loading}
              fetchPriority={plan.fetchPriority}
              decoding="async"
              onLoad={() => settle('loaded')}
              onError={() => settle('error')}
              className={`max-h-[308px] max-w-full drop-shadow-[0_18px_24px_rgba(0,0,0,0.28)] transition-opacity duration-300 ${
                view.imageVisible ? 'opacity-100' : 'opacity-0'
              }`}
            />
            {boxes && view.imageVisible
              ? boxes.fields.map((b) => (
                  <button
                    key={b.field}
                    type="button"
                    data-print-field-tap={b.field}
                    aria-label={PRINT_FIELD_LABEL[b.field]}
                    onClick={() => tap?.(b.field)}
                    className="absolute rounded-md outline-dashed outline-1 outline-mulberry/40 transition-colors hover:bg-mulberry/10 focus-visible:bg-mulberry/10 focus-visible:outline-2 focus-visible:outline-mulberry"
                    style={{
                      left: `${(b.x / boxes.w) * 100}%`,
                      width: `${(b.w / boxes.w) * 100}%`,
                      // At least a thumb tall (44 px), centred on the words.
                      top: `calc(${((b.y + b.h / 2) / boxes.h) * 100}% - max(22px, ${(b.h / boxes.h) * 50}%))`,
                      height: `max(44px, ${(b.h / boxes.h) * 100}%)`,
                    }}
                  />
                ))
              : null}
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- the piece IS a generated SVG/JPEG from our own route, sized by its own viewBox
          <img
            key={attempt}
            ref={imgRef}
            src={imgSrc}
            alt={alt}
            loading={plan.loading}
            fetchPriority={plan.fetchPriority}
            decoding="async"
            onLoad={() => settle('loaded')}
            onError={() => settle('error')}
            className={`max-h-full max-w-full drop-shadow-[0_18px_24px_rgba(0,0,0,0.28)] transition-opacity duration-300 ${
              view.imageVisible ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )
      ) : null}

      {view.showShimmer || view.loadingLabel ? (
        <div
          role="status"
          aria-live="polite"
          className="absolute inset-4 flex flex-col items-center justify-end gap-2 pb-2"
        >
          {view.showShimmer ? (
            <div aria-hidden className="absolute inset-0 -z-0 animate-pulse rounded-lg bg-ink/[0.06]" />
          ) : null}
          {view.loadingLabel ? <p className="relative text-xs font-medium text-ink/55">{view.loadingLabel}</p> : null}
        </div>
      ) : null}

      {view.errorLabel ? (
        <div role="alert" className="flex flex-col items-center gap-2 px-2 text-center">
          <AlertTriangle aria-hidden className="h-5 w-5 text-danger-700" strokeWidth={1.75} />
          <p className="text-xs font-medium text-danger-800">{view.errorLabel}</p>
          <button
            type="button"
            onClick={() => {
              setState({ src, status: 'loading' });
              setAttempt((n) => n + 1);
            }}
            className="button-secondary inline-flex items-center gap-1.5 text-xs"
          >
            <RefreshCw aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Retry
          </button>
        </div>
      ) : null}
    </div>
  );
}
