'use client';

/**
 * find-add-row.tsx — the Guest list's one row: ADD, then Filter and Sort.
 *
 * ⚖ 2026-10-01 · THE SEARCH HALF LEFT FOR THE TOP BAR. Owner 2026-09-30
 * (DECISION_LOG "GUEST LIST: ACCESS + CHECK-IN BECOME COLUMNS; … THE TOP BAR
 * SEARCHES GUESTS"): *"i thought we had a build that will make the search on
 * the top to do the search? so the text box on people will only be add?"* →
 * *"ok"*; INTERACTION_RULES § 4, "The page itself only has 'Add'". The shared
 * top bar drives `?q=` on this page now (`guests-top-search.tsx`), so this row
 * lost its search box, its magnifier and the fold/expand between the two
 * halves. What stays, on purpose:
 *   · the add box is OPEN — before the event there is nothing else for the row
 *     to be, so an empty list (and every other) opens on Add;
 *   · AFTER the event the add box waits behind "+" with words that say the list
 *     is still open (the receded add path below);
 *   · the filter dropdowns and Sort ▾ — Filter is not search.
 *
 * The history below is the row's first shape; its focus trap (focus must not
 * scroll the page) still applies to the "+" that remains.
 *
 * ── THE FIRST SHAPE (2026-09-20) ──────────────────────────────────────────
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
 * (Its fold/expand between a search half and an add half, and the traps that
 * came with it, left with the search half on 2026-10-01 — see above.)
 */

import { useRef, useState } from 'react';
import { Plus } from 'lucide-react';

export function FindAddRow({
  filter,
  sort,
  add,
  folded,
  addLabel = 'Add a guest',
}: {
  /** The filter dropdowns. */
  filter: React.ReactNode;
  /** Sort ▾ — beside the filters, the last control on the row. */
  sort?: React.ReactNode;
  /** The quick-add bar with its four doors. */
  add: React.ReactNode;
  /** The event is over: the add box waits behind "+" until asked for. */
  folded: boolean;
  /** What the folded "+" is called. After the event it must SAY the list is
   *  still open — a bare "+" is reachable but tells a host nothing. */
  addLabel?: string;
}) {
  const [open, setOpen] = useState(!folded);
  const addRef = useRef<HTMLDivElement>(null);

  const unfold = () => {
    setOpen(true);
    // 🪤 `preventScroll`, measured: a plain focus() scrolls the page to bring
    // the box into view, and with this row tucked under the sticky top bar it
    // moved the page 8px — the owner's "the table nudge[s] down a bit when
    // pressed". The host has just CLICKED this row, so it is already on
    // screen; nothing should move.
    requestAnimationFrame(() => addRef.current?.querySelector('input')?.focus({ preventScroll: true }));
  };

  const iconBtn =
    'flex h-11 w-11 items-center justify-center rounded-md border border-ink/15 text-ink/60 hover:bg-ink/5 hover:text-ink';

  return (
    // `items-start`: on a phone the add bar wraps to two lines, and the controls
    // beside it should sit level with the NAME BOX, not float between lines.
    // Below `lg` the dropdowns cannot share a 390px line with the add box, so
    // they WRAP to a line of their own under it (`order-last w-full`) — the same
    // controls, one line more; at `lg` they sit after the add box.
    <div className="flex flex-wrap items-start gap-2 border-b border-ink/[0.07] py-3 lg:flex-nowrap">
      <div ref={addRef} className={open ? 'min-w-0 grow basis-0' : 'shrink-0'} data-find-add-add="">
        {open ? (
          add
        ) : (
          <button type="button" onClick={unfold} aria-label={addLabel} title={addLabel} className={iconBtn}>
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        )}
      </div>

      <div className="order-last flex w-full min-w-0 items-start gap-2 lg:order-none lg:w-auto" data-find-add-filter="">
        <div className="min-w-0 flex-1">{filter}</div>
        {sort ? <div className="shrink-0">{sort}</div> : null}
      </div>
    </div>
  );
}
