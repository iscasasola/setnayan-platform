'use client';

import type { CSSProperties, ReactNode } from 'react';
import type { WatermarkReason } from '@/lib/panood-watermark';

/**
 * The Live Studio paywall mark (owner-locked 2026-07-21: "while not paid, we will run setnayan
 * logo on all screens").
 *
 * ── Why this is GEOMETRIC, not a translucent wash ───────────────────────────────────────────
 * The first version dimmed the picture with a scrim. Two problems, both fatal:
 *
 *   1. It was defeatable. OBS ships a Color Correction filter, and the people using this are BY
 *      DEFINITION OBS users — any purely tonal treatment is a ten-second slider drag from being
 *      undone. Geometry is not: no colour filter can un-shrink a picture.
 *   2. It didn't clear a contrast floor. Measured, a gold mark over a 55% scrim over a
 *      white-dress frame reaches only ~1.47:1 — WORSE than the ~1.59:1 of the version it was
 *      meant to replace, and far below the 3.00:1 needed to be perceivable at all. Nothing
 *      clears 3:1 over live video without drowning the picture so thoroughly that the couple can
 *      no longer verify their own framing, which is the one job the free tier exists to do.
 *
 * So the video is SHRUNK inside its box and the mark is drawn on the letterbox chrome the shrink
 * creates — where there is no video behind it. On the frame's own dark ground the same gold
 * measures ~4.94:1: unmistakable, and it costs one static transform rather than a per-frame GPU
 * pass on a laptop already decoding N streams and running an OBS encode.
 *
 * The picture stays fully legible — framing, focus, exposure and cross-camera white balance are
 * all still judgeable, just small. Useless as a broadcast, perfect as a rig check.
 *
 * Corner marks exist so cropping into a quadrant in OBS still yields marked video.
 */

/**
 * How much of the box the picture keeps. 0.62 leaves ~19% chrome on every side — enough to carry
 * a legible mark, small enough that the couple can still read their own framing.
 */
export const PAYWALL_VIDEO_SCALE = 0.62;

/** The asset's own gold. Deliberately not a design token — it matches the favicon and logo. */
const MARK_GOLD = '#cb9e4b';

function markStyle(opacity: number): CSSProperties {
  // Tailwind here is v3, which has no `mask-*` utilities — this must be inline. The -webkit-
  // pairs are the repo convention for the PWA/iOS target. `no-repeat` is not optional: the asset
  // declares width/height, so a bare mask-image TILES across a 1080p surface.
  return {
    WebkitMaskImage: 'url(/brand/setnayan-mark.svg)',
    maskImage: 'url(/brand/setnayan-mark.svg)',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
    backgroundColor: MARK_GOLD,
    opacity,
  };
}

export type OverlaySize = 'thumb' | 'monitor' | 'full';

const SIZE = {
  thumb: { mark: 'h-4 w-4', corner: 'h-2.5 w-2.5', inset: 'p-1', word: 'hidden', gap: 'gap-1' },
  monitor: {
    mark: 'h-7 w-7',
    corner: 'h-4 w-4',
    inset: 'p-2',
    word: 'text-[10px] tracking-[0.28em]',
    gap: 'gap-2',
  },
  full: {
    mark: 'h-12 w-12',
    corner: 'h-7 w-7',
    inset: 'p-4',
    word: 'text-sm tracking-[0.3em]',
    gap: 'gap-3',
  },
} as const;

/**
 * Shrinks its children inside the parent box so the paywall marks have chrome to sit on.
 *
 * Wraps the whole video BRANCH — never a leaf `<video>`, and never an individual split pane:
 * `splitRatioFromPointer` measures `getBoundingClientRect()`, which reports the POST-transform
 * box, so a scale on any ancestor of the divider would silently desync it from the pointer.
 */
export function PaywalledVideo({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div
        className="relative h-full w-full"
        style={{ transform: `scale(${PAYWALL_VIDEO_SCALE})` }}
      >
        {children}
      </div>
    </div>
  );
}

/** The marks — drawn on top of the shrunken picture so they land on chrome, not on video. */
export function SetnayanOverlay({
  size = 'monitor',
  reason,
  corners = true,
  className = '',
}: {
  size?: OverlaySize;
  reason?: WatermarkReason;
  /** Anti-crop corner marks. On by default — a cropped quadrant must still carry a mark. */
  corners?: boolean;
  className?: string;
}) {
  const s = SIZE[size];
  const sub = reason === 'expired' ? 'Broadcast window closed' : 'Preview — unlock to broadcast';

  return (
    <div
      // Decorative chrome over video; the announced explanation lives in the badge/detail copy
      // rendered beside the monitor.
      aria-hidden
      data-panood-overlay="on"
      className={`pointer-events-none absolute inset-0 z-20 ${className}`}
    >
      {corners && (
        <>
          <span className={`absolute left-0 top-0 ${s.inset}`}>
            <span className={`block ${s.corner}`} style={markStyle(0.62)} />
          </span>
          <span className={`absolute right-0 top-0 ${s.inset}`}>
            <span className={`block ${s.corner}`} style={markStyle(0.62)} />
          </span>
          <span className={`absolute bottom-0 left-0 ${s.inset}`}>
            <span className={`block ${s.corner}`} style={markStyle(0.62)} />
          </span>
          <span className={`absolute bottom-0 right-0 ${s.inset}`}>
            <span className={`block ${s.corner}`} style={markStyle(0.62)} />
          </span>
        </>
      )}

      {/* Primary mark on the BOTTOM chrome band — no video behind it, so it actually reads. */}
      <div
        className={`absolute inset-x-0 bottom-0 flex h-[19%] items-center justify-center ${s.gap}`}
      >
        <span className={`block shrink-0 ${s.mark}`} style={markStyle(0.92)} />
        <span className={`font-semibold uppercase text-cream/90 ${s.word}`}>SETNAYAN</span>
      </div>

      {/* Top band carries the state, so an operator glancing at the monitor knows why. */}
      {size !== 'thumb' && (
        <div className="absolute inset-x-0 top-0 flex h-[19%] items-center justify-center">
          <span className="text-[10px] uppercase tracking-[0.2em] text-cream/55">{sub}</span>
        </div>
      )}
    </div>
  );
}
