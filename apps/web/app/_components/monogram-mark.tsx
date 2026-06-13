'use client';

import { useId } from 'react';

/**
 * MonogramMark — the couple's REAL onboarding lockup, drawn as a self-contained
 * inline SVG for the dashboard chrome (event switcher logo + dropdown rows).
 *
 * WHY (owner directive 2026-06-13, REVERSING the 2026-06-03 "chrome renders
 * letters-forward because the ornate frame is illegible at icon size" lock):
 * the couple designs one of five monogram lockups in /onboarding/wedding
 * (mono-lockup.tsx) and the saved monogram must BE their event logo — varying
 * with the style they chose, not collapsed to plain initials in a font.
 *
 * This component is a hand-built, mark-ONLY twin of the four TYPE-ONLY lockups
 * from mono-lockup.tsx (bar · duo · script · infinity): same geometry, no names,
 * no trace animation, and pure inline styling so it carries no dependency on the
 * `.onbw`-scoped onboarding.css. The fifth lockup, `framed`, stays letters-forward
 * in EventMonogram — its 237-path gold filigree ring is unreadable at ~28–44px,
 * which is exactly why the original lock existed. So we honor BOTH the owner's
 * "render the real mark" intent AND the small-size legibility constraint.
 *
 * The wide marks (bar/script/infinity) keep their natural aspect inside a square
 * box via preserveAspectRatio="xMidYMid meet" — they letterbox vertically rather
 * than distort, and never widen the chrome row.
 */

export type MonogramMarkStyle = 'bar' | 'duo' | 'script' | 'infinity';

type Props = {
  style: MonogramMarkStyle;
  /** Bride initial — single upper-cased char. */
  a: string;
  /** Groom initial — single upper-cased char. */
  b: string;
  /** Resolved face from resolveMonogramDesign (couple's chosen typeface). */
  fontFamily: string;
  fontStyle: 'italic' | 'normal';
  letterSpacing: string;
  /** Ink hex for the letters (mulberry for all four type-only lockups). */
  color: string;
  /** Rendered box edge in px — the svg is px × px, content centered. */
  px: number;
  /** Box sizing / layout classes (h-9 w-9 shrink-0 …) from the caller. */
  className?: string;
  /** Accessible label, e.g. the monogram text "M & J". */
  title?: string;
};

// Shared <text> attributes so every glyph renders in the couple's exact face.
function glyphProps(p: Props) {
  return {
    fill: p.color,
    fontFamily: p.fontFamily,
    fontStyle: p.fontStyle,
    letterSpacing: p.letterSpacing,
    fontWeight: 600,
    textAnchor: 'middle' as const,
  };
}

export function MonogramMark(props: Props) {
  const { style, a, b, color, px, className, title } = props;
  const gradId = useId();
  const g = glyphProps(props);
  const common = {
    width: px,
    height: px,
    className: className?.replace(/\s+/g, ' ').trim(),
    role: 'img' as const,
    'aria-label': title ?? `${a} & ${b}`,
    preserveAspectRatio: 'xMidYMid meet',
  };

  // bar — two serif capitals flanking a vertical divider that carries "&".
  // The divider splits around the ampersand so it reads crisp at icon size.
  if (style === 'bar') {
    return (
      <svg viewBox="0 0 132 96" {...common}>
        <text x={28} y={72} fontSize={64} {...g}>{a}</text>
        <line x1={66} y1={16} x2={66} y2={42} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
        <line x1={66} y1={66} x2={66} y2={82} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
        <text x={66} y={60} fontSize={22} {...g}>&amp;</text>
        <text x={104} y={72} fontSize={64} {...g}>{b}</text>
      </svg>
    );
  }

  // duo — two serif capitals pulled close / lightly overlapping, no divider.
  if (style === 'duo') {
    return (
      <svg viewBox="0 0 100 96" {...common}>
        <text x={42} y={72} fontSize={66} {...g}>{a}</text>
        <text x={58} y={72} fontSize={66} {...g}>{b}</text>
      </svg>
    );
  }

  // script — three calligraphy glyphs: initial · & · initial.
  if (style === 'script') {
    return (
      <svg viewBox="0 0 184 100" {...common}>
        <text x={42} y={78} fontSize={74} {...g}>{a}</text>
        <text x={92} y={76} fontSize={46} {...g}>&amp;</text>
        <text x={142} y={78} fontSize={74} {...g}>{b}</text>
      </svg>
    );
  }

  // infinity — two capitals nested in the loops of a gold ∞ that links them.
  // The ∞ path is lifted verbatim from mono-lockup.tsx so the chrome mark is
  // the same curve the couple saw in onboarding.
  return (
    <svg viewBox="0 0 200 92" {...common}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#A88340" />
          <stop offset="0.5" stopColor="#E4C77E" />
          <stop offset="1" stopColor="#A88340" />
        </linearGradient>
      </defs>
      <path
        d="M100 46 C76 14 26 14 26 46 C26 78 76 78 100 46 C124 14 174 14 174 46 C174 78 124 78 100 46 Z"
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <text x={56} y={56} fontSize={30} {...g}>{a}</text>
      <text x={140} y={56} fontSize={30} {...g}>{b}</text>
    </svg>
  );
}
