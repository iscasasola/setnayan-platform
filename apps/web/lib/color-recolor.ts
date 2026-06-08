/**
 * Color-recolor engine — shared by the admin Color Range Manipulator
 * (app/admin/moodboard-library) and the couple-facing Recolor Studio
 * (app/dashboard/[eventId]/add-ons/mood-board).
 *
 * Pure + DOM-free so it is unit-testable and runs identically in either
 * component. The browser components own the Canvas plumbing; this module owns
 * the math: RGB↔HSL conversion, perceptual color matching, and the two recolor
 * modes a region can take —
 *
 *   • `palette` — snap the region to one of the couple's palette colors
 *                 (swap hue to target, keep source lightness, lift saturation).
 *                 This is the original Color Range Manipulator behavior, moved
 *                 here verbatim so admin tagging output is unchanged.
 *   • `adjust`  — free HSL manipulation: hue shift, saturation, brightness,
 *                 contrast (the owner's "alter hue / contrast / brightness"
 *                 request, 2026-06-08). Operates on the matched region only,
 *                 preserving texture + shading by working in HSL.
 *
 * Region matching reuses a weighted-RGB Euclidean distance as a fast ΔE proxy
 * (same as the legacy manipulator) so a pixel is recolored only when it falls
 * within a tagged slot's tolerance.
 */

// ---- types ----

export type ColorRangeSlot = {
  slotId: number; // 1-6
  sampledHex: string; // '#rrggbb'
  toleranceDe: number; // 5-30 (ΔE-ish)
  regionLabel?: string;
};

/** Per-asset tag map keyed by slotId (persisted in moodboard_asset_color_ranges). */
export type ColorRangeMap = Record<number, ColorRangeSlot>;

/** Legacy admin preview shape: slotId → target hex (palette snap only). */
export type PalettePreview = Record<number, string>;

/**
 * A single region's recolor instruction. `palette` snaps to a target color;
 * `adjust` applies free HSL deltas. Persisted per slot inside
 * event_moodboard_saves.palette_snapshot.
 */
export type RegionEdit =
  | { mode: 'palette'; hex: string }
  | {
      mode: 'adjust';
      /** Hue shift in degrees, -180..180. */
      h: number;
      /** Saturation adjust as a percentage, -100..100 (factor 1 + s/100). */
      s: number;
      /** Brightness/lightness offset, -100..100 (added to L in 0..1 scale). */
      l: number;
      /** Contrast around mid-gray, -100..100 (factor 1 + c/100). */
      c: number;
    };

/** Map of slotId → the edit the couple applied to that region. */
export type RegionEditMap = Record<number, RegionEdit>;

