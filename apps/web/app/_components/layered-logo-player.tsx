'use client';

import { useEffect, useRef } from 'react';
import {
  isLayeredLogo,
  logoInSeconds,
  parseWritePathD,
  penProgress,
  LOGO_WRITE_TIP_OPACITY,
  revealLayersAt,
  sanitizeLogoMotion,
  writeRevealPlan,
} from '@/lib/logo-layers';
import { boxToPart, logoParts, partCovers } from '@/lib/logo-parts-dom';

/**
 * 🅻 THE LAYERED LOGO, PLAYING — each layer its OWN motion, in stack order
 * (owner 2026-09-27: *"i want to be able to upload my 2 layer image so each
 * letter gets its own animation"*).
 *
 * ONE player for the Maker's ▶ Play and for every guest surface that plays the
 * mark (`HeroMonogram`, `StudioRevealPlayer`), so guests see exactly what the
 * editor showed. It reads each `<g data-logo-layer>`'s own data-in /
 * data-during / data-delay (`lib/logo-layers.ts`) and moves only that layer's
 * shapes (`[data-logo-body]`) — the layer's own place in the frame (its
 * `transform` attribute) is never touched, so a moving letter stays on its rails.
 *
 *   · Draw on — along the WRITING PATH the couple traced (`data-write`): the
 *     layer's box is split into the pen's cells (`writeRevealCells`) and each
 *     shows as the pen reaches it, so the real letterform appears in the order
 *     it was written — `writeMaskMarkup` is the same mask at a fixed progress.
 *     No writing path → the letter's own outline traces on, then inks in.
 *   · Rise · Fade — a short lift / a fade in.
 *   · Drift — after it arrives, a slow float, forever.
 *
 * Before its delay a layer is hidden, so letter 2 truly arrives after letter 1.
 * `prefers-reduced-motion` → the still logo. The markup is the SAVED file, which
 * already passed the SVG gate (`safeMonogramSvg`); nothing here adds a URL.
 * Remount (a React key) to play again.
 */
