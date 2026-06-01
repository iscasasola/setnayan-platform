'use client';

import { useId } from 'react';

/**
 * AnimatedMonogramHero — the paid ANIMATED_MONOGRAM SKU's render
 * (₱2,499 · "Your initials, drawn live" · v2.1 brief § 5).
 *
 * Renders the event's auto-generated text monogram (the "M & J" initials) as an
 * SVG <text> that DRAWS ITSELF IN with a stroke-trace reveal on mount — the pen
 * stroke animating over the couple's initials, then settling into the static
 * monogram circle. This is the runtime binding the V2 catalog was missing
 * (v2-catalog.ts marked the SKU 'partial' · "V1 monogram tools exist · not
 * bound to this SKU").
 *
 * SKU DISAMBIGUATION — this is the standalone ANIMATED_MONOGRAM (₱2,499 · V2
 * catalog) applied to the auto-text monogram. It is SEPARATE from the
 * iteration-0004 Monogram Hero widget upgrade (`monogram_hero_upgrade` · ₱1,999)
 * which bundles a custom video/photo background + SVG/PNG-upload-via-Potrace and
 * is gated through the invitation_widgets.tier flip. See lib/animated-monogram.ts.
 *
 * SELF-CONTAINED + ADDITIVE — drops into the exact circle shape the landing-page
 * hero already renders (apps/web/app/[slug]/page.tsx · the
 * `h-20 w-20 rounded-full border-2 bg-cream` monogram circle) so unowned events
 * keep the static circle untouched and owned events get the animated one in the
 * same slot. The trace mechanic mirrors the 0004 spec § hero_monogram
 * (stroke-dasharray + stroke-dashoffset reveal, ~3s, then settle).
 *
 * ACCESSIBILITY — the animation is decorative; the circle is aria-hidden (the
 * couple name + date below carry the meaning, same as the static circle).
 * `prefers-reduced-motion: reduce` snaps the monogram to its final painted
 * state instantly with no stroke draw (WCAG 2.2 § 2.3.3) — handled in the
 * scoped <style> below, NOT relying on globals.css.
 *
 * PALETTE — uses the couple's monogram.color + cream via inline styles only
 * (no Tailwind dark-mode classes), honoring the wedding-landing guardrail in
 * globals.css that keeps the guest page on the couple's palette regardless of
 * the app theme.
 */

type Size = 'md' | 'lg';

const SIZE_PX: Record<Size, number> = {
  // Matches the landing-page hero circle (h-20 w-20 = 80px) and the slightly
  // larger PrivateLanding usage. The SVG is square at this px.
  md: 80,
  lg: 96,
};

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
}: {
  text: string;
  color: string;
  size?: Size;
  className?: string;
  shadow?: boolean;
}) {
  const px = SIZE_PX[size];
  // Unique per-instance ids so multiple monograms on one page (defensive)
  // don't share the same <style> scope / gradient namespace.
  const uid = useId().replace(/[:]/g, '');
  const scopeClass = `am-${uid}`;

  // Font scales with initials length so "M & J" and a single "S" both fit the
  // circle — same length tiers as lib/monogram.ts monogramOverlaySvg.
  const len = text.length;
  const fontSize =
    len <= 1 ? px * 0.42 : len <= 3 ? px * 0.3 : len <= 5 ? px * 0.24 : px * 0.2;

  // The draw-on traces the text OUTLINE (stroke), then a gentle fill settles in
  // so the final state reads as a normal painted monogram. Stroke length is
  // unknown for <text> (no getTotalLength at SSR), so we drive the reveal with
  // a large fixed dash that comfortably exceeds any monogram's perimeter — the
  // dashoffset animates from that length to 0, painting the strokes left-to-
  // right-ish as the browser walks the glyph outlines. ~3s total per 0004 spec.
  const dash = px * 8;

  return (
    <span
      aria-hidden
      className={`${scopeClass} inline-flex shrink-0 items-center justify-center rounded-full border-2 bg-cream ${
        shadow ? 'shadow-sm' : ''
      } ${className ?? ''}`.trim()}
      style={{ height: px, width: px, borderColor: color }}
    >
      <style>{`
        .${scopeClass} svg .am-glyph {
          fill: transparent;
          stroke: ${color};
          stroke-width: 1;
          stroke-linejoin: round;
          stroke-linecap: round;
          stroke-dasharray: ${dash};
          stroke-dashoffset: ${dash};
          animation: ${scopeClass}-draw 2.1s cubic-bezier(0.65, 0, 0.35, 1) forwards;
        }
        .${scopeClass} svg .am-fill {
          fill: ${color};
          opacity: 0;
          animation: ${scopeClass}-fill 0.9s ease-out 1.9s forwards;
        }
        @keyframes ${scopeClass}-draw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes ${scopeClass}-fill {
          to { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .${scopeClass} svg .am-glyph {
            stroke-dashoffset: 0;
            animation: none;
          }
          .${scopeClass} svg .am-fill {
            opacity: 1;
            animation: none;
          }
        }
      `}</style>
      <svg
        viewBox={`0 0 ${px} ${px}`}
        width={px}
        height={px}
        role="presentation"
        focusable="false"
      >
        {/* Two stacked <text> layers: the stroked glyph that draws on, then the
            filled glyph that fades in once the trace finishes — yielding the
            "drawn live, then inked" look. Italic serif to match the static
            monogram (font-serif italic in EventMonogram + the hero circle). */}
        <text
          className="am-glyph"
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="ui-serif, Georgia, Cambria, 'Times New Roman', serif"
          fontStyle="italic"
          fontWeight={600}
          fontSize={fontSize}
        >
          {text}
        </text>
        <text
          className="am-fill"
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="ui-serif, Georgia, Cambria, 'Times New Roman', serif"
          fontStyle="italic"
          fontWeight={600}
          fontSize={fontSize}
        >
          {text}
        </text>
      </svg>
    </span>
  );
}
