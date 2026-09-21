'use client';

/**
 * find-add-row.tsx — search and add, sharing one row.
 *
 * ⚖ Owner 2026-09-20: *"search and filter in 1 row. Quick add and the full
 * form and csv and people on one row?"* → *"or maybe a magnifying icon to show
 * search and filter? then (+) button to switch to adding so they can share 1
 * row?"* → *"no. the add must be on the other end. it will collapse when search
 * expands on the other end"* → *"fully animate it … how it compress and
 * expands"*.
 *
 *     FIND  [ 🔍 search ······················· ][ filter ][ + ]
 *     ADD   [ 🔍 ][ + quick add ··············· 👥 📋 ⬆ ☰ ]
 *
 * ── ⚠ THIS PARTLY REVERSES TWO JULY SIGN-OFFS, ON THE OWNER'S NEWER WORD ──
 * `capture-bar.tsx` records (2026-07-13) that a dual-mode [Add | Find] toggle
 * was RETIRED, "the duplicate search box the owner spotted" being its failure;
 * and (2026-07-11) that the page was capture-first. The owner asked for this
 * shape two months later. It does not repeat the July failure — that was TWO
 * search boxes, and this is one search box and one add box taking turns in
 * one row. And capture-first survives where it matters most: an EMPTY list
 * opens on Add, because there is nobody yet to find.
 *
 * ── HOW IT STAYS HONEST ────────────────────────────────────────────────────
 * 🔑 BOTH SIDES STAY MOUNTED. Collapsing a side never unmounts it, so a half-
 *    typed name survives a glance at search, and a search survives a detour to
 *    add. Switching is layout, never lost state.
 * 🔑 WHICHEVER SIDE GETS FOCUS EXPANDS. One rule covers every way in: the icon
 *    tap, Tab from the keyboard, and the search box's own ⌘K shortcut, which
 *    otherwise would focus a field folded to 40px and invisible.
 * 🪤 THE FILTER BUTTON IS BETWEEN THE HALVES, NOT INSIDE ONE. A side has to
 *    clip (`overflow-hidden`) to animate its width — and the filter panel drops
 *    DOWN from its button. Inside a clipping side, the panel (and the group
 *    rename/delete menu inside it) would be cut off.
 * 🪤 THE FOLDED SIDE IS NOT `aria-hidden`. It was, in the first cut — which
 *    hid a still-FOCUSABLE text box from screen readers, a known trap. `inert`
 *    would fix that and break ⌘K (a programmatic focus on an inert field is
 *    refused). So the fold is purely visual: a screen reader always has both
 *    boxes, and there is no mode for it to discover.
 * Motion is width, via `flex-grow`, and stops for `prefers-reduced-motion`.
 */

import { useRef, useState } from 'react';
import { Plus, Search } from 'lucide-react';

type Mode = 'find' | 'add';

export function FindAddRow({
  search,
  filter,
  add,
  startAdding,
  addLabel = 'Add a guest',
}: {
  /** The always-live search box (URL-driven). */
  search: React.ReactNode;
  /** The filter-and-sort popover button. Shown in Find only. */
  filter: React.ReactNode;
  /** The quick-add bar with its four doors. */
  add: React.ReactNode;
  /** Open on Add — true for an empty list, where there is nobody to find. */
  startAdding: boolean;
  /** What the folded "+" is called. After the event it must SAY the list is
   *  still open — a bare "+" is reachable but tells a host nothing. */
  addLabel?: string;
}) {
  const [mode, setMode] = useState<Mode>(startAdding ? 'add' : 'find');
  const findRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLDivElement>(null);

  const open = (next: Mode) => {
    setMode(next);
    // After the width starts to move, put the cursor where the host is going.
    requestAnimationFrame(() =>
      (next === 'find' ? findRef : addRef).current?.querySelector('input')?.focus(),
    );
  };

  const side = (active: boolean) =>
    `relative min-w-0 overflow-hidden transition-[flex-grow] duration-300 ease-out motion-reduce:transition-none ${
      active ? 'grow basis-0' : 'grow-0 basis-11'
    }`;
  // 🪤 A FOLDED SIDE MUST NOT SIZE THE ROW. Both sides stay mounted, so a
  // folded side's content still has a height — and the add bar, squeezed into
  // 40px, wraps into a tall stack that made the FIND row tall too. Folded, the
  // content leaves the flow (`absolute`) at a sane width, invisible and clipped
  // by its side; only the side in use decides how tall the row is.
  const content = (active: boolean) =>
    `transition-opacity duration-200 motion-reduce:transition-none ${
      active
        ? 'relative opacity-100'
        : 'pointer-events-none absolute left-0 top-0 w-[min(40rem,85vw)] opacity-0'
    }`;
  // 🪤 IN FLOW, AND SIZED — never `absolute inset-0`. The first cut stretched
  // this button over the folded side; once that side's content left the flow
  // (see `content` above) the side had nothing to give it height, collapsed to
  // 0px, and took the button with it. Find lost its "+", Add lost its search —
  // and with them the only way to switch. A fixed 40×40 in the flow is what
  // gives the folded side its size now.
  const iconBtn =
    'flex h-11 w-11 items-center justify-center rounded-md border border-ink/15 text-ink/60 hover:bg-ink/5 hover:text-ink';

  return (
    // `items-start`: on a phone the add bar wraps to two lines, and the search
    // button should sit beside the NAME BOX, not float between the lines.
    <div className="flex items-start gap-2 border-b border-ink/[0.07] py-3">
      <div
        ref={findRef}
        className={side(mode === 'find')}
        onFocusCapture={() => mode !== 'find' && setMode('find')}
      >
        <div className={content(mode === 'find')}>
          {search}
        </div>
        {mode !== 'find' ? (
          <button type="button" onClick={() => open('find')} aria-label="Search and filter" className={iconBtn}>
            <Search className="h-4 w-4" strokeWidth={1.8} aria-hidden />
          </button>
        ) : null}
      </div>

      {mode === 'find' ? filter : null}

      <div
        ref={addRef}
        className={side(mode === 'add')}
        onFocusCapture={() => mode !== 'add' && setMode('add')}
      >
        <div className={content(mode === 'add')}>
          {add}
        </div>
        {mode !== 'add' ? (
          <button type="button" onClick={() => open('add')} aria-label={addLabel} title={addLabel} className={iconBtn}>
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}
