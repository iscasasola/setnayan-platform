'use client';

import type { CSSProperties } from 'react';
import type { WatermarkReason } from '@/lib/panood-watermark';

/**
 * A hard dark OUTLINE on the mark, not a soft glow.
 *
 * The overlay must read on the brightest frame a wedding produces — a white dress under a window,
 * an outdoor noon ceremony — and a blurred drop-shadow does nothing there: it spreads over an
 * already-white background and vanishes. Measured, cream at 85% with a 12px blur reaches only
 * ~1.59:1 against a blown-out frame, so on exactly the shots that matter most the paywall
 * visually disappears.
 *
 * Four offset zero-blur shadows draw a genuine 1px keyline, which survives any background because
 * it is drawn AGAINST the glyph edge rather than behind it. The soft halo is kept as the last
 * layer so the mark still sits down into a dark church scene instead of glaring.
 *
 * This changes legibility only — the mark's size, placement and full-screen coverage are exactly
 * as owner-picked 2026-07-21. Drop this one style object to return to the plain glow.
 */
function markOutline(px: number): CSSProperties {
  const o = `${px}px`;
  const n = `-${px}px`;
  return {
    textShadow: [
      `${o} ${o} 0 rgba(0,0,0,0.8)`,
      `${n} ${n} 0 rgba(0,0,0,0.8)`,
      `${o} ${n} 0 rgba(0,0,0,0.8)`,
      `${n} ${o} 0 rgba(0,0,0,0.8)`,
      `0 2px 14px rgba(0,0,0,0.55)`,
    ].join(', '),
  };
}

/**
 * The full-screen SETNAYAN overlay — the Live Studio paywall (owner-locked 2026-07-21:
 * "while not paid, we will run setnayan logo on all screens").
 *
 * Drawn over EVERY video surface while the overlay is on: the control-room program monitor,
 * every source thumbnail, the split composite, the OBS program pop-out, the camera operator's
 * own publisher view, and the venue screens. One uncovered surface would be the whole bypass,
 * so this is the only overlay component and it reads its on/off from `decideWatermark`.
 *
 * DESIGN INTENT — it must do two contradictory things at once, and the balance is the product:
 *   • Cover enough that the feed is worthless as a real broadcast (it is the paywall), and
 *   • Stay transparent enough that the couple can still VERIFY their rig — see that camera 3 is
 *     framed right, that the DSLR bridged, that the venue WiFi holds. If they cannot check
 *     their setup through it, the free tier fails at its only job and no one converts.
 * Hence a large centred wordmark at partial opacity over a light scrim, not an opaque card.
 *
 * Uses the wordmark as TEXT, not the SVG mark: it must scale to any tile from a 120px thumbnail
 * to a 1080p pop-out, and stay legible after OBS re-encodes it. Brand lock: always the full
 * spelling SETNAYAN, never STNYN.
 */

export type OverlaySize = 'thumb' | 'monitor' | 'full';

const SIZE: Record<OverlaySize, { text: string; sub: string; gap: string }> = {
  // Source thumbnails — small, so wordmark only; a subtitle would be unreadable noise.
  thumb: { text: 'text-[10px] tracking-[0.28em]', sub: 'hidden', gap: 'gap-0' },
  // The control-room program monitor.
  monitor: { text: 'text-2xl sm:text-3xl tracking-[0.3em]', sub: 'text-[10px] tracking-[0.2em]', gap: 'gap-2' },
  // The OBS capture surface / fullscreen.
  full: { text: 'text-4xl sm:text-6xl tracking-[0.32em]', sub: 'text-xs tracking-[0.22em]', gap: 'gap-3' },
};

export function SetnayanOverlay({
  size = 'monitor',
  reason,
  className = '',
}: {
  size?: OverlaySize;
  /** Drives the sub-line. Omitted on thumbnails. */
  reason?: WatermarkReason;
  className?: string;
}) {
  const s = SIZE[size];
  const sub =
    reason === 'expired' ? 'Broadcast window closed' : 'Preview — unlock to broadcast';

  return (
    <div
      // aria-hidden: this is decorative chrome over video. The operator-facing explanation
      // lives in the badge//detail copy beside the monitor, which IS announced.
      aria-hidden
      data-panood-overlay="on"
      className={`pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center ${s.gap} bg-ink/25 ${className}`}
    >
      <span
        style={markOutline(size === 'full' ? 2 : 1)}
        className={`select-none font-semibold uppercase text-cream ${s.text}`}
      >
        SETNAYAN
      </span>
      <span
        style={markOutline(1)}
        className={`select-none uppercase text-cream/85 ${s.sub}`}
      >
        {sub}
      </span>
    </div>
  );
}
