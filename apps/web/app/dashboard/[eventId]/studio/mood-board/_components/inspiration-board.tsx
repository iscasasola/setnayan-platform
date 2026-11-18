'use client';

/**
 * Inspiration board on the Mood Board add-on page (owner directive 2026-06-09:
 * "we also want a place where they can upload inspirations … use that to
 * enhance the photo output to be more accurate").
 *
 * Surfaces the same per-event inspiration intake that onboarding's Card 15
 * uses — 29 named slots × 3 photos, stored in event_inspiration_assets, with
 * a 6-color palette auto-extracted from each upload. Widened through
 * 2026-09-02/03: backdrop · flowers · cocktail, then reception_venue (the
 * ceremony/reception asymmetry), then cake — and 2 photos per slot became 3,
 * per the owner's "it usually is 1-3 designs". Reuses the proven
 * `uploadMoodboardSlot` / `removeMoodboardSlot` server actions + the Canvas
 * extractor (lib/extract-palette).
 *
 * ➕ ONE + PER PART (owner 2026-11-18, "go for all" on the approved drawing "Inspiration board: one + per part",
 * W4-S1/B8 — the board drew 87 identical + boxes, 29 parts × 3). Each part is ONE row: its name, "1 of 3", its
 * photos, and one + that opens the phone's gallery / the computer's file window straight away, several at once
 * (a pick bigger than the free spots keeps the first ones and says so; a photo that did not go up stays as Retry).
 * A full part (3 of 3) has no + — remove one first. The groups fold (Venue & feel open, the others folded with a
 * count). Tap a photo → the shared photo viewer; swipe it left → removed with Undo, no confirm. On a phone, moving
 * a photo is one dropdown of parts in the viewer; a computer keeps dragging. The 3-per-part cap is unchanged (code
 * + database). 🔒 inspiration-board-one-plus.test.ts.
 */

import { useRef, useState, useTransition, type DragEvent } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import { extractPaletteFromFile } from '@/lib/extract-palette';
import { uploadMoodboardSlot, removeMoodboardSlot } from '../../../wizard-actions';
import {
  MOODBOARD_SLOT_POSITIONS,
  type MoodboardSlotPosition,
} from '@/lib/moodboard-slots';
import { Fold } from '@/app/_components/fold';
import { CAP, cutWords, groupCount, INSPIRATION_OPEN_GROUP, partLine } from './inspiration-board-words';
import { PhotoViewer } from '@/app/_components/gallery/photo-viewer';
import { swipeBegin, swipeMove, swipeSettle, type SwipeDrag } from '@/app/_components/swipe-to-delete';
import { deleteWithUndo } from '@/app/_components/undo/delete-with-undo';
import { UndoToastHost } from '@/app/dashboard/[eventId]/guests/_components/undo-toast';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
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
  /** The photo's own sampled colours (`sampled_hex_1…6`) — Studio reads each part's palette from them. */
  swatches?: string[];
  /** 🤝🖼 The supplier suggestion this photo was KEPT from (`from_suggestion_id`, 2026-10-19), else null. */
  fromSuggestionId?: string | null;
  /** …and that supplier's shop name — the credit on the photo ("3 photos · 1 from Bloom & Co."). */
  fromShop?: string | null;
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
      { k: 'bridal_bouquet', label: 'Bridal bouquet' },
      { k: 'centrepieces', label: 'Centrepieces' },
      /* 🎨🖼 The Palette's five parts with photos of their own (2026-10-19). */
      { k: 'chairs', label: 'Chairs' },
      { k: 'ribbons_candles', label: 'Ribbons & candles' },
      { k: 'lights', label: 'Lights' },
      { k: 'entourage_bouquets', label: 'Entourage bouquets' },
      { k: 'flower_accents', label: 'Flower accents' },
    ],
  },
  { title: 'Palette', slots: [{ k: 'palette', label: 'Palette source' }] },
  {
    title: 'Dress codes',
    slots: [
      { k: 'bride', label: 'Bride' },
      { k: 'groom', label: 'Groom' },
      { k: 'entourage', label: 'Entourage' },
      // 👗 The four attire boards of their own (owner 2026-10-08) — the same slots Studio › Attire draws.
      { k: 'bridesmaids', label: 'Bridesmaids' },
      { k: 'groomsmen', label: 'Groomsmen' },
      { k: 'flower_girl', label: 'Flower girl' },
      { k: 'ring_bearer', label: 'Ring bearer' },
      { k: 'principal_sponsor', label: 'Sponsors' },
      { k: 'parents', label: 'Parents' },
      { k: 'guests', label: 'Guests' },
    ],
  },
];

