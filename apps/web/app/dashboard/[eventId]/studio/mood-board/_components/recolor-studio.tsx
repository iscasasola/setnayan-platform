'use client';

/**
 * Recolor Studio — the couple-facing version of the Color Range Manipulator.
 *
 * Owner directive 2026-06-08: "change the colors of specific parts of a photo
 * like a color range selector. then just alter the hue, contrast, brightness
 * or pick from the palette given."
 *
 * The couple:
 *   1. picks a REGION of the photo (a pre-tagged color range — "drapery",
 *      "bouquet", "dress" — or eyedrops their own),
 *   2. either SNAPS it to one of their palette colors, or freely ADJUSTS it
 *      (hue / saturation / brightness / contrast),
 *   3. sees the recolor live (browser-side Canvas, ₱0 marginal cost),
 *   4. saves the look to their pinned moodboard.
 *
 * All math runs through @/lib/color-recolor (shared with the admin tagger).
 * When `onSave` is omitted the component is a READ-ONLY preview — it just
 * renders the image with `initialEdits` applied (used for pinned saves).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildMatchMask,
  buildSnapshot,
  recolorRGBA,
  rgbToHex,
  type ColorRangeSlot,
  type MoodboardSnapshot,
  type RegionEdit,
  type RegionEditMap,
} from '@/lib/color-recolor';

type Props = {
  imageSrc: string;
  /** Selectable regions — the asset's pre-tagged color ranges (or parsed from a save). */
  regions: ColorRangeSlot[];
  /** Palette swatches the couple can snap a region to (this chapter's colors). */
  paletteColors?: string[];
  /** Seed edits (e.g. a saved snapshot being re-opened). */
  initialEdits?: RegionEditMap;
  /** Provide to make the studio editable; omit for a read-only preview. */
  onSave?: (snapshot: MoodboardSnapshot) => void;
  isSaving?: boolean;
  /** Portrait aspect for figure/attire assets (taller than wide). */
  portrait?: boolean;
  /** Allow tapping the photo to sample a custom region (default on when editable). */
  enableEyedrop?: boolean;
};

const MAX_PREVIEW_PX = 520; // downscale large library photos for snappy recolor
const DEFAULT_TOLERANCE = 16;

const ADJUST_ZERO = { h: 0, s: 0, l: 0, c: 0 } as const;

