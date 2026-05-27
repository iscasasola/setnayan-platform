'use client';

/**
 * WAVE 2 · Card 15 Set your inspiration mood board · 13-SLOT UPLOAD.
 *
 * Iteration 0010 Moodboard · owner directive 2026-05-25 verbatim:
 *   "Make the upload. you keep deferring this We want upload photo.
 *    no url. just upload up to photos 2 for each."
 *
 * 13 named slots × 2 photos each = 26 upload tiles total, mapped to the
 * locked 3 mood-board pillars (CLAUDE.md 2026-05-21 row "Moodboard
 * expanded · 3 pillars"):
 *
 *   Location feel (6): Venue · Tunnel · Stage · Table · Ceiling · Overall
 *   Palette       (1): Palette
 *   Dress codes   (6): Groom · Bride · Principal Sponsor · Entourage ·
 *                       Parents · Guests
 *
 * SUPERSEDES PR #543's URL-paste + free-form upload UX. The Curated
 * palettes tab from PR #543 is retired — curated picks live in the
 * post-pilot /add-ons/mood-board surface, not the wizard card.
 *
 * Each tile:
 *   - Empty: dashed border + cloud-upload icon + "Drop a photo or click
 *     to choose" microcopy. Drag-drop + click-to-pick both wired.
 *   - Uploaded: photo at object-cover with hover overlay + X remove button.
 *
 * Auto-save behavior:
 *   - Each upload auto-saves on completion (no global Save button).
 *   - Removal auto-saves.
 *   - First successful upload across any slot promotes wizard task to
 *     in_flight (server-side).
 *   - "Finish mood board" button at bottom settles task to done.
 *
 * Palette extraction (Canvas API histogram bucketing) runs client-side
 * for every upload. The palette extracted from the dedicated Palette
 * slot is auto-saved to events.role_palette.wizard_default at upload
 * time so downstream cards (Save-the-Date, Invitation widgets, Paprint)
 * consume the host's chosen palette without an explicit finalize step.
 *
 * Anchored to:
 *   - CLAUDE.md 2026-05-25 row "Mood Board · 13-slot upload UX
 *     (supersedes PR #543)" — this row.
 *   - CLAUDE.md 2026-05-21 row "Moodboard expanded · 3 pillars" —
 *     canonical 3-pillar lock; 13 slots map cleanly onto it.
 *   - CLAUDE.md 2026-05-24 row "V1 SCOPE EXPANSION · Moodboard becomes
 *     multi-source + stylist-finalized brain" — broader owner_kind
 *     architecture (stylist push-share, finalize-then-broadcast) lands
 *     V1.x post-pilot; this card ships the V1 couple-inspiration slice.
 *   - Iteration 0016 wizard contract — NO LINK out; inline completion only.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import {
  CheckCircle2,
  CloudUpload,
  Loader2,
  Palette as PaletteIcon,
  X,
} from 'lucide-react';
import {
  finalizeMoodboard,
  listMoodboardSlots,
  removeMoodboardSlot,
  uploadMoodboardSlot,
} from '../../wizard-actions';

type Props = {
  eventId: string;
  /** Pre-populate hint when wizard re-enters card 15 — not strictly
   *  consumed by the slot UI but kept on the interface so the dispatcher
   *  call site (wizard-hero.tsx) stays unchanged. */
  initialPalette: string[] | null;
};

// -----------------------------------------------------------------------
// Slot taxonomy — the 13 owner-locked slot keys grouped into 3 pillars.
// Order matches the owner's directive verbatim. Slot labels use the
// owner's exact wording.
// -----------------------------------------------------------------------

type SlotKey =
  | 'venue'
  | 'tunnel'
  | 'stage'
  | 'table'
  | 'ceiling'
  | 'overall'
  | 'palette'
  | 'groom'
  | 'bride'
  | 'principal_sponsor'
  | 'entourage'
  | 'parents'
  | 'guests';

type PillarId = 'location_feel' | 'palette' | 'dress_codes';

