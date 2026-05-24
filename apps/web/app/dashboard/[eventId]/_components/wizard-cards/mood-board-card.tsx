'use client';

/**
 * WAVE 2 · Card 15 Set inspiration mood board · INSPIRATION INTAKE.
 *
 * Iteration 0010 Moodboard · pivot 2026-05-25 — owner directive:
 *   "what i like here is for the customer to paste in photo inspirations
 *    of how they want the wedding to look like."
 *
 * Anchored to:
 *   - CLAUDE.md 2026-05-21 row "Moodboard expanded · 3 pillars" — Palette /
 *     Location feel / Dress codes. This card is the INSPIRATION INTAKE
 *     layer that FEEDS palette (via per-photo extracted 6-color samples
 *     merged into events.role_palette.wizard_default).
 *   - CLAUDE.md 2026-05-24 row "V1 SCOPE EXPANSION · Moodboard becomes
 *     multi-source + stylist-finalized brain" — locks owner_kind ∈
 *     ('setnayan','stylist','couple') + Pinterest/Instagram URL paste +
 *     auto-extract 6-color palette + multi-source. This card ships the
 *     V1 couple-inspiration slice (URL paste + file upload); the broader
 *     stylist push-share + finalize-then-broadcast architecture lands
 *     V1.x post-pilot.
 *   - Iteration 0016 wizard contract — NO LINK to /add-ons/mood-board;
 *     inline completion only. Owner directive 2026-05-23 row 6
 *     (38-card wizard expansion): "each focus card is not a link but an
 *     actual card to complete the process."
 *
 * Two tabs at the top:
 *   A — Inspiration (default, NEW) — URL paste + drag-drop file upload.
 *       Each item shows thumbnail + extracted 6-color strip. Host can
 *       remove items. The combined active palette is built from the
 *       most-recent dominant colors across all active items.
 *   B — Curated palettes (existing) — 12 PH-wedding-canon palettes the
 *       host can pick as a fallback / second pass when they don't have
 *       inspiration on hand yet.
 *
 * Palette extraction is CLIENT-SIDE via Canvas API histogram bucketing —
 * no server-side image decode dependency. We draw the image at low
 * resolution (100×100), sample pixel buckets, pick the 6 most-populous
 * non-white/non-black buckets. Falls back to a neutral 6-color spread
 * if extraction returns <3 distinct colors (rare; happens on
 * monochrome images).
 *
 * Save advances the wizard past Card 15 to the next vendor-pick task per
 * the canonical sequence. The active palette gets written to
 * events.role_palette.wizard_default by the unchanged completeMoodBoardTask
 * server action.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  CheckCircle2,
  ImagePlus,
  Link2,
  Palette as PaletteIcon,
  Upload,
  X,
} from 'lucide-react';
import {
  addInspirationFromUpload,
  addInspirationFromUrl,
  completeMoodBoardTask,
  listEventInspiration,
  removeInspirationAsset,
} from '../../wizard-actions';

type Props = {
  eventId: string;
  /** Pre-populate from events.role_palette.reception when set · lets
   *  hosts re-edit if they opened the full /add-ons/mood-board surface
   *  first and want to round-trip through the wizard. */
  initialPalette: string[] | null;
};

type InspirationRow = {
  inspiration_id: string;
  image_url: string;
  source_kind: 'url_paste' | 'file_upload';
  sampled_hex_1: string;
  sampled_hex_2: string;
  sampled_hex_3: string;
  sampled_hex_4: string;
  sampled_hex_5: string;
  sampled_hex_6: string;
};

type CuratedPalette = {
  id: string;
  name: string;
  hint: string;
  /** 3-6 hex colors · dominant first. */
  colors: string[];
};

/**
 * 12 PH-wedding-canon palettes. First color = dominant · last 1-2 = accents.
 * Kept verbatim from the prior version of this card so hosts who don't have
 * inspiration on hand still get a tasteful fallback.
 */
