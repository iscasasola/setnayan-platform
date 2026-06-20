'use client';

import React, { useId } from 'react';
import type { MonogramMotionKey } from '@/lib/monogram-motion';
import { splitInitials } from '@/lib/monogram';

/**
 * AnimatedMonogramHero — the paid ANIMATED_MONOGRAM SKU's render
 * (₱2,499 · v2.1 brief § 5), backed by the Monogram Motion Library.
 *
 * It plays ONE of six premium motion signatures on mount
 * (lib/monogram-motion.ts · persisted as events.monogram_motion_key):
 *
 *   draw      — stroke-trace reveal, then the fill settles in (the original)
 *   foil      — letters appear in ink, a band of golden light sweeps across
 *   bloom     — ink blooms outward from the center
 *   editorial — letters rise into place while the tracking settles
 *   halo      — a ring/underline sweeps, then the mark fades up
 *   stardust  — gold sparks twinkle around the mark as it appears
 *
 * WHICH MARK animates (owner 2026-06-14 — monogram consistency):
 *   • When the event chose a TYPE-ONLY lockup (bar · duo · script · infinity)
 *     AND has both initials, the six signatures play on the couple's REAL
 *     LOCKUP — the same geometry MonogramMark (chrome) + lib/monogram.ts
 *     `lockupMarkSvg` (QR center) draw — so the animated marquee matches the
 *     static mark everywhere else. Lockup ink = mulberry; the infinity ∞ is the
 *     brand gold gradient.
 *   • Otherwise (framed / single-initial / legacy-no-style events) it animates
 *     the TEXT initials inside the bordered cream circle, EXACTLY as before — so
 *     no existing call site regresses.
 *
 * All six are pure SVG + scoped CSS — no animation runtime, SSR-safe, and all
 * collapse to the static painted mark under `prefers-reduced-motion: reduce`
 * (WCAG 2.2 § 2.3.3). `motion` defaults to 'draw' so every existing call site
 * renders exactly what it did before the library landed.
 *
 * SKU DISAMBIGUATION — this is the standalone ANIMATED_MONOGRAM (₱2,499 · V2
 * catalog). It is SEPARATE from the iteration-0004 Monogram Hero widget upgrade
 * (`monogram_hero_upgrade` · ₱1,999) which bundles a custom video/photo
 * background + SVG/PNG-upload via Potrace and is gated through the
 * invitation_widgets.tier flip. See lib/animated-monogram.ts.
 *
 * ACCESSIBILITY — the animation is decorative; the mark is aria-hidden (the
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
  // larger PrivateLanding usage. The SVG is square at this px for the circle
  // (text) render; the lockup render is `px` tall and auto-wide.
  md: 80,
  lg: 96,
};

const SERIF_STACK = "ui-serif, Georgia, Cambria, 'Times New Roman', serif";

// Brand champagne gold (Clean Editorial palette) for the stardust sparks —
// complements both the mulberry and gold monogram inks.
const SPARK_GOLD = '#C5A059';

// Lockup ∞ gradient stops (mirror MonogramMark + lib/monogram.ts lockupMarkSvg).
const GOLD_A = '#A88340';
const GOLD_MID = '#E4C77E';

// The four type-only lockups this component can animate.
type LockupStyle = 'bar' | 'duo' | 'script' | 'infinity';

function isLockupStyle(s: string | null | undefined): s is LockupStyle {
  return s === 'bar' || s === 'duo' || s === 'script' || s === 'infinity';
}

// Per-lockup tight viewBox — IDENTICAL to MonogramMark (chrome) +
// lib/monogram.ts `lockupMarkSvg` (QR center) so the animated mark and the two
// static twins are pixel-geometry siblings.
const LOCKUP_VIEWBOX: Record<LockupStyle, string> = {
  bar: '6 14 120 70',
  duo: '10 18 82 62',
  script: '8 6 168 90',
  infinity: '18 8 164 76',
};

// Deterministic spark layout for the TEXT (circle) render — fractions of the
// square + per-spark delay/scale, fixed so SSR + client render identically.
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
  /** The couple's chosen lockup. When one of the four TYPE-ONLY lockups
   *  (bar/duo/script/infinity) AND `text` yields two initials, the motion plays
   *  on the real lockup geometry. Anything else → the original text circle. */
  lockupStyle,
  /** Letter-spacing from resolveMonogramDesign (lockup render only). */
  letterSpacing,
}: {
  text: string;
  color: string;
  size?: Size;
  className?: string;
  shadow?: boolean;
  motion?: MonogramMotionKey;
  fontFamily?: string;
  fontStyle?: 'italic' | 'normal';
  lockupStyle?: string | null;
  letterSpacing?: string;
}) {
  const px = SIZE_PX[size];
  // Unique per-instance ids so multiple monograms on one page (defensive)
  // don't share the same <style> scope / gradient namespace.
  const uid = useId().replace(/[:]/g, '');
  const sc = `am-${uid}`;

  const [iA, iB] = splitInitials(text);
  // A lockup render needs a type-only style AND both initials. framed /
  // single-name / legacy-no-style fall through to the text circle below.
  const renderLockup = isLockupStyle(lockupStyle) && Boolean(iA) && Boolean(iB);

  if (renderLockup) {
    return (
      <LockupAnimated
        sc={sc}
        a={iA}
        b={iB}
        style={lockupStyle}
        px={px}
        color={color}
        fontFamily={fontFamily ?? SERIF_STACK}
        fontStyle={fontStyle ?? 'italic'}
        letterSpacing={letterSpacing ?? '0'}
        motion={motion}
        shadow={shadow}
        className={className}
        title={text}
      />
    );
  }

  // ── TEXT (circle) render — unchanged from before the lockup branch landed ──

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

/* ──────────────────────────────────────────────────────────────────────────
 * LockupAnimated — the six motion signatures applied to the couple's REAL
 * type-only lockup (bar · duo · script · infinity).
 *
 * Geometry is IDENTICAL to MonogramMark (app/_components/monogram-mark.tsx) and
 * lib/monogram.ts `lockupMarkSvg`: the SVG uses each lockup's tight viewBox so
 * every motion coordinate is in lockup-space. The mark renders frameless (no
 * cream circle) and `px` tall with auto width — matching the static lockup
 * footprint on the hero (HeroMonogram branch 3) and chrome.
 *
 * Each lockup is built as a set of CLASS-TAGGED primitives so the scoped CSS
 * can drive the right motion:
 *   .lk-glyph  — every letter / "&" <text>     (stroke-traced or filled)
 *   .lk-line   — the bar divider segments      (stroke-drawn lines)
 *   .lk-inf    — the ∞ path                     (stroke-drawn, gold gradient)
 * Plus motion-specific overlays (foil sweep band, bloom clip, halo underline,
 * stardust sparks) drawn in lockup viewBox units.
 * ──────────────────────────────────────────────────────────────────────── */
function LockupAnimated({
  sc,
  a,
  b,
  style,
  px,
  color,
  fontFamily,
  fontStyle,
  letterSpacing,
  motion,
  shadow,
  className,
  title,
}: {
  sc: string;
  a: string;
  b: string;
  style: LockupStyle;
  px: number;
  color: string;
  fontFamily: string;
  fontStyle: 'italic' | 'normal';
  letterSpacing: string;
  motion: MonogramMotionKey;
  shadow?: boolean;
  className?: string;
  title: string;
}) {
  const viewBox = LOCKUP_VIEWBOX[style];
  // The viewBox the motion overlays compute against — "minX minY w h".
  const [vbX, vbY, vbW, vbH] = viewBox.split(' ').map(Number) as [
    number,
    number,
    number,
    number,
  ];
  const cx = vbX + vbW / 2;
  const cy = vbY + vbH / 2;

  // Shared <text> attributes (couple's exact face). The `lk-glyph` class is
  // what the scoped CSS targets for the stroke-trace / rise / settle motions.
  const g = {
    className: 'lk-glyph',
    fill: color,
    fontFamily,
    fontStyle,
    letterSpacing,
    fontWeight: 600,
    textAnchor: 'middle' as const,
  };

  const goldGradId = `${sc}-gold`;

  // ── The static lockup geometry (filled steady state) ───────────────────
  function lockupGlyphs(): React.ReactNode {
    if (style === 'bar') {
      return (
        <>
          <text x={28} y={72} fontSize={64} {...g}>{a}</text>
          <line className="lk-line" x1={66} y1={16} x2={66} y2={42} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
          <line className="lk-line" x1={66} y1={66} x2={66} y2={82} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
          <text x={66} y={60} fontSize={22} {...g}>&amp;</text>
          <text x={104} y={72} fontSize={64} {...g}>{b}</text>
        </>
      );
    }
    if (style === 'duo') {
      return (
        <>
          <text x={34} y={72} fontSize={66} {...g}>{a}</text>
          <text x={68} y={72} fontSize={66} {...g}>{b}</text>
        </>
      );
    }
    if (style === 'script') {
      return (
        <>
          <text x={42} y={78} fontSize={74} {...g}>{a}</text>
          <text x={92} y={76} fontSize={46} {...g}>&amp;</text>
          <text x={142} y={78} fontSize={74} {...g}>{b}</text>
        </>
      );
    }
    // infinity — gold ∞ + two caps nested in the loops.
    return (
      <>
        <defs>
          <linearGradient id={goldGradId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={GOLD_A} />
            <stop offset="0.5" stopColor={GOLD_MID} />
            <stop offset="1" stopColor={GOLD_A} />
          </linearGradient>
        </defs>
        <path
          className="lk-inf"
          d="M100 46 C76 14 26 14 26 46 C26 78 76 78 100 46 C124 14 174 14 174 46 C174 78 124 78 100 46 Z"
          fill="none"
          stroke={`url(#${goldGradId})`}
          strokeWidth={6}
          strokeLinecap="round"
          pathLength={1}
        />
        <text x={56} y={56} fontSize={30} {...g}>{a}</text>
        <text x={140} y={56} fontSize={30} {...g}>{b}</text>
      </>
    );
  }

  // Sparks (stardust) positioned in lockup viewBox units around the mark.
  const lockupSparks = SPARKS.map((sp) => ({
    x: vbX + sp.x * vbW,
    y: vbY + sp.y * vbH,
    r: sp.s * Math.min(vbW, vbH) * 1.1,
    d: sp.d,
  }));

  let css = '';
  let overlay: React.ReactNode = null;
  let glyphWrapClass = '';

  if (motion === 'foil') {
    // Letters in ink, then a skewed gold band sweeps across (clipped to the
    // glyphs). Sweep travels in viewBox units.
    const travel = vbW * 1.25;
    css = `
      .${sc} .lk-glyph, .${sc} .lk-line, .${sc} .lk-inf {
        opacity: 0;
        animation: ${sc}-in 0.6s ease-out forwards;
      }
      .${sc} .lk-sheen {
        transform: translateX(${-travel}px) skewX(-16deg);
        animation: ${sc}-sweep 4.2s ease-in-out 0.7s infinite;
      }
      @keyframes ${sc}-in { to { opacity: 1; } }
      @keyframes ${sc}-sweep {
        0% { transform: translateX(${-travel}px) skewX(-16deg); }
        40%, 100% { transform: translateX(${travel}px) skewX(-16deg); }
      }
      @media (prefers-reduced-motion: reduce) {
        .${sc} .lk-glyph, .${sc} .lk-line, .${sc} .lk-inf { opacity: 1; animation: none; }
        .${sc} .lk-sheen { display: none; }
      }
    `;
    overlay = (
      <>
        <defs>
          <clipPath id={`${sc}-foilclip`}>{lockupGlyphs()}</clipPath>
          <linearGradient id={`${sc}-foilgrad`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0.3" stopColor="#FFF7E0" stopOpacity="0" />
            <stop offset="0.5" stopColor="#FFF7E0" stopOpacity="0.95" />
            <stop offset="0.7" stopColor="#FFF7E0" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g clipPath={`url(#${sc}-foilclip)`}>
          <rect
            className="lk-sheen"
            x={vbX - vbW * 0.35}
            y={vbY - vbH * 0.2}
            width={vbW * 0.7}
            height={vbH * 1.4}
            fill={`url(#${sc}-foilgrad)`}
          />
        </g>
      </>
    );
  } else if (motion === 'bloom') {
    // Ink blooms outward from the center — a growing circular clip reveals the
    // mark while a soft blur sharpens.
    const rMax = Math.hypot(vbW, vbH) * 0.6;
    css = `
      .${sc} .lk-bloomclip {
        animation: ${sc}-r 1.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
      }
      .${sc} .lk-bloomgroup {
        opacity: 0;
        filter: blur(3px);
        animation: ${sc}-tx 1.5s ease-out forwards;
      }
      @keyframes ${sc}-r { from { r: 0; } to { r: ${rMax.toFixed(1)}px; } }
      @keyframes ${sc}-tx {
        0% { opacity: 0; filter: blur(3px); }
        45% { opacity: 1; }
        100% { opacity: 1; filter: blur(0); }
      }
      @media (prefers-reduced-motion: reduce) {
        .${sc} .lk-bloomclip { animation: none; }
        .${sc} .lk-bloomgroup { opacity: 1; filter: none; animation: none; }
      }
    `;
  } else if (motion === 'editorial') {
    // The whole mark rises into place + a hair of scale settles — the quiet
    // confidence of a masthead. (letter-spacing already lives in the face.)
    css = `
      .${sc} .lk-editgroup {
        opacity: 0;
        transform: translateY(${(vbH * 0.14).toFixed(1)}px) scale(0.97);
        transform-origin: ${cx}px ${cy}px;
        transform-box: view-box;
        animation: ${sc}-rise 1.5s cubic-bezier(0.16, 1, 0.3, 1) 0.15s forwards;
      }
      @keyframes ${sc}-rise {
        0% { opacity: 0; transform: translateY(${(vbH * 0.14).toFixed(1)}px) scale(0.97); }
        55% { opacity: 1; }
        100% { opacity: 1; transform: translateY(0) scale(1); }
      }
      @media (prefers-reduced-motion: reduce) {
        .${sc} .lk-editgroup { opacity: 1; transform: none; animation: none; }
      }
    `;
  } else if (motion === 'halo') {
    // An underline sweeps left→right beneath the mark, then the mark fades up.
    const uY = vbY + vbH * 0.93;
    const uX1 = vbX + vbW * 0.08;
    const uX2 = vbX + vbW * 0.92;
    const uLen = uX2 - uX1;
    css = `
      .${sc} .lk-underline {
        stroke-dasharray: ${uLen.toFixed(1)};
        stroke-dashoffset: ${uLen.toFixed(1)};
        animation: ${sc}-ring 1.4s cubic-bezier(0.65, 0, 0.35, 1) forwards;
      }
      .${sc} .lk-halogroup {
        opacity: 0;
        transform: translateY(${(vbH * 0.06).toFixed(1)}px);
        animation: ${sc}-up 0.9s cubic-bezier(0.16, 1, 0.3, 1) 1.05s forwards;
      }
      @keyframes ${sc}-ring { to { stroke-dashoffset: 0; } }
      @keyframes ${sc}-up { to { opacity: 1; transform: translateY(0); } }
      @media (prefers-reduced-motion: reduce) {
        .${sc} .lk-underline { stroke-dashoffset: 0; animation: none; }
        .${sc} .lk-halogroup { opacity: 1; transform: none; animation: none; }
      }
    `;
    overlay = (
      <line
        className="lk-underline"
        x1={uX1}
        y1={uY}
        x2={uX2}
        y2={uY}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    );
  } else if (motion === 'stardust') {
    // Gold sparks twinkle around the mark in a ripple while it settles in.
    css = `
      .${sc} .lk-stargroup {
        opacity: 0;
        transform: scale(0.94);
        transform-origin: ${cx}px ${cy}px;
        transform-box: view-box;
        animation: ${sc}-settle 1.1s cubic-bezier(0.16, 1, 0.3, 1) 0.25s forwards;
      }
      .${sc} .lk-spark {
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
        .${sc} .lk-stargroup { opacity: 1; transform: none; animation: none; }
        .${sc} .lk-spark { display: none; }
      }
    `;
    overlay = (
      <>
        {lockupSparks.map((sp, i) => (
          <g key={i} transform={`translate(${sp.x}, ${sp.y})`}>
            <path
              className="lk-spark"
              d={sparklePath(sp.r)}
              fill={SPARK_GOLD}
              style={{ animationDelay: `${sp.d}s`, transformOrigin: 'center', transformBox: 'fill-box' }}
            />
          </g>
        ))}
      </>
    );
  } else {
    // 'draw' — port the onboarding "Trace": the letter outlines stroke
    // themselves on, then the fills settle in; the bar divider lines draw as
    // lines; the ∞ path draws itself (gold gradient). Stroke length is unknown
    // for <text> at SSR, so a large fixed dash drives the reveal.
    const dash = Math.max(vbW, vbH) * 5;
    css = `
      .${sc} .lk-glyph {
        fill: ${color};
        fill-opacity: 0;
        stroke: ${color};
        stroke-width: 0.9;
        stroke-linejoin: round;
        stroke-linecap: round;
        stroke-dasharray: ${dash.toFixed(0)};
        stroke-dashoffset: ${dash.toFixed(0)};
        animation: ${sc}-draw 1.4s ease forwards, ${sc}-fill 0.5s ease 1.2s forwards;
      }
      .${sc} .lk-line {
        stroke-dasharray: ${(vbH).toFixed(0)};
        stroke-dashoffset: ${(vbH).toFixed(0)};
        animation: ${sc}-draw 1s ease forwards;
      }
      .${sc} .lk-inf {
        stroke-dasharray: 1;
        stroke-dashoffset: 1;
        animation: ${sc}-draw1 1.4s ease-in-out forwards;
      }
      @keyframes ${sc}-draw { to { stroke-dashoffset: 0; } }
      @keyframes ${sc}-draw1 { to { stroke-dashoffset: 0; } }
      @keyframes ${sc}-fill { to { fill-opacity: 1; } }
      @media (prefers-reduced-motion: reduce) {
        .${sc} .lk-glyph { fill-opacity: 1; stroke-dashoffset: 0; animation: none; }
        .${sc} .lk-line { stroke-dashoffset: 0; animation: none; }
        .${sc} .lk-inf { stroke-dashoffset: 0; animation: none; }
      }
    `;
  }

  // Some motions wrap the lockup glyphs in a <g> so the whole mark transforms
  // / clips together. The class is empty for motions that drive the glyphs
  // directly (draw / foil).
  if (motion === 'bloom') glyphWrapClass = 'lk-bloomgroup';
  else if (motion === 'editorial') glyphWrapClass = 'lk-editgroup';
  else if (motion === 'halo') glyphWrapClass = 'lk-halogroup';
  else if (motion === 'stardust') glyphWrapClass = 'lk-stargroup';

  const glyphLayer =
    motion === 'bloom' ? (
      <>
        <defs>
          <clipPath id={`${sc}-bloomclip`}>
            <circle className="lk-bloomclip" cx={cx} cy={cy} r={Math.hypot(vbW, vbH) * 0.6} />
          </clipPath>
        </defs>
        <g className={glyphWrapClass} clipPath={`url(#${sc}-bloomclip)`}>
          {lockupGlyphs()}
        </g>
      </>
    ) : glyphWrapClass ? (
      <g className={glyphWrapClass}>{lockupGlyphs()}</g>
    ) : (
      lockupGlyphs()
    );

  return (
    <span
      aria-hidden
      className={`${sc} inline-flex shrink-0 items-center justify-center ${className ?? ''}`.trim()}
      style={shadow ? { filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.18))' } : undefined}
    >
      <style>{css}</style>
      <svg
        viewBox={viewBox}
        height={px}
        role="img"
        aria-label={title}
        focusable="false"
        style={{ display: 'block', overflow: 'visible' }}
      >
        {/* halo underline + stardust sparks sit beneath / around the glyphs */}
        {motion === 'halo' || motion === 'stardust' ? overlay : null}
        {glyphLayer}
        {/* foil sweep band sits above the glyphs, clipped to them */}
        {motion === 'foil' ? overlay : null}
      </svg>
    </span>
  );
}
