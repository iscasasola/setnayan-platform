'use client';

/**
 * Inspiration board on the Mood Board add-on page (owner directive 2026-06-09:
 * "we also want a place where they can upload inspirations … use that to
 * enhance the photo output to be more accurate").
 *
 * Surfaces the same per-event inspiration intake that onboarding's Card 15
 * uses — 18 named slots × 3 photos, stored in event_inspiration_assets, with
 * a 6-color palette auto-extracted from each upload. Widened through
 * 2026-09-02/03: backdrop · flowers · cocktail, then reception_venue (the
 * ceremony/reception asymmetry), then cake — and 2 photos per slot became 3,
 * per the owner's "it usually is 1-3 designs". Reuses the proven
 * `uploadMoodboardSlot` / `removeMoodboardSlot` server actions + the Canvas
 * extractor (lib/extract-palette). These references will feed the paid
 * "Make it real" render as additional conditioning so the photoreal output
 * matches the couple's actual taste.
 */

import { useState, useTransition, type DragEvent } from 'react';
import { extractPaletteFromFile } from '@/lib/extract-palette';
import { uploadMoodboardSlot, removeMoodboardSlot } from '../../../wizard-actions';
import {
  MOODBOARD_SLOT_POSITIONS,
  type MoodboardSlotPosition,
} from '@/lib/moodboard-slots';
import { reorderMoodboardSlot } from '../actions';
import { GalleryPicker } from './gallery-picker';
import type { GalleryPage } from '@/lib/moodboard-gallery';

export type InspirationItem = {
  slot_key: string;
  slot_position: number;
  image_url: string;
  /**
   * "Bloom & Vine · Florist" for a photo the couple picked out of a supplier's
   * gallery (MB10) — resolved on the SERVER in page.tsx, so this component
   * never pulls lib/taxonomy into the browser bundle. `null` for the couple's
   * own uploads, which have nobody to credit, and also when the shop's row was
   * refused at read time: the photo is already theirs either way, so the tile
   * keeps rendering and simply names nobody rather than guessing.
   */
  credit?: string | null;
};

type Props = {
  eventId: string;
  initial: InspirationItem[];
  /**
   * The slots a supplier gallery exists for — GALLERY_SLOT_KEYS, derived from
   * MOODBOARD_SLOT_TRADES and passed in from the server. A slot with no
   * supplying trade (`palette`) gets NO button at all rather than an empty
   * shelf, which is the same refusal-to-guess the slot→part bridge makes.
   */
  gallerySlots?: readonly string[];
  fetchGalleryAction?: (input: { slotKey: string; offset?: number }) => Promise<GalleryPage>;
  applyGalleryAction?: (input: {
    eventId: string;
    slotKey: string;
    slotPosition: number;
    assetId: string;
  }) => Promise<{ status: 'ok' | 'error'; imageUrl?: string; message?: string }>;
};

const GROUPS: ReadonlyArray<{ title: string; slots: { k: string; label: string }[] }> = [
  {
    title: 'Venue & feel',
    slots: [
      { k: 'overall', label: 'Overall vibe' },
      { k: 'venue', label: 'Ceremony venue' },
      { k: 'reception_venue', label: 'Reception venue' },
      { k: 'backdrop', label: 'Wall design' },
      { k: 'ceiling', label: 'Ceiling' },
      { k: 'stage', label: 'Stage' },
      { k: 'table', label: 'Tables' },
      { k: 'flowers', label: 'Flowers' },
      { k: 'tunnel', label: 'Tunnel' },
      { k: 'cocktail', label: 'Cocktail hour' },
      { k: 'cake', label: 'Cake' },
    ],
  },
  { title: 'Palette', slots: [{ k: 'palette', label: 'Palette source' }] },
  {
    title: 'Dress codes',
    slots: [
      { k: 'bride', label: 'Bride' },
      { k: 'groom', label: 'Groom' },
      { k: 'entourage', label: 'Entourage' },
      { k: 'principal_sponsor', label: 'Sponsors' },
      { k: 'parents', label: 'Parents' },
      { k: 'guests', label: 'Guests' },
    ],
  },
];

const key = (slot: string, pos: number) => `${slot}:${pos}`;
type Tile = { url: string; credit?: string | null } | 'uploading' | undefined;