// ---- conversions ----

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
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

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
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
// converting every pixel to LAB. Result is roughly 0-100, comparable to ΔE.
export function colorDistance(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number,
): number {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  // Perceptual weighting (rough): R 0.30, G 0.59, B 0.11
  return Math.sqrt(0.3 * dr * dr + 0.59 * dg * dg + 0.11 * db * db) / 2.55;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

// ---- recolor ----

/**
 * Recolor a single pixel given the edit that applies to its region.
 * Returns the new [r,g,b]. Pure; used both per-pixel by recolorRGBA and
 * for single-swatch previews.
 */
export function recolorPixel(
  r: number,
  g: number,
  b: number,
  edit: RegionEdit,
): [number, number, number] {
  const [h, s, l] = rgbToHsl(r, g, b);

  if (edit.mode === 'palette') {
    // Original Color Range Manipulator behavior: keep source lightness, swap
    // hue to the target, and use the TARGET's saturation (floored at 0.4) so
    // the recolor reads as "intentional" rather than washed-out.
    const [tr, tg, tb] = hexToRgb(edit.hex);
    const [th, ts] = rgbToHsl(tr, tg, tb);
    return hslToRgb(th, Math.max(ts, 0.4), l);
  }

  // adjust mode — free HSL manipulation on the matched region.
  const nh = (((h + edit.h / 360) % 1) + 1) % 1;
  const ns = clamp01(s * (1 + edit.s / 100));
  let nl = clamp01(l + edit.l / 100);
  // Contrast pivots around mid-gray (0.5). factor > 1 boosts, < 1 flattens.
  const cf = 1 + edit.c / 100;
  nl = clamp01((nl - 0.5) * cf + 0.5);
  return hslToRgb(nh, ns, nl);
}

/** True when an adjust edit is a no-op (all sliders at zero). */
export function isIdentityEdit(edit: RegionEdit | undefined): boolean {
  if (!edit) return true;
  if (edit.mode === 'palette') return false;
  return edit.h === 0 && edit.s === 0 && edit.l === 0 && edit.c === 0;
}

/**
 * Recolor an RGBA pixel buffer in place of the source, returning a NEW buffer.
 *
 * For each pixel: find the closest tagged slot within its tolerance; if that
 * slot has an edit, apply it. Pixels matching no slot (or a slot with no edit)
 * pass through untouched. Mirrors the legacy manipulator's best-slot-wins loop.
 *
 * @param src    source RGBA bytes (length = width*height*4)
 * @param slots  tagged color ranges for the asset
 * @param edits  slotId → edit; omit a slot to leave its region as-is
 */
export function recolorRGBA(
  src: Uint8ClampedArray,
  slots: ColorRangeSlot[],
  edits: RegionEditMap,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(src);
  if (slots.length === 0) return out;

  for (let i = 0; i < src.length; i += 4) {
    const r = src[i]!;
    const g = src[i + 1]!;
    const b = src[i + 2]!;

    let bestSlot: ColorRangeSlot | null = null;
    let bestDist = Infinity;
    for (const slot of slots) {
      const [tr, tg, tb] = hexToRgb(slot.sampledHex);
      const d = colorDistance(r, g, b, tr, tg, tb);
      if (d <= slot.toleranceDe && d < bestDist) {
        bestSlot = slot;
        bestDist = d;
      }
    }

    if (bestSlot) {
      const edit = edits[bestSlot.slotId];
      if (edit && !isIdentityEdit(edit)) {
        const [nr, ng, nb] = recolorPixel(r, g, b, edit);
        out[i] = nr;
        out[i + 1] = ng;
        out[i + 2] = nb;
      }
    }
  }
  return out;
}

/**
 * Build a translucent yellow highlight mask over pixels matching `targetHex`
 * within `tolerance`. Returns RGBA bytes + the matched-pixel count. Used by the
 * region-selection UI so the couple/admin sees exactly which pixels a region
 * covers before recoloring.
 */
export function buildMatchMask(
  src: Uint8ClampedArray,
  targetHex: string,
  tolerance: number,
): { mask: Uint8ClampedArray; matched: number } {
  const [tr, tg, tb] = hexToRgb(targetHex);
  const mask = new Uint8ClampedArray(src.length);
  let matched = 0;
  for (let i = 0; i < src.length; i += 4) {
    const d = colorDistance(src[i]!, src[i + 1]!, src[i + 2]!, tr, tg, tb);
    if (d <= tolerance) {
      mask[i] = 255;
      mask[i + 1] = 240;
      mask[i + 2] = 0;
      mask[i + 3] = 110;
      matched++;
    }
  }
  return { mask, matched };
}

/**
 * Convert a legacy PalettePreview (slotId → hex) into a RegionEditMap of
 * palette-mode edits. Lets the admin tagger's "Preview with palette" path
 * reuse recolorRGBA without changing its call sites' data shape.
 */
export function palettePreviewToEdits(preview: PalettePreview): RegionEditMap {
  const out: RegionEditMap = {};
  for (const [slotId, hex] of Object.entries(preview)) {
    if (hex) out[Number(slotId)] = { mode: 'palette', hex };
  }
  return out;
}

// ---- persistence (event_moodboard_saves.palette_snapshot) ----

/** A region's definition (sampled color + tolerance) stored alongside its edit. */
export type RegionDef = { hex: string; tol: number };

/** One persisted region: its definition + the edit applied to it. */
export type SavedRegion = { def: RegionDef; edit: RegionEdit };

/**
 * The shape stored in event_moodboard_saves.palette_snapshot (JSONB), keyed by
 * slotId. Self-describing — carries each region's definition so a pinned look
 * re-renders identically even if the asset's library tags later change.
 *
 * Backward-compatible read: a legacy value of plain `"#RRGGBB"` (the pre-redesign
 * slot→hex shape) is interpreted as a palette snap, with the region definition
 * recovered from the asset's current color ranges.
 */
export type MoodboardSnapshot = Record<string, SavedRegion>;

const HEX6 = /^#[0-9a-fA-F]{6}$/;

/** Build the persisted snapshot from the active slots + the couple's edits. */
export function buildSnapshot(
  slots: ColorRangeMap,
  edits: RegionEditMap,
): MoodboardSnapshot {
  const out: MoodboardSnapshot = {};
  for (const [slotIdStr, edit] of Object.entries(edits)) {
    const slotId = Number(slotIdStr);
    if (isIdentityEdit(edit)) continue;
    const slot = slots[slotId];
    if (!slot) continue;
    out[slotIdStr] = {
      def: { hex: slot.sampledHex, tol: slot.toleranceDe },
      edit,
    };
  }
  return out;
}

/**
 * Parse a stored palette_snapshot (new SavedRegion map OR legacy slot→hex)
 * back into the slots[] + edits the Recolor Studio needs to re-render.
 *
 * @param raw          the JSONB value from the DB
 * @param assetRanges  the asset's current color ranges — used only to recover
 *                     region defs for legacy string-hex entries.
 */
export function parseSnapshot(
  raw: unknown,
  assetRanges: ColorRangeMap = {},
): { slots: ColorRangeSlot[]; edits: RegionEditMap } {
  const slots: ColorRangeSlot[] = [];
  const edits: RegionEditMap = {};
  if (typeof raw !== 'object' || raw === null) return { slots, edits };

  for (const [slotIdStr, value] of Object.entries(raw as Record<string, unknown>)) {
    const slotId = Number(slotIdStr);
    if (!Number.isFinite(slotId)) continue;

    if (typeof value === 'string') {
      // Legacy { slot: "#hex" } → palette snap. Recover def from live tags.
      if (!HEX6.test(value)) continue;
      const range = assetRanges[slotId];
      const def: RegionDef = range
        ? { hex: range.sampledHex, tol: range.toleranceDe }
        : { hex: value, tol: 15 };
      slots.push({ slotId, sampledHex: def.hex, toleranceDe: def.tol });
      edits[slotId] = { mode: 'palette', hex: value };
      continue;
    }

    if (typeof value === 'object' && value !== null) {
      const v = value as Partial<SavedRegion>;
      if (!v.def || !v.edit) continue;
      slots.push({
        slotId,
        sampledHex: v.def.hex,
        toleranceDe: v.def.tol,
      });
      edits[slotId] = v.edit;
    }
  }
  return { slots, edits };
}
