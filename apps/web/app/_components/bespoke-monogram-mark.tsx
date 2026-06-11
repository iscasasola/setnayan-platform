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
  color,
  size = 'md',
  className,
  shadow = false,
  entrance = false,
}: {
  /** Sanitized SVG markup (events.monogram_custom_svg). */
  svg: string;
  /** Ring color — the couple's monogram.color. */
  color: string;
  size?: Size;
  className?: string;
  shadow?: boolean;
  /** Play the bloom-in entrance (ANIMATED_MONOGRAM owners). */
  entrance?: boolean;
}) {
  const px = SIZE_PX[size];
  const uid = useId().replace(/[:]/g, '');
  const sc = `bm-${uid}`;
  const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

  return (
    <span
      aria-hidden
      className={`${sc} inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 bg-cream ${
        shadow ? 'shadow-sm' : ''
      } ${className ?? ''}`.trim()}
      style={{ height: px, width: px, borderColor: color }}
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
        style={{ width: '86%', height: '86%', objectFit: 'contain' }}
      />
    </span>
  );
}
