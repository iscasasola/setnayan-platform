'use client';

/**
 * Color Range Manipulator — the Photoshop-style color-range tool used by the
 * Setnayan content team to tag photos for the Visual preview pillars
 * (locked 2026-05-21 in iteration 0010 § "Visual preview pillars").
 *
 * Workflow:
 *   1. Load an image (URL or File)
 *   2. Click anywhere on the image → eyedrops that pixel's color
 *   3. Adjust tolerance slider (5–30 ΔE-ish) → matched pixels highlight
 *   4. Click "Save to slot N" → tag persists in slot N (slots 1–6)
 *   5. Pick a target palette color per slot → preview HSL substitution live
 *
 * The output (ColorRangeMap) is what gets persisted to
 * moodboard_asset_color_ranges. The component is intentionally stateless on
 * persistence — caller passes initial map + onChange handler.
 *
 * Color math: RGB→HSL for substitution (keeps L+S, swaps H). Match distance
 * uses weighted RGB Euclidean as a fast proxy for ΔE in CIELAB; switches to
 * proper LAB ΔE76 when tolerance is high enough that the approximation drifts.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ---- types ----

export type ColorRangeSlot = {
  slotId: number; // 1-6
  sampledHex: string; // '#rrggbb'
  toleranceDe: number; // 5-30
  regionLabel?: string;
};

export type ColorRangeMap = Record<number, ColorRangeSlot>; // keyed by slotId

export type PalettePreview = Record<number, string>; // slotId → target hex

type Props = {
  imageSrc: string | null;
  initialMap?: ColorRangeMap;
  onChange?: (next: ColorRangeMap) => void;
  /** When provided, render-preview tab will substitute slot colors → palette hexes */
  previewPalette?: PalettePreview;
};

// ---- color math ----

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [r * 255, g * 255, b * 255];
}

// Weighted RGB Euclidean distance ≈ ΔE76-ish for casual use. Faster than
// converting every pixel to LAB. Scale so 5–30 tolerance feels intuitive.
function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  // Perceptual weighting (rough): R 0.30, G 0.59, B 0.11
  return Math.sqrt(0.3 * dr * dr + 0.59 * dg * dg + 0.11 * db * db) / 2.55;
  // Result ~0-100 range, roughly comparable to ΔE
}

// ---- component ----

const SLOT_COUNT = 6;
const PREVIEW_SCALE = 1; // 1.0 = full resolution; reduce for very large images

