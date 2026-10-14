'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Palette, PenLine, Plus, Search, Sparkles, Trash2, X } from 'lucide-react';
import { useMaker } from '../../../launch/_components/maker-context';
import { useOneOpen } from '@/lib/one-open';
import { makerSave } from '@/lib/maker-refresh';
import { compressImageForWeb } from '@/lib/image-compress';
import { extractPaletteFromFile } from '@/lib/extract-palette';
import { MOODBOARD_SLOT_POSITIONS } from '@/lib/moodboard-slots';
import { PALETTE_LIMITS, sanitizePaletteStyle, type PaletteKey, type RolePalette, type RoomDressing } from '@/lib/mood-board';
import { derivedBoardFor, displayColorsFor } from '@/lib/mood-board-derive';
import { FLORIST_LANE_PARTS, MAIN_COLOUR_SLOTS, ROOM_LANE_PARTS, lanePartColour, type LanePart } from '@/lib/colour-access';
import { STUDIO_INSPIRATION_SLOTS, attireBoardsAfter, attireBoardsUnder, photoTag, type StudioInspirationSlot } from '@/lib/inspiration-slots';
import { PICK_LABEL, attireRow, firstStyleOf, picksOf, withFirstStyle, withSecondColours, withSecondStyle, type AttireTier } from '@/lib/attire-rows';
import { STYLE_ORDER, garmentFor, type FigureWho } from '@/lib/attire-figures';
import { isAttireStyle } from '@/lib/role-dress-code';
import { RoleFigure } from '@/app/_components/role-figure';
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
import { MOOD_BOARD_NOT_SAVED, dressCodeDraftFields, paletteDraftFields, slotRemoveFields, slotUploadFields } from '@/lib/studio-mood-board-saves';
import { STUDIO_GROUP, STUDIO_GROUP_HEAD } from '@/lib/studio-skin';
import type { HubSectionCanvas } from '@/lib/hub-canvas';
import { ActionButton } from '@/components/action-button';
import { ChosenRow, FORM_PILL_CLASS, FormRow, FormRows, usePillWidth } from '@/app/_components/form-row';
import { Explain } from '@/app/_components/explain';
import { PeekToast } from '@/app/_components/toast/peek-toast';
import { ISeg, ISegmented } from '../../../website/editor/_components/inspector-kit';
import { GuestConfirmActions, GuestPopup } from '../../../guests/_components/guest-popup';
import { plainRefusal } from '../../../guests/_components/plain-refusal';
import { useMoodBoardActions } from './mood-board-actions-context';
import { ColourPickerSheet, StudioSheet } from './colour-picker-sheet';
import { AutoPaletteSheet } from './auto-palette-sheet';
import { GalleryPicker } from './gallery-picker';
import { StudioDos } from './studio-dos';
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
 * ONE `ISegmented` (the Pill selector) — Palette · Attire · Inspiration · Do's & Don'ts (owner 2026-10-08, "ok"; the
 * attire boards — Bridal gown · Groom's suit · Bridesmaids · Groomsmen · Flower girl · Ring bearer ·
 * Entourage — live in Attire next to their role) — under
 * the Studio's Tool ▾ row, with ✨ Auto above it. Nothing here is a
 * new write:
 *
 *   · the five main colours, the room's parts and a role's colours → the hub
 *     DRAFT (`hubDraftAction`, `role_palette` as a painted board — step 4c),
 *     each change undoable here, published by Apply;
 *   · a role's outfit → the dress code, through the hub draft (`hubDraftAction`),
 *     so guests meet it at Apply;
 *   · photos → the shipped `uploadMoodboardSlot` / `applyGalleryPick`, into the
 *     shipped slots; the Do's & Don'ts → the shipped `updateDressCodeLists` (`studio-dos.tsx`);
 *   · a supplier's colour change → Keep, or Undo it (`rejectColourChange`, MB16).
 *
 * Opening it writes nothing.
 *
 * 🧩 ON THE TEMPLATES (2026-10-09, `INTERACTION_RULES.md` § 9; `studio-mood-board-are-the-templates.test.ts`): every colour, part and
 * supplier-change row is a Form row; each role's outfit is the Form row's dropdown; every button is the one ActionButton; a result
 * is the top toast (with Undo where it can be undone) and a failure is said in plain words on the page and never looks saved; a photo
 * comes off through the centred confirm box. Every write below is the SAME action with the SAME fields as before
 * (`lib/studio-mood-board-saves.ts`, held by `studio-mood-board-posts-the-same.test.ts`); the writers come from
 * `useMoodBoardActions()` so the dev lab can stand in for them.
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
  /** How many on the guest list hold it — "8 people" (absent: not counted). */
  people?: number;
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
  /** The Do's & Don'ts as stored (the shipped lists), or null when they could not be read. */
  dosLists: { dos: string[]; donts: string[]; incStarter: boolean } | null;
  /** The Dress code scene's canvas (drafted over live) for the look the lists are drawn in — absent where the event has no such scene. */
  dosLookCanvas?: HubSectionCanvas | null;
  /** The section it opens on (the Maker opens on Palette; a guard draws each section). */
  startTab?: Tab;
};

export type Tab = 'colours' | 'attire' | 'insp' | 'dos';
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
  | { kind: 'role-colour'; key: PaletteKey; label: string; index: number }
  /** 👗 The SECOND pick's colours (women · girls, 2026-10-14) — a colour changed or removed (`index`), or added (null). */
  | { kind: 'second-colour'; row: StudioAttireRow; label: string; index: number | null };
type Sheet =
  | { kind: 'picker'; target: PickTarget }
  | { kind: 'auto' }
  | { kind: 'browse'; slot: StudioInspirationSlot }
  /** 👗 A role's note — "Ivory, not white" (`dress_code_config[tier][key].note`, read on their invitation). */
  | { kind: 'note'; row: StudioAttireRow }
  | null;

