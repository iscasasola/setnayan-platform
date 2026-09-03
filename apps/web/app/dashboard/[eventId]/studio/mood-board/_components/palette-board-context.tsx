'use client';

/**
 * The shared state behind MB5's live 00 → 02 derivation.
 *
 * `<ThemeCard>` (00) edits the couple's five majors; `<PaletteSection>` (02)
 * shows every role's colors derived from them, live, on the palette-style
 * engine (`lib/palette-styles.ts`). They are SIBLINGS in `page.tsx`, not
 * parent/child, so the only way both can read and mutate the SAME majors
 * without a network round trip between them is a shared client boundary —
 * this provider, wrapped around both in `page.tsx`.
 *
 * This component is a thin React wrapper. The actual mutations — and THE
 * ONE-DIRECTIONAL RULE ("02 never writes to 00") — live as plain, pure
 * functions in `lib/mood-board-board-ops.ts`, unit-tested there with no
 * React tree at all. Read that file's docblock before touching a setter
 * below; every one of them is a one-line delegation on purpose.
 *
 * ── touchedRoles ─────────────────────────────────────────────────────────
 * Any edit to a role marks it touched — from then on `deriveBoard` never
 * overwrites it (see `lib/mood-board-derive.ts`'s `displayColorsFor`),
 * through every major change and every style switch, until `releaseRole`
 * explicitly clears it. Persisted inside the same `role_palette` JSONB
 * column as `room_dressing` and `custom_roles` (`RolePalette.touched_roles`)
 * — no migration needed.
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState, useTransition } from 'react';
import {
  hasChosenMajors,
  resolveRoomDressing,
  sanitizePaletteStyle,
  type CustomPaletteRole,
  type PaletteKey,
  type RolePalette,
  type RoomDressing,
} from '@/lib/mood-board';
import { derivedBoardFor, displayColorsFor, effectiveMajors } from '@/lib/mood-board-derive';
import {
  applyAddMajorSlot,
  applyAddRoleColor,
  applyPasteInto,
  applyRelease,
  applyRemoveMajorSlot,
  applyRemoveRoleColor,
  applySetMajorColor,
  applySetRoleColor,
  applySwap,
} from '@/lib/mood-board-board-ops';
import type { Board, PaletteStyle } from '@/lib/palette-styles';

const SAVE_DEBOUNCE_MS = 900;

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

type ClipboardEntry = { hex: string; name: string } | null;
type SwapSource = { key: PaletteKey; index: number } | null;

type PaletteBoardValue = {
  eventId: string;
  palette: RolePalette;
  majors: string[];
  style: PaletteStyle;
  touched: ReadonlySet<PaletteKey>;
  derived: Board | null;
  majorsChosen: boolean;
  saveStatus: SaveStatus;

  colorsFor(key: PaletteKey): string[];
  isTouched(key: PaletteKey): boolean;

  setMajorColor(index: number, hex: string): void;
  addMajorSlot(): void;
  removeMajorSlot(index: number): void;

  setStyle(style: PaletteStyle): void;

  setRoleColor(key: PaletteKey, index: number, hex: string): void;
  addRoleColor(key: PaletteKey): void;
  removeRoleColor(key: PaletteKey, index: number): void;
  releaseRole(key: PaletteKey): void;

  roomDressing: Required<RoomDressing>;
  roomDressingOverride: RoomDressing;
  setRoomDressing(field: keyof RoomDressing, hex: string): void;
  resetRoomDressing(field: keyof RoomDressing): void;

  customRoles: CustomPaletteRole[];
  addCustomRole(): void;
  removeCustomRole(index: number): void;
  updateCustomRoleLabel(index: number, label: string): void;
  addCustomRoleColor(index: number): void;
  updateCustomRoleColor(index: number, colorIndex: number, hex: string): void;
  removeCustomRoleColor(index: number, colorIndex: number): void;

  /** The internal colour clipboard — "Copy this colour" / "Paste" across any
   *  two swatches on the board, never the system clipboard. */
  clipboard: ClipboardEntry;
  copyToClipboard(hex: string, name: string): void;
  pasteFrom(key: PaletteKey, index: number): void;

  /** Swap mode: mark one swatch as the source, then commit against a second
   *  — the two colors trade places, both roles touched. */
  swapSource: SwapSource;
  beginSwap(key: PaletteKey, index: number): void;
  commitSwap(key: PaletteKey, index: number): void;
  cancelSwap(): void;
};

const PaletteBoardContext = createContext<PaletteBoardValue | null>(null);

/** `null` outside a `<PaletteBoardProvider>` — callers (e.g. `<ThemeCard>`
 *  rendered standalone in its own tests) must treat that as "no majors
 *  editor here", not throw. See `theme-card.tsx`. */
export function usePaletteBoard(): PaletteBoardValue | null {
  return useContext(PaletteBoardContext);
}

