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
import { springEasing, holdsFor, runSpecularSweep } from '@/lib/monogram-studio/choreography';

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
  // Menu merge (benchmark verdict §4): Trace is a Quick-tempo Handwriting
  // alias; Gold Turn is absorbed by the Medallion Turn. Saved configs with the
  // old keys upgrade automatically — the wire format never changed.
  let kind: StudioAnimKind = anim.kind;
  let dur = anim.dur;
  if (kind === 'trace') {
    kind = 'handwriting';
    dur = Math.min(dur, 3.5);
  }
  if (kind === 'gold') kind = 'flip3d';
  if (kind === 'molten') {
    // WebGL only where permitted (one live context); elsewhere degrade to the
    // Medallion Turn (svg marks) or the CSS gold turn (text fallback).
    if (allowWebgl) return <MoltenMonogramInline markSvg={svg} monogram={monogram} />;
    if (svg) return <MedallionTurn svg={svg} dur={dur} smooth={anim.smooth} className={className} />;
    return <GoldMonogramReveal markSvg={svg} monogram={monogram} inline className={className} />;
  }
  if (kind === 'flip3d') {
    // The Medallion Turn (verdict §3) needs real paths; text-only fallback
    // lockups keep the CSS gold turn.
    if (svg) return <MedallionTurn svg={svg} dur={dur} smooth={anim.smooth} className={className} />;
    return <GoldMonogramReveal markSvg={svg} monogram={monogram} inline className={className} />;
  }
  return <DrawOnSvg svg={svg} kind={kind as 'handwriting' | 'droplet' | 'petalfall'} dur={dur} smooth={anim.smooth} delay={anim.delay} className={className} />;
}

/**
 * MedallionTurn — the benchmark verdict §3 prescription, verbatim: parent
 * perspective 750px (600 mobile) with a raised origin; a compound
 * rotateX(8°)+rotateY(−78°→0) turn on the 48-point spring; an angle-driven
 * brightness track (1.0 → 0.72 → 1.06 catch → 1.0); the specular sweep clipped
 * to the letterforms during the final traverse; a 4-copy translateZ thickness
 * stack in deep bronze (the medallion rim); intra-mark parallax when the
 * export carries <g data-mlayer> groups (frames −8px · letters 0 · pen +6px);
 * a breathing contact shadow; one sparkle ping 200ms after rest; Ceremonial
 * tempo adds a dim echo sweep. CSS/WAAPI only — no WebGL.
 */