const CURATED_PALETTES: ReadonlyArray<CuratedPalette> = [
  {
    id: 'bridgerton_burgundy',
    name: 'Bridgerton burgundy',
    hint: 'Deep wine, dusty rose, cream',
    colors: ['#7A1F2B', '#C29A9A', '#E8C8C0', '#FAF6F0', '#4F1019'],
  },
  {
    id: 'bohemian_sage',
    name: 'Bohemian sage',
    hint: 'Sage, terracotta, oat',
    colors: ['#8FA68E', '#C97B4B', '#D9C2A3', '#F5F0E8', '#5C7060'],
  },
  {
    id: 'capiz_garden',
    name: 'Capiz garden',
    hint: 'Pearl ivory, soft moss, blush',
    colors: ['#F5EBDC', '#A8B89B', '#E8C9C0', '#D4A574', '#3D4A38'],
  },
  {
    id: 'tagaytay_cream',
    name: 'Tagaytay cream',
    hint: 'Cream, fog grey, eucalyptus',
    colors: ['#FAF6F0', '#B8B5AC', '#9DAA9C', '#D9C9B0', '#5C5044'],
  },
  {
    id: 'modern_minimalist',
    name: 'Modern minimalist',
    hint: 'Ink, bone, soft terracotta',
    colors: ['#1A1A1A', '#F0EBE0', '#C97B4B', '#8C8378', '#FAF6F0'],
  },
  {
    id: 'tropical_heritage',
    name: 'Tropical heritage',
    hint: 'Banana leaf, mango, abaca',
    colors: ['#4A6B47', '#E8A547', '#D9C2A3', '#FAF6F0', '#2D4A3A'],
  },
  {
    id: 'filipiniana_terno',
    name: 'Filipiniana terno',
    hint: 'Maria Clara cream, sampaguita gold, ink',
    colors: ['#F5EBDC', '#D4A574', '#8C6D3F', '#1A1A1A', '#FAF6F0'],
  },
  {
    id: 'cebu_coast',
    name: 'Cebu coast',
    hint: 'Sand, sea glass, coral',
    colors: ['#E8DCC0', '#A8C0B8', '#E8A89A', '#FAF6F0', '#6B7F78'],
  },
  {
    id: 'sunset_pinks',
    name: 'Sunset pinks',
    hint: 'Blush, peach, dusty rose',
    colors: ['#F5D5C5', '#E8B098', '#D9A0A8', '#FAEDE5', '#B07868'],
  },
  {
    id: 'monochrome_classic',
    name: 'Monochrome classic',
    hint: 'Ivory, charcoal, gold',
    colors: ['#F5EFE5', '#1A1A1A', '#C9A66B', '#8C8378', '#FAF6F0'],
  },
  {
    id: 'lush_emerald',
    name: 'Lush emerald',
    hint: 'Emerald, gold, ivory',
    colors: ['#2D5A4A', '#C9A66B', '#F5EFE5', '#1F4038', '#E8DCC0'],
  },
  {
    id: 'royal_navy',
    name: 'Royal navy',
    hint: 'Navy, ivory, brass',
    colors: ['#1F2B47', '#F5EFE5', '#C9A66B', '#3D4A6B', '#D4C29A'],
  },
];

const DEFAULT_COLORS = ['#7A1F2B', '#C29A9A', '#E8C8C0', '#FAF6F0', '#4F1019', '#3D2017'];

/** Pad/truncate a color list to a 6-slot strip. Defaults missing slots
 *  to cream so the preview always shows 6 squares. */
function pad6(colors: string[]): string[] {
  const out = [...colors];
  while (out.length < 6) out.push('#FAF6F0');
  return out.slice(0, 6);
}

