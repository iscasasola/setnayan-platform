'use client';

/**
 * WaxSeal — the couple's monogram pressed into a wax seal (0024 addendum §3).
 *
 * Renders the MINTED recipe (events.wax_seal_config, via the candle-stamp maker)
 * with the WebGL2 painter `paintWaxSealWebGL` — height-field normal mapping,
 * Phong lighting, subsurface scattering stand-in — so the embossed monogram has
 * genuine 3D depth. Falls back to Canvas-2D `paintWaxSeal` on browsers without
 * WebGL2 support. The seal a guest sees is deterministically identical to what the
 * couple minted (same seed → same puddle shape, regardless of renderer).
 *
 * Progressive enhancement: a CSS-mask static seal renders before hydration / with
 * no JS, then the canvas paints over it on mount, so it is never blank. When the
 * couple hasn't minted yet (config null) the painter uses default levers seeded
 * by `fallbackSeed`, so every couple still gets a bespoke (not generic) seal.
 */

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  fallbackSeedFromPublicId,
  resolveWaxColor,
  type WaxSealConfig,
} from '@/lib/wax-seal/types';
import { buildMarkCanvas, paintWaxSeal } from '@/lib/wax-seal/paint';
import {
  buildDieForGL,
  initWaxSealGL,
  paintWaxSealWebGL,
  type WaxSealGLState,
} from '@/lib/wax-seal/paint-webgl';

type Props = {
  /** The couple's monogram SVG markup (uploaded/custom) — the stamp die. Null → lettered. */
  markSvg: string | null;
  /** Lettered fallback, e.g. "A & J". */
  monogramText: string;
  /** Mood-Board deep-accent wax colour (hex) — the default when the recipe has no override. */
  waxColor: string;
  /** The minted recipe. Null → render default levers seeded by `fallbackSeed`. */
  config?: WaxSealConfig | null;
  /** Stable seed for an un-minted seal (public_id-derived). */
  fallbackSeed?: number;
  /** Diameter in px. */
  size?: number;
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const body = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim())?.[1] ?? '5c2542';
  const n = parseInt(body, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function mix(hex: string, target: number, amt: number): string {
  const { r, g, b } = hexToRgb(hex);
  const f = (c: number) => Math.round(c + (target - c) * amt);
  return `rgb(${f(r)} ${f(g)} ${f(b)})`;
}
const lighten = (hex: string, amt: number) => mix(hex, 255, amt);
const darken = (hex: string, amt: number) => mix(hex, 0, amt);

function reliefLayer(maskUrl: string, bg: string, dx: number, dy: number): CSSProperties {
  return {
    position: 'absolute',
    inset: '24%',
    backgroundColor: bg,
    WebkitMaskImage: maskUrl,
    maskImage: maskUrl,
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
    transform: `translate(${dx}px, ${dy}px)`,
  };
}

/** The pre-hydration / no-JS static seal (CSS mask), kept so it's never blank. */
function CssFallback({
  markSvg,
  monogramText,
  waxColor,
  size,
}: {
  markSvg: string | null;
  monogramText: string;
  waxColor: string;
  size: number;
}) {
  const usableMark = markSvg && !/<image[\s/>]/i.test(markSvg) ? markSvg : null;
  const maskUrl = usableMark
    ? `url("data:image/svg+xml;utf8,${encodeURIComponent(usableMark)}")`
    : null;
  const highlight = lighten(waxColor, 0.42);
  const face = darken(waxColor, 0.16);
  const shadow = darken(waxColor, 0.4);
  return (
    <span
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: '50%',
        background: `radial-gradient(40% 38% at 38% 32%, ${lighten(waxColor, 0.34)} 0%, ${waxColor} 46%, ${darken(waxColor, 0.22)} 100%)`,
        boxShadow: `inset 0 1px 2px ${lighten(waxColor, 0.5)}, inset 0 -2px 5px ${darken(waxColor, 0.45)}`,
      }}
    >
      {maskUrl ? (
        <>
          <span style={reliefLayer(maskUrl, highlight, -0.7, -0.7)} />
          <span style={reliefLayer(maskUrl, shadow, 0.7, 0.7)} />
          <span style={reliefLayer(maskUrl, face, 0, 0)} />
        </>
      ) : (
        <span
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-display, Georgia, serif)',
            fontStyle: 'italic',
            fontSize: size * 0.3,
            color: face,
            textShadow: `-0.7px -0.7px 0 ${highlight}, 0.7px 0.7px 0 ${shadow}`,
          }}
        >
          {monogramText}
        </span>
      )}
      <span
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background:
            'radial-gradient(60% 22% at 42% 22%, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0) 70%)',
        }}
      />
    </span>
  );
}

export function WaxSeal({
  markSvg,
  monogramText,
  waxColor,
  config = null,
  fallbackSeed,
  size = 84,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // GL state: undefined = not attempted, null = failed (use Canvas 2D)
  const glInitRef = useRef(false);
  const glRef = useRef<WaxSealGLState | null>(null);
  const [painted, setPainted] = useState(false);

  const resolvedColor = resolveWaxColor(config, waxColor);
  const finish = config?.wax.finish ?? 'matte';
  const seed = config?.seed ?? fallbackSeed ?? fallbackSeedFromPublicId(monogramText);
  const configKey = config ? JSON.stringify(config) : '';

  useEffect(() => {
    let cancelled = false;
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // lazy-init WebGL2 once per canvas lifetime
    if (!glInitRef.current) {
      glInitRef.current = true;
      glRef.current = initWaxSealGL(cv);
    }
    const glState = glRef.current;

    (async () => {
      if (glState) {
        // WebGL2 path — height-field normal mapping + Phong
        const die = await buildDieForGL(markSvg, monogramText);
        if (cancelled) return;
        paintWaxSealWebGL(glState, {
          config,
          mark: die,
          monogramText,
          waxColor: resolvedColor,
          finish,
          seed,
          size,
          dpr,
        });
      } else {
        // Canvas-2D fallback (WebGL2 unavailable)
        const S = Math.round(size * dpr);
        cv.width = S;
        cv.height = S;
        const ctx = cv.getContext('2d');
        if (!ctx) return;
        const mark = await buildMarkCanvas(markSvg);
        if (cancelled) return;
        paintWaxSeal(ctx, {
          config,
          mark,
          monogramText,
          waxColor: resolvedColor,
          finish,
          seed,
          size,
          dpr,
        });
      }
      if (!cancelled) setPainted(true);
    })();
    return () => {
      cancelled = true;
    };
    // configKey captures the recipe; resolvedColor/finish/seed are derived from it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markSvg, monogramText, resolvedColor, finish, seed, size, configKey]);

  return (
    <span
      aria-hidden
      style={{ position: 'relative', display: 'block', width: size, height: size }}
    >
      <span
        style={{
          position: 'absolute',
          inset: 0,
          opacity: painted ? 0 : 1,
          transition: 'opacity 200ms ease-out',
        }}
      >
        <CssFallback
          markSvg={markSvg}
          monogramText={monogramText}
          waxColor={resolvedColor}
          size={size}
        />
      </span>
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        style={{
          position: 'absolute',
          inset: 0,
          width: size,
          height: size,
          opacity: painted ? 1 : 0,
          transition: 'opacity 200ms ease-out',
        }}
      />
    </span>
  );
}
