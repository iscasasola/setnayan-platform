'use client';

import React, { useId } from 'react';

/**
 * BespokeMonogramMark — renders an applied Setnayan-AI bespoke monogram
 * (events.monogram_custom_svg) inside the exact circle slot the landing-page
 * hero / maker preview use for the typographic mark.
 *
 * SECURITY — the SVG was allowlist-sanitized server-side at generation time
 * (lib/bespoke-monogram-engine.ts), and renders here via a data-URI <img>,
 * which is an inert image context (no script execution, no external fetches)
 * — defense-in-depth on top of the sanitizer.
 *
 * ⭕ NO RING (owner 2026-09-21: "a circle on the monogram that is not part of
 * the monogram. remove that"). This used to draw a 2px ring in the monogram
 * colour and a cream disc around every uploaded / AI mark — a frame the couple
 * never designed. The mark now renders as itself. `plate` keeps a plain cream
 * disc, with NO ring, for the dark surfaces that need one to read (the recap
 * photo hero, the Live Wall) — see HeroMonogram's `plate`.
 *
 * `entrance` plays a gentle bloom-in (fade + scale settle) when the event
 * owns the ANIMATED_MONOGRAM upgrade — the Motion Library's glyph-level
 * signatures (stroke-trace etc.) need letterform strokes, so the bespoke
 * mark gets this container-level entrance instead. Collapses to the static
 * mark under `prefers-reduced-motion: reduce` (WCAG 2.2 § 2.3.3).
 */

type Size = 'md' | 'lg';

const SIZE_PX: Record<Size, number> = {
  // Mirrors AnimatedMonogramHero — the landing hero circle (h-20 w-20 = 80px)
  // and the larger maker-preview slot.
  md: 80,
  lg: 96,
};

export function BespokeMonogramMark({
  svg,
  size = 'md',
  className,
  shadow = false,
  entrance = false,
  plate = false,
}: {
  /** Sanitized SVG markup (events.monogram_custom_svg). */
  svg: string;
  /** Kept for callers; the ring it coloured is gone (see the note above). */
  color?: string;
  size?: Size;
  className?: string;
  shadow?: boolean;
  /** Play the bloom-in entrance (ANIMATED_MONOGRAM owners). */
  entrance?: boolean;
  /** A plain cream disc behind the mark, for dark surfaces. Never a ring. */
  plate?: boolean;
}) {
  const px = SIZE_PX[size];
  const uid = useId().replace(/[:]/g, '');
  const sc = `bm-${uid}`;
  const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

  return (
    <span
      aria-hidden
      className={`${sc} inline-flex shrink-0 items-center justify-center ${
        plate ? 'overflow-hidden rounded-full bg-cream' : ''
      } ${shadow && plate ? 'shadow-sm' : ''} ${className ?? ''}`.trim()}
      style={{ height: px, width: px }}
    >
      {entrance ? (
        <style>{`
          .${sc} img {
            opacity: 0;
            transform: scale(0.92);
            animation: ${sc}-bloom 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.15s forwards;
          }
          @keyframes ${sc}-bloom {
            to { opacity: 1; transform: scale(1); }
          }
          @media (prefers-reduced-motion: reduce) {
            .${sc} img { opacity: 1; transform: none; animation: none; }
          }
        `}</style>
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element -- inert data-URI
          render of the sanitized mark; next/image adds nothing for an inline
          SVG data URI and its loader would reject it. */}
      <img
        src={dataUri}
        alt=""
        width={px}
        height={px}
        style={{
          width: plate ? '86%' : '100%',
          height: plate ? '86%' : '100%',
          objectFit: 'contain',
          // Off the disc, the shadow follows the mark's own shape.
          filter: shadow && !plate ? 'drop-shadow(0 1px 2px rgba(0,0,0,0.18))' : undefined,
        }}
      />
    </span>
  );
}