function MedallionTurn({
  svg,
  dur,
  smooth,
  className,
}: {
  svg: string;
  dur: number;
  smooth: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host || !svg) return;
    const reduced =
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
    const isMobile =
      typeof window !== 'undefined' && (window.matchMedia?.('(max-width: 640px)').matches ?? false);

    const { holdMs } = holdsFor(dur);
    const turnMs = Math.max(650, Math.round(dur * 183)); // ≈1100ms at the Classic 6s
    const spring = springEasing();

    host.innerHTML = '';
    host.style.position = 'relative';
    host.style.width = '100%';
    host.style.height = '100%';
    host.style.perspective = isMobile ? '600px' : '750px';
    host.style.perspectiveOrigin = '50% 35%';

    // breathing contact shadow — anchors the medallion to a floor
    const shadow = document.createElement('div');
    shadow.style.cssText =
      'position:absolute;left:15%;right:15%;bottom:2%;height:10%;border-radius:50%;' +
      'background:radial-gradient(ellipse at center, rgba(10,8,16,0.9) 0%, rgba(10,8,16,0) 70%);' +
      'filter:blur(13px);opacity:0.17;transform:scaleX(0.95);';
    host.appendChild(shadow);

    const turn = document.createElement('div');
    turn.style.cssText =
      'position:absolute;inset:0 0 8% 0;transform-style:preserve-3d;will-change:transform;';
    host.appendChild(turn);

    const layerDiv = (inner: string, z: number, filter?: string) => {
      const d = document.createElement('div');
      d.style.cssText = `position:absolute;inset:0;transform:translateZ(${z}px);${filter ? `filter:${filter};` : ''}`;
      d.innerHTML = inner;
      const el = d.querySelector('svg');
      if (el) {
        el.setAttribute('width', '100%');
        el.setAttribute('height', '100%');
        (el as unknown as HTMLElement).style.cssText = 'display:block;width:100%;height:100%;overflow:visible;';
      }
      return d;
    };

    // thickness stack — 4 deep-bronze copies behind the face (§3.5)
    for (let z = 4; z >= 1; z--) {
      turn.appendChild(layerDiv(svg, -z, 'brightness(0.42) sepia(0.7) saturate(1.6) opacity(0.9)'));
    }

    // face — split into parallax layers when the export carries them (§3.8)
    const faceSvgs: SVGSVGElement[] = [];
    let split: { z: number; markup: string }[] | null = null;
    try {
      const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
      const root = doc.documentElement;
      const groups = Array.from(root.children).filter(
        (c) => c.tagName === 'g' && c.getAttribute('data-mlayer'),
      );
      if (groups.length >= 2) {
        const shellOpen = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${root.getAttribute('viewBox') ?? ''}">`;
        const zFor: Record<string, number> = { frames: -8, letters: 0, pen: 6 };
        split = groups.map((g) => ({
          z: zFor[g.getAttribute('data-mlayer') ?? 'letters'] ?? 0,
          markup: shellOpen + new XMLSerializer().serializeToString(g) + '</svg>',
        }));
      }
    } catch {
      split = null;
    }
    (split ?? [{ z: 0, markup: svg }]).forEach((L) => {
      const d = layerDiv(L.markup, L.z);
      turn.appendChild(d);
      const el = d.querySelector('svg');
      if (el) faceSvgs.push(el as SVGSVGElement);
    });

    if (reduced) {
      turn.style.transform = 'none';
      shadow.style.opacity = '0.28';
      return;
    }

    const anims: Animation[] = [];
    // the turn — hold at −78°, spring to rest (§3.9 beat structure)
    turn.style.transform = 'rotateX(8deg) rotateY(-78deg)';
    anims.push(
      turn.animate(
        [
          { transform: 'rotateX(8deg) rotateY(-78deg)' },
          { transform: 'rotateX(8deg) rotateY(0deg)' },
        ],
        { duration: turnMs, delay: holdMs, easing: smooth > 0.5 ? spring : 'ease-out', fill: 'both' },
      ),
    );
    // angle-driven light (§3.3) — the single biggest upgrade
    faceSvgs.forEach((el) => {
      anims.push(
        el.animate(
          [
            { filter: 'brightness(0.78)', offset: 0 },
            { filter: 'brightness(0.72)', offset: 0.3 },
            { filter: 'brightness(1.06)', offset: 0.88 },
            { filter: 'brightness(1)', offset: 1 },
          ],
          { duration: turnMs, delay: holdMs, easing: 'ease-in-out', fill: 'both' },
        ),
      );
    });
    // breathing contact shadow (§3.6)
    anims.push(
      shadow.animate(
        [
          { transform: 'scaleX(0.98)', opacity: 0.15, filter: 'blur(14px)' },
          { transform: 'scaleX(0.55)', opacity: 0.35, filter: 'blur(6px)' },
        ],
        { duration: turnMs, delay: holdMs, easing: smooth > 0.5 ? spring : 'ease-out', fill: 'both' },
      ),
    );
    // specular traverse at 55–74% of the turn, clipped to the letterforms (§3.4)
    const faceMain = faceSvgs[faceSvgs.length - 1];
    if (faceMain) {
      runSpecularSweep(faceMain, {
        delayMs: holdMs + Math.round(turnMs * 0.55),
        durMs: Math.round(turnMs * 0.34),
        strong: true,
      });
      // Ceremonial: a dim echo sweep at +1.2s (§3.9)
      if (dur > 8) runSpecularSweep(faceMain, { delayMs: holdMs + turnMs + 1200, durMs: 900 });
    }
    // one 4px sparkle ping, 200ms after rest (§3.9)
    const spark = document.createElement('div');
    spark.style.cssText =
      'position:absolute;left:56%;top:38%;width:4px;height:4px;border-radius:50%;' +
      'background:#fff8e7;box-shadow:0 0 8px 2px rgba(255,246,220,0.9);opacity:0;pointer-events:none;';
    host.appendChild(spark);
    anims.push(
      spark.animate(
        [
          { opacity: 0, transform: 'scale(0.4)' },
          { opacity: 1, transform: 'scale(1.4)', offset: 0.4 },
          { opacity: 0, transform: 'scale(0.6)' },
        ],
        { duration: 480, delay: holdMs + turnMs + 200, easing: 'ease-out', fill: 'both' },
      ),
    );

    return () => {
      anims.forEach((a) => {
        try {
          a.cancel();
        } catch {
          /* noop */
        }
      });
    };
  }, [svg, dur, smooth]);

  return <div ref={ref} className={className} aria-hidden style={{ width: '100%', height: '100%' }} />;
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
  kind: 'handwriting' | 'droplet' | 'petalfall';
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

    // House choreography (council verdict §4): an entry HOLD before every act,
    // spring landings, and the shared specular pass after the act completes.
    const { holdMs } = holdsFor(dur);
    const spring = springEasing();

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
      // handwriting + droplet stagger start-to-start by `delay` (engine semantics).
      const startDelay = holdMs + i * staggerMs;

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
            // spring landing (house choreography) — pieces SETTLE, not stop
            { duration: durMs, delay: startDelay, easing: spring, fill: 'both' },
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
            // spring landing (house choreography)
            { duration: durMs, delay: startDelay, easing: spring, fill: 'both' },
          ),
        );
        return;
      }

      // handwriting — stroke the outline on, then ink the fill in.
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
      p.style.stroke = fill;
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

    // The shared specular pass — the light crosses the finished mark
    // (handwriting: after the last stroke · bloom: at full open · petal fall:
    // 300ms after the final piece lands).
    const actSpan = durMs + staggerMs * Math.max(0, paths.length - 1);
    runSpecularSweep(svgEl, { delayMs: holdMs + actSpan + (kind === 'petalfall' ? 300 : 120), durMs: 700 });

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