export function PaletteBoardProvider({
  eventId,
  initial,
  saveAction,
  children,
}: {
  eventId: string;
  initial: RolePalette;
  saveAction: (formData: FormData) => Promise<void>;
  children: React.ReactNode;
}) {
  const [palette, setPalette] = useState<RolePalette>(initial);
  const [clipboard, setClipboard] = useState<ClipboardEntry>(null);
  const [swapSource, setSwapSource] = useState<SwapSource>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [, startTransition] = useTransition();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleSave = useCallback(
    (next: RolePalette) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      setSaveStatus('saving');
      saveTimer.current = setTimeout(() => {
        startTransition(async () => {
          try {
            const formData = new FormData();
            formData.set('event_id', eventId);
            formData.set('palette_json', JSON.stringify(next));
            await saveAction(formData);
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus((s) => (s === 'saved' ? 'idle' : s)), 2000);
          } catch {
            setSaveStatus('error');
          }
        });
      }, SAVE_DEBOUNCE_MS);
    },
    [eventId, saveAction],
  );

  const mutate = useCallback(
    (fn: (p: RolePalette) => RolePalette) => {
      setPalette((p) => {
        const next = fn(p);
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave],
  );

  // Deliberately keyed on `palette.reception` alone, not the whole `palette`
  // — `effectiveMajors` only ever reads that field, and re-running the OKLCH
  // engine (`derived` below) on every unrelated role edit would defeat the
  // point of memoizing it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const majors = useMemo(() => effectiveMajors(palette), [palette.reception]);
  const style = sanitizePaletteStyle(palette.palette_style);
  const touched = useMemo(() => new Set(palette.touched_roles ?? []), [palette.touched_roles]);
  // `majors` is itself a memo above, so it's a stable reference whenever
  // `palette.reception` hasn't changed — safe to depend on directly.
  const derived = useMemo(() => derivedBoardFor(majors, style), [majors, style]);

  const roomDressingOverride = palette.room_dressing ?? {};
  const roomDressing = resolveRoomDressing({ reception: palette.reception, room_dressing: roomDressingOverride });

  const value: PaletteBoardValue = {
    eventId,
    palette,
    majors,
    style,
    touched,
    derived,
    majorsChosen: hasChosenMajors(palette),
    saveStatus,

    colorsFor: (key) => displayColorsFor(key, palette, touched, derived),
    isTouched: (key) => touched.has(key),

    setMajorColor: (index, hex) => mutate((p) => applySetMajorColor(p, index, hex)),
    addMajorSlot: () => mutate((p) => applyAddMajorSlot(p)),
    removeMajorSlot: (index) => mutate((p) => applyRemoveMajorSlot(p, index)),

    setStyle: (next) => mutate((p) => ({ ...p, palette_style: next })),

    setRoleColor: (key, index, hex) => mutate((p) => applySetRoleColor(p, key, index, hex)),
    addRoleColor: (key) => mutate((p) => applyAddRoleColor(p, key)),
    removeRoleColor: (key, index) => mutate((p) => applyRemoveRoleColor(p, key, index)),
    releaseRole: (key) => mutate((p) => applyRelease(p, key)),

    roomDressing,
    roomDressingOverride,
    setRoomDressing(field, hex) {
      mutate((p) => ({ ...p, room_dressing: { ...p.room_dressing, [field]: hex.toUpperCase() } }));
    },
    resetRoomDressing(field) {
      mutate((p) => {
        const next = { ...p.room_dressing };
        delete next[field];
        return { ...p, room_dressing: next };
      });
    },

    customRoles: palette.custom_roles ?? [],
    addCustomRole() {
      mutate((p) => {
        const rs = p.custom_roles ?? [];
        return { ...p, custom_roles: [...rs, { key: '', label: '', colors: ['#C97B4B'] }] };
      });
    },
    removeCustomRole(index) {
      mutate((p) => ({ ...p, custom_roles: (p.custom_roles ?? []).filter((_, i) => i !== index) }));
    },
    updateCustomRoleLabel(index, label) {
      mutate((p) => ({
        ...p,
        custom_roles: (p.custom_roles ?? []).map((r, i) => (i === index ? { ...r, label } : r)),
      }));
    },
    addCustomRoleColor(index) {
      mutate((p) => ({
        ...p,
        custom_roles: (p.custom_roles ?? []).map((r, i) =>
          i === index ? { ...r, colors: [...r.colors, '#C97B4B'] } : r,
        ),
      }));
    },
    updateCustomRoleColor(index, colorIndex, hex) {
      mutate((p) => ({
        ...p,
        custom_roles: (p.custom_roles ?? []).map((r, i) => {
          if (i !== index) return r;
          const colors = [...r.colors];
          colors[colorIndex] = hex.toUpperCase();
          return { ...r, colors };
        }),
      }));
    },
    removeCustomRoleColor(index, colorIndex) {
      mutate((p) => ({
        ...p,
        custom_roles: (p.custom_roles ?? []).map((r, i) =>
          i === index ? { ...r, colors: r.colors.filter((_, ci) => ci !== colorIndex) } : r,
        ),
      }));
    },

    clipboard,
    copyToClipboard(hex, name) {
      setClipboard({ hex: hex.toUpperCase(), name });
    },
    pasteFrom(key, index) {
      if (!clipboard) return;
      mutate((p) => applyPasteInto(p, key, index, clipboard.hex));
    },

    swapSource,
    beginSwap(key, index) {
      if (key === 'reception') return; // one-directional rule — applySwap enforces it too
      setSwapSource({ key, index });
    },
    commitSwap(key, index) {
      // Reads `swapSource` from this render's closure, never from inside a
      // `setSwapSource` updater — an updater can run twice under Strict
      // Mode, which would silently double-apply the swap.
      const source = swapSource;
      setSwapSource(null);
      if (!source) return;
      mutate((p) => applySwap(p, source, { key, index }));
    },
    cancelSwap() {
      setSwapSource(null);
    },
  };

  return <PaletteBoardContext.Provider value={value}>{children}</PaletteBoardContext.Provider>;
}