export function RecolorStudio({
  imageSrc,
  regions,
  paletteColors = [],
  initialEdits = {},
  onSave,
  isSaving = false,
  portrait = false,
  enableEyedrop,
}: Props) {
  const editable = typeof onSave === 'function';
  const allowEyedrop = enableEyedrop ?? editable;

  const baseRef = useRef<HTMLCanvasElement>(null);
  const maskRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const sourceRef = useRef<ImageData | null>(null);
  const rafRef = useRef<number | null>(null);

  const [imgLoaded, setImgLoaded] = useState(false);
  const [tainted, setTainted] = useState(false); // CORS-blocked → no recolor
  const [slots, setSlots] = useState<ColorRangeSlot[]>(regions);
  const [edits, setEdits] = useState<RegionEditMap>(initialEdits);
  const [activeSlotId, setActiveSlotId] = useState<number | null>(
    regions[0]?.slotId ?? null,
  );
  const [eyedropping, setEyedropping] = useState(false);
  const [dirty, setDirty] = useState(false);

  // ---- load image, size canvas, cache source pixels ----
  useEffect(() => {
    setImgLoaded(false);
    setTainted(false);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;
    img.onload = () => {
      imgRef.current = img;
      const base = baseRef.current;
      const mask = maskRef.current;
      if (!base || !mask) return;
      const scale = Math.min(
        1,
        MAX_PREVIEW_PX / Math.max(img.naturalWidth, img.naturalHeight),
      );
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      base.width = w;
      base.height = h;
      mask.width = w;
      mask.height = h;
      const ctx = base.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, w, h);
      try {
        sourceRef.current = ctx.getImageData(0, 0, w, h);
      } catch {
        // Cross-origin image without CORS headers taints the canvas; we can
        // still show it, just not recolor it. Graceful degrade.
        sourceRef.current = null;
        setTainted(true);
      }
      setImgLoaded(true);
    };
    img.onerror = () => setImgLoaded(false);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [imageSrc]);

  // Keep slots in sync if the regions prop changes identity (new asset).
  useEffect(() => {
    setSlots(regions);
    setActiveSlotId(regions[0]?.slotId ?? null);
  }, [regions]);

  // ---- live recolor (coalesced via rAF so slider drags stay smooth) ----
  useEffect(() => {
    if (!imgLoaded) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const base = baseRef.current;
      const ctx = base?.getContext('2d', { willReadFrequently: true });
      const source = sourceRef.current;
      if (!base || !ctx) return;
      if (!source) {
        // Tainted: just paint the original.
        if (imgRef.current)
          ctx.drawImage(imgRef.current, 0, 0, base.width, base.height);
        return;
      }
      const recolored = recolorRGBA(source.data, slots, edits);
      const out = ctx.createImageData(base.width, base.height);
      out.data.set(recolored);
      ctx.putImageData(out, 0, 0);
    });
  }, [edits, slots, imgLoaded]);

  // ---- highlight the active region (editable only) ----
  useEffect(() => {
    const mask = maskRef.current;
    const mctx = mask?.getContext('2d');
    if (!mask || !mctx) return;
    mctx.clearRect(0, 0, mask.width, mask.height);
    if (!editable || activeSlotId == null || !imgLoaded) return;
    const source = sourceRef.current;
    const slot = slots.find((s) => s.slotId === activeSlotId);
    if (!source || !slot) return;
    const { mask: overlay } = buildMatchMask(
      source.data,
      slot.sampledHex,
      slot.toleranceDe,
    );
    const od = mctx.createImageData(mask.width, mask.height);
    od.data.set(overlay);
    mctx.putImageData(od, 0, 0);
  }, [activeSlotId, slots, imgLoaded, editable]);

  // ---- derived: the active slot's current adjust values ----
  const activeEdit = activeSlotId != null ? edits[activeSlotId] : undefined;
  const adjust =
    activeEdit?.mode === 'adjust' ? activeEdit : { ...ADJUST_ZERO };

  function setActiveEdit(next: RegionEdit | null) {
    if (activeSlotId == null) return;
    setEdits((prev) => {
      const copy = { ...prev };
      if (next == null) delete copy[activeSlotId];
      else copy[activeSlotId] = next;
      return copy;
    });
    setDirty(true);
  }

  function setAdjust(key: 'h' | 's' | 'l' | 'c', value: number) {
    setActiveEdit({ mode: 'adjust', ...adjust, [key]: value });
  }

  function snapToPalette(hex: string) {
    setActiveEdit({ mode: 'palette', hex });
  }

  function resetActiveRegion() {
    setActiveEdit(null);
  }

  function resetAll() {
    setEdits({});
    setDirty(true);
  }

  // ---- eyedrop: sample a custom region from the photo ----
  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!editable || !allowEyedrop || !eyedropping) return;
    const base = baseRef.current;
    const source = sourceRef.current;
    if (!base || !source) return;
    const rect = base.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * base.width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * base.height);
    const idx = (y * base.width + x) * 4;
    const hex = rgbToHex(source.data[idx]!, source.data[idx + 1]!, source.data[idx + 2]!);
    const nextId = (slots.reduce((m, s) => Math.max(m, s.slotId), 0) || 0) + 1;
    const newSlot: ColorRangeSlot = {
      slotId: nextId,
      sampledHex: hex,
      toleranceDe: DEFAULT_TOLERANCE,
      regionLabel: 'Custom area',
    };
    setSlots((prev) => [...prev, newSlot]);
    setActiveSlotId(nextId);
    setEyedropping(false);
  }

  function handleSave() {
    if (!onSave) return;
    const slotMap = Object.fromEntries(slots.map((s) => [s.slotId, s]));
    onSave(buildSnapshot(slotMap, edits));
    setDirty(false);
  }

  const editedCount = useMemo(
    () => Object.keys(edits).length,
    [edits],
  );

  const canvasAspect = portrait ? 'aspect-[3/4]' : 'aspect-[4/3]';

  return (
    <div className="space-y-3">
      {/* ---- viewzone: the photo ---- */}
      <div
        className={`relative w-full overflow-hidden rounded-xl border border-ink/15 bg-cream ${
          eyedropping ? 'cursor-crosshair' : ''
        }`}
      >
        <canvas
          ref={baseRef}
          onClick={handleCanvasClick}
          className={`block h-auto w-full ${canvasAspect} object-contain`}
        />
        <canvas
          ref={maskRef}
          className="pointer-events-none absolute left-0 top-0 block h-auto w-full"
        />
        {!imgLoaded && (
          <div className="flex h-44 items-center justify-center text-sm text-ink/55">
            Loading photo…
          </div>
        )}
        {tainted && imgLoaded && (
          <p className="absolute inset-x-0 bottom-0 bg-ink/70 px-2 py-1 text-center text-[10px] text-cream">
            Preview only — this photo can&rsquo;t be recolored in-browser
          </p>
        )}
      </div>

      {/* Read-only mode stops here (pinned previews). */}
      {!editable ? null : (
        <>
          {/* ---- region chips ---- */}
          <div className="space-y-1.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
              1 · Pick a part to recolor
            </p>
            <div className="flex flex-wrap gap-1.5">
              {slots.length === 0 && (
                <span className="text-xs text-ink/50">
                  No tagged regions — use the eyedropper to pick one.
                </span>
              )}
              {slots.map((s) => {
                const isActive = s.slotId === activeSlotId;
                const isEdited = !!edits[s.slotId];
                return (
                  <button
                    key={s.slotId}
                    type="button"
                    onClick={() => setActiveSlotId(s.slotId)}
                    className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${
                      isActive
                        ? 'border-terracotta bg-terracotta/10 text-ink'
                        : 'border-ink/15 bg-cream text-ink/70 hover:border-ink/30'
                    }`}
                  >
                    <span
                      className="h-3 w-3 rounded-full border border-ink/20"
                      style={{ backgroundColor: s.sampledHex }}
                    />
                    {s.regionLabel || `Region ${s.slotId}`}
                    {isEdited && <span className="text-terracotta">●</span>}
                  </button>
                );
              })}
              {allowEyedrop && (
                <button
                  type="button"
                  onClick={() => setEyedropping((v) => !v)}
                  className={`rounded-full border px-2.5 py-1 text-xs transition ${
                    eyedropping
                      ? 'border-mulberry bg-mulberry/10 text-mulberry'
                      : 'border-dashed border-ink/30 text-ink/60 hover:border-ink/50'
                  }`}
                >
                  {eyedropping ? 'Tap the photo…' : '+ Eyedrop area'}
                </button>
              )}
            </div>
          </div>

          {/* ---- tapzone: controls for the active region ---- */}
          {activeSlotId != null && (
            <div className="space-y-3 rounded-xl border border-ink/10 bg-white p-3">
              {/* palette snap */}
              {paletteColors.length > 0 && (
                <div className="space-y-1.5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
                    2 · Snap to a palette color
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {paletteColors.map((hex, i) => {
                      const selected =
                        activeEdit?.mode === 'palette' &&
                        activeEdit.hex.toUpperCase() === hex.toUpperCase();
                      return (
                        <button
                          key={`${hex}-${i}`}
                          type="button"
                          onClick={() => snapToPalette(hex)}
                          title={hex}
                          className={`h-8 w-8 rounded-md border transition ${
                            selected
                              ? 'border-terracotta ring-2 ring-terracotta/40'
                              : 'border-ink/15 hover:scale-105'
                          }`}
                          style={{ backgroundColor: hex }}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* manual adjust */}
              <div className="space-y-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
                  {paletteColors.length > 0 ? '3 · ' : '2 · '}Or adjust by hand
                </p>
                <Slider
                  label="Hue"
                  min={-180}
                  max={180}
                  value={adjust.h}
                  onChange={(v) => setAdjust('h', v)}
                  suffix="°"
                />
                <Slider
                  label="Saturation"
                  min={-100}
                  max={100}
                  value={adjust.s}
                  onChange={(v) => setAdjust('s', v)}
                />
                <Slider
                  label="Brightness"
                  min={-100}
                  max={100}
                  value={adjust.l}
                  onChange={(v) => setAdjust('l', v)}
                />
                <Slider
                  label="Contrast"
                  min={-100}
                  max={100}
                  value={adjust.c}
                  onChange={(v) => setAdjust('c', v)}
                />
              </div>

              <button
                type="button"
                onClick={resetActiveRegion}
                className="text-[11px] uppercase tracking-[0.15em] text-ink/50 hover:text-terracotta"
              >
                Reset this part
              </button>
            </div>
          )}

          {/* ---- actions ---- */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || (!dirty && editedCount === 0)}
              className="rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : 'Save to moodboard'}
            </button>
            {editedCount > 0 && (
              <button
                type="button"
                onClick={resetAll}
                className="rounded-md border border-ink/20 px-3 py-2 text-xs font-medium text-ink"
              >
                Reset all
              </button>
            )}
            <span className="text-[11px] text-ink/50">
              {editedCount > 0
                ? `${editedCount} part${editedCount > 1 ? 's' : ''} recolored`
                : 'Pick a part, then snap or adjust'}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function Slider({
  label,
  min,
  max,
  value,
  onChange,
  suffix = '',
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-[11px] text-ink/65">
        <label className="font-mono uppercase tracking-[0.15em]">{label}</label>
        <span className="font-mono">
          {value > 0 ? '+' : ''}
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-terracotta"
      />
    </div>
  );
}