/**
 * Extract a 6-color palette from an HTMLImageElement via Canvas API.
 * Histogram bucketing: quantize each pixel to a 4-bit-per-channel bucket
 * (4096 cells), tally counts, sort, return the 6 most-populous buckets.
 *
 * Skips near-white (avg > 245) AND near-black (avg < 15) buckets unless
 * they're the only candidates. This matches what the host would describe
 * as their wedding palette — the dominant cream-vs-charcoal still
 * surfaces, but pure paper-white background pixels don't drown out a
 * Bridgerton burgundy that occupies only 15% of the frame.
 *
 * Returns 6 hex strings. Pads with cream when fewer distinct buckets
 * exist (very rare for real wedding inspiration imagery).
 */
function extractPaletteFromImage(img: HTMLImageElement): string[] {
  // 100×100 downsample keeps the work cheap on mobile while still
  // capturing the dominant palette. 10000 pixels is plenty for k-means-
  // style histogram bucketing.
  const SIZE = 100;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return pad6(DEFAULT_COLORS);

  try {
    ctx.drawImage(img, 0, 0, SIZE, SIZE);
  } catch {
    // CORS-tainted canvas (image from a domain that doesn't send the
    // anchor's CORS headers). The browser blocks getImageData. We can't
    // extract; fall back to cream-tone default and let the host pick
    // curated. Saving will still work — the URL persists; this is just
    // the palette extraction failing on a tainted source.
    return pad6(DEFAULT_COLORS);
  }

  let imageData: ImageData;
  try {
    imageData = ctx.getImageData(0, 0, SIZE, SIZE);
  } catch {
    return pad6(DEFAULT_COLORS);
  }

  const data = imageData.data;
  const buckets = new Map<number, { count: number; r: number; g: number; b: number }>();

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    const a = data[i + 3] ?? 255;
    if (a < 64) continue; // transparent pixel; skip

    // 4-bit-per-channel bucket key (4096 buckets total).
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const existing = buckets.get(key);
    if (existing) {
      existing.count += 1;
      existing.r += r;
      existing.g += g;
      existing.b += b;
    } else {
      buckets.set(key, { count: 1, r, g, b });
    }
  }

  // Average each bucket back to a representative color.
  const candidates: Array<{ count: number; hex: string; avg: number }> = [];
  for (const bucket of buckets.values()) {
    const r = Math.round(bucket.r / bucket.count);
    const g = Math.round(bucket.g / bucket.count);
    const b = Math.round(bucket.b / bucket.count);
    const avg = (r + g + b) / 3;
    const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
    candidates.push({ count: bucket.count, hex, avg });
  }

  // Sort by count desc; prefer mid-tone buckets first (avoid pure white
  // and pure black drowning the result), then fall back to all buckets
  // if we can't fill 6 slots with mid-tones.
  candidates.sort((a, b) => b.count - a.count);
  const midTones = candidates.filter((c) => c.avg > 15 && c.avg < 245);

  const picks: string[] = [];
  const seen = new Set<string>();
  for (const c of midTones) {
    if (seen.has(c.hex)) continue;
    picks.push(c.hex);
    seen.add(c.hex);
    if (picks.length >= 6) break;
  }
  // Fill remaining slots from the full candidate list (in case the image
  // is mostly white/black extremes — picks up any remaining tone).
  if (picks.length < 6) {
    for (const c of candidates) {
      if (seen.has(c.hex)) continue;
      picks.push(c.hex);
      seen.add(c.hex);
      if (picks.length >= 6) break;
    }
  }

  return pad6(picks.length > 0 ? picks : DEFAULT_COLORS);
}

/**
 * Load an image element from a URL or File, then run extractPaletteFromImage.
 * Returns the palette + a usable display URL (object URL for File, original
 * URL for paste).
 *
 * For URL paste we set crossOrigin='anonymous' so we can read pixel data
 * back. If the remote server doesn't send Access-Control-Allow-Origin,
 * the canvas becomes tainted and we fall back to the cream-tone default
 * — the host still successfully saves the inspiration with a "best
 * guess" palette they can adjust later via curated picks.
 */
