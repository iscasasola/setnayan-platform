'use client';

/**
 * StudioRevealPlayer — plays the couple's CHOSEN reveal (designed in the Vector
 * Studio's "Animate the reveal" panel, stored as monogram_studio_config.anim) on
 * the LIVE surfaces (hero · Save-the-Date film · recap). This is the reader that
 * closes the loop: what a couple designs in the studio is what guests see.
 *
 * One dispatcher over the 5 reveal kinds:
 *   - gold   → GoldMonogramReveal (CSS flowing-gold turn), inline
 *   - molten → MoltenMonogramInline (WebGL) when allowWebgl, else degrade to gold
 *   - handwriting / trace / droplet → a DOM-SVG draw-on of the mark's own paths,
 *     replaying the studio's per-kind motion with the chosen dur/delay/smooth.
 *
 * The draw-on is a DOM port of the studio engine's canvas reveal (stroke-dashoffset
 * draw + fill-in), not a paper.js rerun — paper.js can't ship to a server page.
 * Per-path (not per-letter): the exported mark has per-path geometry but no
 * per-letter groups, so merged glyphs stagger as one (close match; exact per-letter
 * parity is a deferred fidelity pass).
 *
 * Client-only (getTotalLength + the molten ssr:false boundary). prefers-reduced-
 * motion / WebGL-absent → the static filled mark. Remount (React key) to replay.
 */

import { useEffect, useRef } from 'react';
import type { StudioAnimKind } from '@/lib/monogram-studio-shared';
import { GoldMonogramReveal } from './gold-monogram-reveal';
import { MoltenMonogramInline } from './molten-monogram-inline';

export type StudioAnim = { kind: StudioAnimKind; dur: number; smooth: number; delay: number };

const GOLD = '#C5A059';

export function StudioRevealPlayer({
  svg,
  monogram,
  anim,
  allowWebgl = false,
  className,
}: {
  /** The couple's mark as inert SVG (studio export / uploaded). */
  svg: string | null;
  /** Initials fallback for the gold/molten glyph path when there's no svg. */
  monogram: string;
  anim: StudioAnim;
  /** Permit the WebGL molten to render live here (one context at a time). */
  allowWebgl?: boolean;
  className?: string;
}) {
  if (anim.kind === 'gold') {
    return <GoldMonogramReveal markSvg={svg} monogram={monogram} inline className={className} />;
  }
  if (anim.kind === 'molten') {
    // WebGL only where permitted (one live context); elsewhere degrade to Gold Turn.
    return allowWebgl ? (
      <MoltenMonogramInline markSvg={svg} monogram={monogram} />
    ) : (
      <GoldMonogramReveal markSvg={svg} monogram={monogram} inline className={className} />
    );
  }
  return <DrawOnSvg svg={svg} kind={anim.kind} dur={anim.dur} smooth={anim.smooth} delay={anim.delay} className={className} />;
}

/** handwriting/trace/droplet — DOM-SVG draw-on of the mark's own paths. */
function DrawOnSvg({
  svg,
  kind,
  dur,
  smooth,
  delay,
  className,
}: {
  svg: string | null;
  kind: 'handwriting' | 'trace' | 'droplet';
  dur: number;
  smooth: number;
  delay: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host || !svg) return;
    // The svg is server-rendered (dangerouslySetInnerHTML below) so it's visible
    // with no JS and there's no empty flash; here we just animate the existing nodes.
    const svgEl = host.querySelector('svg');
    if (!svgEl) return;
    svgEl.setAttribute('width', '100%');
    svgEl.setAttribute('height', '100%');
    svgEl.style.display = 'block';
    svgEl.style.width = '100%';
    svgEl.style.height = '100%';
    svgEl.style.overflow = 'visible';

    const paths = Array.from(svgEl.querySelectorAll<SVGPathElement>('path'));
    const reduced =
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
    // Reduced motion / no animatable paths → leave the static filled mark.
    if (reduced || !paths.length || typeof paths[0]?.getTotalLength !== 'function') return;

    // eased() mirror: more `smooth` → softer in/out (the engine's smoothstep blend).
    const easing = smooth > 0.66 ? 'cubic-bezier(.45,.05,.25,1)' : smooth > 0.33 ? 'ease-in-out' : 'linear';
    const durMs = Math.max(400, dur * 1000);
    // Normalized stagger budget (council verdict §5.5): the SPAN of start times
    // is capped at one act duration, so 6 paths or 200 land on the same clock —
    // a frame pattern's repeated paths (a wreath is dozens) can no longer
    // stretch a 6s reveal into minutes. Small marks keep the chosen delay.
    const rawStaggerMs = Math.max(0, delay) * 1000;
    const staggerMs = paths.length > 1 ? Math.min(rawStaggerMs, durMs / (paths.length - 1)) : 0;
    const anims: Animation[] = [];

    paths.forEach((p, i) => {
      const fill = p.getAttribute('fill') || 'currentColor';
      // trace draws ALL paths together (one global progress); handwriting + droplet
      // stagger start-to-start by `delay` (engine semantics).
      const startDelay = kind === 'trace' ? 0 : i * staggerMs;

      if (kind === 'droplet') {
        // a growing fill-in per path (no stroke) — ink "drops" into shape.
        p.style.transformBox = 'fill-box';
        p.style.transformOrigin = 'center';
        p.style.fill = fill;
        p.style.opacity = '0';
        anims.push(
          p.animate(
            [
              { opacity: 0, transform: 'scale(0.6)' },
              { opacity: 1, transform: 'scale(1)' },
            ],
            { duration: durMs, delay: startDelay, easing, fill: 'both' },
          ),
        );
        return;
      }

      // handwriting / trace — stroke the outline on, then ink the fill in.
      let len = 0;
      try {
        len = p.getTotalLength();
      } catch {
        len = 0;
      }
      if (!len) {
        // un-measurable path → just fade the fill in so nothing goes missing.
        p.style.fill = fill;
        p.style.opacity = '0';
        anims.push(p.animate([{ opacity: 0 }, { opacity: 1 }], { duration: durMs, delay: startDelay, easing, fill: 'both' }));
        return;
      }
      p.style.fill = fill;
      p.style.fillOpacity = '0';
      p.style.stroke = kind === 'trace' ? GOLD : fill;
      p.style.strokeWidth = '1.4';
      p.style.strokeDasharray = String(len);
      p.style.strokeDashoffset = String(len);
      anims.push(
        p.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], {
          duration: durMs,
          delay: startDelay,
          easing,
          fill: 'both',
        }),
      );
      // fill inks in over the back half of the draw, then the stroke fades out.
      anims.push(
        p.animate(
          [
            { fillOpacity: 0, strokeOpacity: 1, offset: 0 },
            { fillOpacity: 0, strokeOpacity: 1, offset: 0.5 },
            { fillOpacity: 1, strokeOpacity: 0, offset: 1 },
          ],
          { duration: durMs, delay: startDelay, easing: 'ease-in', fill: 'both' },
        ),
      );
    });

    return () => {
      anims.forEach((a) => {
        try {
          a.cancel();
        } catch {
          /* noop */
        }
      });
    };
  }, [svg, kind, dur, smooth, delay]);

  return (
    <div
      ref={ref}
      className={className}
      // `color` is the resolved fallback for any path whose fill is `currentColor`
      // (paper.js normally emits a per-path fill, so this is belt-and-suspenders).
      style={{ width: '100%', height: '100%', color: '#1E2229' }}
      aria-hidden
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  );
}
