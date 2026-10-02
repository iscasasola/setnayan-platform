'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { DetailsItemKey } from '@/lib/maker-details-items';

/**
 * 📱 THE EDITOR SHEET'S ONE DROPDOWN (owner, live phone test 2026-10-02:
 * *"any set of choices is one dropdown, never a pill row"*). On a phone the
 * navigator strip — the other items here, and the item's own sections (RSVP's
 * "What you ask · Who can reply · Reply by · Requests", a chapter, a moment) —
 * became this: ONE button in the sheet's header row ("What you ask ▾") that
 * opens ONE list. The sections are the item's own piece buttons
 * (`DetailsPieceButton`), drawn here as the list's rows — the same mechanism,
 * never a second one. Closes on a pick, a tap outside, and Escape.
 */
export function SheetSections({
  items,
  selected,
  onPick,
  pieces,
  current,
}: {
  /** The items this sheet can switch between (the step's, or the group's). */
  items: ReadonlyArray<{ key: DetailsItemKey; label: string }>;
  selected: DetailsItemKey;
  onPick: (key: DetailsItemKey) => void;
  /** The item's own sections — its piece buttons — or null. */
  pieces: ReactNode;
  /** The picked section's name, when the item said it (`ItemPieces`); else the item's. */
  current: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  const others = items.filter((i) => i.key !== selected);
  if (others.length === 0 && !pieces) return null;
  const here = items.find((i) => i.key === selected)?.label ?? '';
  return (
    <div ref={ref} className="relative ml-auto min-w-0" data-sheet-sections="">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="sn-press inline-flex min-h-10 max-w-full items-center gap-1 rounded-full bg-ink/[0.06] px-3 text-[13px] font-semibold text-ink"
      >
        <span className="min-w-0 truncate">{current ?? here}</span>
        <ChevronDown aria-hidden className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={2} />
      </button>
      {open ? (
        <div
          role="menu"
          data-sheet-sections-list=""
          /* A tap on a section picks it and closes the list (the pieces are buttons). */
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('button')) setOpen(false);
          }}
          className="absolute right-0 top-full z-40 mt-1 flex max-h-[40dvh] w-[min(18rem,calc(100vw-2rem))] flex-col gap-0.5 overflow-y-auto rounded-xl bg-white p-1 shadow-[0_24px_48px_-20px_rgba(30,26,18,.45)] ring-1 ring-ink/10 [&_[data-details-piece]]:w-full [&_[data-details-piece]]:self-stretch [&_[data-details-piece]]:rounded-lg"
        >
          {pieces ? <div className="flex flex-col gap-0.5">{pieces}</div> : null}
          {others.length > 0 ? (
            <>
              {pieces ? <span className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-ink/45">Also here</span> : null}
              {items.map((i) => (
                <button
                  key={i.key}
                  type="button"
                  role="menuitemradio"
                  aria-checked={i.key === selected}
                  onClick={() => onPick(i.key)}
                  className="sn-press flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-[14px] text-ink hover:bg-ink/5"
                >
                  <span className="min-w-0 flex-1 truncate">{i.label}</span>
                  {i.key === selected ? <Check aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2.4} /> : null}
                </button>
              ))}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
