'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { STUDIO_AUTO_BUTTON, STUDIO_SAVED_PILL } from '@/lib/studio-skin';
import { useMaker } from '../../../launch/_components/maker-context';
import { ChevronDown, Plus, Sparkles, X } from 'lucide-react';
import { useOneOpen } from '@/lib/one-open';
import { makerSave } from '@/lib/maker-refresh';
import { compressImageForWeb } from '@/lib/image-compress';
import { extractPaletteFromFile } from '@/lib/extract-palette';
import { MOODBOARD_SLOT_POSITIONS } from '@/lib/moodboard-slots';
import { PALETTE_LIMITS, sanitizePaletteStyle, type PaletteKey, type RolePalette, type RoomDressing } from '@/lib/mood-board';
import { derivedBoardFor, displayColorsFor } from '@/lib/mood-board-derive';
import { FLORIST_LANE_PARTS, MAIN_COLOUR_SLOTS, ROOM_LANE_PARTS, lanePartColour, type LanePart } from '@/lib/colour-access';
import { STUDIO_INSPIRATION_SLOTS, attireBoardsAfter, attireBoardsUnder, photoTag, type StudioInspirationSlot } from '@/lib/inspiration-slots';
import {
  MAIN_COLOUR_JOBS,
  paletteFromPhotos,
  shownMainFive,
  slotsFromPhotoPalette,
  withAttireStyle,
  withAutoPalette,
  withMainColour,
  withPartColour,
  withRoleColours,
  type AutoSuggestion,
} from '@/lib/mood-board-studio';
import { InfoTip } from '@/app/_components/info-tip';
import { ISeg, ISegmented } from '../../../website/editor/_components/inspector-kit';
import { PickMenu } from '../../../website/editor/_components/pick-menu';
import { hubDraftAction } from '../../../website/hub-draft-actions';
import { rejectColourChange } from '../../../colour-access-actions';
import { uploadMoodboardSlot, removeMoodboardSlot } from '../../../wizard-actions';
import { applyGalleryPick, fetchGalleryAssets } from '../actions';
import { ColourPickerSheet, StudioSheet } from './colour-picker-sheet';
import { AutoPaletteSheet } from './auto-palette-sheet';
import { GalleryPicker } from './gallery-picker';
import type { InspirationItem } from './inspiration-board';

/**
 * 🎨👗 STUDIO › MOOD BOARD & DRESS CODE — the new Maker's tool (owner
 * 2026-10-06: *"ok"*; DECISION_LOG "STUDIO › MOOD BOARD & DRESS CODE,
 * REDRAWN"; plan `EVENT_HUB_MAKER_STAGES_STUDIO_BUILD_PLAN_2026-10-06.md` §3
 * PR 5; prototype `mood`, `openPicker`, `openAuto`, `openBrowse`).
 *
 * Drawn only while the new Maker is on (the launch page hands `studio` to
 * `MoodBoardMakerBody`), and loaded with the rest of the Mood Board
 * (`mood-board-lazy.tsx`, the `maker-mood-board` chunk). Every couple today
 * keeps the shipped board.
 *
 * ONE `ISegmented` — Palette · Attire · Inspiration · Do's & Don'ts (owner 2026-10-08, "ok"; the
 * attire boards — Bridal gown · Groom's suit · Bridesmaids · Groomsmen · Flower girl · Ring bearer ·
 * Entourage — live in Attire next to their role) — under
 * the Studio's Tool ▾ row, with Saved and ✨ Auto above it. Nothing here is a
 * new write:
 *
 *   · the five main colours, the room's parts and a role's colours → the hub
 *     DRAFT (`hubDraftAction`, `role_palette` as a painted board — step 4c),
 *     each change undoable here, published by Apply;
 *   · a role's outfit → the dress code, through the hub draft (`hubDraftAction`),
 *     so guests meet it at Apply;
 *   · photos → the shipped `uploadMoodboardSlot` / `applyGalleryPick`, into the
 *     shipped slots; the Do's & Don'ts → the shipped `DressCodeListsForm`;
 *   · a supplier's colour change → Keep, or Undo it (`rejectColourChange`, MB16).
 *
 * Opening it writes nothing.
 */

export type StudioChange = { id: string; who: string; what: string; from: string | null; to: string };

export type StudioAttireRow = {
  /** `roles` (one role's own line) or `groups` (a whole group's). */
  tier: 'roles' | 'groups';
  key: string;
  label: string;
  /** The palette key that colours them — null for one with no palette (a celebrant). */
  paletteKey: PaletteKey | null;
  /** The shipped call time, already in words ("2:00 PM"). */
  arrives: string | null;
};

