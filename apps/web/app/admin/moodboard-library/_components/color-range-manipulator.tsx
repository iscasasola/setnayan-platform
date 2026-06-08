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

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildMatchMask,
  palettePreviewToEdits,
  recolorRGBA,
  rgbToHex,
  type ColorRangeMap,
  type PalettePreview,
} from '@/lib/color-recolor';

// ---- types ----
// Color math + the ColorRange/Palette types now live in @/lib/color-recolor so
// the couple-facing Recolor Studio shares the exact same engine. Re-exported
// here for existing importers (visual-preview.tsx, the moodboard page, etc.).
export type { ColorRangeSlot, ColorRangeMap, PalettePreview } from '@/lib/color-recolor';

type Props = {
  imageSrc: string | null;
  initialMap?: ColorRangeMap;
  onChange?: (next: ColorRangeMap) => void;
  /** When provided, render-preview tab will substitute slot colors → palette hexes */
  previewPalette?: PalettePreview;
};

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

    const sourceData = getSourcePixels();
    if (!sourceData) return;

    // Translucent yellow highlight over pixels within tolerance of the picked
    // color — shared buildMatchMask keeps this identical to the studio.
    const { mask: overlay, matched } = buildMatchMask(
      sourceData.data,
      pickedHex,
      tolerance,
    );
    const overlayImg = mctx.createImageData(w, h);
    overlayImg.data.set(overlay);
    mctx.putImageData(overlayImg, 0, 0);
    setMatchedPixelCount(matched);
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

    const slotEntries = Object.values(slots);
    if (slotEntries.length === 0) {
      ctx.putImageData(source, 0, 0);
      mctx.clearRect(0, 0, w, h);
      return;
    }

    // Shared engine: best-slot-wins match + palette-mode HSL substitution
    // (keep source L, swap H to the palette hue, lift S). Identical math to the
    // couple-facing Recolor Studio so admin tagging previews match what hosts see.
    const recolored = recolorRGBA(
      source.data,
      slotEntries,
      palettePreviewToEdits(palette),
    );
    source.data.set(recolored);
    ctx.putImageData(source, 0, 0);
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
