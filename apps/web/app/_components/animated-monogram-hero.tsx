'use client';

import React, { useId } from 'react';
import type { MonogramMotionKey } from '@/lib/monogram-motion';

/**
 * AnimatedMonogramHero — the paid ANIMATED_MONOGRAM SKU's render
 * (₱2,499 · v2.1 brief § 5), now backed by the Monogram Motion Library.
 *
 * Renders the event's auto-generated text monogram (the "M & J" initials) as
 * an SVG that plays ONE of six premium motion signatures on mount
 * (lib/monogram-motion.ts · persisted as events.monogram_motion_key):
 *
 *   draw      — stroke-trace reveal, then the fill settles in (the original)
 *   foil      — letters appear in ink, a band of golden light sweeps across
 *   bloom     — ink blooms outward from the center of the circle
 *   editorial — letters rise into place while the tracking settles
 *   halo      — the ring sweeps itself around first, letters fade up after
 *   stardust  — gold sparks twinkle around the circle as letters appear
 *
 * All six are pure SVG + scoped CSS — no animation runtime, SSR-safe, and all
 * collapse to the static painted monogram under `prefers-reduced-motion:
 * reduce` (WCAG 2.2 § 2.3.3). `motion` defaults to 'draw' so every existing
 * call site renders exactly what it did before the library landed.
 *
 * SKU DISAMBIGUATION — this is the standalone ANIMATED_MONOGRAM (₱2,499 · V2
 * catalog) applied to the auto-text monogram. It is SEPARATE from the
 * iteration-0004 Monogram Hero widget upgrade (`monogram_hero_upgrade` ·
 * ₱1,999) which bundles a custom video/photo background + SVG/PNG-upload via
 * Potrace and is gated through the invitation_widgets.tier flip. See
 * lib/animated-monogram.ts.
 *
 * SELF-CONTAINED + ADDITIVE — drops into the exact circle shape the
 * landing-page hero already renders (apps/web/app/[slug]/page.tsx · the
 * `h-20 w-20 rounded-full border-2 bg-cream` monogram circle) so unowned
 * events keep the static circle untouched and owned events get the animated
 * one in the same slot. The `halo` signature paints its ring inside the SVG,
 * so it renders the span border transparent and keeps the layout box.
 *
 * ACCESSIBILITY — the animation is decorative; the circle is aria-hidden (the
 * couple name + date below carry the meaning, same as the static circle).
 *
 * PALETTE — uses the couple's monogram color + cream via inline styles only
 * (no Tailwind dark-mode classes), honoring the wedding-landing guardrail in
 * globals.css that keeps the guest page on the couple's palette regardless of
 * the app theme. Stardust sparks use the brand champagne gold.
 */

type Size = 'md' | 'lg';

const SIZE_PX: Record<Size, number> = {
  // Matches the landing-page hero circle (h-20 w-20 = 80px) and the slightly
  // larger PrivateLanding usage. The SVG is square at this px.
  md: 80,
  lg: 96,
};

const SERIF_STACK = "ui-serif, Georgia, Cambria, 'Times New Roman', serif";

// Brand champagne gold (Clean Editorial palette) for the stardust sparks —
// complements both the mulberry and gold monogram inks.
const SPARK_GOLD = '#C5A059';

// Deterministic spark layout (fractions of the square + per-spark delay/scale)
// — fixed so SSR + client render identically; ringed around the letters.
const SPARKS: { x: number; y: number; s: number; d: number }[] = [
  { x: 0.2, y: 0.24, s: 0.055, d: 0.2 },
  { x: 0.79, y: 0.19, s: 0.04, d: 0.55 },
  { x: 0.86, y: 0.6, s: 0.05, d: 0.95 },
  { x: 0.26, y: 0.8, s: 0.045, d: 1.3 },
  { x: 0.64, y: 0.86, s: 0.035, d: 0.75 },
  { x: 0.12, y: 0.52, s: 0.032, d: 1.1 },
  { x: 0.73, y: 0.38, s: 0.028, d: 1.55 },
];