export function LayeredLogoPlayer({ svg, className }: { svg: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host || !isLayeredLogo(svg)) return;
    host.innerHTML = svg;
    const root = host.querySelector('svg');
    if (!root) return;
    root.setAttribute('width', '100%');
    root.setAttribute('height', '100%');
    root.style.overflow = 'visible';
    const reduced =
      typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
    if (reduced) return;

    const anims: Animation[] = [];
    const frames: number[] = [];
    const NS = 'http://www.w3.org/2000/svg';
    const defs = document.createElementNS(NS, 'defs');
    root.insertBefore(defs, root.firstChild);
    host.querySelectorAll<SVGGElement>('g[data-logo-layer]').forEach((layer, i) => {
      const body = layer.querySelector<SVGGElement>('g[data-logo-body]');
      if (!body) return;
      const durAttr = layer.getAttribute('data-dur');
      const motion = sanitizeLogoMotion({
        in: layer.getAttribute('data-in'),
        during: layer.getAttribute('data-during'),
        delay: Number(layer.getAttribute('data-delay')),
        dur: durAttr === null ? undefined : Number(durAttr),
      });
      const delayMs = motion.delay * 1000;
      const inMs = logoInSeconds(motion) * 1000;
      body.style.transformBox = 'fill-box';
      body.style.transformOrigin = 'center';

      const [w = 0, h = 0] = (body.getAttribute('data-logo-body') ?? '').split(' ').map(Number);
      const write =
        motion.in === 'draw'
          ? parseWritePathD(layer.getAttribute('data-write'), Number(layer.getAttribute('data-write-w')) || 60)
          : undefined;
      if (motion.in === 'draw' && write && w > 0 && h > 0) {
        // ✍ The pen's cells: each shows as the pen reaches it, so the ink
        // appears in writing order and nothing is saved for the end. ✂ Each
        // PART (one traced shape per gap-separated piece) follows only the pen
        // that is on it (`writeRevealPlan`), so it never appears early because
        // the pen passed close by on its neighbour.
        const parts = logoParts(body);
        const covers = partCovers(body, parts, Math.max(w, h) * 0.02); // a finger's tolerance
        // A kept white card is not a part: it comes in as the pen sets off.
        body.querySelectorAll('rect').forEach((card) =>
          anims.push(card.animate([{ opacity: 0 }, { opacity: 1 }], { duration: inMs * 0.15, delay: delayMs, fill: 'both' })),
        );
        const plan = writeRevealPlan(write, w, h, parts.length, covers);
        // 🧈 One growing shape per part (`revealLayersAt`) — a solid path of
        // the cells the pen has passed and a soft tip ahead — changed once a
        // frame. Never an animation per cell (that stuttered and striped).
        const bands: Array<{ solid: SVGPathElement; near: SVGPathElement; far: SVGPathElement; cells: Array<{ t: number; d: string }>; shown: string }> = [];
        const masked: SVGElement[] = [];
        parts.forEach((part, k) => {
          const id = `logo-write-${i}-${k}-${Math.random().toString(36).slice(2, 8)}`;
          const mask = document.createElementNS(NS, 'mask');
          mask.setAttribute('id', id);
          mask.setAttribute('maskUnits', 'userSpaceOnUse');
          mask.setAttribute('x', String(-w * 2));
          mask.setAttribute('y', String(-h * 2));
          mask.setAttribute('width', String(w * 5));
          mask.setAttribute('height', String(h * 5));
          defs.appendChild(mask);
          // userSpaceOnUse = the PART's own space; the cells are in the body's box.
          const holder = document.createElementNS(NS, 'g');
          const m = boxToPart(body, part);
          holder.setAttribute('transform', `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`);
          mask.appendChild(holder);
          const band = (opacity: number) => {
            const el = document.createElementNS(NS, 'path');
            el.setAttribute('fill', '#FFFFFF');
            el.setAttribute('fill-opacity', String(opacity));
            holder.appendChild(el);
            return el;
          };
          bands.push({
            solid: band(1),
            near: band(LOGO_WRITE_TIP_OPACITY.near),
            far: band(LOGO_WRITE_TIP_OPACITY.far),
            cells: plan[k] ?? [],
            shown: '',
          });
          part.setAttribute('mask', `url(#${id})`);
          masked.push(part);
        });
        // The clock is an animation (so it pauses, seeks and cancels with the
        // rest); each frame reads it and redraws only a part whose reveal moved.
        const clock = body.animate([{ opacity: 1 }, { opacity: 1 }], { duration: delayMs + inMs, fill: 'forwards' });
        anims.push(clock);
        const paint = () => {
          const at = Number(clock.currentTime ?? 0);
          const p = at < delayMs ? 0 : penProgress((at - delayMs) / Math.max(1, inMs));
          for (const b of bands) {
            const r = revealLayersAt(b.cells, p);
            const key = `${r.solid.length}:${r.near.length}:${r.far.length}`;
            if (key === b.shown) continue;
            b.shown = key;
            b.solid.setAttribute('d', r.solid);
            b.near.setAttribute('d', r.near);
            b.far.setAttribute('d', r.far);
          }
          if (clock.playState === 'finished') {
            masked.forEach((el) => el.removeAttribute('mask'));
            return;
          }
          frames.push(requestAnimationFrame(paint));
        };
        paint();
      } else if (motion.in === 'draw') {
        // ✍ No writing path: ONE pen traces the letter's outlines, one after
        // another, then the fill inks in (the studio's Handwriting) — the trace
        // every uploaded letter had before the layers.
        //
        // 🔑 ONE PEN, ONE STARTING POINT (owner 2026-09-28: *"the start started
        // with 2 points. i should have started on one"*). A traced letter is
        // several outlines (and a compound path several subpaths); dashing them
        // each on at once starts the draw in several places. So each outline is
        // re-drawn as its own stroke, and each waits for the one before it.
        const ctm = body.getScreenCTM();
        const px = ctm && Math.abs(ctm.a) > 1e-6 ? 1 / Math.abs(ctm.a) : Math.max(w, h) * 0.003;
        const strokeMs = inMs * 0.75;
        const inkIn = { duration: inMs * 0.5, delay: delayMs + inMs * 0.5, fill: 'both' as const, easing: 'ease-in' };
        const pens: Array<{ el: SVGPathElement; len: number }> = [];
        body.querySelectorAll<SVGGeometryElement>('path, rect, circle, ellipse, polygon').forEach((shape) => {
          // Every shape inks in with the fill, whatever else happens to it.
          anims.push(shape.animate([{ opacity: 0 }, { opacity: 1 }], inkIn));
          const ink = getComputedStyle(shape).fill;
          if (shape.tagName === 'rect' || !ink || ink === 'none') return; // a white card
          let total = 0;
          try {
            total = shape.getTotalLength();
          } catch {
            total = 0;
          }
          if (!total) return;
          // Walk the outline; a jump far bigger than a step is a new subpath.
          const n = Math.min(1500, Math.max(120, Math.round(total / 2)));
          const step = total / n;
          let run: string[] = [];
          let prev: DOMPoint | null = null;
          const flush = () => {
            if (run.length > 1) {
              const el = document.createElementNS(NS, 'path');
              el.setAttribute('d', `M${run.join('L')}`);
              el.setAttribute('fill', 'none');
              el.setAttribute('data-logo-pen', '');
              el.style.stroke = ink;
              el.style.strokeWidth = String(1.6 * px);
              el.style.strokeLinejoin = 'round';
              el.style.strokeLinecap = 'butt';
              body.appendChild(el);
              pens.push({ el, len: el.getTotalLength() });
            }
            run = [];
          };
          for (let k = 0; k <= n; k++) {
            const pt = shape.getPointAtLength(Math.min(total, k * step));
            if (prev && Math.hypot(pt.x - prev.x, pt.y - prev.y) > step * 4) flush();
            run.push(`${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`);
            prev = pt;
          }
          flush();
        });
        const all = pens.reduce((sum, p) => sum + p.len, 0) || 1;
        let done = 0;
        for (const { el, len } of pens) {
          el.style.strokeDasharray = `${len + 1} ${len + 1}`;
          el.style.strokeDashoffset = String(len + 1);
          const share = (len / all) * strokeMs;
          anims.push(
            el.animate([{ strokeDashoffset: len + 1 }, { strokeDashoffset: 0 }], {
              duration: Math.max(1, share),
              delay: delayMs + (done / all) * strokeMs,
              fill: 'both',
            }),
          );
          // the pen's line gives way to the ink as the fill arrives
          anims.push(el.animate([{ opacity: 1 }, { opacity: 0 }], { ...inkIn, easing: 'ease-out' }));
          done += len;
        }
      } else if (motion.in === 'rise' || motion.in === 'fade') {
        const from = motion.in === 'rise' ? { opacity: 0, transform: 'translateY(8%)' } : { opacity: 0 };
        const to = motion.in === 'rise' ? { opacity: 1, transform: 'none' } : { opacity: 1 };
        anims.push(
          body.animate([from, to], { duration: inMs, delay: delayMs, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' }),
        );
      }

      if (motion.during === 'drift') {
        anims.push(
          body.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-2%)' }], {
            duration: 3200,
            delay: delayMs + inMs,
            direction: 'alternate',
            iterations: Infinity,
            easing: 'ease-in-out',
          }),
        );
      }
    });
    return () => {
      anims.forEach((a) => a.cancel());
      frames.forEach((f) => cancelAnimationFrame(f));
      host.innerHTML = '';
    };
  }, [svg]);
  return <div ref={ref} aria-hidden data-layered-logo="" className={className ?? 'h-full w-full'} />;
}