type Tile = { url: string; credit: string | null; swatches: string[] };

const SAVE_AFTER_MS = 600;

export function MoodBoardStudio(props: MoodBoardStudioProps) {
  const { eventId } = props;
  const router = useRouter();
  const { hubDraftAction, rejectColourChange, uploadMoodboardSlot, removeMoodboardSlot, applyGalleryPick, fetchGalleryAssets } = useMoodBoardActions();
  const [tab, setTab] = useState<Tab>(props.startTab ?? 'colours');
  const [sheet, setSheet] = useState<Sheet>(null);
  useOneOpen(sheet !== null, () => setSheet(null));
  /* The Studio's Tool row's right end (`StudioToolRow` `[data-studio-row-end]`) — found once mounted. */
  /* Only while the Mood Board is the tool on screen: Studio keeps its tools mounted, hidden. */
  const shown = useMaker()?.detailsItem === 'mood-board';
  const [rowEnd, setRowEnd] = useState<Element | null>(null);
  useEffect(() => setRowEnd(shown ? document.querySelector('[data-studio-row-end]') : null), [shown]);
  /* The top toast needs the body (the dashboard page is a transformed box, inside which `fixed` is not the screen). */
  const [body, setBody] = useState<HTMLElement | null>(null);
  useEffect(() => setBody(document.body), []);

  /* ── what the page SAYS ──
     · a RESULT is the top toast — with Undo where it can be undone;
     · a failure, or a refusal the couple must read in full, is a line on the page in plain words (never the server's raw text),
       and a failure never looks saved. */
  const toastSeq = useRef(0);
  const [toast, setToast] = useState<{ n: number; text: string; undo?: () => void } | null>(null);
  const [problem, setProblem] = useState<{ text: string; failed: boolean } | null>(null);
  const tell = (text: string, undo?: () => void) => {
    setProblem(null);
    setToast({ n: ++toastSeq.current, text, undo });
  };
  const refuse = (text: string) => {
    setToast(null);
    setProblem({ text, failed: false });
  };
  const failed = (text: string) => {
    setToast(null);
    setProblem({ text, failed: true });
  };

  /* ── the palette: local, written through the Mood Board's own writer ── */
  const [palette, setPalette] = useState<RolePalette>(props.palette);
  const paletteRef = useRef(palette);
  paletteRef.current = palette;
  /* What the draft holds, as far as this page knows — a failed write goes back to it. */
  const savedPalette = useRef(props.palette);
  const timer = useRef<number | null>(null);
  const flushPalette = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    /* 🎨 INTO THE DRAFT (step 4c, controller 2026-10-07 — "Apply publishes"): the
       hub draft now holds a PAINTED board (\`sanitizePaintedPalette\`), so the
       picker, ✨ Auto and the part palettes are tried here and published by
       Apply, through the Mood Board's own write shape — never live. */
    const wrote = paletteRef.current;
    const fd = new FormData();
    for (const [k, v] of Object.entries(paletteDraftFields(wrote))) fd.set(k, v);
    const back = (text: string) => {
      /* The draft does not hold these colours — the board goes back to what it does hold, and says so. */
      setPalette(savedPalette.current);
      paletteRef.current = savedPalette.current;
      failed(text);
    };
    makerSave(() => hubDraftAction(eventId, fd), () => router.refresh())
      .then((r) => {
        if (r.ok) {
          savedPalette.current = wrote;
          setProblem(null);
        } else back(plainRefusal(r.error, MOOD_BOARD_NOT_SAVED.palette));
      })
      .catch(() => back(MOOD_BOARD_NOT_SAVED.palette));
  }, [eventId, router, hubDraftAction]);
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
    timer.current = window.setTimeout(flushPalette, SAVE_AFTER_MS);
    tell(said, () => commit(before, 'Put back.'));
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

  /* ═══ COLOURS ═══ */
  const pickMain = (index: number, hex: string) => commit(withMainColour(palette, five, index, hex), `${MAIN_COLOUR_SLOTS[index]} changed.`);
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
    commit(withPartColour(palette, part.field, hex), `${part.label} set.`);
  };
  const pickRole = (key: PaletteKey, hex: string) => commit(withRoleColours(palette, key, [...roleColours(key), hex]), 'Colour added.');
  /* 🎨 A role's own colour, changed or removed (owner 2026-10-07: *"the palettes can still be changed to
     colors manually"*) — any colour, not only the five; into the same draft as every pick here. */
  const setRoleColour = (key: PaletteKey, index: number, hex: string) =>
    commit(withRoleColours(palette, key, roleColours(key).map((c, i) => (i === index ? hex : c))), 'Colour changed.');
  const removeRoleColour = (key: PaletteKey, index: number) =>
    commit(withRoleColours(palette, key, roleColours(key).filter((_, i) => i !== index)), 'Colour removed.');

  const takeAuto = (s: AutoSuggestion) => {
    setSheet(null);
    commit(withAutoPalette(palette, s.five), `${s.name} — five colours set.`);
  };

  /* ═══ ATTIRE ═══ */
  /* 👗 Every attire write is ONE draft write of the WHOLE dress code (`dressCodeDraftFields`) — the first pick where it
     has always been stored, the second (women · girls) in `women` (`lib/attire-rows.ts`), the note on the row's rule. */
  const wear = (row: StudioAttireRow, style: string | null) => {
    if (!dress) return;
    saveDress(withFirstStyle(dress, row.tier, row.key, style, withAttireStyle));
  };
  const wearSecond = (row: StudioAttireRow, style: string | null) => {
    if (!dress) return;
    saveDress(withSecondStyle(dress, row.tier, row.key, isAttireStyle(style) ? style : null));
  };
  const secondColours = (row: StudioAttireRow, colours: string[] | null) => {
    if (!dress) return;
    saveDress(withSecondColours(dress, row.tier, row.key, colours));
  };
  const noteFor = (row: StudioAttireRow) => (((dress?.[row.tier] ?? {}) as Record<string, { note?: unknown }>)[row.key]?.note as string | undefined) ?? '';
  const writeNote = (row: StudioAttireRow, note: string) => {
    if (!dress) return;
    const map = { ...((dress[row.tier] as Record<string, Record<string, unknown>> | undefined) ?? {}) };
    const rule = map[row.key];
    if (!rule) return;
    const said = note.trim().slice(0, 120);
    const { note: _was, ...rest } = rule;
    map[row.key] = said ? { ...rest, note: said } : rest;
    saveDress({ ...dress, [row.tier]: map });
  };
  const saveDress = (next: Record<string, unknown>) => {
    if (!dress) return;
    const before = dress;
    setDress(next);
    const fd = new FormData();
    for (const [k, v] of Object.entries(dressCodeDraftFields(next))) fd.set(k, v);
    const back = (text: string) => {
      setDress(before);
      failed(text);
    };
    makerSave(() => hubDraftAction(eventId, fd), () => router.refresh())
      .then((r) => {
        if (r.ok) setProblem(null);
        else back(plainRefusal(r.error, MOOD_BOARD_NOT_SAVED.wear));
      })
      .catch(() => back(MOOD_BOARD_NOT_SAVED.wear));
  };

  /* ═══ INSPIRATION ═══ */
  const fileFor = useRef<HTMLInputElement>(null);
  const [uploadSlot, setUploadSlot] = useState<string | null>(null);
  const freeIn = (slot: string) => MOODBOARD_SLOT_POSITIONS.filter((p) => !tiles[slot]?.[p - 1]);
  const openUpload = (slot: string) => {
    if (freeIn(slot).length === 0) {
      refuse('This part already holds its three photos — remove one to add another.');
      return;
    }
    setUploadSlot(slot);
    fileFor.current?.click();
  };
  const setTile = (slot: string, pos: number, tile: Tile | undefined) =>
    setTiles((t) => ({ ...t, [slot]: Object.assign([...(t[slot] ?? [])], { [pos - 1]: tile }) }));
  const onFile = async (file: File | undefined) => {
    const slot = uploadSlot;
    if (!file || !slot) return;
    const pos = freeIn(slot)[0];
    if (!pos) return;
    setTile(slot, pos, { url: '', credit: null, swatches: [] });
    try {
      /* 📱 Compressed on the phone before it leaves (the shipped `compressImageForWeb`, what FileUpload's `compressImage` runs). */
      const small = await compressImageForWeb(file);
      const swatches = await extractPaletteFromFile(small);
      const fd = new FormData();
      /* The photo sits between the place it goes to and the colours read from it, as it always has. */
      for (const [k, v] of Object.entries(slotUploadFields({ eventId, slot, pos, swatches }))) {
        if (k === 'palette_json') fd.set('file', small);
        fd.set(k, v);
      }
      const res = await uploadMoodboardSlot(fd);
      if (res.status === 'ok' && res.image_url) {
        setTile(slot, pos, { url: res.image_url, credit: null, swatches });
        setProblem(null);
      } else {
        setTile(slot, pos, undefined);
        failed(plainRefusal(res.message, MOOD_BOARD_NOT_SAVED.upload));
      }
    } catch {
      setTile(slot, pos, undefined);
      failed(MOOD_BOARD_NOT_SAVED.upload);
    }
  };
  /* ✕ asks once (the centred confirm box): a photo that comes off is gone — there is no Undo for it. */
  const [askRemove, setAskRemove] = useState<{ slot: string; pos: number; label: string } | null>(null);
  const removePhoto = async (slot: string, pos: number) => {
    const before = tiles[slot]?.[pos - 1];
    setTile(slot, pos, undefined);
    const fd = new FormData();
    for (const [k, v] of Object.entries(slotRemoveFields({ eventId, slot, pos }))) fd.set(k, v);
    const back = (text: string) => {
      /* The photo is still on the board — it goes back to where it was, and the page says so. */
      if (before) setTile(slot, pos, before);
      failed(text);
    };
    try {
      const res = await removeMoodboardSlot(fd);
      if (res.status === 'ok') setProblem(null);
      else back(plainRefusal(res.message, MOOD_BOARD_NOT_SAVED.remove));
    } catch {
      back(MOOD_BOARD_NOT_SAVED.remove);
    }
  };
  const applySlotPalette = (slot: StudioInspirationSlot, colours: string[]) => {
    const t = slot.target;
    if (t.kind === 'florals') {
      if (props.frozenDressing.includes('florals')) return refuse('Your florist has agreed the flowers — ask them to reopen it first.');
      commit(withPartColour(palette, 'florals', colours[0]!), 'Florist’s colours set.');
    } else if (t.kind === 'room') {
      const [dom, sup, acc] = slotsFromPhotoPalette(colours, five);
      let next = palette;
      const set = (f: keyof RoomDressing, hex: string | undefined) => {
        if (hex && !props.frozenDressing.includes(f)) next = withPartColour(next, f, hex);
      };
      set('linens', sup);
      set('chairs', acc);
      set('lighting_warmth', dom);
      commit(next, 'Room colours set.');
    } else if (t.kind === 'role') {
      commit(withRoleColours(palette, t.key, colours), ROLE_COLOURS_SAID[t.key]);
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
    try {
      const r = await rejectColourChange(eventId, c.id);
      if (r.status === 'ok' || r.status === 'already') {
        settle(c.id);
        setProblem(null);
        router.refresh();
      } else {
        failed(r.status === 'frozen' ? 'That part is agreed with your supplier — ask them to reopen it first.' : MOOD_BOARD_NOT_SAVED.undo);
      }
    } catch {
      failed(MOOD_BOARD_NOT_SAVED.undo);
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
          <span data-mood-board-part-follow="" className="self-start">
            <ActionButton tone="neutral" icon={X} label={`Follow ${c.followsLabel} again`} onClick={() => { setSheet(null); pickPart(t.part, null); }} className="!h-11" />
          </span>
        ) : null,
      };
    }
    if (t.kind === 'role-colour') {
      const now = roleColours(t.key);
      return {
        title: t.label,
        job: 'A colour they wear — any colour, not only your five',
        current: now[t.index] ?? five[0]!,
        onPick: (h: string) => setRoleColour(t.key, t.index, h),
        extra:
          now.length > Math.max(1, PALETTE_LIMITS[t.key].min) ? (
            <span data-mood-board-role-remove="" className="self-start">
              <ActionButton
                tone="neutral"
                icon={X}
                label="Remove this colour"
                onClick={() => {
                  setSheet(null);
                  removeRoleColour(t.key, t.index);
                }}
                className="!h-11"
              />
            </span>
          ) : null,
      };
    }
    if (t.kind === 'second-colour') {
      const now = secondNow(t.row);
      const at = t.index;
      if (at === null) return { title: t.label, job: 'Adds a colour they wear', current: now[0] ?? five[0]!, onPick: (h: string) => secondColours(t.row, [...now, h]), extra: null };
      return {
        title: t.label,
        job: 'A colour they wear — any colour, not only your five',
        current: now[at] ?? five[0]!,
        onPick: (h: string) => secondColours(t.row, now.map((c, i) => (i === at ? h : c))),
        extra:
          now.length > 1 ? (
            <span data-mood-board-role-remove="" className="self-start">
              <ActionButton
                tone="neutral"
                icon={X}
                label="Remove this colour"
                onClick={() => {
                  setSheet(null);
                  secondColours(t.row, now.filter((_, i) => i !== at));
                }}
                className="!h-11"
              />
            </span>
          ) : null,
      };
    }
    return { title: t.label, job: 'Adds a colour they wear', current: roleColours(t.key)[0] ?? five[0]!, onPick: (h: string) => pickRole(t.key, h), extra: null };
  };
  /** The second pick's colours as drawn: its own, else the row's (the first pick's). */
  const secondNow = (row: StudioAttireRow): string[] => {
    const def = attireRow(row.tier as AttireTier, row.key);
    const own = def ? picksOf(dress, def)[1]?.colours : null;
    return own ? [...own] : row.paletteKey ? roleColours(row.paletteKey) : [];
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
          <span data-mood-board-search={slot.slotKey}>
            <ActionButton tone="neutral" quiet icon={Search} label="Search ideas" name={`Search ideas for ${slot.label}`} onClick={() => setSheet({ kind: 'browse', slot })} />
          </span>
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {/* The Upload kind's tile (§ 21): one clear place to add a file. It is not the shared `FileUpload`, because the board's write
              (`uploadMoodboardSlot`) takes the photo itself with the colours read from it — see the guard's list of what is not a template. */}
          <button type="button" data-mood-board-add={slot.slotKey} aria-label={`Add a photo to ${slot.label}`} onClick={() => openUpload(slot.slotKey)} className="sn-press flex h-20 w-20 flex-none items-center justify-center rounded-xl bg-ink/5 text-sn-accent">
            <Plus aria-hidden className="h-6 w-6" />
          </button>
          {photos.map(({ pos, tile }) => (
            <span key={pos} className="relative h-20 w-20 flex-none overflow-hidden rounded-xl bg-ink/5">
              {tile!.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tile!.url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-[11px] text-ink/50">Uploading…</span>
              )}
              {photoTag(tile!.credit) ? <em className="absolute bottom-1 left-1 rounded-md bg-ink/55 px-1.5 py-0.5 text-[9.5px] not-italic text-white">{photoTag(tile!.credit)}</em> : null}
              {tile!.url ? (
                <span className="absolute right-0 top-0 scale-75">
                  <ActionButton tone="neutral" iconOnly icon={X} label="Remove this photo" onClick={() => setAskRemove({ slot: slot.slotKey, pos, label: slot.label })} />
                </span>
              ) : null}
            </span>
          ))}
        </div>
        <div className="flex min-h-11 items-center gap-2">
          {slotPalette.length > 0 ? (
            <>
              <Swatches colours={slotPalette} label={`${slot.label}’s palette`} />
              {slot.useLabel ? (
                <span data-mood-board-use-slot={slot.slotKey} className="ml-auto">
                  <ActionButton tone="neutral" icon={Sparkles} label={slot.useLabel} onClick={() => applySlotPalette(slot, slotPalette)} />
                </span>
              ) : null}
            </>
          ) : (
            <small className="text-[12px] text-ink/55">Add photos to get its palette</small>
          )}
        </div>
      </section>
    );
  };

  /* 👗 A ROLE'S OWN PHOTOS, IN ATTIRE (prototype `ideasHTML`): its photos small, how many, ＋ (the couple's own) and
     Search ideas › (the suppliers' — the shipped picker). A photo comes off through the same confirm box; the photos'
     colours are offered to the role where its board has one ("Use for …"). `named` — a role with two boards (the
     bearers: Flower girl · Ring bearer) says whose each is. */
  const ideasRow = (slot: StudioInspirationSlot, named: boolean) => {
    const row = tiles[slot.slotKey] ?? [];
    const photos = MOODBOARD_SLOT_POSITIONS.map((p) => ({ pos: p, tile: row[p - 1] })).filter((x) => x.tile);
    const slotPalette = paletteFromPhotos(photos.flatMap((x) => x.tile!.swatches), 5);
    const count = photos.length === 0 ? 'No photos yet' : photos.length === 1 ? '1 photo' : `${photos.length} photos`;
    return (
      <div className="flex flex-col gap-1" data-mood-board-slot={slot.slotKey}>
        <div className="flex min-h-11 items-center gap-1.5">
          {photos.map(({ pos, tile }) =>
            tile!.url ? (
              <ActionButton
                key={pos}
                tone="neutral"
                quiet
                iconOnly
                icon={<Thumb src={tile!.url} />}
                label={`Remove this photo from ${slot.label}`}
                onClick={() => setAskRemove({ slot: slot.slotKey, pos, label: slot.label })}
              />
            ) : (
              <span key={pos} className="h-[34px] w-[34px] flex-none animate-pulse rounded-[7px] bg-ink/10" />
            ),
          )}
          <span className="ml-1 min-w-0 flex-1 truncate text-[12px] text-ink/55">{named ? `${slot.label} · ${count}` : count}</span>
          <ActionButton tone="neutral" iconOnly icon={Plus} label={`Add a photo to ${slot.label}`} onClick={() => openUpload(slot.slotKey)} />
          <span data-mood-board-search={slot.slotKey}>
            <ActionButton tone="neutral" quiet icon={Search} label="Search ideas" name={`Search ideas for ${slot.label}`} onClick={() => setSheet({ kind: 'browse', slot })} />
          </span>
        </div>
        {slotPalette.length > 0 && slot.useLabel ? (
          <div className="flex min-h-11 items-center gap-2">
            <Swatches colours={slotPalette} label={`${slot.label}’s palette`} />
            <span data-mood-board-use-slot={slot.slotKey} className="ml-auto">
              <ActionButton tone="neutral" icon={Sparkles} label={slot.useLabel} onClick={() => applySlotPalette(slot, slotPalette)} />
            </span>
          </div>
        ) : null}
      </div>
    );
  };

  /* ✨ Auto — IN the Studio's Tool row, beside Tool ▾ (prototype `.fhead`: MOOD BOARD ▾ · ✨ Auto), portalled into its right end;
     drawn here only where there is no such row (the shipped Mood Board page). */
  const bar = (
    <div className="flex min-h-11 items-center gap-1.5" data-mood-board-studio-bar="">
      <span data-mood-board-auto="">
        <ActionButton tone="neutral" icon={Sparkles} label="Auto" onClick={() => setSheet({ kind: 'auto' })} />
      </span>
    </div>
  );

  return (
    <div data-mood-board="studio" className="flex flex-col gap-3 pb-8">
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
      {/* 🧾 No "✓ Saved" chip (owner 2026-10-07, *"yes remove the saved."*): edits go to the draft and the ONE signal is ✓ Apply's count.
          A save that FAILED — or a refusal that must be read in full — stays on the page in plain words, never silent. */}
      {problem ? (
        <p role="alert" data-mood-board-save={problem.failed ? 'error' : 'refused'} className="px-1.5 text-[12.5px] font-semibold text-danger-700">
          {problem.text}
        </p>
      ) : null}
      {toast && body
        ? createPortal(
            <PeekToast
              key={toast.n}
              data="mood-board"
              action={toast.undo ? { label: 'Undo', onPress: () => { const u = toast.undo; setToast(null); u?.(); } } : undefined}
              onGone={() => setToast((t) => (t?.n === toast.n ? null : t))}
            >
              {toast.text}
            </PeekToast>,
            body,
          )
        : null}

      {/* 📎 ONE file input for every board's ＋, mounted WHICHEVER tab is open. It used to live inside the
          Inspiration tab, so a board in Attire tapped ＋ and nothing opened — a refusal with no words. */}
      <input ref={fileFor} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" data-mood-board-file="" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />

      {tab === 'colours' ? (
        <div className="flex flex-col" data-mood-board-colours="">
          {openChanges.length > 0 ? (
            <div className={STUDIO_GROUP}>
              <FormRows data="mood-board-changes">
                {openChanges.map((c) => (
                  <FormRow
                    key={c.id}
                    name={`${c.who} suggested a change`}
                    attrs={{ 'data-colour-change': c.id }}
                    line={
                      <span className="flex flex-wrap items-center gap-1.5">
                        {c.what} ·{c.from ? <Dot hex={c.from} /> : null}
                        {c.from ?? 'following'} → <Dot hex={c.to} />
                        {c.to}
                      </span>
                    }
                    below={
                      <div className="flex gap-2 pb-3 [&>*]:min-w-0 [&>*]:flex-1 [&_.ab]:w-full">
                        <ActionButton tone="neutral" label="Keep" icon={Check} onClick={() => settle(c.id)} />
                        <ActionButton tone="neutral" label="Undo it" icon={X} onClick={() => void undoChange(c)} />
                      </div>
                    }
                  />
                ))}
              </FormRows>
            </div>
          ) : null}
          <Heading title="Your five main colours" tip="One palette with Look › Colours. Every part below follows them until you set it." />
          <div className={STUDIO_GROUP}>
            <FormRows width="short" data="mood-board-five">
              {five.map((hex, i) => (
                <ColourRow key={i} hex={hex} name={MAIN_COLOUR_SLOTS[i]!} line={MAIN_COLOUR_JOBS[i]!} onTap={() => setSheet({ kind: 'picker', target: { kind: 'main', index: i } })} data={`main-${i}`} />
              ))}
            </FormRows>
          </div>
          <Heading title="The room — for your stylist" tip="Your booked stylist can change these — and your five main colours. You see every change." />
          <div className={STUDIO_GROUP}>
            <FormRows width="short" data="mood-board-room">
              {ROOM_LANE_PARTS.map((p) => (
                <LaneRow key={p.label} part={p} five={five} palette={palette} frozen={Boolean(p.field && props.frozenDressing.includes(p.field))} onTap={() => setSheet({ kind: 'picker', target: { kind: 'part', part: p } })} />
              ))}
            </FormRows>
          </div>
          <Heading title="Flowers — for your florist" tip="Your booked florist can change the flowers. You see every change." />
          <div className={STUDIO_GROUP}>
            <FormRows width="short" data="mood-board-flowers">
              {FLORIST_LANE_PARTS.map((p) => (
                <LaneRow key={p.label} part={p} five={five} palette={palette} frozen={Boolean(p.field && props.frozenDressing.includes(p.field))} onTap={() => setSheet({ kind: 'picker', target: { kind: 'part', part: p } })} />
              ))}
            </FormRows>
          </div>
        </div>
      ) : null}

      {tab === 'attire' ? (
        /* 👗 ONE BLOCK PER ROLE (owner 2026-10-14, DECISION_LOG "EFFECTS + ATTIRE DESIGN APPROVED"; prototype
           `maker_effects_and_attire_2026-10-14_fable.html` `attireProposedHTML`): the role's name and when it arrives →
           its people, each a figure in the garment its Wear ▾ names and the colours beside it (two picks — men · women,
           boys · girls — where the role holds both) → the note → the role's own photos. Divided by a hairline; a frame
           only on what is pressed. The Entourage board is gone (owner: "remove entourage"). */
        <div className="flex flex-col" data-mood-board-attire="">
          {props.attire.length === 0 ? <p className="py-4 text-[13px] text-ink/60">Add people with a role to your guest list and they appear here.</p> : null}
          {props.attire.map((row) => {
            const def = attireRow(row.tier as AttireTier, row.key);
            const picks = def ? picksOf(dress, def) : [{ who: 'f' as FigureWho, style: null, colours: null }];
            const two = picks.length === 2;
            const note = noteFor(row);
            const canNote = Boolean(dress && firstStyleOf(dress, row.tier as AttireTier, row.key));
            return (
              <section key={`${row.tier}:${row.key}`} data-mood-board-role={row.key} className="flex flex-col gap-1.5 border-t border-ink/10 py-3 first:border-t-0">
                <header className="flex flex-wrap items-baseline gap-2">
                  <h3 className="font-serif text-[21px] font-medium leading-tight text-ink">{row.label}</h3>
                  {row.arrives ? <small className="ml-auto whitespace-nowrap text-[12px] text-ink/55">Arrives {row.arrives}</small> : null}
                </header>
                {row.people ? <p className="text-[12px] text-ink/65">{row.people === 1 ? '1 person' : `${row.people} people`}</p> : null}
                <div className="flex gap-2.5" data-mood-board-picks={picks.length}>
                  {picks.map((pick, pi) => {
                    const colours = pi === 0 ? (row.paletteKey ? roleColours(row.paletteKey) : []) : secondNow(row);
                    const max = row.paletteKey ? PALETTE_LIMITS[row.paletteKey].max : 0;
                    const pickLabel = two ? `${row.label} — ${PICK_LABEL[pick.who].toLowerCase()}` : row.label;
                    const figure = (
                      <span className={`flex h-[132px] flex-none items-end justify-center ${two ? "min-w-[62px]" : "min-w-[86px]"}`} data-mood-board-figure={pick.who}>
                        <RoleFigure
                          roleKey={row.key}
                          people={[{ who: pick.who, garment: garmentFor(pick.who, pick.style), main: colours[0] ?? five[3]! }]}
                          className="h-[132px]"
                        />
                      </span>
                    );
                    const swatches = row.paletteKey ? (
                      <span className={`flex items-center ${two ? 'flex-col items-start' : 'flex-wrap'}`} data-mood-board-swatches={pick.who}>
                        {colours.map((c, i) => (
                          <button
                            key={i}
                            type="button"
                            aria-label={`${pickLabel} colour ${c} — change it`}
                            data-mood-board-role-colour={i}
                            onClick={() =>
                              setSheet({
                                kind: 'picker',
                                target: pi === 0 ? { kind: 'role-colour', key: row.paletteKey!, label: row.label, index: i } : { kind: 'second-colour', row, label: pickLabel, index: i },
                              })
                            }
                            className={`sn-press inline-flex h-11 w-11 items-center justify-center rounded-full ${two ? '-my-1' : ''}`}
                          >
                            <i aria-hidden className={`${two ? 'h-[26px] w-[26px]' : 'h-7 w-7'} rounded-full border border-ink/10`} style={{ background: c }} />
                          </button>
                        ))}
                        {colours.length < max && (pi === 0 || dress) ? (
                          <ActionButton
                            tone="neutral"
                            iconOnly
                            icon={Plus}
                            label={pi === 0 ? `Add a colour for ${row.label}` : `Add a colour for ${pickLabel}`}
                            onClick={() =>
                              setSheet({
                                kind: 'picker',
                                target: pi === 0 ? { kind: 'role', key: row.paletteKey!, label: row.label } : { kind: 'second-colour', row, label: pickLabel, index: null },
                              })
                            }
                          />
                        ) : null}
                      </span>
                    ) : null;
                    /* Wear ▾ — the house dropdown (one ChosenRow); each person's fitting styles first, from the ONE vocabulary. */
                    const wearRow = dress ? (
                      <FormRows width="short" data="mood-board-wear">
                        <ChosenRow
                          name="Wear"
                          label={`${pickLabel} — what to wear`}
                          value={pick.style ?? ''}
                          options={[{ key: '', label: 'Not said yet' }, ...STYLE_ORDER[pick.who].map((k) => ({ key: k, label: props.attireStyles.find((st) => st.key === k)?.label ?? k }))]}
                          onPick={(k) => (pi === 0 ? wear(row, k || null) : wearSecond(row, k || null))}
                          buttonText={pick.style ? (props.attireStyles.find((st) => st.key === pick.style)?.label ?? pick.style) : 'Not said yet'}
                          dataAttr="data-mood-board-wear"
                          attrs={{ 'data-mood-board-wear-for': pick.who }}
                        />
                      </FormRows>
                    ) : null;
                    return (
                      <div key={pick.who} className="flex min-w-0 flex-1 flex-col gap-1.5" data-mood-board-pick={pick.who}>
                        {two ? <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink/55">{PICK_LABEL[pick.who]}</span> : null}
                        <div className="flex items-end gap-2.5">
                          {figure}
                          <div className="flex min-w-0 flex-1 flex-col justify-end gap-1.5">
                            {swatches}
                            {two ? null : wearRow}
                          </div>
                        </div>
                        {two ? wearRow : null}
                      </div>
                    );
                  })}
                </div>
                {row.key === 'guest' ? <p className="text-[12px] leading-snug text-ink/65">Guests wear any one of the colours above — never combined. The figures show the first.</p> : null}
                {canNote ? (
                  <div className="flex min-h-11 items-center gap-2" data-mood-board-role-note={row.key}>
                    <span className="flex-none text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink/55">Note</span>
                    {note ? <em className="min-w-0 flex-1 truncate text-[13px] text-ink">“{note}”</em> : <span className="min-w-0 flex-1 text-[13px] text-ink/55">Nothing yet</span>}
                    <ActionButton tone="neutral" quiet icon={PenLine} label={note ? 'Change' : 'Add a note'} name={`${note ? 'Change' : 'Add'} the note for ${row.label}`} onClick={() => setSheet({ kind: 'note', row })} />
                  </div>
                ) : null}
                {attireBoardsUnder(row.key).map((slot) => (
                  <div key={slot.slotKey} data-mood-board-attire-board={slot.slotKey}>
                    {ideasRow(slot, attireBoardsUnder(row.key).length > 1)}
                  </div>
                ))}
              </section>
            );
          })}
          {/* 👗 A board whose role is not on the guest list yet keeps its place — ideas come before the names. */}
          {attireBoardsAfter(props.attire.map((r) => r.key)).map((slot) => (
            <div key={slot.slotKey} data-mood-board-attire-board={slot.slotKey} className="border-t border-ink/10 py-2">
              {ideasRow(slot, true)}
            </div>
          ))}
        </div>
      ) : null}

      {tab === 'insp' ? (
        <div className="flex flex-col gap-4" data-mood-board-inspiration="">
          <div className={STUDIO_GROUP}>
            <FormRows data="mood-board-upload">
              <ChosenRow
                name="Upload your own photos"
                label="Upload your own photos — which part is it for?"
                value={null}
                options={STUDIO_INSPIRATION_SLOTS.filter((s) => !s.attire).map((s) => ({ key: s.slotKey, label: s.label }))}
                onPick={(k) => openUpload(k)}
                buttonText="Which part?"
                dataAttr="data-mood-board-upload"
              />
            </FormRows>
          </div>
          <div className="flex flex-col gap-2" data-mood-board-main-palette="">
            <Heading title="Your main palette" tip="Read from all your photos. Each part below has its own too." />
            {photoFive ? (
              <>
                <Swatches colours={photoFive} label="Your photos’ palette" wide />
                <div className="flex gap-2 [&_.ab]:w-full [&>span]:min-w-0 [&>span]:flex-1">
                  <span>
                    <ActionButton tone="brand" main icon={Sparkles} label="Use as my five main colours" onClick={() => commit(withAutoPalette(palette, photoFive), 'Five colours from your photos.')} />
                  </span>
                  <span className="flex-none [&_.ab]:w-auto">
                    <ActionButton tone="neutral" icon={Palette} label="Compare" onClick={() => setTab('colours')} />
                  </span>
                </div>
              </>
            ) : (
              <p className="text-[12.5px] text-ink/60">Add photos to get its palette.</p>
            )}
          </div>
          {STUDIO_INSPIRATION_SLOTS.filter((slot) => !slot.attire).map(slotBoard)}
        </div>
      ) : null}

      {tab === 'dos' ? (
        <div data-mood-board-dos="">
          {props.dosLists ? (
            <StudioDos eventId={eventId} dos={props.dosLists.dos} donts={props.dosLists.donts} incStarter={props.dosLists.incStarter} lookCanvas={props.dosLookCanvas ?? null} />
          ) : (
            <p role="alert" className="text-sm text-danger-700" data-mood-board-unread="">
              Your do&rsquo;s and don&rsquo;ts could not be loaded just now. Nothing was changed — please reopen this in a moment.
            </p>
          )}
        </div>
      ) : null}

      {askRemove ? (
        <RemovePhotoConfirm
          onKeep={() => setAskRemove(null)}
          onRemove={() => {
            const a = askRemove;
            setAskRemove(null);
            void removePhoto(a.slot, a.pos);
          }}
        />
      ) : null}

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
      {sheet?.kind === 'note' ? <NoteSheet label={`${sheet.row.label} · a note`} start={noteFor(sheet.row)} onClose={() => setSheet(null)} onSave={(text) => { const row = sheet.row; setSheet(null); writeNote(row, text); }} /> : null}
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
                setTile(k, pos, { url, credit, swatches: swatches ?? [] });
                setProblem(null);
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

/** "…’s colours set." — whose colours a board's palette became. */
const ROLE_COLOURS_SAID = {
  bride: 'Bride’s colours set.',
  wedding_party: 'Entourage’s colours set.',
  bridesmaids: 'Bridesmaids’ colours set.',
  groomsmen: 'Groomsmen’s colours set.',
} as const;

/** A group's name, and the ⓘ behind its longer line (the Form row's own ⓘ — one open at a time). */
function Heading({ title, tip }: { title: string; tip: string }) {
  return (
    <p className={STUDIO_GROUP_HEAD}>
      {title}
      <Explain title={title} className="-my-3.5">
        {tip}
      </Explain>
    </p>
  );
}

/** A small round swatch beside a word (a supplier's colour, before and after). */
function Dot({ hex }: { hex: string }) {
  return <i aria-hidden className="inline-block h-3 w-3 rounded-full border border-ink/15" style={{ background: hex }} />;
}

/** A row of colours read from photos — the circles are the couple's own colours; nothing here can be tapped. */
function Swatches({ colours, label, wide = false }: { colours: readonly string[]; label: string; wide?: boolean }) {
  return wide ? (
    <span className="flex gap-1.5" role="img" aria-label={label}>
      {colours.map((c, i) => (
        <i key={i} aria-hidden className="h-11 flex-1 rounded-md ring-1 ring-inset ring-ink/10" style={{ background: c }} />
      ))}
    </span>
  ) : (
    <span className="flex gap-1" role="img" aria-label={label}>
      {colours.map((c, i) => (
        <i key={i} aria-hidden className="h-6 w-6 rounded-full border border-ink/10" style={{ background: c }} />
      ))}
    </span>
  );
}

/** The answer of a colour row: the colour, its code and the arrow — the Form row's pill, opening the one colour picker. */
function ColourPill({ hex, name, onTap, data }: { hex: string; name: string; onTap: () => void; data: string }) {
  const width = usePillWidth();
  return (
    <button type="button" data-mood-board-colour={data} aria-haspopup="dialog" aria-label={`${name}: ${hex}. Tap to change`} onClick={onTap} className={`${FORM_PILL_CLASS} ${width} border-ink/15`}>
      <span className="flex min-w-0 items-center gap-2">
        <i aria-hidden className="h-5 w-5 flex-none rounded-full ring-1 ring-inset ring-ink/15" style={{ background: hex }} />
        <span className="truncate font-mono text-[12.5px] text-ink/70">{hex}</span>
      </span>
      <ChevronDown aria-hidden data-form-row-mark="arrow" className="h-4 w-4 flex-none text-sn-accent" strokeWidth={2} />
    </button>
  );
}

function ColourRow({ hex, name, line, onTap, data, disabled = false }: { hex: string; name: string; line: string; onTap?: () => void; data: string; disabled?: boolean }) {
  return (
    <FormRow name={name} line={line} attrs={{ 'data-mood-board-row': data }}>
      {onTap && !disabled ? (
        <ColourPill hex={hex} name={name} onTap={onTap} data={data} />
      ) : (
        /* Agreed with a supplier, or following a main colour: shown, not tappable — so nothing here looks as if it could be pressed. */
        <span data-mood-board-colour={data} className="inline-flex items-center gap-2 pr-1">
          <i aria-hidden className="h-5 w-5 flex-none rounded-full ring-1 ring-inset ring-ink/15" style={{ background: hex }} />
          <span className="font-mono text-[12.5px] text-ink/50">{hex}</span>
        </span>
      )}
    </FormRow>
  );
}

function LaneRow({ part, five, palette, frozen, onTap }: { part: LanePart; five: readonly string[]; palette: RolePalette; frozen: boolean; onTap: () => void }) {
  const c = lanePartColour(part, five, palette);
  const line = frozen ? 'Agreed with your supplier' : c.setByYou ? 'Set by you' : `Follows ${c.followsLabel}`;
  /* Only a part with a colour of its own to store can be set; the rest follow their main colour. */
  return <ColourRow hex={c.hex} name={part.label} line={line} onTap={part.field ? onTap : undefined} disabled={frozen} data={`part-${part.label}`} />;
}

/** A role's photo, small — the picture of the button that takes it off the board (a tap asks once, the same confirm box). */
function Thumb({ src }: { src: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- the couple's own photo, already sized by the board
  return <img src={src} alt="" className="h-[34px] w-[34px] rounded-[7px] object-cover" />;
}

/** 👗 A role's note — one line, up to 120 letters, read by that role on their invitation. Keep closes it unchanged. */
function NoteSheet({ label, start, onClose, onSave }: { label: string; start: string; onClose: () => void; onSave: (text: string) => void }) {
  const [text, setText] = useState(start);
  return (
    <StudioSheet label={label} onClose={onClose}>
      <div className="flex flex-col gap-2 px-1 pb-2" data-mood-board-role-note-sheet="">
        <input
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 120))}
          maxLength={120}
          placeholder="e.g. ivory, not white"
          aria-label={label}
          className="h-11 w-full rounded-xl border border-ink/15 bg-white px-3 text-[14px] text-ink"
        />
        <div className="flex gap-2 [&>span]:flex-1 [&_.ab]:w-full">
          <span>
            <ActionButton tone="neutral" icon={X} label="Keep" onClick={onClose} />
          </span>
          <span>
            <ActionButton tone="brand" main icon={Check} label="Save" onClick={() => onSave(text)} />
          </span>
        </div>
      </div>
    </StudioSheet>
  );
}

/**
 * 🧾 TAKING A PHOTO OFF A BOARD asks once — the approved centred confirm box (the guest list's `GuestPopup kind="confirm"`): the
 * rest of the screen dark and blurred, nothing behind works, a tap on the dark closes it as KEEP, never as the removal.
 * (Nothing brings a removed photo back, so there is no Undo to offer instead.)
 */
function RemovePhotoConfirm({ onKeep, onRemove }: { onKeep: () => void; onRemove: () => void }) {
  const titleId = useId();
  return (
    <GuestPopup kind="confirm" onClose={onKeep} labelledById={titleId}>
      <div className="space-y-3" data-mood-board-remove-photo="">
        <h2 id={titleId} className="font-display text-xl text-ink">
          Remove this photo?
        </h2>
        <p className="text-sm leading-relaxed text-ink/70">It comes off the board. This can’t be undone.</p>
        <GuestConfirmActions
          keep={<ActionButton tone="neutral" icon={X} label="Keep" onClick={onKeep} />}
          go={
            <div data-mood-board-remove-confirm="">
              <ActionButton tone="danger" main icon={Trash2} label="Remove" onClick={onRemove} />
            </div>
          }
        />
      </div>
    </GuestPopup>
  );
}