export type MoodBoardStudioProps = {
  eventId: string;
  palette: RolePalette;
  /** The five the board shows while it is not the couple's — the worn theme's own. */
  fallbackFive: string[];
  /** `room_dressing` fields a supplier has agreed to — not changeable here. */
  frozenDressing: string[];
  changes: StudioChange[];
  attire: StudioAttireRow[];
  /** The dress code as drafted, or null when it could not be read (Wear ▾ is then not offered). */
  dressConfig: Record<string, unknown> | null;
  attireStyles: ReadonlyArray<{ key: string; label: string }>;
  inspirations: InspirationItem[];
  /** ✨ Auto's themes (their own five colours), in order. */
  autoThemes: ReadonlyArray<{ name: string; five: string[] }>;
  regions: ReadonlyArray<{ key: string; label: string }>;
  /** The shipped Do's & Don'ts form. */
  dos: ReactNode;
};

type Tab = 'colours' | 'attire' | 'insp' | 'dos';
const TABS: ReadonlyArray<[Tab, string]> = [
  /* "Palette" (owner 2026-10-08, "ok") — the five, the room and the flowers; the key stays `colours`. */
  ['colours', 'Palette'],
  ['attire', 'Attire'],
  ['insp', 'Inspiration'],
  ['dos', 'Do’s & Don’ts'],
];

type PickTarget =
  | { kind: 'main'; index: number }
  | { kind: 'part'; part: LanePart }
  | { kind: 'role'; key: PaletteKey; label: string }
  /** One colour a role already wears — tap its dot to change it, or remove it. */
  | { kind: 'role-colour'; key: PaletteKey; label: string; index: number };
type Sheet = { kind: 'picker'; target: PickTarget } | { kind: 'auto' } | { kind: 'browse'; slot: StudioInspirationSlot } | null;

type Tile = { url: string; credit: string | null; swatches: string[] };
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const SAVE_AFTER_MS = 600;

