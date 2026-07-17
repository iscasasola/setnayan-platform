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
  kind: 'handwriting' | 'trace' | 'droplet' | 'petalfall' | 'flip3d';
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

    // flip3d — the REAL 3D turn (owner 2026-07-17): one CSS rotateY on the
    // whole mark. The studio canvas can only fake this (2D engine); the live
    // site gets the true perspective spin.
    if (kind === 'flip3d') {
      // Physical 3D (owner: "3D doesn't feel 3D enough"): tighter perspective,
      // a TILTED spin axis (pure rotateY reads flat), depth zoom, and a
      // drop-shadow that starts loose and lands tight — the light does the
      // selling. Spring-ish landing via an overshooting bezier.
      host.style.perspective = '650px';
      host.style.perspectiveOrigin = '50% 40%';
      const spinMs = Math.max(700, dur * 1000);
      const a = svgEl.animate(
        [
          {
            transform: 'rotate3d(0.24, 1, 0, 520deg) scale(0.62) translateZ(-120px)',
            opacity: 0.08,
            filter: 'drop-shadow(0 26px 28px rgba(20,17,28,0.30)) brightness(1.15)',
            offset: 0,
          },
          {
            transform: 'rotate3d(0.24, 1, 0, 180deg) scale(0.88) translateZ(-30px)',
            opacity: 0.9,
            filter: 'drop-shadow(0 14px 18px rgba(20,17,28,0.24)) brightness(1.25)',
            offset: 0.58,
          },
          {
            transform: 'rotate3d(0.24, 1, 0, -8deg) scale(1.02) translateZ(0)',
            opacity: 1,
            filter: 'drop-shadow(0 5px 8px rgba(20,17,28,0.18)) brightness(1.05)',
            offset: 0.86,
          },
          {
            transform: 'rotate3d(0.24, 1, 0, 0deg) scale(1) translateZ(0)',
            opacity: 1,
            filter: 'drop-shadow(0 2px 3px rgba(20,17,28,0.12)) brightness(1)',
            offset: 1,
          },
        ],
        { duration: spinMs, easing: smooth > 0.5 ? 'cubic-bezier(.22,.9,.24,1)' : 'ease-out', fill: 'both' },
      );
      return () => {
        try {
          a.cancel();
        } catch {
          /* noop */
        }
      };
    }

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

      if (kind === 'petalfall') {
        // every piece drifts down with a little spin and settles (owner
        // 2026-07-17 "wreath falling in like petals into place").
        const seed = ((i * 137.5) % 100) / 100;
        p.style.transformBox = 'fill-box';
        p.style.transformOrigin = 'center';
        p.style.fill = fill;
        p.style.opacity = '0';
        anims.push(
          p.animate(
            [
              {
                opacity: 0,
                transform: `translate(${(seed - 0.5) * 60}px, ${-(80 + seed * 120)}px) rotate(${(seed - 0.5) * 80}deg)`,
              },
              { opacity: 1, transform: 'none' },
            ],
            { duration: durMs, delay: startDelay, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' },
          ),
        );
        return;
      }

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