async function loadImageAndExtract(
  source: string | File,
): Promise<{ palette: string[]; displayUrl: string }> {
  let displayUrl: string;
  if (typeof source === 'string') {
    displayUrl = source;
  } else {
    displayUrl = URL.createObjectURL(source);
  }

  const palette = await new Promise<string[]>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(extractPaletteFromImage(img));
    img.onerror = () => resolve(pad6(DEFAULT_COLORS));
    img.src = displayUrl;
  });

  return { palette, displayUrl };
}

/**
 * Compute the combined active palette from inspiration items + curated
 * pick. If the host has inspiration items, we use the dominant color
 * from each (slot 1) up to 6 items, padding with the curated dominant
 * for slots beyond what inspiration provides. If no inspiration, we use
 * the curated palette directly.
 */
function computeActivePalette(
  items: InspirationRow[],
  curatedColors: string[] | null,
): string[] {
  if (items.length === 0) {
    return pad6(curatedColors ?? DEFAULT_COLORS);
  }
  // Take the dominant color from each of the first 6 inspiration items.
  // For events with fewer than 6 inspiration items, pad with the secondary
  // colors of the latest item so the strip still shows 6 swatches.
  const picks: string[] = [];
  for (const item of items) {
    if (picks.length >= 6) break;
    picks.push(item.sampled_hex_1);
  }
  if (picks.length < 6 && items.length > 0) {
    const latest = items[0]!;
    const secondary = [
      latest.sampled_hex_2,
      latest.sampled_hex_3,
      latest.sampled_hex_4,
      latest.sampled_hex_5,
      latest.sampled_hex_6,
    ];
    for (const s of secondary) {
      if (picks.length >= 6) break;
      if (!picks.includes(s)) picks.push(s);
    }
  }
  return pad6(picks);
}