export function InspirationBoard({
  eventId,
  initial,
  gallerySlots,
  fetchGalleryAction,
  applyGalleryAction,
}: Props) {
  const [tiles, setTiles] = useState<Record<string, Tile>>(() => {
    const m: Record<string, Tile> = {};
    for (const it of initial) {
      m[key(it.slot_key, it.slot_position)] = {
        url: it.image_url,
        credit: it.credit ?? null,
      };
    }
    return m;
  });
  const [error, setError] = useState<string | null>(null);
  const [openGallerySlot, setOpenGallerySlot] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  /**
   * Which of a slot's three cells are free. Read off the SAME `tiles` state the
   * grid paints from, so the picker can never offer to fill a cell the couple
   * is looking at a photo in.
   */
  function emptyPositionsFor(slot: string): number[] {
    return MOODBOARD_SLOT_POSITIONS.filter((pos) => !tiles[key(slot, pos)]);
  }

  const galleryWired = Boolean(fetchGalleryAction && applyGalleryAction);
  const gallerySlotSet = new Set(gallerySlots ?? []);

  async function onFile(slot: string, pos: number, file: File | undefined) {
    if (!file) return;
    setError(null);
    setTiles((t) => ({ ...t, [key(slot, pos)]: 'uploading' }));
    try {
      const palette = await extractPaletteFromFile(file);
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('slot_key', slot);
      fd.set('slot_position', String(pos));
      fd.set('file', file);
      fd.set('palette_json', JSON.stringify(palette));
      const res = await uploadMoodboardSlot(fd);
      if (res.status === 'ok' && res.image_url) {
        // The couple's own photo — nobody to credit, and `null` says so
        // rather than inheriting whatever the cell held before.
        setTiles((t) => ({ ...t, [key(slot, pos)]: { url: res.image_url!, credit: null } }));
      } else {
        setTiles((t) => ({ ...t, [key(slot, pos)]: undefined }));
        setError(res.message ?? 'Upload failed — try again.');
      }
    } catch {
      setTiles((t) => ({ ...t, [key(slot, pos)]: undefined }));
      setError('Upload failed — try again.');
    }
  }

  function onRemove(slot: string, pos: number) {
    setTiles((t) => ({ ...t, [key(slot, pos)]: undefined }));
    startTransition(async () => {
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('slot_key', slot);
      fd.set('slot_position', String(pos));
      await removeMoodboardSlot(fd);
    });
  }

  // Drag-reorder — native HTML5 DnD (no new dependency; the repo has no
  // existing drag-and-drop library to reuse). Swaps whatever occupies the
  // dragged-from and dropped-on cells, within a slot or across slots.
  function onDropTile(
    fromSlot: string,
    fromPos: MoodboardSlotPosition,
    toSlot: string,
    toPos: MoodboardSlotPosition,
  ) {
    if (fromSlot === toSlot && fromPos === toPos) return;
    const fromKey = key(fromSlot, fromPos);
    const toKey = key(toSlot, toPos);
    setTiles((t) => ({ ...t, [fromKey]: t[toKey], [toKey]: t[fromKey] }));
    startTransition(async () => {
      try {
        await reorderMoodboardSlot(
          eventId,
          { slotKey: fromSlot, slotPosition: fromPos },
          { slotKey: toSlot, slotPosition: toPos },
        );
      } catch {
        setError('Could not reorder — please try again.');
      }
    });
  }

  return (
    <div className="space-y-5">
      {error ? (
        <p role="alert" className="text-xs text-terracotta-700">
          {error}
        </p>
      ) : null}
      {GROUPS.map((group) => (
        <div key={group.title} className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
            {group.title}
          </p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {group.slots.map((slot) => (
              <li
                key={slot.k}
                className="space-y-1 rounded-xl border border-ink/12 bg-cream p-2"
              >
                <p className="px-0.5 text-[11px] font-medium text-ink/70">{slot.label}</p>
                <div className="flex gap-1.5">
                  {MOODBOARD_SLOT_POSITIONS.map((pos) => (
                    <SlotTile
                      key={pos}
                      tile={tiles[key(slot.k, pos)]}
                      onPick={(f) => onFile(slot.k, pos, f)}
                      onRemove={() => onRemove(slot.k, pos)}
                      slotKey={slot.k}
                      slotPosition={pos}
                      onDropTile={onDropTile}
                    />
                  ))}
                </div>
                {/* The door into the supplier gallery. Only for slots a trade
                    actually supplies, and only once the actions are wired —
                    a button that cannot fetch is worse than no button. */}
                {galleryWired && gallerySlotSet.has(slot.k) ? (
                  <button
                    type="button"
                    onClick={() =>
                      setOpenGallerySlot((prior) => (prior === slot.k ? null : slot.k))
                    }
                    aria-expanded={openGallerySlot === slot.k}
                    className="sn-press px-0.5 text-left text-[10px] font-bold text-ink/55 underline underline-offset-2 hover:text-ink"
                  >
                    {openGallerySlot === slot.k
                      ? 'Hide supplier photos'
                      : 'Browse supplier photos'}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {/* Rendered under the GROUP, not inside the grid cell: the picker is
              a six-photo grid of its own and a 2-column tile cannot hold it. */}
          {galleryWired &&
          openGallerySlot !== null &&
          group.slots.some((s) => s.k === openGallerySlot) ? (
            <GalleryPicker
              eventId={eventId}
              slotKey={openGallerySlot}
              slotLabel={
                group.slots.find((s) => s.k === openGallerySlot)?.label ?? openGallerySlot
              }
              emptyPositions={emptyPositionsFor(openGallerySlot)}
              fetchAction={fetchGalleryAction!}
              applyAction={applyGalleryAction!}
              onSaved={(pos, url, credit) => {
                // The credit the picker just showed is the credit the tile now
                // carries — the same string handed across, not a second
                // derivation. The board reflects the save without a reload,
                // and a reload re-resolves the identical line in page.tsx.
                const saved = openGallerySlot;
                if (!saved) return;
                setTiles((t) => ({ ...t, [key(saved, pos)]: { url, credit } }));
              }}
              onClose={() => setOpenGallerySlot(null)}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

const DND_MIME = 'application/x-moodboard-slot';

function SlotTile({
  tile,
  onPick,
  onRemove,
  slotKey,
  slotPosition,
  onDropTile,
}: {
  tile: Tile;
  onPick: (f: File | undefined) => void;
  onRemove: () => void;
  slotKey: string;
  slotPosition: MoodboardSlotPosition;
  onDropTile: (
    fromSlot: string,
    fromPos: MoodboardSlotPosition,
    toSlot: string,
    toPos: MoodboardSlotPosition,
  ) => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  function handleDragStart(e: DragEvent) {
    e.dataTransfer.setData(DND_MIME, JSON.stringify({ slotKey, slotPosition }));
    e.dataTransfer.effectAllowed = 'move';
  }
  function handleDragOver(e: DragEvent) {
    if (e.dataTransfer.types.includes(DND_MIME)) {
      e.preventDefault();
      setDragOver(true);
    }
  }
  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const raw = e.dataTransfer.getData(DND_MIME);
    if (!raw) return;
    try {
      // JSON from the drag payload is untrusted at this boundary; the server
      // re-validates the position against MOODBOARD_SLOT_POSITIONS regardless.
      const from = JSON.parse(raw) as { slotKey: string; slotPosition: MoodboardSlotPosition };
      onDropTile(from.slotKey, from.slotPosition, slotKey, slotPosition);
    } catch {
      /* ignore malformed payload */
    }
  }

  const dropZoneClass = dragOver ? 'ring-2 ring-terracotta ring-offset-1' : '';

  if (tile === 'uploading') {
    return (
      <div className="flex aspect-square flex-1 items-center justify-center rounded-lg border border-ink/15 bg-white text-[10px] text-ink/50">
        …
      </div>
    );
  }
  if (tile) {
    return (
      <div
        className={`group relative aspect-square flex-1 overflow-hidden rounded-lg border border-ink/15 ${dropZoneClass}`}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={tile.url}
          alt="Mood board inspiration image"
          className="h-full w-full cursor-grab object-cover active:cursor-grabbing"
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove"
          className="absolute right-1 top-1 rounded-full bg-ink/70 px-1.5 text-xs leading-5 text-cream"
        >
          ×
        </button>
        {/* 🔑 THE END OF THE CHAIN. A supplier's photo carries its shop on the
            BOARD, not only in the picker it was chosen from — otherwise the
            credit lasts exactly as long as the modal and the couple can never
            answer "whose bouquet was that?" a week later. Absent for the
            couple's own uploads, which have nobody to credit. */}
        {tile.credit ? (
          <span className="absolute inset-x-0 bottom-0 truncate bg-ink/65 px-1.5 py-0.5 text-[9px] font-semibold leading-tight text-cream">
            {tile.credit}
          </span>
        ) : null}
      </div>
    );
  }
  return (
    <label
      onDragOver={handleDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`flex aspect-square flex-1 cursor-pointer items-center justify-center rounded-lg border border-dashed border-ink/25 bg-white text-lg text-ink/40 transition hover:border-terracotta hover:text-terracotta ${dropZoneClass}`}
    >
      +
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          onPick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </label>
  );
}
