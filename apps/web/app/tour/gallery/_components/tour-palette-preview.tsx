'use client';

// ============================================================================
// TourPalettePreview — CLIENT-ONLY interactive palette for the public Maria &
// Jose tour (Stop 5).
//
// Purely presentational + locally interactive. The parent RSC reads the
// couple's saved events.role_palette (via sanitizeRolePalette) ONCE, server-
// side, and hands the swatch families down as plain props. This component shows
// them as labelled families and lets the visitor PREVIEW a recolor: dragging the
// hue slider rotates every swatch's hue in LOCAL React state only. It calls NO
// server (writing role_palette is a dashboard-only server action, off-limits to
// the read-only tour), and a reload resets it.
//
// Tokens match the tour (serif headings, #1E2229 ink, #5F5E5A body, #8C6932 /
// #C5A059 gold, #5C2542 mulberry, #FBF8F1 cream).
// ============================================================================

import { useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';

export type TourSwatchGroup = {
  key: string;
  label: string;
  family: 'venue' | 'couple' | 'role';
  colors: string[];
  slotLabels: string[] | null;
};

const FAMILY_LABEL: Record<TourSwatchGroup['family'], string> = {
  venue: 'Venue',
  couple: 'The couple',
  role: 'The entourage',
};

/** Parse #RRGGBB → [r,g,b] (0-255). Returns null for anything malformed. */
function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m || !m[1]) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

/** Pure hue rotation in HSL space — keeps each colour's saturation + lightness,
 *  only spins the wheel by `deg`. Lets a visitor "try a warmer/cooler story"
 *  without inventing arbitrary colours. */
function rotateHue(hex: string, deg: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  let [r, g, b] = rgb.map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      default:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  h = (h + deg / 360) % 1;
  if (h < 0) h += 1;

  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  if (s === 0) {
    return rgbToHex(l * 255, l * 255, l * 255);
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  r = hue2rgb(p, q, h + 1 / 3);
  g = hue2rgb(p, q, h);
  b = hue2rgb(p, q, h - 1 / 3);
  return rgbToHex(r * 255, g * 255, b * 255);
}

export function TourPalettePreview({ groups }: { groups: TourSwatchGroup[] }) {
  const [hueShift, setHueShift] = useState(0);

  // Recolor every swatch locally as the slider moves. Identity at 0° so the
  // default shows the couple's TRUE palette.
  const recolored = useMemo(
    () =>
      groups.map((g) => ({
        ...g,
        colors: hueShift === 0 ? g.colors : g.colors.map((c) => rotateHue(c, hueShift)),
      })),
    [groups, hueShift],
  );

  return (
    <div className="rounded-2xl border border-[#C5A059]/40 bg-[#FBF8F1] p-5 sm:p-6">
      {/* Local-only recolor control. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label htmlFor="tour-hue" className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#8C6932]">
          Preview a recolor
        </label>
        <button
          type="button"
          onClick={() => setHueShift(0)}
          disabled={hueShift === 0}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-[#C5A059]/50 px-3 text-xs font-medium text-[#5C2542] transition-opacity hover:opacity-80 disabled:opacity-40"
        >
          <RotateCcw aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Their palette
        </button>
      </div>
      <input
        id="tour-hue"
        type="range"
        min={-180}
        max={180}
        step={5}
        value={hueShift}
        onChange={(e) => setHueShift(Number(e.target.value))}
        className="mt-3 w-full accent-[#5C2542]"
        aria-label="Shift the palette hue"
      />
      <p className="mt-1.5 text-xs text-[#9A8F86]">
        {hueShift === 0
          ? 'This is their real colour story. Drag to imagine a warmer or cooler one — nothing is saved.'
          : `Previewing a ${hueShift > 0 ? '+' : ''}${hueShift}° shift — a local sketch only.`}
      </p>

      {/* Swatch families. */}
      <div className="mt-6 space-y-5">
        {recolored.map((g) => (
          <div key={g.key}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-serif text-sm text-[#1E2229]">{g.label}</p>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#8C6932]">
                {FAMILY_LABEL[g.family]}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {g.colors.map((color, i) => (
                <div key={`${g.key}-${i}`} className="flex flex-col items-center gap-1">
                  <span
                    className="block h-11 w-11 rounded-lg border border-[#1E2229]/10 shadow-sm sm:h-12 sm:w-12"
                    style={{ backgroundColor: color }}
                    title={color}
                    aria-label={`${g.label} colour ${color}`}
                  />
                  {g.slotLabels && g.slotLabels[i] ? (
                    <span className="text-[10px] text-[#9A8F86]">{g.slotLabels[i]}</span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
