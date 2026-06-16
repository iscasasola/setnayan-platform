'use client';

/**
 * WaxSeal — the couple's monogram pressed into a wax seal (0024 addendum §3).
 *
 * NOT a hardcoded mark: the couple's real monogram (events.monogram_uploaded_svg
 * ?? monogram_custom_svg — the 0037 / Cipher mark) is rendered as an EMBOSSED
 * relief in wax tones, exactly like a stamp pressed into molten wax. Three masked
 * copies of the mark (a lighter highlight offset up-left, a darker shadow offset
 * down-right, and a mid debossed face) build the pressed-in look; the disc itself
 * carries a waxy radial sheen + a bulged rim. Colour = the Mood-Board deep accent
 * (§4), so it recolours with the rest of the couple site at ₱0.
 *
 * Owner-explicit (§1a): the seal casts/receives NO shadow — only its own surface
 * material (sheen + the embossed relief + edge bulge) reads, never a drop shadow.
 *
 * When the couple has no mark SVG yet, it falls back to their lettered monogram
 * ("A & J") embossed with the same wax-tone relief, so it's never blank.
 */

import type { CSSProperties } from 'react';

type Props = {
  /** The couple's monogram SVG markup (uploaded/custom). Null → lettered fallback. */
  markSvg: string | null;
  /** Lettered fallback, e.g. "A & J". */
  monogramText: string;
  /** Wax colour (hex) — the Mood-Board deep accent. */
  waxColor: string;
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

/** A masked relief layer — paints `bg` only through the mark's silhouette. */
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

export function WaxSeal({ markSvg, monogramText, waxColor, size = 84 }: Props) {
  // Press the mark in as a CSS mask (alpha mask → the painted silhouette shows
  // in wax tones). This works for the transparent-background VECTOR marks (the
  // Cipher / bespoke 0037 path), but a RASTER upload is stored as
  // `<svg><image href="data:…"/></svg>` whose content rect is fully opaque — used
  // as an alpha mask it would pass the whole rect and render a featureless wax
  // disc. So a raster-wrapped mark falls back to the lettered emboss instead of
  // a blank seal. (True raster→wax emboss needs a luminance/threshold source —
  // handled when the candle-stamp maker mints the seal.)
  const usableMark = markSvg && !/<image[\s/>]/i.test(markSvg) ? markSvg : null;
  const maskUrl = usableMark
    ? `url("data:image/svg+xml;utf8,${encodeURIComponent(usableMark)}")`
    : null;

  // Wax-tone relief stops: a light highlight, the mid debossed face, a dark core.
  const highlight = lighten(waxColor, 0.42);
  const face = darken(waxColor, 0.16);
  const shadow = darken(waxColor, 0.4);

  return (
    <span
      aria-hidden
      style={{
        position: 'relative',
        display: 'block',
        width: size,
        height: size,
        borderRadius: '50%',
        // Waxy sheen: off-centre soft highlight over the deep accent, with a
        // bulged rim (inset ring) — material only, NO drop shadow (owner §1a).
        background: `radial-gradient(40% 38% at 38% 32%, ${lighten(
          waxColor,
          0.34,
        )} 0%, ${waxColor} 46%, ${darken(waxColor, 0.22)} 100%)`,
        boxShadow: `inset 0 1px 2px ${lighten(waxColor, 0.5)}, inset 0 -2px 5px ${darken(
          waxColor,
          0.45,
        )}`,
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
            // Letter emboss: light highlight up-left + dark shadow down-right.
            textShadow: `-0.7px -0.7px 0 ${highlight}, 0.7px 0.7px 0 ${shadow}`,
          }}
        >
          {monogramText}
        </span>
      )}
      {/* top gloss streak — the freshly-pressed wax sheen */}
      <span
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background:
            'radial-gradient(60% 22% at 42% 22%, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0) 70%)',
          pointerEvents: 'none',
        }}
      />
    </span>
  );
}