export function MoodBoardStudio(props: MoodBoardStudioProps) {
  const { eventId } = props;
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('colours');
  const [sheet, setSheet] = useState<Sheet>(null);
  useOneOpen(sheet !== null, () => setSheet(null));
  const [save, setSave] = useState<SaveState>('idle');
  /* The Studio's Tool row's right end (`StudioToolRow` `[data-studio-row-end]`) — found once mounted. */
  /* Only while the Mood Board is the tool on screen: Studio keeps its tools mounted, hidden. */
  const shown = useMaker()?.detailsItem === 'mood-board';
  const [rowEnd, setRowEnd] = useState<Element | null>(null);
  useEffect(() => setRowEnd(shown ? document.querySelector('[data-studio-row-end]') : null), [shown]);
  const [note, setNote] = useState<{ text: string; undo?: () => void } | null>(null);

  /* ── the palette: local, written through the Mood Board's own writer ── */
  const [palette, setPalette] = useState<RolePalette>(props.palette);
  const paletteRef = useRef(palette);
  paletteRef.current = palette;
  const timer = useRef<number | null>(null);
  const flushPalette = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    /* 🎨 INTO THE DRAFT (step 4c, controller 2026-10-07 — "Apply publishes"): the
       hub draft now holds a PAINTED board (\`sanitizePaintedPalette\`), so the
       picker, ✨ Auto and the part palettes are tried here and published by
       Apply, through the Mood Board's own write shape — never live. */
    const fd = new FormData();
    fd.set('intent', 'save');
    fd.set('patch', JSON.stringify({ events: { role_palette: paletteRef.current } }));
    setSave('saving');
    makerSave(() => hubDraftAction(eventId, fd), () => router.refresh())
      .then((r) => {
        setSave(r.ok ? 'saved' : 'error');
        if (!r.ok) setNote({ text: r.error ?? 'Your colours did not save to your draft. Nothing changed — please try again.' });
      })
      .catch(() => setSave('error'));
  }, [eventId, router]);
  useEffect(
    () => () => {
      if (timer.current) {
        window.clearTimeout(timer.current);
        flushPalette();
      }
    },
    [flushPalette],
  );
  const commit = (next: RolePalette, said: string) => {
    const before = paletteRef.current;
    setPalette(next);
    paletteRef.current = next;
    if (timer.current) window.clearTimeout(timer.current);
    setSave('saving');
    timer.current = window.setTimeout(flushPalette, SAVE_AFTER_MS);
    setNote({ text: said, undo: () => commit(before, 'Put back.') });
  };

  const five = shownMainFive(palette, props.fallbackFive);
  const touched = useMemo(() => new Set(palette.touched_roles ?? []), [palette.touched_roles]);
  const derived = useMemo(() => derivedBoardFor(five, sanitizePaletteStyle(palette.palette_style)), [five.join(), palette.palette_style]); // eslint-disable-line react-hooks/exhaustive-deps
  const shownPalette: RolePalette = { ...palette, reception: five };
  const roleColours = (key: PaletteKey) => displayColorsFor(key, shownPalette, touched, derived);

  /* ── inspiration: the couple's photos, by slot ── */
  const [tiles, setTiles] = useState<Record<string, Array<Tile | undefined>>>(() => {
    const m: Record<string, Array<Tile | undefined>> = {};
    for (const it of props.inspirations) {
      const row = (m[it.slot_key] ??= []);
      row[it.slot_position - 1] = { url: it.image_url, credit: it.credit ?? null, swatches: it.swatches ?? [] };
    }
    return m;
  });
  const allPhotoHexes = Object.values(tiles).flatMap((row) => row.flatMap((t) => t?.swatches ?? []));
  const photoColours = paletteFromPhotos(allPhotoHexes, 8);
  const photoFive = photoColours.length > 0 ? slotsFromPhotoPalette(photoColours.slice(0, 5), five) : null;

  /* ── attire: the dress code as drafted ── */
  const [dress, setDress] = useState(props.dressConfig);
  const dressKey = JSON.stringify(props.dressConfig);
  useEffect(() => setDress(props.dressConfig), [dressKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const said = (text: string) => setNote({ text });

  /* ═══ COLOURS ═══ */
  const pickMain = (index: number, hex: string) =>
    commit(withMainColour(palette, five, index, hex), `${MAIN_COLOUR_SLOTS[index]} changed — ${MAIN_COLOUR_JOBS[index]!.toLowerCase()}.`);
  const pickPart = (part: LanePart, hex: string | null) => {
    if (!part.field) return;
    if (hex === null) {
      const rest = { ...palette.room_dressing };
      delete rest[part.field];
      const next: RolePalette = { ...palette };
      if (Object.keys(rest).length > 0) next.room_dressing = rest;
      else delete next.room_dressing;
      commit(next, `${part.label} follows ${MAIN_COLOUR_SLOTS[part.follows]} again.`);
      return;
    }
    commit(withPartColour(palette, part.field, hex), `${part.label} set — your stylist sees it.`);
  };
  const pickRole = (key: PaletteKey, label: string, hex: string) =>
    commit(withRoleColours(palette, key, [...roleColours(key), hex]), `${label} — colour added.`);
  /* 🎨 A role's own colour, changed or removed (owner 2026-10-07: *"the palettes can still be changed to
     colors manually"*) — any colour, not only the five; into the same draft as every pick here. */
  const setRoleColour = (key: PaletteKey, label: string, index: number, hex: string) =>
    commit(withRoleColours(palette, key, roleColours(key).map((c, i) => (i === index ? hex : c))), `${label} — colour changed.`);
  const removeRoleColour = (key: PaletteKey, label: string, index: number) =>
    commit(withRoleColours(palette, key, roleColours(key).filter((_, i) => i !== index)), `${label} — colour removed.`);

  const takeAuto = (s: AutoSuggestion) => {
    setSheet(null);
    commit(withAutoPalette(palette, s.five), `${s.name} — your five main colours are filled. Change any by hand.`);
  };

  /* ═══ ATTIRE ═══ */
  const wear = (row: StudioAttireRow, style: string | null) => {
    if (!dress) return;
    const next = withAttireStyle(dress, row.tier, row.key, style);
    setDress(next);
    const fd = new FormData();
    fd.set('intent', 'save');
    fd.set('patch', JSON.stringify({ events: { dress_code_config: next } }));
    setSave('saving');
    makerSave(() => hubDraftAction(eventId, fd), () => router.refresh())
      .then((r) => {
        setSave(r.ok ? 'saved' : 'error');
        if (!r.ok) said(r.error ?? 'That did not save. Nothing changed — please try again.');
      })
      .catch(() => setSave('error'));
  };

  /* ═══ INSPIRATION ═══ */
  const fileFor = useRef<HTMLInputElement>(null);
  const [uploadSlot, setUploadSlot] = useState<string | null>(null);
  const freeIn = (slot: string) => MOODBOARD_SLOT_POSITIONS.filter((p) => !tiles[slot]?.[p - 1]);
  const openUpload = (slot: string) => {
    if (freeIn(slot).length === 0) {
      said('This part already holds its three photos — remove one to add another.');
      return;
    }
    setUploadSlot(slot);
    fileFor.current?.click();
  };
  const onFile = async (file: File | undefined) => {
    const slot = uploadSlot;
    if (!file || !slot) return;
    const pos = freeIn(slot)[0];
    if (!pos) return;
    setTiles((t) => ({ ...t, [slot]: Object.assign([...(t[slot] ?? [])], { [pos - 1]: { url: '', credit: null, swatches: [] } }) }));
    setSave('saving');
    try {
      /* 📱 Compressed on the phone before it leaves (the shipped `compressImageForWeb`, what FileUpload's `compressImage` runs). */
      const small = await compressImageForWeb(file);
      const swatches = await extractPaletteFromFile(small);
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('slot_key', slot);
      fd.set('slot_position', String(pos));
      fd.set('file', small);
      fd.set('palette_json', JSON.stringify(swatches));
      const res = await uploadMoodboardSlot(fd);
      if (res.status === 'ok' && res.image_url) {
        setTiles((t) => ({ ...t, [slot]: Object.assign([...(t[slot] ?? [])], { [pos - 1]: { url: res.image_url!, credit: null, swatches } }) }));
        setSave('saved');
      } else {
        setTiles((t) => ({ ...t, [slot]: Object.assign([...(t[slot] ?? [])], { [pos - 1]: undefined }) }));
        setSave('error');
        said(res.message ?? 'That photo did not upload — please try again.');
      }
    } catch {
      setTiles((t) => ({ ...t, [slot]: Object.assign([...(t[slot] ?? [])], { [pos - 1]: undefined }) }));
      setSave('error');
      said('That photo did not upload — please try again.');
    }
  };
  const removePhoto = (slot: string, pos: number) => {
    setTiles((t) => ({ ...t, [slot]: Object.assign([...(t[slot] ?? [])], { [pos - 1]: undefined }) }));
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('slot_key', slot);
    fd.set('slot_position', String(pos));
    void removeMoodboardSlot(fd);
  };
  const applySlotPalette = (slot: StudioInspirationSlot, colours: string[]) => {
    const t = slot.target;
    if (t.kind === 'florals') {
      if (props.frozenDressing.includes('florals')) return said('Your florist has agreed the flowers — ask them to reopen it first.');
      commit(withPartColour(palette, 'florals', colours[0]!), `${slot.label}’s palette is now the florist’s colours.`);
    } else if (t.kind === 'room') {
      const [dom, sup, acc] = slotsFromPhotoPalette(colours, five);
      let next = palette;
      const set = (f: keyof RoomDressing, hex: string | undefined) => {
        if (hex && !props.frozenDressing.includes(f)) next = withPartColour(next, f, hex);
      };
      set('linens', sup);
      set('chairs', acc);
      set('lighting_warmth', dom);
      commit(next, `${slot.label}’s palette is now the room’s — linens, chairs and lights.`);
    } else if (t.kind === 'role') {
      commit(withRoleColours(palette, t.key, colours), `${slot.label}’s palette is now ${ROLE_COLOURS_SAID[t.key]}.`);
    }
  };

  /* ═══ SUPPLIER CHANGES — Keep / Undo it (MB16) ═══ */
  const [settled, setSettled] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`mb-kept:${eventId}`);
      if (raw) setSettled(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* a per-viewer convenience — the cards simply show again */
    }
  }, [eventId]);
  const settle = (id: string) => {
    setSettled((s) => {
      const next = new Set(s).add(id);
      try {
        window.localStorage.setItem(`mb-kept:${eventId}`, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  };
  const undoChange = async (c: StudioChange) => {
    setSave('saving');
    try {
      const r = await rejectColourChange(eventId, c.id);
      if (r.status === 'ok' || r.status === 'already') {
        settle(c.id);
        setSave('saved');
        router.refresh();
      } else {
        setSave('error');
        said(r.status === 'frozen' ? 'That part is agreed with your supplier — ask them to reopen it first.' : 'That did not undo. Nothing changed — please try again.');
      }
    } catch {
      setSave('error');
    }
  };
  const openChanges = props.changes.filter((c) => !settled.has(c.id));

  /* ═══ the picker's target, as words ═══ */
  const pickerFor = (t: PickTarget) => {
    if (t.kind === 'main') {
      return { title: MAIN_COLOUR_SLOTS[t.index]!, job: MAIN_COLOUR_JOBS[t.index]!, current: five[t.index]!, onPick: (h: string) => pickMain(t.index, h), extra: null };
    }
    if (t.kind === 'part') {
      const c = lanePartColour(t.part, five, palette);
      return {
        title: t.part.label,
        job: c.setByYou ? 'Set by you — your supplier sees it' : `Follows ${c.followsLabel} until you set it`,
        current: c.hex,
        onPick: (h: string) => pickPart(t.part, h),
        extra: c.setByYou ? (
          <button type="button" onClick={() => { setSheet(null); pickPart(t.part, null); }} className="sn-press min-h-11 self-start rounded-full bg-ink/5 px-4 text-[13px] font-semibold text-ink">
            Follow {c.followsLabel} again
          </button>
        ) : null,
      };
    }
    if (t.kind === 'role-colour') {
      const now = roleColours(t.key);
      return {
        title: t.label,
        job: 'A colour they wear — any colour, not only your five',
        current: now[t.index] ?? five[0]!,
        onPick: (h: string) => setRoleColour(t.key, t.label, t.index, h),
        extra:
          now.length > Math.max(1, PALETTE_LIMITS[t.key].min) ? (
            <button
              type="button"
              data-mood-board-role-remove=""
              onClick={() => {
                setSheet(null);
                removeRoleColour(t.key, t.label, t.index);
              }}
              className="sn-press min-h-11 self-start rounded-full bg-terracotta-700/10 px-4 text-[13px] font-semibold text-terracotta-700"
            >
              Remove this colour
            </button>
          ) : null,
      };
    }
    return { title: t.label, job: 'Adds a colour they wear', current: roleColours(t.key)[0] ?? five[0]!, onPick: (h: string) => pickRole(t.key, t.label, h), extra: null };
  };

  /* 🖼 ONE BOARD PER PART — upload (+) and Search ideas › (the suppliers' photos), drawn in Inspiration, or in Attire for the attire boards. */
  /* 👗 The attire boards sit under their role's row (`attireBoardsUnder` — one for most, two for the bearers:
     Flower girl · Ring bearer); a board whose role is not on the list yet is drawn after the rows (`attireBoardsAfter`). */
  const slotBoard = (slot: StudioInspirationSlot) => {
    const row = tiles[slot.slotKey] ?? [];
    const photos = MOODBOARD_SLOT_POSITIONS.map((p) => ({ pos: p, tile: row[p - 1] })).filter((x) => x.tile);
    const slotPalette = paletteFromPhotos(photos.flatMap((x) => x.tile!.swatches), 5);
    return (
      <section key={slot.slotKey} className="flex flex-col gap-2 border-t border-ink/10 pt-3" data-mood-board-slot={slot.slotKey}>
        <div className="flex items-center justify-between gap-2">
          <b className="text-[14.5px] font-semibold text-ink">{slot.label}</b>
          <button type="button" onClick={() => setSheet({ kind: 'browse', slot })} className="sn-press min-h-11 px-2 text-[13px] font-semibold text-mulberry" data-mood-board-search={slot.slotKey}>
            Search ideas ›
          </button>
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          <button type="button" aria-label={`Add a photo to ${slot.label}`} onClick={() => openUpload(slot.slotKey)} className="sn-press flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-ink/5 text-mulberry">
            <Plus aria-hidden className="h-6 w-6" />
          </button>
          {photos.map(({ pos, tile }) => (
            <span key={pos} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-ink/5">
              {tile!.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tile!.url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-[11px] text-ink/50">Uploading…</span>
              )}
              {photoTag(tile!.credit) ? <em className="absolute bottom-1 left-1 rounded-md bg-ink/55 px-1.5 py-0.5 text-[9.5px] not-italic text-white">{photoTag(tile!.credit)}</em> : null}
              {tile!.url ? (
                <button type="button" aria-label="Remove this photo" onClick={() => removePhoto(slot.slotKey, pos)} className="absolute right-0 top-0 flex h-8 w-8 items-center justify-center text-white drop-shadow">
                  <X aria-hidden className="h-4 w-4" />
                </button>
              ) : null}
            </span>
          ))}
        </div>
        <div className="flex min-h-11 items-center gap-2">
          {slotPalette.length > 0 ? (
            <>
              <span className="flex gap-1" aria-label={`${slot.label}’s palette`}>
                {slotPalette.map((c, i) => (
                  <i key={i} className="h-6 w-6 rounded-full border border-ink/10" style={{ background: c }} />
                ))}
              </span>
              {slot.useLabel ? (
                <button type="button" onClick={() => applySlotPalette(slot, slotPalette)} className="sn-press ml-auto min-h-11 rounded-full bg-ink/5 px-3 text-[12px] font-semibold text-ink" data-mood-board-use-slot={slot.slotKey}>
                  {slot.useLabel}
                </button>
              ) : null}
            </>
          ) : (
            <small className="text-[12px] text-ink/55">Add photos to get its palette</small>
          )}
        </div>
      </section>
    );
  };

  const bar = (
    <div className="flex min-h-11 items-center gap-1.5" data-mood-board-studio-bar="">
      <button type="button" onClick={() => setSheet({ kind: 'auto' })} className={STUDIO_AUTO_BUTTON} data-mood-board-auto="">
        <Sparkles aria-hidden className="h-4 w-4" /> Auto
      </button>
      {/* 🧾 No "✓ Saved" chip (owner 2026-10-07, *"yes remove the saved."*): edits go to the draft and the ONE
          signal is ✓ Apply's count. A save that FAILED is still said, in words, here — never silent. */}
      {save === 'error' ? (
        <span className={`${STUDIO_SAVED_PILL} text-terracotta-700`} data-mood-board-save="error" role="alert">
          Not saved — try again
        </span>
      ) : null}
    </div>
  );

  return (
    <div data-mood-board="studio" className="flex flex-col gap-3 pb-8">
      {/* Saved · ✨ Auto (owner: "a button beside save") — IN the Studio's Tool row, beside Tool ▾
          (prototype `.fhead`: MOOD BOARD ▾ · ✨ Auto · ✓ Saved), portalled into its right end; drawn
          here only where there is no such row (the shipped Mood Board page). */}
      {rowEnd ? createPortal(bar, rowEnd) : bar}
      <div className="flex" data-mood-board-tabs="">
        <ISegmented label="Mood Board">
          {TABS.map(([k, label]) => (
            <ISeg key={k} on={tab === k} onClick={() => setTab(k)} data={`data-mood-board-tab="${k}"`} className="!px-1 !text-[12.5px]">
              {label}
            </ISeg>
          ))}
        </ISegmented>
      </div>
      {note ? (
        <p className="flex items-center gap-2 text-[12.5px] text-ink/70" data-mood-board-note="" role="status">
          <span className="min-w-0 flex-1">{note.text}</span>
          {note.undo ? (
            <button type="button" onClick={() => { const u = note.undo; setNote(null); u?.(); }} className="sn-press min-h-9 shrink-0 rounded-full px-3 font-semibold text-mulberry">
              Undo
            </button>
          ) : null}
        </p>
      ) : null}

      {/* 📎 ONE file input for every board's ＋, mounted WHICHEVER tab is open. It used to live inside the
          Inspiration tab, so a board in Attire tapped ＋ and nothing opened — a refusal with no words. */}
      <input ref={fileFor} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" data-mood-board-file="" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />

      {tab === 'colours' ? (
        <div className="flex flex-col" data-mood-board-colours="">
          {openChanges.map((c) => (
            <div key={c.id} className="mb-2 flex flex-col gap-1 py-2" data-colour-change={c.id}>
              <b className="text-[13.5px] text-ink">{c.who} suggested a change</b>
              <span className="flex items-center gap-1.5 text-[12.5px] text-ink/75">
                {c.what} ·
                {c.from ? <i aria-hidden className="inline-block h-3 w-3 rounded-full border border-ink/15" style={{ background: c.from }} /> : null}
                {c.from ?? 'following'} → <i aria-hidden className="inline-block h-3 w-3 rounded-full border border-ink/15" style={{ background: c.to }} />
                {c.to}
              </span>
              <span className="mt-1 flex gap-2">
                <button type="button" onClick={() => settle(c.id)} className="sn-press min-h-11 flex-1 rounded-full bg-white text-[13px] font-semibold text-ink ring-1 ring-ink/15">
                  Keep
                </button>
                <button type="button" onClick={() => void undoChange(c)} className="sn-press min-h-11 flex-1 rounded-full bg-white text-[13px] font-semibold text-ink ring-1 ring-ink/15">
                  Undo it
                </button>
              </span>
            </div>
          ))}
          <Heading title="Your five main colours" tip="One palette with Look › Colours. Every part below follows them until you set it." />
          {five.map((hex, i) => (
            <ColourRow key={i} hex={hex} name={MAIN_COLOUR_SLOTS[i]!} line={MAIN_COLOUR_JOBS[i]!} trail={hex} onTap={() => setSheet({ kind: 'picker', target: { kind: 'main', index: i } })} data={`main-${i}`} />
          ))}
          <Heading title="The room — for your stylist" tip="Your booked stylist can change these — and your five main colours. You see every change." />
          {ROOM_LANE_PARTS.map((p) => (
            <LaneRow key={p.label} part={p} five={five} palette={palette} frozen={Boolean(p.field && props.frozenDressing.includes(p.field))} onTap={() => setSheet({ kind: 'picker', target: { kind: 'part', part: p } })} />
          ))}
          <Heading title="Flowers — for your florist" tip="Your booked florist can change the flowers. You see every change." />
          {FLORIST_LANE_PARTS.map((p) => (
            <LaneRow key={p.label} part={p} five={five} palette={palette} frozen={Boolean(p.field && props.frozenDressing.includes(p.field))} onTap={() => setSheet({ kind: 'picker', target: { kind: 'part', part: p } })} />
          ))}
        </div>
      ) : null}

      {tab === 'attire' ? (
        <div className="flex flex-col" data-mood-board-attire="">
          {props.attire.length === 0 ? <p className="py-4 text-[13px] text-ink/60">Add people with a role to your guest list and they appear here.</p> : null}
          {props.attire.map((row) => {
            const colours = row.paletteKey ? roleColours(row.paletteKey) : [];
            const map = (dress?.[row.tier] ?? {}) as Record<string, { style?: string }>;
            const style = map[row.key]?.style ?? null;
            const label = style ? props.attireStyles.find((s) => s.key === style)?.label ?? null : null;
            return (
              <div key={`${row.tier}:${row.key}`} className="flex gap-3 border-b border-ink/10 py-3" data-mood-board-role={row.key}>
                <Figure colour={colours[0] ?? five[3]!} />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <b className="text-[14.5px] font-semibold text-ink">{row.label}</b>
                  {dress ? (
                    <PickMenu
                      label={`${row.label} — what to wear`}
                      value={style ?? ''}
                      options={[{ key: '', label: 'Not said yet' }, ...props.attireStyles]}
                      onPick={(k) => wear(row, k || null)}
                      buttonText={label ? `Wear · ${label}` : 'Not said yet'}
                      dataAttr="data-mood-board-wear"
                      className="min-h-11 self-start"
                    />
                  ) : null}
                  {row.paletteKey ? (
                    <span className="flex flex-wrap items-center gap-1.5">
                      {colours.map((c, i) => (
                        <button
                          key={i}
                          type="button"
                          aria-label={`${row.label} colour ${c} — change it`}
                          data-mood-board-role-colour={i}
                          onClick={() => setSheet({ kind: 'picker', target: { kind: 'role-colour', key: row.paletteKey!, label: row.label, index: i } })}
                          className="sn-press inline-flex h-11 w-11 items-center justify-center rounded-full"
                        >
                          <i aria-hidden className="h-7 w-7 rounded-full border border-ink/10" style={{ background: c }} />
                        </button>
                      ))}
                      {colours.length < PALETTE_LIMITS[row.paletteKey].max ? (
                        <button
                          type="button"
                          aria-label={`Add a colour for ${row.label}`}
                          onClick={() => setSheet({ kind: 'picker', target: { kind: 'role', key: row.paletteKey!, label: row.label } })}
                          className="sn-press inline-flex h-11 w-11 items-center justify-center rounded-full text-mulberry ring-1 ring-ink/25"
                        >
                          <Plus aria-hidden className="h-4 w-4" />
                        </button>
                      ) : null}
                    </span>
                  ) : null}
                  {row.arrives ? <small className="text-[11.5px] text-ink/55">Arrives {row.arrives}</small> : null}
                  {attireBoardsUnder(row.key).map((slot) => (
                    <div key={slot.slotKey} data-mood-board-attire-board={slot.slotKey}>
                      {slotBoard(slot)}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {/* 👗 An attire board whose role is not on the list yet still has its place. */}
          {attireBoardsAfter(props.attire.map((r) => r.key)).map((slot) => (
            <div key={slot.slotKey} data-mood-board-attire-board={slot.slotKey}>
              {slotBoard(slot)}
            </div>
          ))}
        </div>
      ) : null}

      {tab === 'insp' ? (
        <div className="flex flex-col gap-4" data-mood-board-inspiration="">
          <PickMenu
            label="Upload your own photos — which part is it for?"
            value={null}
            options={STUDIO_INSPIRATION_SLOTS.filter((s) => !s.attire).map((s) => ({ key: s.slotKey, label: s.label }))}
            onPick={(k) => openUpload(k)}
            buttonText="Upload your own photos"
            dataAttr="data-mood-board-upload"
            className="min-h-14 w-full justify-center !bg-mulberry/10 text-[15px]"
          />
          <div className="flex flex-col gap-2" data-mood-board-main-palette="">
            <Heading title="Your main palette" tip="Read from all your photos. Each part below has its own too." />
            {photoFive ? (
              <>
                <Strip colours={photoFive} />
                <div className="flex gap-2">
                  <button type="button" onClick={() => commit(withAutoPalette(palette, photoFive), 'Your photos’ palette is now your five main colours.')} className="sn-press min-h-11 flex-1 rounded-full bg-ink text-[13px] font-semibold text-cream">
                    Use as my five main colours
                  </button>
                  <button type="button" onClick={() => setTab('colours')} className="sn-press min-h-11 shrink-0 rounded-full bg-ink/5 px-4 text-[13px] font-semibold text-ink">
                    Compare
                  </button>
                </div>
              </>
            ) : (
              <p className="text-[12.5px] text-ink/60">Add photos to get its palette.</p>
            )}
          </div>
          {STUDIO_INSPIRATION_SLOTS.filter((slot) => !slot.attire).map(slotBoard)}
        </div>
      ) : null}

      {tab === 'dos' ? <div data-mood-board-dos="">{props.dos}</div> : null}

      {sheet?.kind === 'picker'
        ? (() => {
            const p = pickerFor(sheet.target);
            return (
              <ColourPickerSheet
                title={p.title}
                job={p.job}
                current={p.current}
                fromPhotos={photoColours}
                palette={five}
                slots
                onPick={(h) => {
                  setSheet(null);
                  p.onPick(h);
                }}
                onClose={() => setSheet(null)}
                extra={p.extra}
              />
            );
          })()
        : null}
      {sheet?.kind === 'auto' ? (
        <AutoPaletteSheet suggestions={[...(photoFive ? [{ name: 'From your photos', five: photoFive, best: true as const }] : []), ...props.autoThemes.map((t) => ({ name: t.name, five: t.five }))]} onUse={takeAuto} onClose={() => setSheet(null)} />
      ) : null}
      {sheet?.kind === 'browse' ? (
        <StudioSheet label={`Ideas for ${sheet.slot.label}`} onClose={() => setSheet(null)}>
          <div className="px-2 pb-2">
            <GalleryPicker
              eventId={eventId}
              slotKey={sheet.slot.slotKey}
              slotLabel={sheet.slot.label}
              emptyPositions={freeIn(sheet.slot.slotKey)}
              fetchAction={fetchGalleryAssets}
              applyAction={applyGalleryPick}
              onSaved={(pos, url, credit, swatches) => {
                const k = sheet.slot.slotKey;
                setTiles((t) => ({ ...t, [k]: Object.assign([...(t[k] ?? [])], { [pos - 1]: { url, credit, swatches: swatches ?? [] } }) }));
                setSave('saved');
              }}
              onClose={() => setSheet(null)}
              studio={{ mainFive: five, regions: props.regions }}
            />
          </div>
        </StudioSheet>
      ) : null}
    </div>
  );
}

/* ── small parts ─────────────────────────────────────────────────────────── */

/** "…’s palette is now ___." — whose colours a board's palette became. */
const ROLE_COLOURS_SAID = {
  bride: 'the bride’s colours',
  wedding_party: 'the entourage’s colours',
  bridesmaids: 'the bridesmaids’ colours',
  groomsmen: 'the groomsmen’s colours',
} as const;

function Heading({ title, tip }: { title: string; tip: string }) {
  return (
    <div className="px-1 pb-1 pt-4">
      <InfoTip label={title} ariaLabel={`About ${title}`} align="start" labelClassName="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink/55">
        {tip}
      </InfoTip>
    </div>
  );
}

function ColourRow({ hex, name, line, trail, onTap, data, disabled = false }: { hex: string; name: string; line: string; trail?: string; onTap?: () => void; data: string; disabled?: boolean }) {
  const body = (
    <>
      <span aria-hidden className="h-8 w-8 shrink-0 rounded-full ring-1 ring-inset ring-ink/15" style={{ background: hex }} />
      <span className="flex min-w-0 flex-1 flex-col">
        <b className="text-[14px] font-semibold text-ink">{name}</b>
        <small className="truncate text-[11.5px] text-ink/55">{line}</small>
      </span>
      {trail ? <span className="font-mono text-[11.5px] text-ink/50">{trail}</span> : null}
      {onTap && !disabled ? <ChevronDown aria-hidden className="h-4 w-4 text-ink/40" /> : null}
    </>
  );
  return onTap && !disabled ? (
    <button type="button" onClick={onTap} className="sn-press flex min-h-11 w-full items-center gap-3 border-b border-ink/10 px-1 py-1.5 text-left" data-mood-board-colour={data}>
      {body}
    </button>
  ) : (
    <div className="flex min-h-11 w-full items-center gap-3 border-b border-ink/10 px-1 py-1.5" data-mood-board-colour={data}>
      {body}
    </div>
  );
}

function LaneRow({ part, five, palette, frozen, onTap }: { part: LanePart; five: readonly string[]; palette: RolePalette; frozen: boolean; onTap: () => void }) {
  const c = lanePartColour(part, five, palette);
  const line = frozen ? 'Agreed with your supplier' : c.setByYou ? 'Set by you' : `Follows ${c.followsLabel}`;
  /* Only a part with a colour of its own to store can be set; the rest follow their main colour. */
  return <ColourRow hex={c.hex} name={part.label} line={line} onTap={part.field ? onTap : undefined} disabled={frozen} data={`part-${part.label}`} />;
}

function Strip({ colours }: { colours: readonly string[] }) {
  return (
    <span className="flex gap-1.5" aria-hidden>
      {colours.map((c, i) => (
        <i key={i} className="h-11 flex-1 rounded-md ring-1 ring-inset ring-ink/10" style={{ background: c }} />
      ))}
    </span>
  );
}

/** The role's figure, in its colour — a head and a gown. */
function Figure({ colour }: { colour: string }) {
  return (
    <span aria-hidden className="relative h-[72px] w-[46px] shrink-0">
      <span className="absolute left-[15px] top-0 h-4 w-4 rounded-full bg-[#E9D9C8]" />
      <span className="absolute left-[6px] top-[18px] h-[54px] w-[34px] rounded-t-2xl rounded-b-sm ring-1 ring-inset ring-ink/10" style={{ background: colour }} />
    </span>
  );
}