const PILLARS: Array<{
  id: PillarId;
  label: string;
  hint: string;
  slots: Array<{ key: SlotKey; label: string }>;
}> = [
  {
    id: 'location_feel',
    label: 'Location feel',
    hint: 'How the spaces look + the moments inside them.',
    slots: [
      { key: 'venue', label: 'Venue' },
      { key: 'tunnel', label: 'Tunnel' },
      { key: 'stage', label: 'Stage' },
      { key: 'table', label: 'Table' },
      { key: 'ceiling', label: 'Ceiling' },
      { key: 'overall', label: 'Overall' },
    ],
  },
  {
    id: 'palette',
    label: 'Palette',
    hint: 'The 6 colors that anchor every other decision. We extract the palette automatically from the photo you drop here.',
    slots: [{ key: 'palette', label: 'Palette' }],
  },
  {
    id: 'dress_codes',
    label: 'Dress codes',
    hint: 'What every role wears on the day.',
    slots: [
      { key: 'groom', label: 'Groom' },
      { key: 'bride', label: 'Bride' },
      { key: 'principal_sponsor', label: 'Principal Sponsor' },
      { key: 'entourage', label: 'Entourage' },
      { key: 'parents', label: 'Parents' },
      { key: 'guests', label: 'Guests' },
    ],
  },
];

// -----------------------------------------------------------------------
// Canvas-API palette extractor — copied from PR #543 mood-board-card
// (the helper kept its quality bar so we preserve the shape verbatim).
// Returns 6 hex strings; pads with cream tones when the image has fewer
// distinct colors (rare on real wedding inspiration imagery).
// -----------------------------------------------------------------------

const DEFAULT_COLORS = [
  '#F8F1E7',
  '#E2D5C0',
  '#C9A87C',
  '#9B7A4F',
  '#5C3A1E',
  '#2B1810',
];

function pad6(values: string[]): string[] {
  const out: string[] = values.slice(0, 6);
  let i = 0;
  while (out.length < 6) {
    out.push(DEFAULT_COLORS[i % DEFAULT_COLORS.length]!);
    i += 1;
  }
  return out.map((v) => v.toUpperCase());
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

function extractPaletteFromImage(img: HTMLImageElement): string[] {
  const SIZE = 100;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return pad6(DEFAULT_COLORS);
  try {
    ctx.drawImage(img, 0, 0, SIZE, SIZE);
  } catch {
    // Cross-origin taint or other draw failure — return default.
    return pad6(DEFAULT_COLORS);
  }
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, SIZE, SIZE).data;
  } catch {
    return pad6(DEFAULT_COLORS);
  }

  // Bucket pixels into 16-step-per-channel cubes. 16^3 = 4096 buckets;
  // walk all pixels, count per bucket, return the top 6 distinct buckets
  // (skipping near-white and near-black so the dominant cream/charcoal
  // backgrounds don't drown out the real palette).
  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const a = data[i + 3]!;
    if (a < 128) continue;
    if (r > 240 && g > 240 && b > 240) continue;
    if (r < 20 && g < 20 && b < 20) continue;
    const key = `${(r >> 4) << 4}|${(g >> 4) << 4}|${(b >> 4) << 4}`;
    const prior = buckets.get(key);
    if (prior) {
      prior.count += 1;
      prior.r += r;
      prior.g += g;
      prior.b += b;
    } else {
      buckets.set(key, { count: 1, r, g, b });
    }
  }

  const sorted = [...buckets.values()].sort((a, b) => b.count - a.count);
  const picks: string[] = [];
  for (const bucket of sorted) {
    if (picks.length >= 6) break;
    const hex = rgbToHex(
      bucket.r / bucket.count,
      bucket.g / bucket.count,
      bucket.b / bucket.count,
    );
    picks.push(hex);
  }
  return pad6(picks.length > 0 ? picks : DEFAULT_COLORS);
}

async function extractPaletteFromFile(file: File): Promise<string[]> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const palette = extractPaletteFromImage(img);
      URL.revokeObjectURL(url);
      resolve(palette);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(pad6(DEFAULT_COLORS));
    };
    img.src = url;
  });
}

// -----------------------------------------------------------------------
// Slot state — one entry per (slot_key, slot_position). Tile state is
// either 'empty' or { image_url, hex[6] } (loaded from server) or
// 'uploading' (transient during in-flight upload).
// -----------------------------------------------------------------------