const key = (slot: string, pos: number) => `${slot}:${pos}`;

/** A part's cell: a saved photo · a photo on its way up · a photo that did not go up (kept, so Retry can resend it). */
type Photo = { url: string; credit?: string | null };
type Failed = { failed: File };
type Tile = Photo | 'uploading' | Failed | undefined;
const isPhoto = (t: Tile): t is Photo => typeof t === 'object' && t !== null && 'url' in t;
const isFailed = (t: Tile): t is Failed => typeof t === 'object' && t !== null && 'failed' in t;

export function InspirationBoard({
  eventId,
  initial,
  gallerySlots,
  fetchGalleryAction,
  applyGalleryAction,
}: Props) {
  const [tiles, setTilesState] = useState<Record<string, Tile>>(() => {
    const m: Record<string, Tile> = {};
    for (const it of initial) {
      m[key(it.slot_key, it.slot_position)] = {
        url: it.image_url,
        credit: it.credit ?? null,
      };
    }
    return m;
  });
  /* The uploads run one after another and read the board between them, so the board is mirrored in a ref — a
     closure would read the board as it was when the picker opened. */
  const tilesRef = useRef(tiles);
  const setTiles = (f: (t: Record<string, Tile>) => Record<string, Tile>) => {
    setTilesState((t) => {
      const next = f(t);
      tilesRef.current = next;
      return next;
    });
  };
  const [error, setError] = useState<string | null>(null);
  /** A note under one part — a pick cut to the free spots, a move that did not land. */
  const [note, setNote] = useState<{ slot: string; text: string; bad: boolean } | null>(null);
  const [openGallerySlot, setOpenGallerySlot] = useState<string | null>(null);
  /** The photo open in the preview — its part and which of that part's photos. */
  const [viewing, setViewing] = useState<{ slot: string; at: number } | null>(null);
  /* A removed photo is written only when its Undo window closes (`deleteWithUndo`). Its position is written to
     before then only after that write is flushed, so a new photo is never deleted by the old one's late remove. */
  const pendingRemoves = useRef<Map<string, Array<() => Promise<void>>>>(new Map());
  const [, startTransition] = useTransition();

  const galleryWired = Boolean(fetchGalleryAction && applyGalleryAction);
  const gallerySlotSet = new Set(gallerySlots ?? []);
  const labelOf = (slot: string) =>
    GROUPS.flatMap((g) => g.slots).find((s) => s.k === slot)?.label ?? slot;

  /** Which of a part's spots are free — read off the SAME board the rows paint from. */
  function freePositions(slot: string, board = tilesRef.current): MoodboardSlotPosition[] {
    return MOODBOARD_SLOT_POSITIONS.filter((pos) => !board[key(slot, pos)]);
  }
  function photosOf(slot: string, board = tiles): Array<{ pos: MoodboardSlotPosition; photo: Photo }> {
    const out: Array<{ pos: MoodboardSlotPosition; photo: Photo }> = [];
    for (const pos of MOODBOARD_SLOT_POSITIONS) {
      const t = board[key(slot, pos)];
      if (isPhoto(t)) out.push({ pos, photo: t });
    }
    return out;
  }
  async function flushRemoves(slot: string) {
    const list = pendingRemoves.current.get(slot);
    if (!list?.length) return;
    pendingRemoves.current.delete(slot);
    await Promise.all(list.map((f) => f()));
  }

  async function uploadOne(slot: string, pos: MoodboardSlotPosition, file: File) {
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
        // The couple's own photo — nobody to credit, and `null` says so.
        setTiles((t) => ({ ...t, [key(slot, pos)]: { url: res.image_url!, credit: null } }));
      } else {
        // 🔁 A photo that did not go up stays in its spot as Retry — never drawn as a saved photo, never as an
        // empty spot that looks like it was never picked.
        setTiles((t) => ({ ...t, [key(slot, pos)]: { failed: file } }));
        if (res.message) setError(res.message);
      }
    } catch {
      setTiles((t) => ({ ...t, [key(slot, pos)]: { failed: file } }));
    }
  }

  /** The part's one + : the photos the couple picked, into the free spots, first ones first. */
  async function onPickFiles(slot: string, files: File[]) {
    if (files.length === 0) return;
    setError(null);
    setNote(null);
    await flushRemoves(slot);
    const free = freePositions(slot);
    const take = files.slice(0, free.length);
    if (files.length > take.length) setNote({ slot, text: cutWords(files.length, take.length), bad: false });
    // Every picked photo shows in the row at once; they go up one after another.
    setTiles((t) => {
      const next = { ...t };
      take.forEach((_, i) => (next[key(slot, free[i]!)] = 'uploading'));
      return next;
    });
    for (let i = 0; i < take.length; i++) await uploadOne(slot, free[i]!, take[i]!);
  }

  function onRetry(slot: string, pos: MoodboardSlotPosition) {
    const t = tilesRef.current[key(slot, pos)];
    if (!isFailed(t)) return;
    setError(null);
    void uploadOne(slot, pos, t.failed);
  }

  /** 👈 Swipe left (or Remove in the preview): gone at once, the Undo toast for a few seconds, no confirm. */
  function removeWithUndo(slot: string, pos: MoodboardSlotPosition) {
    const k = key(slot, pos);
    const was = tilesRef.current[k];
    setError(null);
    setNote(null);
    if (!isPhoto(was)) {
      // A photo that never went up has nothing to remove on the server.
      setTiles((t) => ({ ...t, [k]: undefined }));
      return;
    }
    const { flush } = deleteWithUndo({
      label: 'Photo removed',
      failed: 'Could not remove that photo. It’s back — try again.',
      hide: () => setTiles((t) => ({ ...t, [k]: undefined })),
      // Back only into an empty spot — never over a photo added since.
      restore: () => setTiles((t) => (t[k] ? t : { ...t, [k]: was })),
      commit: async () => {
        const list = pendingRemoves.current.get(slot);
        if (list) pendingRemoves.current.set(slot, list.filter((f) => f !== flush));
        const fd = new FormData();
        fd.set('event_id', eventId);
        fd.set('slot_key', slot);
        fd.set('slot_position', String(pos));
        /* 📵 A remove that never answered (no signal, a 5xx) throws — deleteWithUndo puts the photo back and says so. */
        const res = await removeMoodboardSlot(fd);
        return res.status === 'ok' ? { ok: true } : { ok: false, error: res.message ?? null };
      },
    });
    pendingRemoves.current.set(slot, [...(pendingRemoves.current.get(slot) ?? []), flush]);
  }

  // Drag-reorder on a computer — native HTML5 DnD. Swaps whatever occupies the dragged-from and dropped-on spots,
  // within a part or across parts.
  function onDropTile(
    fromSlot: string,
    fromPos: MoodboardSlotPosition,
    toSlot: string,
    toPos: MoodboardSlotPosition,
  ) {
    if (fromSlot === toSlot && fromPos === toPos) return;
    const fromKey = key(fromSlot, fromPos);
    const toKey = key(toSlot, toPos);
    const wasFrom = tilesRef.current[fromKey];
    const wasTo = tilesRef.current[toKey];
    setError(null);
    setNote(null);
    setTiles((t) => ({ ...t, [fromKey]: t[toKey], [toKey]: t[fromKey] }));
    /* ↩ A move that did not land puts BOTH photos back and says so under the part it was moved to. */
    const undo = (message: string) => {
      setTiles((t) => ({ ...t, [fromKey]: wasFrom, [toKey]: wasTo }));
      setNote({ slot: toSlot, text: message, bad: true });
    };
    startTransition(async () => {
      try {
        await Promise.all([flushRemoves(fromSlot), flushRemoves(toSlot)]);
        const res = await reorderMoodboardSlot(
          eventId,
          { slotKey: fromSlot, slotPosition: fromPos },
          { slotKey: toSlot, slotPosition: toPos },
        );
        if (!res.ok) undo(res.message);
      } catch {
        undo('Could not move that photo — please try again.');
      }
    });
  }

  /** A photo moved to ANOTHER part (the preview's dropdown on a phone; a drop on a row on a computer) lands in its first free spot. */
  function moveToPart(fromSlot: string, fromPos: MoodboardSlotPosition, toSlot: string) {
    if (fromSlot === toSlot) return;
    const free = freePositions(toSlot);
    if (free.length === 0) {
      setNote({ slot: fromSlot, text: `${labelOf(toSlot)} is full. Remove one there first.`, bad: true });
      return;
    }
    onDropTile(fromSlot, fromPos, toSlot, free[0]!);
  }

  const viewed = viewing ? photosOf(viewing.slot) : [];
  const viewedAt = viewing ? Math.min(viewing.at, viewed.length - 1) : -1;
  const current = viewing && viewedAt >= 0 ? viewed[viewedAt] : undefined;

  return (
    <div className="space-y-3" data-inspiration-board="">
      <UndoToastHost />
      {error ? (
        <p role="alert" className="text-xs text-terracotta-700">
          {error}
        </p>
      ) : null}
      {GROUPS.map((group) => {
        const withPhotos = group.slots.filter((s) => photosOf(s.k).length > 0).length;
        return (
          <Fold
            key={group.title}
            title={group.title}
            aside={<span className="text-[12px] text-ink/70">{groupCount(withPhotos, group.slots.length)}</span>}
            defaultOpen={group.title === INSPIRATION_OPEN_GROUP}
            data={`inspiration-group-${group.slots[0]!.k}`}
          >
            <ul>
              {group.slots.map((slot) => {
                const cells = MOODBOARD_SLOT_POSITIONS.map((pos) => ({ pos, tile: tiles[key(slot.k, pos)] }));
                const saved = cells.filter((c) => isPhoto(c.tile));
                const uploading = cells.filter((c) => c.tile === 'uploading').length;
                const failed = cells.filter((c) => isFailed(c.tile)).length;
                const credits = saved.map((c) => (c.tile as Photo).credit).filter((c): c is string => Boolean(c));
                const line = partLine(saved.length, uploading, credits);
                const room = cells.filter((c) => !c.tile).length;
                return (
                  <li
                    key={slot.k}
                    className="border-t border-ink/10"
                    data-inspiration-part={slot.k}
                    onDragOver={(e) => {
                      if (e.dataTransfer.types.includes(DND_MIME)) e.preventDefault();
                    }}
                    onDrop={(e) => {
                      // A drop on the row (not on a photo) moves the photo into this part's first free spot.
                      const from = readDrag(e);
                      if (from) moveToPart(from.slotKey, from.slotPosition, slot.k);
                    }}
                  >
                    <div className="flex min-h-16 items-center gap-2.5 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold leading-tight text-ink">{slot.label}</p>
                        <p
                          className={`text-[12px] ${line.full ? 'font-semibold text-success-700' : 'text-ink/70'}`}
                          data-part-count=""
                        >
                          {line.text}
                        </p>
                      </div>
                      <div className="flex flex-none gap-1.5">
                        {cells.map(({ pos, tile }) =>
                          isPhoto(tile) ? (
                            <PhotoTile
                              key={pos}
                              photo={tile}
                              slotKey={slot.k}
                              slotPosition={pos}
                              label={`${slot.label} photo ${saved.findIndex((c) => c.pos === pos) + 1}`}
                              onOpen={() =>
                                setViewing({ slot: slot.k, at: saved.findIndex((c) => c.pos === pos) })
                              }
                              onRemove={() => removeWithUndo(slot.k, pos)}
                              onDropTile={onDropTile}
                            />
                          ) : tile === 'uploading' ? (
                            <span
                              key={pos}
                              aria-label="Uploading"
                              className="flex h-11 w-11 flex-none animate-pulse items-center justify-center rounded-md bg-ink/5 text-[12px] text-ink/70"
                            >
                              …
                            </span>
                          ) : isFailed(tile) ? (
                            <button
                              key={pos}
                              type="button"
                              onClick={() => onRetry(slot.k, pos)}
                              data-inspiration-retry=""
                              className="sn-press flex h-11 w-11 flex-none items-center justify-center rounded-md border-[1.5px] border-danger-600 bg-danger-50 text-[11px] font-bold text-danger-700"
                            >
                              Retry
                            </button>
                          ) : null,
                        )}
                        {/* ＋ ONE per part (owner 18 Nov). Opens the phone's gallery / the computer's file window
                            straight away — several at once. A full part (3 of 3) has none: remove one first. */}
                        {room > 0 ? (
                          <AddPhotos
                            label={slot.label}
                            busy={uploading > 0}
                            onPick={(files) => void onPickFiles(slot.k, files)}
                          />
                        ) : null}
                      </div>
                    </div>
                    {failed > 0 ? (
                      <p role="alert" className="mb-2 rounded-md bg-danger-50 px-2.5 py-2 text-[12px] text-danger-700">
                        {`${failed} photo${failed === 1 ? '' : 's'} did not upload. Tap Retry.`}
                        {saved.length > 0
                          ? saved.length === 1
                            ? ' The other one is saved.'
                            : ` The other ${saved.length} are saved.`
                          : ''}
                      </p>
                    ) : null}
                    {note?.slot === slot.k ? (
                      <p
                        role={note.bad ? 'alert' : 'status'}
                        className={`mb-2 rounded-md px-2.5 py-2 text-[12px] ${note.bad ? 'bg-danger-50 text-danger-700' : 'bg-ink/5 text-ink'}`}
                      >
                        {note.text}
                      </p>
                    ) : null}
                    {/* The door into the supplier gallery — where it was: under its part, only for parts a trade
                        supplies, and only once the actions are wired. */}
                    {galleryWired && gallerySlotSet.has(slot.k) ? (
                      <button
                        type="button"
                        onClick={() =>
                          setOpenGallerySlot((prior) => (prior === slot.k ? null : slot.k))
                        }
                        aria-expanded={openGallerySlot === slot.k}
                        className="sn-press -mt-1 flex min-h-11 items-center text-left text-[12px] font-bold text-ink/70 underline underline-offset-2 hover:text-ink"
                      >
                        {openGallerySlot === slot.k
                          ? 'Hide supplier photos'
                          : 'Browse supplier photos'}
                      </button>
                    ) : null}
                    {galleryWired && openGallerySlot === slot.k ? (
                      <GalleryPicker
                        eventId={eventId}
                        slotKey={slot.k}
                        slotLabel={slot.label}
                        emptyPositions={freePositions(slot.k, tiles)}
                        fetchAction={fetchGalleryAction!}
                        applyAction={applyGalleryAction!}
                        onSaved={(pos, url, credit) => {
                          // The credit the picker just showed is the credit the tile now carries.
                          setTiles((t) => ({ ...t, [key(slot.k, pos)]: { url, credit } }));
                        }}
                        onClose={() => setOpenGallerySlot(null)}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Fold>
        );
      })}

      {viewing && current ? (
        <PhotoViewer
          photo={{ src: current.photo.url, kind: 'photo', label: 'Mood board inspiration image' }}
          at={viewedAt}
          total={viewed.length}
          album={labelOf(viewing.slot)}
          onMove={(to) => setViewing({ slot: viewing.slot, at: to })}
          onClose={() => setViewing(null)}
          sub={current.photo.credit ? `From ${current.photo.credit}` : undefined}
          title={
            /* 📱 On a phone, moving a photo is this ONE dropdown of parts (a finger cannot drag between rows).
               A computer keeps dragging, so the dropdown is a phone's only. */
            <div className="[@media(hover:hover)_and_(pointer:fine)]:hidden" data-inspiration-move="">
              <PickMenu
                label="Move to another part"
                buttonText={`Move to another part · ${labelOf(viewing.slot)}`}
                value={viewing.slot}
                options={GROUPS.flatMap((g) =>
                  g.slots.map((s) => ({
                    key: s.k,
                    label: s.label,
                    group: g.title,
                    disabledNote:
                      s.k !== viewing.slot && freePositions(s.k, tiles).length === 0
                        ? `${s.label} is full (${CAP} of ${CAP}). Remove one there first.`
                        : undefined,
                  })),
                )}
                onPick={(to) => {
                  const from = viewing;
                  setViewing(null);
                  moveToPart(from.slot, current.pos, to);
                }}
                opensUp
              />
            </div>
          }
          actions={[
            {
              key: 'remove',
              label: 'Remove',
              icon: Trash2,
              tone: 'danger',
              onPress: () => {
                const from = viewing;
                setViewing(viewed.length > 1 ? { slot: from.slot, at: Math.max(0, viewedAt - 1) } : null);
                removeWithUndo(from.slot, current.pos);
              },
            },
            { key: 'done', label: 'Done', icon: Check, onPress: () => setViewing(null) },
          ]}
        />
      ) : null}
    </div>
  );
}

const DND_MIME = 'application/x-moodboard-slot';

function readDrag(e: DragEvent): { slotKey: string; slotPosition: MoodboardSlotPosition } | null {
  e.preventDefault();
  const raw = e.dataTransfer.getData(DND_MIME);
  if (!raw) return null;
  try {
    // JSON from the drag payload is untrusted at this boundary; the server re-validates the position regardless.
    return JSON.parse(raw) as { slotKey: string; slotPosition: MoodboardSlotPosition };
  } catch {
    return null;
  }
}

/** The part's one ＋ — a label around a hidden multi-file input, so the press IS the picker (no page, no sheet of ours). */
function AddPhotos({ label, busy, onPick }: { label: string; busy: boolean; onPick: (files: File[]) => void }) {
  return (
    <label
      aria-label={`Add photos to ${label}`}
      aria-disabled={busy || undefined}
      data-inspiration-add=""
      className={`flex h-11 w-11 flex-none cursor-pointer items-center justify-center rounded-md border-[1.5px] border-dashed border-terracotta text-terracotta-700 transition hover:bg-terracotta/10 ${busy ? 'pointer-events-none opacity-40' : ''}`}
    >
      <Plus aria-hidden className="h-[18px] w-[18px]" strokeWidth={2} />
      <input
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        disabled={busy}
        onChange={(e) => {
          onPick(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />
    </label>
  );
}

/**
 * One saved photo in a part's row. TAP opens the preview; SWIPE LEFT removes it (with Undo, no confirm — owner
 * 18 Nov). The swipe is the house gesture (`swipeBegin` · `swipeMove` · `swipeSettle`, swipe-to-delete.tsx): axis
 * lock, a vertical move first lets the sheet scroll, the tap a swipe ends in is swallowed. On a computer it drags.
 */
function PhotoTile({
  photo,
  slotKey,
  slotPosition,
  label,
  onOpen,
  onRemove,
  onDropTile,
}: {
  photo: Photo;
  slotKey: string;
  slotPosition: MoodboardSlotPosition;
  label: string;
  onOpen: () => void;
  onRemove: () => void;
  onDropTile: (
    fromSlot: string,
    fromPos: MoodboardSlotPosition,
    toSlot: string,
    toPos: MoodboardSlotPosition,
  ) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [tx, setTx] = useState(0);
  const drag = useRef<SwipeDrag>({ ...swipeBegin(0, 0, 0), active: false });

  return (
    <button
      type="button"
      aria-label={photo.credit ? `${label}, from ${photo.credit}` : label}
      data-inspiration-photo=""
      draggable
      onClick={(e) => {
        if (drag.current.moved) {
          e.preventDefault();
          drag.current = { ...drag.current, moved: false };
          return;
        }
        onOpen();
      }}
      onTouchStart={(e) => {
        const t = e.touches[0];
        if (t) drag.current = swipeBegin(t.clientX, t.clientY, 0, e.timeStamp);
      }}
      onTouchMove={(e) => {
        const t = e.touches[0];
        if (!t) return;
        const { drag: next, tx: nextTx } = swipeMove(drag.current, t.clientX, t.clientY, e.timeStamp, SWIPE_REMOVE_PX);
        drag.current = next;
        if (nextTx !== null) setTx(nextTx);
      }}
      onTouchEnd={() => {
        const d = drag.current;
        drag.current = { ...d, active: false };
        if (d.horiz && swipeSettle(tx, SWIPE_REMOVE_PX) !== 0) onRemove();
        setTx(0);
      }}
      onTouchCancel={() => {
        drag.current = { ...drag.current, active: false };
        setTx(0);
      }}
      onDragStart={(e) => {
        e.dataTransfer.setData(DND_MIME, JSON.stringify({ slotKey, slotPosition }));
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(DND_MIME)) {
          e.preventDefault();
          setDragOver(true);
        }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.stopPropagation();
        setDragOver(false);
        const from = readDrag(e);
        if (from) onDropTile(from.slotKey, from.slotPosition, slotKey, slotPosition);
      }}
      style={{
        transform: tx === 0 ? undefined : `translateX(${tx}px)`,
        opacity: tx === 0 ? undefined : 1 + tx / (SWIPE_REMOVE_PX * 2),
        touchAction: 'pan-y',
      }}
      className={`relative h-11 w-11 flex-none overflow-hidden rounded-md border border-ink/15 ${dragOver ? 'ring-2 ring-terracotta ring-offset-1' : ''}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.url} alt="" className="h-full w-full cursor-grab object-cover active:cursor-grabbing" />
      {/* 🔑 A supplier's photo carries its mark on the BOARD; the shop's name is on the row and in the preview. */}
      {photo.credit ? <span aria-hidden className="absolute inset-x-0 bottom-0 h-1 bg-terracotta" /> : null}
    </button>
  );
}

/** How far a photo slides before letting go removes it — the tile's own width. */
const SWIPE_REMOVE_PX = 44;
