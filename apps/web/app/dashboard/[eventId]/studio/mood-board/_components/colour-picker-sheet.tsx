'use client';

import { useContext, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { PICKER_SWATCHES, cleanHexInput } from '@/lib/mood-board-studio';
import { PickSheetContext, pickOpensAsSheet } from '../../../website/editor/_components/pick-menu-place';

/**
 * 🎨 THE COLOUR PICKER (owner 2026-10-06, DECISION_LOG "AUTO PALETTE BESIDE
 * SAVED — AND A REAL COLOUR PICKER FOR CHANGING IT BY HAND": *"how do we change
 * the palette?"*). Opens from the bottom: the colour now · From your photos ·
 * Swatches (16) · Custom (the system wheel + a code to type, e.g. a stylist's
 * brief). ONE tap sets that colour and closes; the Studio then says what it
 * changed. Opening it writes nothing.
 *
 * Prototype `openPicker`. The sheet is the new Maker's ONE bottom sheet
 * (`PickSheetContext`, handed down by the shell on a phone); a desktop draws
 * the same body in a small centred panel.
 */
export function ColourPickerSheet({
  title,
  job,
  current,
  fromPhotos,
  onPick,
  onClose,
  extra,
}: {
  /** "Dominant", "Table linens", "Bridesmaids". */
  title: string;
  /** What it changes, said beside the title ("Headings and big blocks · flowers · lights"). */
  job: string;
  current: string;
  /** The colours read from the couple's photos — empty = the row is not drawn. */
  fromPhotos: readonly string[];
  onPick: (hex: string) => void;
  onClose: () => void;
  /** One quiet row under the swatches ("Follow Neutral again"). */
  extra?: ReactNode;
}) {
  const [code, setCode] = useState(current);
  const typed = cleanHexInput(code);
  const sw = (c: string) => {
    const on = c.toUpperCase() === current.toUpperCase();
    return (
      <button
        key={c}
        type="button"
        aria-label={c}
        aria-pressed={on}
        onClick={() => onPick(c)}
        className={`aspect-square min-h-9 w-full rounded-full border border-ink/15 ${on ? 'ring-2 ring-mulberry ring-offset-2 ring-offset-white' : ''}`}
        style={{ background: c }}
        data-picker-swatch={c}
      />
    );
  };
  return (
    <StudioSheet label={title} onClose={onClose}>
      <div className="flex flex-col gap-3 px-2 pb-2" data-colour-picker="">
        <p className="-mt-1 text-[12px] text-ink/60">{job}</p>
        <div className="flex items-center gap-3">
          <span aria-hidden className="h-11 w-11 shrink-0 rounded-full ring-1 ring-inset ring-ink/15" style={{ background: current }} />
          <span className="font-mono text-[14px] text-ink">{current.toUpperCase()}</span>
          <small className="text-[11px] text-ink/50">now</small>
        </div>
        {fromPhotos.length > 0 ? (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/55">From your photos</p>
            <div className="grid grid-cols-8 gap-2" data-picker-from-photos="">
              {fromPhotos.slice(0, 8).map(sw)}
            </div>
          </>
        ) : null}
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/55">Swatches</p>
        <div className="grid grid-cols-8 gap-2" data-picker-swatches="">
          {PICKER_SWATCHES.map(sw)}
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/55">Custom</p>
        <div className="flex items-center gap-2" data-picker-custom="">
          <label className="relative h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-full" aria-label="Colour wheel" style={{ background: 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)' }}>
            <input type="color" value={typed ?? current} onChange={(e) => setCode(e.target.value.toUpperCase())} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
          </label>
          <input
            type="text"
            value={code}
            maxLength={7}
            onChange={(e) => setCode(e.target.value)}
            aria-label="Colour code"
            className="min-h-11 min-w-0 flex-1 rounded-full bg-ink/5 px-4 font-mono text-[15px] text-ink"
          />
          <button
            type="button"
            disabled={!typed}
            onClick={() => typed && onPick(typed)}
            className="sn-press inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full bg-ink px-4 text-[13px] font-semibold text-cream disabled:opacity-40"
          >
            <Check aria-hidden className="h-4 w-4" /> Use
          </button>
        </div>
        {extra}
      </div>
    </StudioSheet>
  );
}

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