type TileState =
  | { kind: 'empty' }
  | { kind: 'uploading' }
  | {
      kind: 'filled';
      inspiration_id: string;
      image_url: string;
      palette: string[];
    };

type SlotStateMap = Record<SlotKey, [TileState, TileState]>;

function emptySlotMap(): SlotStateMap {
  return {
    venue: [{ kind: 'empty' }, { kind: 'empty' }],
    tunnel: [{ kind: 'empty' }, { kind: 'empty' }],
    stage: [{ kind: 'empty' }, { kind: 'empty' }],
    table: [{ kind: 'empty' }, { kind: 'empty' }],
    ceiling: [{ kind: 'empty' }, { kind: 'empty' }],
    overall: [{ kind: 'empty' }, { kind: 'empty' }],
    palette: [{ kind: 'empty' }, { kind: 'empty' }],
    groom: [{ kind: 'empty' }, { kind: 'empty' }],
    bride: [{ kind: 'empty' }, { kind: 'empty' }],
    principal_sponsor: [{ kind: 'empty' }, { kind: 'empty' }],
    entourage: [{ kind: 'empty' }, { kind: 'empty' }],
    parents: [{ kind: 'empty' }, { kind: 'empty' }],
    guests: [{ kind: 'empty' }, { kind: 'empty' }],
  };
}

const ALL_SLOT_KEYS: SlotKey[] = [
  'venue',
  'tunnel',
  'stage',
  'table',
  'ceiling',
  'overall',
  'palette',
  'groom',
  'bride',
  'principal_sponsor',
  'entourage',
  'parents',
  'guests',
];

// -----------------------------------------------------------------------
// Card component
// -----------------------------------------------------------------------

