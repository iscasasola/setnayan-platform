'use client';

import { useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { printPreviewView } from '@/lib/print-preview-view';

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
 * The status → copy/flags mapping is `lib/print-preview-view.ts`, a PURE
 * function, so the loading and error states are provable in the unit suite
 * without a DOM (this repo's `tsx --test` has none). This component only
 * wires that mapping to `useState` and the `<img>`'s own events.
 *
 * Client component ONLY for this box; the panel around it stays a server
 * component with no writes (`maker-prints.tsx`'s own rule).
 */
export function PrintPreview({
  src,
  alt,
  label,
}: {
  /** `/api/hub-print/<piece>?event=…&mode=screen…` */
  src: string;
  alt: string;
  /** The piece's own name, lowercased into the sentence — "invitation", "poster". */
  label: string;
}) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  // Bumped on Retry so the <img> gets a fresh element (a new `key`) instead of
  // re-requesting a URL the browser may have already cached as a failure.
  const [attempt, setAttempt] = useState(0);
  const view = printPreviewView(status, label);

  return (
    <div className="relative flex h-[340px] w-full items-center justify-center overflow-hidden rounded-xl bg-ink/[0.04] p-4">
      {view.showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- the piece IS a generated SVG/JPEG from our own route, sized by its own viewBox
        <img
          key={attempt}
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
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
              setStatus('loading');
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
