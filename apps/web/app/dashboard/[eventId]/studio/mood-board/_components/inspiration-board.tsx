'use client';

/**
 * Inspiration board on the Mood Board add-on page (owner directive 2026-06-09:
 * "we also want a place where they can upload inspirations … use that to
 * enhance the photo output to be more accurate").
 *
 * Surfaces the same per-event inspiration intake that onboarding's Card 15
 * uses — 13 named slots × 2 photos, stored in event_inspiration_assets, with
 * a 6-color palette auto-extracted from each upload. Reuses the proven
 * `uploadMoodboardSlot` / `removeMoodboardSlot` server actions + the Canvas
 * extractor (lib/extract-palette). These references will feed the paid
 * "Make it real" render as additional conditioning so the photoreal output
 * matches the couple's actual taste.
 */

import { useState, useTransition } from 'react';
import { extractPaletteFromFile } from '@/lib/extract-palette';
import { uploadMoodboardSlot, removeMoodboardSlot } from '../../../wizard-actions';

export type InspirationItem = {
  slot_key: string;
  slot_position: number;
  image_url: string;
};

type Props = { eventId: string; initial: InspirationItem[] };

const GROUPS: ReadonlyArray<{ title: string; slots: { k: string; label: string }[] }> = [
  {
    title: 'Venue & feel',
    slots: [
      { k: 'overall', label: 'Overall vibe' },
      { k: 'ceiling', label: 'Ceiling' },
      { k: 'stage', label: 'Stage' },
      { k: 'table', label: 'Tables' },
      { k: 'tunnel', label: 'Tunnel' },
      { k: 'venue', label: 'Venue' },
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
type Tile = { url: string } | 'uploading' | undefined;

export function InspirationBoard({ eventId, initial }: Props) {
  const [tiles, setTiles] = useState<Record<string, Tile>>(() => {
    const m: Record<string, Tile> = {};
    for (const it of initial) m[key(it.slot_key, it.slot_position)] = { url: it.image_url };
    return m;
  });
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

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
        setTiles((t) => ({ ...t, [key(slot, pos)]: { url: res.image_url! } }));
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
                  {[1, 2].map((pos) => (
                    <SlotTile
                      key={pos}
                      tile={tiles[key(slot.k, pos)]}
                      onPick={(f) => onFile(slot.k, pos, f)}
                      onRemove={() => onRemove(slot.k, pos)}
                    />
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function SlotTile({
  tile,
  onPick,
  onRemove,
}: {
  tile: Tile;
  onPick: (f: File | undefined) => void;
  onRemove: () => void;
}) {
  if (tile === 'uploading') {
    return (
      <div className="flex aspect-square flex-1 items-center justify-center rounded-lg border border-ink/15 bg-white text-[10px] text-ink/50">
        …
      </div>
    );
  }
  if (tile) {
    return (
      <div className="group relative aspect-square flex-1 overflow-hidden rounded-lg border border-ink/15">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={tile.url} alt="inspiration" className="h-full w-full object-cover" />
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove"
          className="absolute right-1 top-1 rounded-full bg-ink/70 px-1.5 text-xs leading-5 text-cream"
        >
          ×
        </button>
      </div>
    );
  }
  return (
    <label className="flex aspect-square flex-1 cursor-pointer items-center justify-center rounded-lg border border-dashed border-ink/25 bg-white text-lg text-ink/40 transition hover:border-terracotta hover:text-terracotta">
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