export function MoodBoardCard({ eventId, initialPalette: _initialPalette }: Props) {
  const [slots, setSlots] = useState<SlotStateMap>(() => emptySlotMap());
  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isFinishing, startFinishTransition] = useTransition();

  // Hydrate slot state from server on mount.
  useEffect(() => {
    let cancelled = false;
    listMoodboardSlots(eventId)
      .then((rows) => {
        if (cancelled) return;
        const next = emptySlotMap();
        for (const row of rows) {
          if (!(row.slot_key in next)) continue;
          if (row.slot_position !== 1 && row.slot_position !== 2) continue;
          const idx = row.slot_position - 1;
          next[row.slot_key as SlotKey][idx] = {
            kind: 'filled',
            inspiration_id: row.inspiration_id,
            image_url: row.image_url,
            palette: [
              row.sampled_hex_1,
              row.sampled_hex_2,
              row.sampled_hex_3,
              row.sampled_hex_4,
              row.sampled_hex_5,
              row.sampled_hex_6,
            ],
          };
        }
        setSlots(next);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const updateTile = useCallback(
    (slotKey: SlotKey, position: 1 | 2, next: TileState) => {
      setSlots((prior) => {
        const cloned: SlotStateMap = { ...prior };
        const tiles = [...prior[slotKey]] as [TileState, TileState];
        tiles[position - 1] = next;
        cloned[slotKey] = tiles;
        return cloned;
      });
    },
    [],
  );

  const handleUpload = useCallback(
    async (slotKey: SlotKey, position: 1 | 2, file: File) => {
      setGlobalError(null);

      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        setGlobalError('Use a PNG, JPG, or WebP photo.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setGlobalError('Photo must be 5MB or smaller.');
        return;
      }

      updateTile(slotKey, position, { kind: 'uploading' });

      try {
        const palette = await extractPaletteFromFile(file);
        const formData = new FormData();
        formData.set('event_id', eventId);
        formData.set('slot_key', slotKey);
        formData.set('slot_position', String(position));
        formData.set('palette_json', JSON.stringify(palette));
        formData.set('file', file);

        const res = await uploadMoodboardSlot(formData);
        if (res.status !== 'ok' || !res.inspiration_id || !res.image_url) {
          setGlobalError(res.message ?? 'Upload failed — try again.');
          updateTile(slotKey, position, { kind: 'empty' });
          return;
        }
        updateTile(slotKey, position, {
          kind: 'filled',
          inspiration_id: res.inspiration_id,
          image_url: res.image_url,
          palette: res.palette ?? palette,
        });
      } catch (err) {
        setGlobalError(
          err instanceof Error ? err.message : 'Upload failed — try again.',
        );
        updateTile(slotKey, position, { kind: 'empty' });
      }
    },
    [eventId, updateTile],
  );

  const handleRemove = useCallback(
    async (slotKey: SlotKey, position: 1 | 2) => {
      setGlobalError(null);
      const priorTile: TileState =
        slots[slotKey][position - 1] ?? { kind: 'empty' };
      // Optimistic UI flip back to empty.
      updateTile(slotKey, position, { kind: 'empty' });
      try {
        const formData = new FormData();
        formData.set('event_id', eventId);
        formData.set('slot_key', slotKey);
        formData.set('slot_position', String(position));
        const res = await removeMoodboardSlot(formData);
        if (res.status !== 'ok') {
          setGlobalError(res.message ?? 'Remove failed — try again.');
          // Roll back the optimistic flip so the tile reappears.
          updateTile(slotKey, position, priorTile);
        }
      } catch (err) {
        setGlobalError(
          err instanceof Error ? err.message : 'Remove failed — try again.',
        );
        updateTile(slotKey, position, priorTile);
      }
    },
    [eventId, slots, updateTile],
  );

  const totalFilled = useMemo(() => {
    let n = 0;
    for (const key of ALL_SLOT_KEYS) {
      for (const tile of slots[key]) {
        if (tile.kind === 'filled') n += 1;
      }
    }
    return n;
  }, [slots]);

  const handleFinish = useCallback(() => {
    if (totalFilled === 0) {
      setGlobalError('Upload at least one photo before finishing.');
      return;
    }
    setGlobalError(null);
    startFinishTransition(async () => {
      try {
        const formData = new FormData();
        formData.set('event_id', eventId);
        await finalizeMoodboard(formData);
      } catch (err) {
        setGlobalError(
          err instanceof Error ? err.message : 'Could not save — try again.',
        );
      }
    });
  }, [eventId, totalFilled]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">
          Set your inspiration mood board
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-ink-muted">
          Upload up to 2 reference photos for each section. The look you upload
          here drives your palette, your stylist&apos;s render, and every
          downstream vendor brief.
        </p>
        {totalFilled > 0 ? (
          <p className="text-xs font-medium text-terracotta">
            {totalFilled} {totalFilled === 1 ? 'photo' : 'photos'} uploaded
          </p>
        ) : null}
      </header>

      {globalError ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {globalError}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading your mood board…
        </div>
      ) : (
        <div className="space-y-8">
          {PILLARS.map((pillar) => (
            <PillarSection
              key={pillar.id}
              pillar={pillar}
              slots={slots}
              onUpload={handleUpload}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}

      <footer className="flex flex-col gap-3 border-t border-cream-deep pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-ink-muted">
          Each upload saves automatically. Finish when you&apos;re ready to
          move on — you can always come back to swap photos.
        </p>
        <button
          type="button"
          onClick={handleFinish}
          disabled={isFinishing || totalFilled === 0}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-terracotta px-5 py-2.5 text-sm font-semibold text-cream shadow-sm transition-colors hover:bg-terracotta-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isFinishing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Finish mood board
            </>
          )}
        </button>
      </footer>
    </div>
  );
}

// -----------------------------------------------------------------------
// Pillar section — renders one of the 3 pillars (Location feel · Palette ·
// Dress codes). Each pillar header surfaces a short hint copy, then the
// pillar's slots stack vertically; inside each slot, the two upload tiles
// sit in a 2-column grid.
// -----------------------------------------------------------------------

function PillarSection({
  pillar,
  slots,
  onUpload,
  onRemove,
}: {
  pillar: (typeof PILLARS)[number];
  slots: SlotStateMap;
  onUpload: (slotKey: SlotKey, position: 1 | 2, file: File) => void;
  onRemove: (slotKey: SlotKey, position: 1 | 2) => void;
}) {
  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
          {pillar.id === 'palette' ? (
            <PaletteIcon className="h-4 w-4 text-terracotta" />
          ) : null}
          {pillar.label}
        </h3>
        <p className="text-xs text-ink-muted">{pillar.hint}</p>
      </header>

      <div className="space-y-4">
        {pillar.slots.map((slot) => (
          <SlotCard
            key={slot.key}
            slotKey={slot.key}
            label={slot.label}
            tiles={slots[slot.key]}
            onUpload={onUpload}
            onRemove={onRemove}
          />
        ))}
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------
// Slot card — one row per slot, label on top, then two upload tiles in
// a 2-column grid.
// -----------------------------------------------------------------------

function SlotCard({
  slotKey,
  label,
  tiles,
  onUpload,
  onRemove,
}: {
  slotKey: SlotKey;
  label: string;
  tiles: [TileState, TileState];
  onUpload: (slotKey: SlotKey, position: 1 | 2, file: File) => void;
  onRemove: (slotKey: SlotKey, position: 1 | 2) => void;
}) {
  return (
    <div className="rounded-xl border border-cream-deep bg-white/40 p-4 shadow-sm">
      <p className="mb-3 text-sm font-medium text-ink">{label}</p>
      <div className="grid grid-cols-2 gap-3">
        <UploadTile
          slotKey={slotKey}
          label={label}
          position={1}
          tile={tiles[0]}
          onUpload={onUpload}
          onRemove={onRemove}
        />
        <UploadTile
          slotKey={slotKey}
          label={label}
          position={2}
          tile={tiles[1]}
          onUpload={onUpload}
          onRemove={onRemove}
        />
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------
// Upload tile — empty / uploading / filled state machine. Click + drop
// both wired. Hover reveals an X remove button on filled tiles.
// -----------------------------------------------------------------------

function UploadTile({
  slotKey,
  label,
  position,
  tile,
  onUpload,
  onRemove,
}: {
  slotKey: SlotKey;
  label: string;
  position: 1 | 2;
  tile: TileState;
  onUpload: (slotKey: SlotKey, position: 1 | 2, file: File) => void;
  onRemove: (slotKey: SlotKey, position: 1 | 2) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handlePick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0]!;
      onUpload(slotKey, position, file);
    },
    [onUpload, slotKey, position],
  );

  const handleDragOver = useCallback((evt: React.DragEvent<HTMLButtonElement>) => {
    evt.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (evt: React.DragEvent<HTMLButtonElement>) => {
      evt.preventDefault();
      setIsDragging(false);
      handleFiles(evt.dataTransfer.files);
    },
    [handleFiles],
  );

  if (tile.kind === 'filled') {
    return (
      <div className="group relative aspect-square overflow-hidden rounded-lg border border-cream-deep bg-cream">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={tile.image_url}
          alt={`${label} inspiration ${position}`}
          className="h-full w-full object-cover"
        />
        <button
          type="button"
          onClick={() => onRemove(slotKey, position)}
          aria-label={`Remove ${label} photo ${position}`}
          className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-ink/80 text-cream opacity-0 transition-opacity hover:bg-ink group-hover:opacity-100 focus:opacity-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (tile.kind === 'uploading') {
    return (
      <div className="grid aspect-square place-items-center rounded-lg border border-dashed border-terracotta/50 bg-cream/50">
        <Loader2 className="h-6 w-6 animate-spin text-terracotta" />
      </div>
    );
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={(evt) => {
          handleFiles(evt.target.files);
          evt.currentTarget.value = '';
        }}
      />
      <button
        type="button"
        onClick={handlePick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        aria-label={`Upload ${label} photo ${position}`}
        className={`grid aspect-square place-items-center rounded-lg border-2 border-dashed transition-colors ${
          isDragging
            ? 'border-terracotta bg-terracotta/10 text-terracotta'
            : 'border-cream-deep bg-cream/50 text-ink-muted hover:border-terracotta hover:bg-terracotta/5 hover:text-terracotta'
        }`}
      >
        <span className="flex flex-col items-center gap-1.5 px-2 text-center">
          <CloudUpload className="h-6 w-6" />
          <span className="text-[11px] leading-tight">
            Drop a photo or click to choose
          </span>
        </span>
      </button>
    </>
  );
}