export function MoodBoardCard({ eventId, initialPalette }: Props) {
  const [tab, setTab] = useState<'inspiration' | 'curated'>('inspiration');

  // Inspiration tab state
  const [items, setItems] = useState<InspirationRow[]>([]);
  const [loadingItems, setLoadingItems] = useState<boolean>(true);
  const [pasteUrl, setPasteUrl] = useState<string>('');
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Curated tab state
  const initialCuratedId = useMemo(() => {
    if (!initialPalette || initialPalette.length === 0) return null;
    const match = CURATED_PALETTES.find(
      (p) =>
        p.colors.length === initialPalette.length &&
        p.colors.every(
          (c, i) => c.toUpperCase() === (initialPalette[i] ?? '').toUpperCase(),
        ),
    );
    return match?.id ?? null;
  }, [initialPalette]);

  const [selectedCuratedId, setSelectedCuratedId] = useState<string | null>(
    initialCuratedId,
  );

  // Save state
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Load existing inspiration items on mount.
  useEffect(() => {
    let cancelled = false;
    listEventInspiration(eventId)
      .then((rows) => {
        if (cancelled) return;
        setItems(rows);
        setLoadingItems(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadingItems(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const curatedColors = useMemo(() => {
    if (!selectedCuratedId) return null;
    return CURATED_PALETTES.find((p) => p.id === selectedCuratedId)?.colors ?? null;
  }, [selectedCuratedId]);

  const activePalette = useMemo(
    () => computeActivePalette(items, curatedColors),
    [items, curatedColors],
  );

  const handlePasteSubmit = useCallback(async () => {
    setPasteError(null);
    const url = pasteUrl.trim();
    if (!url) {
      setPasteError('Paste a photo URL to continue.');
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      setPasteError("That doesn't look like a URL. Try the full https://… address.");
      return;
    }
    setIsProcessing(true);
    try {
      const { palette } = await loadImageAndExtract(url);
      const formData = new FormData();
      formData.set('event_id', eventId);
      formData.set('image_url', url);
      formData.set('palette_json', JSON.stringify(palette));
      const res = await addInspirationFromUrl(formData);
      if (res.status !== 'ok' || !res.inspiration_id) {
        setPasteError(res.message ?? "Couldn't save that photo. Try a different URL.");
        return;
      }
      // Optimistic local insert so the UI reflects the new item immediately;
      // server has authoritative state via revalidatePath but we don't want
      // to round-trip a refetch on every add.
      setItems((prior) => [
        {
          inspiration_id: res.inspiration_id!,
          image_url: url,
          source_kind: 'url_paste',
          sampled_hex_1: palette[0]!,
          sampled_hex_2: palette[1]!,
          sampled_hex_3: palette[2]!,
          sampled_hex_4: palette[3]!,
          sampled_hex_5: palette[4]!,
          sampled_hex_6: palette[5]!,
        },
        ...prior,
      ]);
      setPasteUrl('');
    } catch {
      setPasteError("Couldn't load that photo — try a direct image URL (right-click → Copy Image Address).");
    } finally {
      setIsProcessing(false);
    }
  }, [eventId, pasteUrl]);

  const handleFileUpload = useCallback(
    async (file: File) => {
      setPasteError(null);
      if (!file.type.startsWith('image/')) {
        setPasteError('Pick an image file (PNG, JPEG, WebP).');
        return;
      }
      const FIVE_MB = 5 * 1024 * 1024;
      if (file.size > FIVE_MB) {
        setPasteError("That photo is over 5 MB — try a smaller one.");
        return;
      }
      setIsProcessing(true);
      try {
        const { palette, displayUrl } = await loadImageAndExtract(file);
        const formData = new FormData();
        formData.set('event_id', eventId);
        formData.set('file', file);
        formData.set('palette_json', JSON.stringify(palette));
        const res = await addInspirationFromUpload(formData);
        if (res.status !== 'ok' || !res.inspiration_id) {
          setPasteError(res.message ?? "Couldn't save that upload. Try again.");
          return;
        }
        setItems((prior) => [
          {
            inspiration_id: res.inspiration_id!,
            image_url: displayUrl,
            source_kind: 'file_upload',
            sampled_hex_1: palette[0]!,
            sampled_hex_2: palette[1]!,
            sampled_hex_3: palette[2]!,
            sampled_hex_4: palette[3]!,
            sampled_hex_5: palette[4]!,
            sampled_hex_6: palette[5]!,
          },
          ...prior,
        ]);
      } catch {
        setPasteError("Upload failed — try again.");
      } finally {
        setIsProcessing(false);
      }
    },
    [eventId],
  );

  const handleRemove = useCallback(
    async (inspirationId: string) => {
      const formData = new FormData();
      formData.set('event_id', eventId);
      formData.set('inspiration_id', inspirationId);
      const res = await removeInspirationAsset(formData);
      if (res.status === 'ok') {
        setItems((prior) => prior.filter((i) => i.inspiration_id !== inspirationId));
      }
    },
    [eventId],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFileUpload(file);
    },
    [handleFileUpload],
  );

  const handleSave = useCallback(() => {
    setErrorMessage(null);
    const formData = new FormData();
    formData.set('event_id', eventId);
    formData.set('palette_json', JSON.stringify(activePalette));
    // Tag the source so downstream copy ("from your inspiration", "Bridgerton
    // burgundy") can read it. inspiration-derived palettes don't have a
    // single canonical name; pass the curated name when curated is active.
    if (items.length === 0 && selectedCuratedId) {
      const pal = CURATED_PALETTES.find((p) => p.id === selectedCuratedId);
      if (pal?.name) formData.set('palette_name', pal.name);
    } else if (items.length > 0) {
      formData.set('palette_name', 'From your inspiration');
    }
    startTransition(async () => {
      try {
        await completeMoodBoardTask(formData);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Couldn't save your palette. Try again.";
        setErrorMessage(message);
      }
    });
  }, [eventId, activePalette, items.length, selectedCuratedId]);

  return (
    <div className="space-y-5">
      {/* Tab toggle · Inspiration (default) vs Curated palettes */}
      <div className="inline-flex items-center gap-1 rounded-full border border-ink/10 bg-cream/60 p-1">
        <button
          type="button"
          onClick={() => setTab('inspiration')}
          className={`rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] transition-colors ${
            tab === 'inspiration'
              ? 'bg-terracotta text-cream'
              : 'text-ink/55 hover:text-ink'
          }`}
        >
          Inspiration
        </button>
        <button
          type="button"
          onClick={() => setTab('curated')}
          className={`rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] transition-colors ${
            tab === 'curated'
              ? 'bg-terracotta text-cream'
              : 'text-ink/55 hover:text-ink'
          }`}
        >
          Curated palettes
        </button>
      </div>

      {tab === 'inspiration' ? (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-ink/70">
            Paste photo links or drop in pictures of weddings, rooms, or
            moods you love. We&apos;ll pull the colors from each photo so
            your palette becomes a reflection of what actually inspires you.
          </p>

          {/* URL paste row */}
          <div className="space-y-2">
            <label
              htmlFor="inspiration-url"
              className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/60"
            >
              <Link2 aria-hidden className="h-3 w-3" strokeWidth={2} />
              Paste a photo link
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="inspiration-url"
                type="url"
                value={pasteUrl}
                onChange={(e) => setPasteUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handlePasteSubmit();
                  }
                }}
                placeholder="https://www.pinterest.com/pin/… or https://instagram.com/…"
                className="flex-1 rounded-lg border border-ink/15 bg-cream px-3 py-2 text-sm text-ink placeholder:text-ink/35 focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30"
                disabled={isProcessing}
              />
              <button
                type="button"
                onClick={handlePasteSubmit}
                disabled={isProcessing || pasteUrl.trim().length === 0}
                className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-terracotta px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-terracotta-700 focus:outline-none focus:ring-2 focus:ring-terracotta focus:ring-offset-2 focus:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isProcessing ? 'Reading…' : 'Add to board'}
              </button>
            </div>
            <p className="text-xs leading-relaxed text-ink/50">
              For best results, right-click the photo on Pinterest or
              Instagram and choose <em>Copy Image Address</em> — that
              gives us the direct image URL we can sample.
            </p>
          </div>

          {/* Upload zone (drag-drop + click) */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
              isDragging
                ? 'border-terracotta bg-terracotta/5'
                : 'border-ink/20 bg-cream/40 hover:border-ink/35'
            }`}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            aria-label="Upload an inspiration photo"
          >
            <Upload aria-hidden className="h-5 w-5 text-ink/55" strokeWidth={2} />
            <p className="text-sm font-semibold text-ink">
              Or drop a photo here
            </p>
            <p className="text-xs leading-relaxed text-ink/50">
              PNG, JPEG, or WebP — up to 5 MB.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
                // Reset so picking the same file twice still fires onChange.
                e.target.value = '';
              }}
              disabled={isProcessing}
            />
          </div>

          {pasteError ? (
            <p
              role="alert"
              className="rounded-md border border-rose-300/60 bg-rose-50 px-3 py-2 text-sm text-rose-800"
            >
              {pasteError}
            </p>
          ) : null}

          {/* Inspiration grid */}
          <div className="space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/60">
              Your inspiration ({items.length})
            </p>
            {loadingItems ? (
              <p className="text-sm text-ink/50">Loading your board…</p>
            ) : items.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg border border-dashed border-ink/15 bg-cream/40 px-4 py-6 text-sm text-ink/55">
                <ImagePlus aria-hidden className="h-4 w-4" strokeWidth={2} />
                <span>
                  Nothing pasted yet — add a photo above and your palette
                  builds from it.
                </span>
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {items.map((item) => {
                  const palette = [
                    item.sampled_hex_1,
                    item.sampled_hex_2,
                    item.sampled_hex_3,
                    item.sampled_hex_4,
                    item.sampled_hex_5,
                    item.sampled_hex_6,
                  ];
                  return (
                    <li
                      key={item.inspiration_id}
                      className="overflow-hidden rounded-xl border border-ink/10 bg-cream"
                    >
                      <div className="relative aspect-[4/3] w-full bg-ink/5">
                        {/* Plain img — inspiration URLs come from arbitrary
                            third-party hosts (Pinterest, Instagram CDNs);
                            next/image would require allowing every possible
                            remote pattern. Plain img keeps it simple +
                            still respects width/height via object-cover. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.image_url}
                          alt="Inspiration"
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemove(item.inspiration_id)}
                          aria-label="Remove this inspiration"
                          className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-ink/70 text-cream backdrop-blur-sm transition-colors hover:bg-ink"
                        >
                          <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                        </button>
                      </div>
                      <div className="flex h-6 w-full">
                        {palette.map((hex, idx) => (
                          <span
                            key={`${item.inspiration_id}-${idx}`}
                            aria-hidden
                            className="flex-1"
                            style={{ backgroundColor: hex }}
                          />
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <fieldset className="space-y-3">
          <legend className="sr-only">Pick a curated palette</legend>
          <p className="text-sm leading-relaxed text-ink/70">
            Pick one of these to start with — you can refine it from the
            Mood Board surface anytime.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {CURATED_PALETTES.map((palette) => {
              const isSelected = selectedCuratedId === palette.id;
              return (
                <button
                  key={palette.id}
                  type="button"
                  onClick={() =>
                    setSelectedCuratedId(isSelected ? null : palette.id)
                  }
                  aria-pressed={isSelected}
                  className={`flex flex-col gap-2 rounded-xl border-2 bg-cream p-3 text-left transition-colors ${
                    isSelected
                      ? 'border-terracotta'
                      : 'border-ink/10 hover:border-ink/25'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-ink">
                      {palette.name}
                    </p>
                    {isSelected ? (
                      <CheckCircle2
                        aria-hidden
                        className="h-4 w-4 text-terracotta"
                        strokeWidth={2}
                      />
                    ) : null}
                  </div>
                  <div className="flex h-6 w-full overflow-hidden rounded-md border border-ink/5">
                    {palette.colors.map((color, idx) => (
                      <span
                        key={`${palette.id}-${idx}`}
                        aria-hidden
                        className="flex-1"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <p className="text-xs leading-relaxed text-ink/55">
                    {palette.hint}
                  </p>
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {/* Live preview of the active palette · always rendered so the host
          sees what gets saved before clicking Save. */}
      <div className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/60">
          Your palette
        </p>
        <div className="flex h-10 w-full overflow-hidden rounded-lg border border-ink/10">
          {activePalette.map((color, idx) => (
            <span
              key={`preview-${idx}-${color}`}
              aria-hidden
              className="flex-1"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <p className="text-xs leading-relaxed text-ink/50">
          {items.length > 0
            ? `Pulled from your ${items.length} inspiration photo${items.length === 1 ? '' : 's'}.`
            : selectedCuratedId
              ? 'From the curated palette you picked above.'
              : 'Add inspiration or pick a curated palette to start.'}
        </p>
      </div>

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-md border border-rose-300/60 bg-rose-50 px-3 py-2 text-sm text-rose-800"
        >
          {errorMessage}
        </p>
      ) : null}

      <div>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || (items.length === 0 && !selectedCuratedId)}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-terracotta px-5 py-3 text-sm font-semibold text-cream transition-colors hover:bg-terracotta-700 focus:outline-none focus:ring-2 focus:ring-terracotta focus:ring-offset-2 focus:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? (
            'Saving…'
          ) : (
            <>
              <PaletteIcon aria-hidden className="h-4 w-4" strokeWidth={2} />
              Save palette
            </>
          )}
        </button>
      </div>

      <p className="text-xs leading-relaxed text-ink/55">
        You can refine per-role palettes (bride, groom, sponsors) anytime
        from your Mood Board surface — this is your headline palette.
      </p>
    </div>
  );
}