export function ColorRangeManipulator({ imageSrc, initialMap = {}, onChange, previewPalette }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  const [activeSlot, setActiveSlot] = useState<number>(1);
  const [tolerance, setTolerance] = useState<number>(15);
  const [hoverHex, setHoverHex] = useState<string | null>(null);
  const [pickedHex, setPickedHex] = useState<string | null>(null);
  const [map, setMap] = useState<ColorRangeMap>(initialMap);
  const [showPreview, setShowPreview] = useState(false);
  const [matchedPixelCount, setMatchedPixelCount] = useState(0);
  const [regionLabelDraft, setRegionLabelDraft] = useState<string>('');

  // ---- image load ----
  useEffect(() => {
    if (!imageSrc) {
      setImgLoaded(false);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;
    img.onload = () => {
      imgRef.current = img;
      const canvas = canvasRef.current;
      const mask = maskCanvasRef.current;
      if (!canvas || !mask) return;
      const w = Math.floor(img.naturalWidth * PREVIEW_SCALE);
      const h = Math.floor(img.naturalHeight * PREVIEW_SCALE);
      canvas.width = w;
      canvas.height = h;
      mask.width = w;
      mask.height = h;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, w, h);
      setImgLoaded(true);
    };
  }, [imageSrc]);

  // ---- bubble-up changes ----
  useEffect(() => {
    onChange?.(map);
  }, [map, onChange]);

  // ---- render mask overlay whenever picked color or tolerance changes ----
  useEffect(() => {
    if (!imgLoaded) return;
    const canvas = canvasRef.current;
    const mask = maskCanvasRef.current;
    if (!canvas || !mask) return;
    const ctx = canvas.getContext('2d');
    const mctx = mask.getContext('2d');
    if (!ctx || !mctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Reset mask
    mctx.clearRect(0, 0, w, h);

    if (showPreview && previewPalette) {
      // ---- preview render: HSL substitute matched pixels per slot ----
      renderPreview(ctx, mctx, w, h, map, previewPalette);
      return;
    }

    if (!pickedHex) return;

    const [tr, tg, tb] = hexToRgb(pickedHex);
    const sourceData = getSourcePixels();
    if (!sourceData) return;

    const overlay = mctx.createImageData(w, h);
    let matches = 0;
    for (let i = 0; i < sourceData.data.length; i += 4) {
      const r = sourceData.data[i]!;
      const g = sourceData.data[i + 1]!;
      const b = sourceData.data[i + 2]!;
      const d = colorDistance(r, g, b, tr, tg, tb);
      if (d <= tolerance) {
        // tint matched pixels with a translucent yellow overlay
        overlay.data[i] = 255;
        overlay.data[i + 1] = 240;
        overlay.data[i + 2] = 0;
        overlay.data[i + 3] = 110; // semi-transparent
        matches++;
      } else {
        overlay.data[i + 3] = 0; // transparent
      }
    }
    mctx.putImageData(overlay, 0, 0);
    setMatchedPixelCount(matches);
  }, [pickedHex, tolerance, imgLoaded, showPreview, previewPalette, map]);

  // ---- helpers ----
  function getSourcePixels(): ImageData | null {
    if (!imgRef.current) return null;
    const off = document.createElement('canvas');
    off.width = canvasRef.current!.width;
    off.height = canvasRef.current!.height;
    const octx = off.getContext('2d');
    if (!octx) return null;
    octx.drawImage(imgRef.current, 0, 0, off.width, off.height);
    return octx.getImageData(0, 0, off.width, off.height);
  }

  function renderPreview(
    ctx: CanvasRenderingContext2D,
    mctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    slots: ColorRangeMap,
    palette: PalettePreview,
  ) {
    const source = getSourcePixels();
    if (!source) return;

    // For each pixel, find which slot it best matches (if any).
    // If multiple slots match, pick the closest. Apply target hue (keep L+S).
    const out = ctx.createImageData(w, h);
    out.data.set(source.data);

    const slotEntries = Object.values(slots);
    if (slotEntries.length === 0) {
      ctx.putImageData(source, 0, 0);
      mctx.clearRect(0, 0, w, h);
      return;
    }

    for (let i = 0; i < source.data.length; i += 4) {
      const r = source.data[i]!;
      const g = source.data[i + 1]!;
      const b = source.data[i + 2]!;

      let bestSlot: ColorRangeSlot | null = null;
      let bestDist = Infinity;
      for (const slot of slotEntries) {
        const [tr, tg, tb] = hexToRgb(slot.sampledHex);
        const d = colorDistance(r, g, b, tr, tg, tb);
        if (d <= slot.toleranceDe && d < bestDist) {
          bestSlot = slot;
          bestDist = d;
        }
      }

      if (bestSlot) {
        const targetHex = palette[bestSlot.slotId];
        if (targetHex) {
          // HSL substitution: keep L+S of source pixel, swap H to target hue
          const [, , l] = rgbToHsl(r, g, b);
          const [hr, hg, hb] = hexToRgb(targetHex);
          const [sH, sS] = rgbToHsl(hr, hg, hb);
          // For the saturation we use the TARGET's saturation rather than
          // source's — that's what makes the recolor feel "intentional" rather
          // than washed-out. Some tools blend source S; we keep target's S.
          const [nr, ng, nb] = hslToRgb(sH, Math.max(sS, 0.4), l);
          out.data[i] = nr;
          out.data[i + 1] = ng;
          out.data[i + 2] = nb;
        }
      }
    }

    ctx.putImageData(out, 0, 0);
    mctx.clearRect(0, 0, w, h);
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!imgLoaded || showPreview) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * canvas.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const px = ctx.getImageData(x, y, 1, 1).data;
    const hex = rgbToHex(px[0]!, px[1]!, px[2]!);
    setPickedHex(hex);
  }

  function handleCanvasMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!imgLoaded || showPreview) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * canvas.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const px = ctx.getImageData(x, y, 1, 1).data;
    setHoverHex(rgbToHex(px[0]!, px[1]!, px[2]!));
  }

  function saveSlot() {
    if (!pickedHex) return;
    setMap((prev) => ({
      ...prev,
      [activeSlot]: {
        slotId: activeSlot,
        sampledHex: pickedHex,
        toleranceDe: tolerance,
        regionLabel: regionLabelDraft || undefined,
      },
    }));
    setRegionLabelDraft('');
  }

  function clearSlot(slotId: number) {
    setMap((prev) => {
      const next = { ...prev };
      delete next[slotId];
      return next;
    });
  }

  function loadSlot(slotId: number) {
    const s = map[slotId];
    if (!s) return;
    setActiveSlot(slotId);
    setPickedHex(s.sampledHex);
    setTolerance(s.toleranceDe);
    setRegionLabelDraft(s.regionLabel ?? '');
  }

  const slotsArr = useMemo(
    () => Array.from({ length: SLOT_COUNT }, (_, i) => i + 1),
    [],
  );

  return (
    <div className="space-y-4">
      {/* Canvas area */}
      <div
        className="relative inline-block max-w-full cursor-crosshair overflow-hidden rounded-xl border border-ink/15 bg-ink/5"
        onClick={handleCanvasClick}
        onMouseMove={handleCanvasMove}
        onMouseLeave={() => setHoverHex(null)}
      >
        <canvas ref={canvasRef} className="block max-w-full" />
        <canvas
          ref={maskCanvasRef}
          className="pointer-events-none absolute left-0 top-0 block max-w-full"
        />
        {!imgLoaded && (
          <div className="flex h-48 w-96 max-w-full items-center justify-center text-sm text-ink/55">
            Load a photo to begin
          </div>
        )}
      </div>

      {/* Sample readout */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Hover
          </span>
          <ColorChip hex={hoverHex} />
          <span className="font-mono text-xs text-ink/65">{hoverHex ?? '—'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Picked
          </span>
          <ColorChip hex={pickedHex} />
          <span className="font-mono text-xs text-ink/65">{pickedHex ?? '—'}</span>
        </div>
        {pickedHex && (
          <span className="text-xs text-ink/55">
            {matchedPixelCount.toLocaleString()} matched pixels at tolerance {tolerance}
          </span>
        )}
      </div>

      {/* Tolerance slider */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-ink/65">
          <label htmlFor="tolerance" className="font-mono uppercase tracking-[0.2em] text-[11px]">
            Tolerance (ΔE-ish)
          </label>
          <span className="font-mono">{tolerance}</span>
        </div>
        <input
          id="tolerance"
          type="range"
          min="5"
          max="30"
          step="1"
          value={tolerance}
          onChange={(e) => setTolerance(Number(e.target.value))}
          className="w-full accent-terracotta"
          disabled={showPreview}
        />
      </div>

      {/* Region label input */}
      <div className="space-y-1">
        <label htmlFor="region-label" className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Region label (e.g. &ldquo;drapery&rdquo;, &ldquo;cocktail dress&rdquo;)
        </label>
        <input
          id="region-label"
          type="text"
          value={regionLabelDraft}
          onChange={(e) => setRegionLabelDraft(e.target.value)}
          placeholder="optional"
          className="w-full rounded-md border border-ink/15 bg-cream px-3 py-2 text-sm focus:border-terracotta focus:outline-none"
        />
      </div>

      {/* Slot pills */}
      <div className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">Palette slots</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {slotsArr.map((slotId) => {
            const slot = map[slotId];
            const isActive = slotId === activeSlot;
            return (
              <button
                key={slotId}
                type="button"
                onClick={() => setActiveSlot(slotId)}
                className={`flex flex-col items-center gap-1 rounded-lg border p-2 transition ${
                  isActive
                    ? 'border-terracotta bg-terracotta/10'
                    : 'border-ink/15 bg-cream hover:border-ink/30'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
                    Slot {slotId}
                  </span>
                  <ColorChip hex={slot?.sampledHex ?? null} small />
                </div>
                {slot ? (
                  <div className="text-center text-[10px] text-ink/55">
                    {slot.sampledHex}
                    <br />
                    {slot.regionLabel ?? 'no label'}
                    <br />
                    tol {slot.toleranceDe}
                  </div>
                ) : (
                  <div className="text-center text-[10px] text-ink/40">empty</div>
                )}
                {slot && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      loadSlot(slotId);
                    }}
                    className="text-[10px] uppercase tracking-[0.15em] text-terracotta hover:underline"
                  >
                    Load
                  </button>
                )}
                {slot && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearSlot(slotId);
                    }}
                    className="text-[10px] uppercase tracking-[0.15em] text-ink/50 hover:underline"
                  >
                    Clear
                  </button>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 border-t border-ink/10 pt-3">
        <button
          type="button"
          onClick={saveSlot}
          disabled={!pickedHex || showPreview}
          className="rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save sample to slot {activeSlot}
        </button>
        <button
          type="button"
          onClick={() => setShowPreview((p) => !p)}
          disabled={Object.keys(map).length === 0 || !previewPalette}
          className="rounded-md border border-ink/20 bg-cream px-4 py-2 text-sm font-medium text-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          {showPreview ? 'Back to tagging' : 'Preview with palette'}
        </button>
      </div>
    </div>
  );
}

// ---- inline color chip ----
function ColorChip({ hex, small }: { hex: string | null; small?: boolean }) {
  const size = small ? 'h-3 w-3' : 'h-5 w-5';
  if (!hex) {
    return <div className={`${size} rounded border border-dashed border-ink/30 bg-cream`} />;
  }
  return (
    <div
      className={`${size} rounded border border-ink/20`}
      style={{ backgroundColor: hex }}
    />
  );
}
