'use client';

/**
 * filter-popover.tsx — the four rows of filter pills, behind one button.
 *
 * ⚖ Owner 2026-09-20, on the facet rows: *"is it better to have this like a
 * filter icon and it can be sorted and picked inside a pop up."*
 *
 * ── NOTHING INSIDE IS NEW, AND NOTHING INSIDE IS LOST ──────────────────────
 * The panel's CONTENT is the page's existing, server-rendered facet rows —
 * Side · RSVP · View · Group · Tags — passed in as `children`, with their
 * links, counts and honesty rules untouched. This component only decides
 * whether they are on screen. The Sort select rides inside too, because two
 * of its orders (First name, Newest first) have no column header to click.
 *
 * ── THREE DECISIONS, EACH WITH A REASON ────────────────────────────────────
 * 🪤 NO `overflow-hidden` ON THE PANEL. The Group row is also where a group is
 *    RENAMED and DELETED, through a kebab menu that opens downward. A clipping
 *    panel would cut that menu off — a control that silently stops working
 *    the moment it moves in here. (Same reason the old bar's root was never
 *    clipped; its own note says so.)
 * 🔑 IT STAYS OPEN WHILE YOU PICK. A pill is a link, and a soft navigation
 *    keeps this component mounted, so its open state survives the click. Two
 *    filters are two taps, not open-pick-reopen-pick.
 * 🔑 THE COUNT IS ON THE BUTTON. With the rows folded away, an applied filter
 *    is invisible except for the chips beside this button and the number on
 *    it — so the number is never hidden, even when the panel is shut.
 *
 * Closes on Escape and on a press outside it, and returns focus to the button
 * that opened it.
 */

import { useEffect, useId, useRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';

export function FilterPopover({
  activeCount,
  children,
}: {
  /** How many filters are applied — shown on the button even when shut. */
  activeCount: number;
  /** The server-rendered facet rows + sort. */
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative shrink-0">
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={activeCount ? `Filter and sort — ${activeCount} applied` : 'Filter and sort'}
        // 44px: the same height as the search box and the switch buttons, so
        // the row lines up when it aligns to the top.
        className={`inline-flex h-11 items-center gap-1.5 rounded-md border px-2.5 text-sm transition-colors ${
          open || activeCount
            ? 'border-terracotta-700/40 bg-terracotta/10 text-terracotta-700'
            : 'border-ink/15 text-ink/70 hover:bg-ink/5 hover:text-ink'
        }`}
      >
        <SlidersHorizontal aria-hidden className="h-4 w-4" strokeWidth={1.8} />
        <span className="hidden sm:inline">Filter</span>
        {activeCount ? (
          <span className="rounded bg-terracotta-700 px-1.5 text-[11px] font-semibold leading-5 text-cream">
            {activeCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Filter and sort guests"
          // Anchored to the button's LEFT edge on a phone (the button sits at
          // the start of its row) and never wider than the screen minus the
          // gutter; from `sm` it is a fixed-width card. No overflow-hidden —
          // see the group kebab note above.
          className="absolute left-0 top-full z-40 mt-2 w-[min(34rem,calc(100vw-2rem))] rounded-tile border border-ink/10 bg-cream p-3 shadow-lg"
        >
          <div className="flex flex-col gap-2.5">{children}</div>
        </div>
      ) : null}
    </div>
  );
}
