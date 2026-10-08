'use client';

import { useContext, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { MAIN_COLOUR_NAMES, PICKER_SWATCHES, cleanHexInput, pickerReadsOn, pickerShelves, type PickerRow } from '@/lib/mood-board-studio';
import { PickSheetContext, pickOpensAsSheet } from '../../../website/editor/_components/pick-menu-place';

/**
 * 🎨 THE COLOUR PICKER — THE ONE (owner 2026-10-06, DECISION_LOG "AUTO PALETTE BESIDE SAVED — AND A
 * REAL COLOUR PICKER FOR CHANGING IT BY HAND": *"how do we change the palette?"*; owner 2026-10-08:
 * *"we already have a design for the color palettes and how to pick colors on the moodboard. apply
 * that same concept on the background and on any other color rules parts"* · *"the color suggestions
 * should rely on the moodboard as well. so the mood board colors, then the complementing colors for
 * them"* · *"restudy is good"* — `BACKGROUND_RESTUDY_2026-10-08_fable.md` § 2.2 + § 6 row 4,
 * picture `prototypes/background-restudy-2026-10-08/08-picker.png`).
 *
 * Every colour control opens THIS sheet — the Mood Board's own, `StudioColourField` for the Studio's
 * rows, `ColourWell` / `ColourSheet` for every well in Stages and Look, the Mood Board's swatches
 * (`swatch-popover.tsx`) — never a second picker. Its shelves, top to bottom, in the approved order:
 *
 *   Against the background   the AA line, only when the caller hands the ground the colour sits on
 *                            (`readsOn`): how the colour chosen NOW reads there — "Clear to read ·
 *                            7.2:1" AA · "Hard to read — pick a deeper colour · 2.1:1" AA ✗ — and
 *                            the two shelves under it then lead with the colours that read on it
 *   Your Mood Board          the five, each with its name (its slot's with `slots`, else the colour's own)
 *   Goes with your Mood Board  the Mood Board's own harmony for them (`pickerSuggestions`)
 *   From your photos         where the caller has them (the Mood Board)
 *   Swatches                 the sixteen
 *   Custom                   the system wheel + a code to type (a stylist's brief) + ✓ Use
 *
 * ONE tap sets that colour and closes; the caller then says what it changed. Opening it writes
 * nothing. The colour chosen now is the marked row (✓), and Custom's code opens on it.
 *
 * The sheet is the new Maker's ONE bottom sheet (`PickSheetContext`, handed down by the shell on a
 * phone); a desktop draws the same body in a small centred panel.
 */
export function ColourPickerSheet({
  title,
  job,
  current,
  fromPhotos,
  onPick,
  onClose,
  extra,
  palette = [],
  onRemove,
  slots = false,
  readsOn,
}: {
  /** "Remove this colour" under the swatches (a role's own colour, a part set by hand). */
  onRemove?: () => void;
  /** The Mood Board's five — drawn FIRST, then the colours that go with them. Empty = both shelves are left out. */
  palette?: readonly string[];
  /** "Dominant", "Table linens", "Bridesmaids". */
  title: string;
  /** What it changes, said under the title ("Headings and big blocks · flowers · lights"). Empty = no line. */
  job: string;
  current: string;
  /** The colours read from the couple's photos — empty = the shelf is not drawn. */
  fromPhotos: readonly string[];
  onPick: (hex: string) => void;
  onClose: () => void;
  /** One quiet row under the swatches ("Follow Neutral again"). */
  extra?: ReactNode;
  /** `palette` IS the five main colours in slot order: each wears its slot's name (Dominant … Accent 2). Else a colour wears its own name. */
  slots?: boolean;
  /** The ground this colour sits on (words on a background). Draws "Against the background" and leads the suggestions with what reads on it — reordered, never hidden. */
  readsOn?: string | null;
}) {
  const [code, setCode] = useState(current);
  const suggest = pickerShelves(palette, { names: slots ? MAIN_COLOUR_NAMES : undefined, readsOn });
  const typed = cleanHexInput(code);
  const now = current.toUpperCase();
  const read = pickerReadsOn(current, readsOn);
  const sw = (c: string) => {
    const on = c.toUpperCase() === now;
    return (
      <button
        key={c}
        type="button"
        aria-label={c}
        aria-pressed={on}
        onClick={() => onPick(c)}
        className={`aspect-square min-h-9 w-full rounded-full border border-ink/15 ${on ? 'ring-2 ring-sn-accent ring-offset-2 ring-offset-white' : ''}`}
        style={{ background: c }}
        data-picker-swatch={c}
      />
    );
  };
  /* A suggestion: the colour, its name, its code, ✓ on the one chosen now. */
  const row = (r: PickerRow) => {
    const on = r.hex === now;
    return (
      <button
        key={r.hex}
        type="button"
        aria-label={r.name ? `${r.name} ${r.hex}` : r.hex}
        aria-pressed={on}
        onClick={() => onPick(r.hex)}
        className={`sn-press flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 text-left ${on ? 'bg-sn-accent/10' : ''}`}
        data-picker-swatch={r.hex}
      >
        <span aria-hidden className="h-7 w-7 shrink-0 rounded-full ring-1 ring-inset ring-ink/15" style={{ background: r.hex }} />
        {r.name ? <span className={`min-w-0 truncate text-[14px] text-ink ${on ? 'font-semibold' : ''}`}>{r.name}</span> : null}
        <small className="shrink-0 font-mono text-[11px] text-ink/50">{r.hex}</small>
        {on ? <Check aria-hidden className="ml-auto h-4 w-4 shrink-0 text-sn-accent" strokeWidth={2.4} /> : null}
      </button>
    );
  };
  return (
    <StudioSheet label={title} onClose={onClose}>
      <div className="flex flex-col gap-3 px-2 pb-2" data-colour-picker="">
        {job ? <p className="-mt-1 text-[12px] text-ink/60">{job}</p> : null}
        {read ? (
          <>
            <p className={SHELF}>Against the background</p>
            <div className="flex min-h-9 items-center gap-3 px-3" role="status" data-picker-against={read.grade}>
              <span aria-hidden className="h-7 w-7 shrink-0 rounded-full ring-1 ring-inset ring-ink/15" style={{ background: readsOn ?? undefined }} />
              <small className="min-w-0 flex-1 text-[12.5px] text-ink/70">{read.words}</small>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tracking-[0.06em] ${
                  read.grade === 'clear' ? 'bg-success-50 text-success-700' : 'bg-terracotta/10 text-terracotta-700'
                }`}
              >
                {read.grade === 'clear' ? 'AA' : 'AA ✗'}
              </span>
            </div>
          </>
        ) : null}
        {suggest.board.length > 0 ? (
          <>
            <p className={SHELF}>Your Mood Board</p>
            <div className="flex flex-col" data-picker-palette="">
              {suggest.board.map(row)}
            </div>
            {suggest.goesWith.length > 0 ? (
              <>
                <p className={SHELF}>Goes with your Mood Board</p>
                <div className="flex flex-col" data-picker-goes-with="">
                  {suggest.goesWith.map(row)}
                </div>
              </>
            ) : null}
          </>
        ) : null}
        {fromPhotos.length > 0 ? (
          <>
            <p className={SHELF}>From your photos</p>
            <div className="grid grid-cols-8 gap-2" data-picker-from-photos="">
              {fromPhotos.slice(0, 8).map(sw)}
            </div>
          </>
        ) : null}
        <p className={SHELF}>Swatches</p>
        <div className="grid grid-cols-8 gap-2" data-picker-swatches="">
          {PICKER_SWATCHES.map(sw)}
        </div>
        <p className={SHELF}>Custom</p>
        <div className="flex items-center gap-2" data-picker-custom="">
          <label className="relative h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-full" aria-label="Colour wheel" style={{ background: 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)' }}>
            <input type="color" value={typed ?? cleanHexInput(current) ?? '#000000'} onChange={(e) => setCode(e.target.value.toUpperCase())} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
          </label>
          <input
            type="text"
            value={code}
            maxLength={7}
            onChange={(e) => setCode(e.target.value)}
            aria-label="Colour code"
            className="min-h-11 min-w-0 flex-1 rounded-full bg-ink/5 px-4 font-mono text-[15px] text-ink"
          />
          {/* The sheet's ONE main action: the app's main button (the accent), never an ink pill of its own. */}
          <ActionButton tone="brand" main icon={Check} label="Use" disabled={!typed} onClick={() => typed && onPick(typed)} className="!h-11" />
        </div>
        {extra}
        {onRemove ? (
          <span data-picker-remove="" className="self-start">
            <ActionButton tone="neutral" icon={X} label="Remove this colour" onClick={onRemove} className="!h-11" />
          </span>
        ) : null}
      </div>
    </StudioSheet>
  );
}

/** A shelf's heading. */
const SHELF = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/55';

/**
 * ▁ Studio's pop-ups — the new Maker's ONE bottom sheet on a phone (the shell's
 * `PickSheetContext`), a small centred panel on a wider screen. Esc closes it.
 */
export function StudioSheet({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const sheet = useContext(PickSheetContext);
  const [wide, setWide] = useState<number | null>(null);
  useEffect(() => {
    setWide(window.innerWidth);
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  if (wide === null) return null;
  if (sheet && pickOpensAsSheet(true, wide)) return <>{sheet({ label, onClose, children })}</>;
  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center" data-studio-sheet="">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 h-full w-full cursor-default bg-ink/20" />
      <div role="dialog" aria-label={label} className="relative flex max-h-[80dvh] w-full max-w-md flex-col rounded-t-3xl bg-white px-2 pb-4 pt-3 shadow-xl ring-1 ring-ink/10 sm:rounded-3xl">
        <p className="shrink-0 px-3 pb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink/55">{label}</p>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
