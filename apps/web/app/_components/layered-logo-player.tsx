'use client';

import { useEffect, useRef } from 'react';
import { LOGO_IN_SECONDS, isLayeredLogo, sanitizeLogoMotion } from '@/lib/logo-layers';

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
 *   · Draw on — along the WRITING PATH the couple traced (`data-write`): a mask
 *     brush drawn along it (`stroke-dashoffset`, length → 0) reveals the real
 *     letterform in the order it was written — `writeMaskMarkup` is the same
 *     mask at a fixed progress. No writing path → the file already says Fade.
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
    const NS = 'http://www.w3.org/2000/svg';
    const defs = document.createElementNS(NS, 'defs');
    root.insertBefore(defs, root.firstChild);
    host.querySelectorAll<SVGGElement>('g[data-logo-layer]').forEach((layer, i) => {
      const body = layer.querySelector<SVGGElement>('g[data-logo-body]');
      if (!body) return;
      const motion = sanitizeLogoMotion({
        in: layer.getAttribute('data-in'),
        during: layer.getAttribute('data-during'),
        delay: Number(layer.getAttribute('data-delay')),
      });
      const delayMs = motion.delay * 1000;
      const inMs = LOGO_IN_SECONDS[motion.in] * 1000;
      body.style.transformBox = 'fill-box';
      body.style.transformOrigin = 'center';

      const writeD = layer.getAttribute('data-write');
      if (motion.in === 'draw' && writeD) {
        const [w = 0, h = 0] = (body.getAttribute('data-logo-body') ?? '').split(' ').map(Number);
        const id = `logo-write-${i}-${Math.random().toString(36).slice(2, 8)}`;
        const mask = document.createElementNS(NS, 'mask');
        mask.setAttribute('id', id);
        mask.setAttribute('maskUnits', 'userSpaceOnUse');
        mask.setAttribute('x', String(-w));
        mask.setAttribute('y', String(-h));
        mask.setAttribute('width', String(w * 3));
        mask.setAttribute('height', String(h * 3));
        const brush = document.createElementNS(NS, 'path');
        brush.setAttribute('d', writeD);
        brush.setAttribute('fill', 'none');
        brush.setAttribute('stroke', '#FFFFFF');
        brush.setAttribute('stroke-width', layer.getAttribute('data-write-w') ?? '60');
        brush.setAttribute('stroke-linecap', 'round');
        brush.setAttribute('stroke-linejoin', 'round');
        mask.appendChild(brush);
        // userSpaceOnUse = the layer body's own box, wherever the mask lives.
        defs.appendChild(mask);
        const len = brush.getTotalLength() + 1;
        brush.style.strokeDasharray = `${len} ${len}`;
        brush.style.strokeDashoffset = String(len);
        body.setAttribute('mask', `url(#${id})`);
        const a = brush.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], {
          duration: inMs,
          delay: delayMs,
          easing: 'cubic-bezier(.45,.05,.35,1)',
          fill: 'both',
        });
        a.onfinish = () => body.removeAttribute('mask');
        anims.push(a);
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
      host.innerHTML = '';
    };
  }, [svg]);
  return <div ref={ref} aria-hidden data-layered-logo="" className={className ?? 'h-full w-full'} />;
}
