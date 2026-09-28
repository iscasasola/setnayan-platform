'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { FIRST_PREVIEW_GRACE_MS, printPreviewLoad, printPreviewView, type PrintPreviewStatus } from '@/lib/print-preview-view';

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
 * ⚡ THE FIRST PREVIEW DRAWS FIRST (owner 2026-09-28: the boarding pass took
 * ~8 s). Every preview used to ask the server at once — seven set pieces plus
 * the free group, each ~1 s of server work — so the one the couple was looking
 * at queued behind the ones they were not. Now (`printPreviewLoad`):
 *   · the FIRST piece asks straight away, `fetchpriority="high"`;
 *   · every other piece waits until it is within a screen of view AND the first
 *     has drawn (or `FIRST_PREVIEW_GRACE_MS` has passed, so nothing waits on a
 *     preview that is off screen or slow);
 *   · once a piece has drawn, its OTHER sizes are fetched while the page is
 *     idle, so picking a size from the dropdown finds the picture already here
 *     (the addresses are versioned and immutable — `lib/print-preview-cache.ts`).
 *
 * The status → copy/flags mapping is `lib/print-preview-view.ts`, a PURE
 * function, so the loading and error states are provable in the unit suite
 * without a DOM (this repo's `tsx --test` has none). This component only
 * wires that mapping to `useState` and the `<img>`'s own events.
 *
 * Client component ONLY for this box; the panel around it stays a server
 * component with no writes (`maker-prints.tsx`'s own rule).
 */

// ── ONE GATE FOR THE PANEL — opened by the first preview's load (or error). ──
let firstDrawn = false;
const waiting = new Set<() => void>();
function openGate() {
  if (firstDrawn) return;
  firstDrawn = true;
  for (const go of waiting) go();
  waiting.clear();
}

export function PrintPreview({
  src,
  alt,
  label,
  priority = false,
  prefetch = [],
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
}) {
  // The status belongs to ONE address: a new size (a new `src`) starts at
  // "loading" by construction, never by an effect that could run after the
  // cached image had already fired `load`.
  const [state, setState] = useState<{ src: string; status: PrintPreviewStatus }>({ src, status: 'loading' });
  const status: PrintPreviewStatus = state.src === src ? state.status : 'loading';
  // Bumped on Retry so the <img> gets a fresh element (a new `key`) instead of
  // re-requesting a URL the browser may have already cached as a failure.
  const [attempt, setAttempt] = useState(0);
  const plan = printPreviewLoad(priority);
  const [go, setGo] = useState(!plan.deferred);
  const box = useRef<HTMLDivElement>(null);
  const view = printPreviewView(status, label);

  // Deferred: within a screen of view AND the first preview has drawn.
  useEffect(() => {
    if (go) return;
    const el = box.current;
    let visible = false;
    let gated = firstDrawn;
    const tryGo = () => {
      if (visible && gated) setGo(true);
    };
    const onGate = () => {
      gated = true;
      tryGo();
    };
    if (!gated) waiting.add(onGate);
    const grace = window.setTimeout(openGate, FIRST_PREVIEW_GRACE_MS);
    let io: IntersectionObserver | null = null;
    if (el && typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(
        (entries) => {
          visible = entries.some((e) => e.isIntersecting);
          tryGo();
        },
        { rootMargin: plan.rootMargin },
      );
      io.observe(el);
    } else {
      visible = true;
      tryGo();
    }
    return () => {
      waiting.delete(onGate);
      window.clearTimeout(grace);
      io?.disconnect();
    };
  }, [go, plan.rootMargin]);

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

  const settle = (next: PrintPreviewStatus) => {
    setState({ src, status: next });
    if (priority) openGate();
  };

  return (
    <div
      ref={box}
      data-print-preview={priority ? 'first' : 'deferred'}
      data-print-preview-src={src}
      data-print-prefetch={prefetch.join(' ')}
      className="relative flex h-[340px] w-full items-center justify-center overflow-hidden rounded-xl bg-ink/[0.04] p-4"
    >
      {view.showImage && go ? (
        // eslint-disable-next-line @next/next/no-img-element -- the piece IS a generated SVG/JPEG from our own route, sized by its own viewBox
        <img
          key={attempt}
          src={src}
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
