/**
 * lib/monogram-studio/choreography.ts
 *
 * The house choreography for every monogram reveal (benchmark council verdict
 * 2026-07-17 §4: "one shared choreography module … the highest premium-per-
 * line-of-code item in the entire benchmark"). Client-safe, no React — used by
 * app/_components/studio-reveal-player.tsx (the live site + the studio's
 * portal preview).
 *
 * Three ingredients, applied to every reveal:
 *   1. HOLDS — 250–400ms of stillness before the act, ≥600ms of stillness
 *      after it. Stillness before and after is part of the effect; tempo
 *      presets scale durations but never delete holds.
 *   2. THE SPRING — every landing rides a 48-point CSS `linear()` easing
 *      sampled from a real damped spring (stiffness 170, damping 20, mass 1),
 *      landing with a small overshoot and settle. Browsers without linear()
 *      fall back to an overshooting cubic-bezier. Kill every uniform rotation.
 *   3. THE SPECULAR PASS — one shared light sweep, clipped to the letterforms
 *      (SVG mask of the mark's own paths, mix-blend screen), run after each
 *      reveal's act completes: Handwriting after the last stroke, Bloom at
 *      full open, Petal Fall 300ms after the final piece.
 */

/** Sample a damped spring into a CSS linear() easing string. */
export function springLinear(stiffness = 170, damping = 20, mass = 1, points = 48): string {
  // Underdamped spring displacement from 1 → 0; progress = 1 - x(t).
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  // Settle window: time for the envelope to decay below ~0.1% (then normalize).
  const settleT = zeta < 1 ? 6.9 / (zeta * w0) : 6.9 / w0;
  const wd = zeta < 1 ? w0 * Math.sqrt(1 - zeta * zeta) : 0;
  const vals: string[] = [];
  for (let i = 0; i < points; i++) {
    const t = (i / (points - 1)) * settleT;
    let x: number;
    if (zeta < 1) {
      const env = Math.exp(-zeta * w0 * t);
      x = env * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
    } else {
      x = Math.exp(-w0 * t) * (1 + w0 * t);
    }
    const p = 1 - x;
    vals.push(String(Math.round(p * 10000) / 10000));
  }
  vals[points - 1] = '1';
  return `linear(${vals.join(', ')})`;
}

/** The house spring — computed once. */
export const SPRING_EASING = springLinear(170, 20, 1, 48);
/** Overshooting fallback for browsers without linear() support. */
export const SPRING_FALLBACK = 'cubic-bezier(0.22, 1, 0.36, 1)';

let linearSupport: boolean | null = null;
/** The spring easing this browser can actually run. */
export function springEasing(): string {
  if (linearSupport === null) {
    try {
      linearSupport =
        typeof CSS !== 'undefined' && CSS.supports('animation-timing-function', 'linear(0, 0.5, 1)');
    } catch {
      linearSupport = false;
    }
  }
  return linearSupport ? SPRING_EASING : SPRING_FALLBACK;
}

/** Entry-hold + settle for a reveal, derived from its duration (the tempo
 *  proxy): Quick ≈ 250ms hold, Classic ≈ 300ms, Ceremonial ≈ 400ms. The
 *  settle is stillness we ask the caller to preserve, never a timer we own. */
export function holdsFor(durSeconds: number): { holdMs: number; settleMs: number } {
  const holdMs = durSeconds <= 4 ? 250 : durSeconds <= 8 ? 300 : 400;
  return { holdMs, settleMs: 600 };
}

/**
 * The shared specular pass: a warm light band sweeps across the mark, CLIPPED
 * TO THE LETTERFORMS (mask = clones of the mark's own paths), blended with
 * `screen`. Runtime-only DOM — appended to the live <svg>, removed when done;
 * nothing here ever touches the saved mark.
 */
export function runSpecularSweep(
  svgEl: SVGSVGElement,
  opts: { delayMs?: number; durMs?: number; strong?: boolean } = {},
): void {
  try {
    const delayMs = opts.delayMs ?? 0;
    const durMs = opts.durMs ?? 700;
    const vb = svgEl.viewBox?.baseVal;
    if (!vb || !vb.width) return;
    const NS = 'http://www.w3.org/2000/svg';
    const uid = 'spec' + Math.floor(vb.width * 7 + vb.height * 13) + '-' + (svgEl.childNodes.length || 0);

    const defs = document.createElementNS(NS, 'defs');
    const grad = document.createElementNS(NS, 'linearGradient');
    grad.setAttribute('id', uid + '-g');
    grad.setAttribute('gradientTransform', 'rotate(25)');
    [
      ['0%', 'rgba(255,246,220,0)'],
      ['46%', 'rgba(255,246,220,0)'],
      ['50%', `rgba(255,246,220,${opts.strong ? 0.9 : 0.85})`],
      ['54%', 'rgba(255,246,220,0)'],
      ['100%', 'rgba(255,246,220,0)'],
    ].forEach((pair) => {
      const stop = document.createElementNS(NS, 'stop');
      stop.setAttribute('offset', pair[0] ?? '0%');
      stop.setAttribute('stop-color', pair[1] ?? 'rgba(255,246,220,0)');
      grad.appendChild(stop);
    });
    defs.appendChild(grad);

    // Mask = the mark's own paths in white → the sweep exists only on the ink.
    const mask = document.createElementNS(NS, 'mask');
    mask.setAttribute('id', uid + '-m');
    svgEl.querySelectorAll('path').forEach((p) => {
      const c = p.cloneNode(false) as SVGPathElement;
      c.setAttribute('fill', '#fff');
      c.removeAttribute('style');
      c.setAttribute('stroke', 'none');
      mask.appendChild(c);
    });
    defs.appendChild(mask);
    svgEl.appendChild(defs);

    const band = document.createElementNS(NS, 'rect');
    band.setAttribute('x', String(vb.x - vb.width));
    band.setAttribute('y', String(vb.y - vb.height * 0.5));
    band.setAttribute('width', String(vb.width * 1.2));
    band.setAttribute('height', String(vb.height * 2));
    band.setAttribute('fill', `url(#${uid}-g)`);
    band.setAttribute('mask', `url(#${uid}-m)`);
    (band.style as CSSStyleDeclaration).mixBlendMode = 'screen';
    svgEl.appendChild(band);

    const anim = band.animate(
      [
        { transform: 'translateX(0)' },
        { transform: `translateX(${vb.width * 1.9}px)` },
      ],
      { duration: durMs, delay: delayMs, easing: 'cubic-bezier(.4,.1,.3,1)', fill: 'both' },
    );
    const cleanup = () => {
      try {
        band.remove();
        defs.remove();
      } catch {
        /* noop */
      }
    };
    anim.onfinish = cleanup;
    anim.oncancel = cleanup;
  } catch {
    /* the sweep is garnish — never let it break a reveal */
  }
}