/** Four-point sparkle path centered on 0,0 at radius r. */
function sparklePath(r: number): string {
  const w = r * 0.28;
  return [
    `M0 ${-r} L${w} 0 L0 ${r} L${-w} 0 Z`,
    `M${-r} 0 L0 ${-w} L${r} 0 L0 ${w} Z`,
  ].join(' ');
}

export function AnimatedMonogramHero({
  text,
  color,
  size = 'md',
  className,
  /**
   * Drop a soft shadow to match the over-photo hero variant
   * (apps/web/app/[slug]/page.tsx · the heroPhotoUrl branch uses shadow-sm).
   */
  shadow = false,
  /** Which motion-library signature plays. Defaults to the original draw-on. */
  motion = 'draw',
  /** The couple's exact monogram face (lib/monogram.ts stack). Defaults keep
   *  the original generic-serif rendering for callers that don't resolve it. */
  fontFamily,
  fontStyle,
}: {
  text: string;
  color: string;
  size?: Size;
  className?: string;
  shadow?: boolean;
  motion?: MonogramMotionKey;
  fontFamily?: string;
  fontStyle?: 'italic' | 'normal';
}) {
  const px = SIZE_PX[size];
  // Unique per-instance ids so multiple monograms on one page (defensive)
  // don't share the same <style> scope / gradient namespace.
  const uid = useId().replace(/[:]/g, '');
  const sc = `am-${uid}`;

  // Font scales with initials length so "M & J" and a single "S" both fit the
  // circle — same length tiers as lib/monogram.ts monogramOverlaySvg.
  const len = text.length;
  const fontSize =
    len <= 1 ? px * 0.42 : len <= 3 ? px * 0.3 : len <= 5 ? px * 0.24 : px * 0.2;

  const glyphProps = {
    x: '50%',
    y: '50%',
    textAnchor: 'middle',
    dominantBaseline: 'central',
    fontFamily: fontFamily ?? SERIF_STACK,
    fontStyle: fontStyle ?? 'italic',
    fontWeight: 600,
    fontSize,
  } as const;

  let css = '';
  let body: React.ReactNode = null;

  if (motion === 'foil') {
    // Letters fade in as ink, then a skewed band of golden light sweeps across
    // them (clipped to the glyphs) — gold-foil stationery catching the light.
    // The sweep repeats on a long, restful cycle.
    css = `
      .${sc} svg .am-base {
        fill: ${color};
        opacity: 0;
        animation: ${sc}-in 0.6s ease-out forwards;
      }
      .${sc} svg .am-sheen {
        transform: translateX(${-px * 1.2}px) skewX(-16deg);
        animation: ${sc}-sweep 4.2s ease-in-out 0.7s infinite;
      }
      @keyframes ${sc}-in { to { opacity: 1; } }
      @keyframes ${sc}-sweep {
        0% { transform: translateX(${-px * 1.2}px) skewX(-16deg); }
        40%, 100% { transform: translateX(${px * 1.2}px) skewX(-16deg); }
      }
      @media (prefers-reduced-motion: reduce) {
        .${sc} svg .am-base { opacity: 1; animation: none; }
        .${sc} svg .am-sheen { display: none; }
      }
    `;
    body = (
      <>
        <defs>
          <clipPath id={`${sc}-clip`}>
            <text {...glyphProps}>{text}</text>
          </clipPath>
          <linearGradient id={`${sc}-grad`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0.3" stopColor="#FFF7E0" stopOpacity="0" />
            <stop offset="0.5" stopColor="#FFF7E0" stopOpacity="0.95" />
            <stop offset="0.7" stopColor="#FFF7E0" stopOpacity="0" />
          </linearGradient>
        </defs>
        <text className="am-base" {...glyphProps}>
          {text}
        </text>
        <g clipPath={`url(#${sc}-clip)`}>
          <rect
            className="am-sheen"
            x={0}
            y={0}
            width={px}
            height={px}
            fill={`url(#${sc}-grad)`}
          />
        </g>
      </>
    );
  } else if (motion === 'bloom') {
    // Ink blooms outward from the heart of the circle — a growing circular
    // clip reveals the letters while a soft blur sharpens. Browsers without
    // CSS-animatable `r` keep the full-radius attribute and just get the
    // blur-fade (graceful).
    css = `
      .${sc} svg .am-bloomclip {
        animation: ${sc}-r 1.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
      }
      .${sc} svg .am-bloom {
        fill: ${color};
        opacity: 0;
        filter: blur(3px);
        animation: ${sc}-tx 1.5s ease-out forwards;
      }
      @keyframes ${sc}-r { from { r: 0; } to { r: ${px * 0.55}px; } }
      @keyframes ${sc}-tx {
        0% { opacity: 0; filter: blur(3px); }
        45% { opacity: 1; }
        100% { opacity: 1; filter: blur(0); }
      }
      @media (prefers-reduced-motion: reduce) {
        .${sc} svg .am-bloomclip { animation: none; }
        .${sc} svg .am-bloom { opacity: 1; filter: none; animation: none; }
      }
    `;
    body = (
      <>
        <defs>
          <clipPath id={`${sc}-clip`}>
            <circle
              className="am-bloomclip"
              cx={px / 2}
              cy={px / 2}
              r={px * 0.55}
            />
          </clipPath>
        </defs>
        <g clipPath={`url(#${sc}-clip)`}>
          <text className="am-bloom" {...glyphProps}>
            {text}
          </text>
        </g>
      </>
    );
  } else if (motion === 'editorial') {
    // The letters rise into place while the letter-spacing settles from wide
    // to tight — the quiet confidence of a magazine masthead.
    css = `
      .${sc} svg .am-edit {
        fill: ${color};
        opacity: 0;
        letter-spacing: 0.3em;
        transform: translateY(${px * 0.12}px);
        animation: ${sc}-rise 1.5s cubic-bezier(0.16, 1, 0.3, 1) 0.15s forwards;
      }
      @keyframes ${sc}-rise {
        0% { opacity: 0; letter-spacing: 0.3em; transform: translateY(${px * 0.12}px); }
        55% { opacity: 1; }
        100% { opacity: 1; letter-spacing: 0.02em; transform: translateY(0); }
      }
      @media (prefers-reduced-motion: reduce) {
        .${sc} svg .am-edit {
          opacity: 1;
          letter-spacing: 0.02em;
          transform: none;
          animation: none;
        }
      }
    `;
    body = (
      <text className="am-edit" {...glyphProps}>
        {text}
      </text>
    );
  } else if (motion === 'halo') {
    // The ring sweeps itself around the initials first (exact circumference —
    // a real path length, unlike text), then the letters fade up inside it.
    // The span border renders transparent for this signature; the SVG ring
    // takes its place in the same visual slot.
    const r = px / 2 - 3;
    const c = 2 * Math.PI * r;
    css = `
      .${sc} svg .am-ring {
        stroke-dasharray: ${c.toFixed(2)};
        stroke-dashoffset: ${c.toFixed(2)};
        transform: rotate(-90deg);
        transform-origin: 50% 50%;
        animation: ${sc}-ring 1.5s cubic-bezier(0.65, 0, 0.35, 1) forwards;
      }
      .${sc} svg .am-halotext {
        fill: ${color};
        opacity: 0;
        transform: translateY(${px * 0.06}px);
        animation: ${sc}-up 0.9s cubic-bezier(0.16, 1, 0.3, 1) 1.15s forwards;
      }
      @keyframes ${sc}-ring { to { stroke-dashoffset: 0; } }
      @keyframes ${sc}-up { to { opacity: 1; transform: translateY(0); } }
      @media (prefers-reduced-motion: reduce) {
        .${sc} svg .am-ring { stroke-dashoffset: 0; animation: none; }
        .${sc} svg .am-halotext { opacity: 1; transform: none; animation: none; }
      }
    `;
    body = (
      <>
        <circle
          className="am-ring"
          cx={px / 2}
          cy={px / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
        />
        <text className="am-halotext" {...glyphProps}>
          {text}
        </text>
      </>
    );
  } else if (motion === 'stardust') {
    // Gold sparks twinkle around the circle in a ripple while the letters
    // settle in — a brief celebration, then calm.
    css = `
      .${sc} svg .am-startext {
        fill: ${color};
        opacity: 0;
        transform: scale(0.94);
        transform-origin: 50% 50%;
        animation: ${sc}-settle 1.1s cubic-bezier(0.16, 1, 0.3, 1) 0.25s forwards;
      }
      .${sc} svg .am-spark {
        opacity: 0;
        animation: ${sc}-spark 1.7s ease-in-out forwards;
      }
      @keyframes ${sc}-settle { to { opacity: 1; transform: scale(1); } }
      @keyframes ${sc}-spark {
        0% { opacity: 0; transform: scale(0.2); }
        35% { opacity: 1; transform: scale(1); }
        70% { opacity: 0.8; transform: scale(0.7); }
        100% { opacity: 0; transform: scale(0.25); }
      }
      @media (prefers-reduced-motion: reduce) {
        .${sc} svg .am-startext { opacity: 1; transform: none; animation: none; }
        .${sc} svg .am-spark { display: none; }
      }
    `;
    body = (
      <>
        <text className="am-startext" {...glyphProps}>
          {text}
        </text>
        {SPARKS.map((sp, i) => (
          <g key={i} transform={`translate(${sp.x * px}, ${sp.y * px})`}>
            <path
              className="am-spark"
              d={sparklePath(sp.s * px * 1.6)}
              fill={SPARK_GOLD}
              style={{ animationDelay: `${sp.d}s` }}
            />
          </g>
        ))}
      </>
    );
  } else {
    // 'draw' — the original stroke-trace reveal. The draw-on traces the text
    // OUTLINE (stroke), then a gentle fill settles in so the final state reads
    // as a normal painted monogram. Stroke length is unknown for <text> (no
    // getTotalLength at SSR), so we drive the reveal with a large fixed dash
    // that comfortably exceeds any monogram's perimeter — the dashoffset
    // animates from that length to 0, painting the strokes left-to-right-ish
    // as the browser walks the glyph outlines. ~3s total per 0004 spec.
    const dash = px * 8;
    css = `
      .${sc} svg .am-glyph {
        fill: transparent;
        stroke: ${color};
        stroke-width: 1;
        stroke-linejoin: round;
        stroke-linecap: round;
        stroke-dasharray: ${dash};
        stroke-dashoffset: ${dash};
        animation: ${sc}-draw 2.1s cubic-bezier(0.65, 0, 0.35, 1) forwards;
      }
      .${sc} svg .am-fill {
        fill: ${color};
        opacity: 0;
        animation: ${sc}-fill 0.9s ease-out 1.9s forwards;
      }
      @keyframes ${sc}-draw { to { stroke-dashoffset: 0; } }
      @keyframes ${sc}-fill { to { opacity: 1; } }
      @media (prefers-reduced-motion: reduce) {
        .${sc} svg .am-glyph { stroke-dashoffset: 0; animation: none; }
        .${sc} svg .am-fill { opacity: 1; animation: none; }
      }
    `;
    body = (
      <>
        {/* Two stacked <text> layers: the stroked glyph that draws on, then
            the filled glyph that fades in once the trace finishes — yielding
            the "drawn live, then inked" look. Italic serif to match the
            static monogram (font-serif italic in EventMonogram + the hero
            circle). */}
        <text className="am-glyph" {...glyphProps}>
          {text}
        </text>
        <text className="am-fill" {...glyphProps}>
          {text}
        </text>
      </>
    );
  }

  return (
    <span
      aria-hidden
      className={`${sc} inline-flex shrink-0 items-center justify-center rounded-full border-2 bg-cream ${
        shadow ? 'shadow-sm' : ''
      } ${className ?? ''}`.trim()}
      style={{
        height: px,
        width: px,
        borderColor: motion === 'halo' ? 'transparent' : color,
      }}
    >
      <style>{css}</style>
      <svg
        viewBox={`0 0 ${px} ${px}`}
        width={px}
        height={px}
        role="presentation"
        focusable="false"
      >
        {body}
      </svg>
    </span>
  );
}
