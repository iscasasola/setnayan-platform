'use client';

/**
 * find-add-row.tsx — the Guest list's one row: Filter ▾, then Sort and ⋯.
 *
 * ⚖ 2026-10-01 (later the same day) · ADD LEFT THIS ROW TOO. Owner: "okay keep it
 * similar" — the computer adds with the SAME round + as the phone; its sheet
 * (`add-guest-sheet.tsx`) holds the name box this row used to lead with.
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

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export function FindAddRow({
  filter,
  sort,
  more,
}: {
  /** The filter dropdowns. */
  filter: React.ReactNode;
  /** Sort ▾ — in the row on a computer; behind ⋯ on a phone. */
  sort?: React.ReactNode;
  /** The ⋯ at the end of the row (Sort · the doors · the add doors). */
  more?: React.ReactNode;
}) {
  const [filterOpen, setFilterOpen] = useState(false);

  return (
    /*
      ⚖ ONE Filter ▾ AT EVERY WIDTH (owner 2026-10-01, DECISION_LOG "THE SIMPLE
      PHONE APP — APPROVED", frame 2 — "one search · one Filter ▾ (RSVP · Side ·
      Role · Group)"; desktop keeps its row with the SAME controls). The four
      dropdowns are the SAME `RosterFilters`, opened by the one Filter ▾ onto a
      line of their own. The search is the top bar's. ADD IS NOT HERE ANY MORE:
      owner 2026-10-01 "okay keep it similar" — one round + at every width
      (`add-guest-sheet.tsx`), whose sheet holds the name box and the other ways.
    */
    // No top padding: the page's one gap sits above this row (owner 2026-10-03).
    <div className="flex flex-wrap items-start gap-2 border-b border-ink/[0.07] pb-2 lg:pb-3">
      <button
        type="button"
        onClick={() => setFilterOpen((v) => !v)}
        aria-expanded={filterOpen}
        data-find-add-filter-toggle=""
        className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border border-ink/15 px-4 text-sm font-medium text-ink hover:bg-ink/5"
      >
        Filter
        <ChevronDown className={`h-4 w-4 transition-transform ${filterOpen ? 'rotate-180' : ''}`} strokeWidth={1.8} aria-hidden />
      </button>
      {sort ? <div className="hidden shrink-0 lg:block">{sort}</div> : null}
      {/* The computer's ⋯; a phone draws the same ⋯ beside its title. */}
      {more ? <div className="ml-auto hidden shrink-0 lg:block">{more}</div> : null}

      <div className={`order-last w-full min-w-0 ${filterOpen ? 'block' : 'hidden'}`} data-find-add-filter="">
        {filter}
      </div>
    </div>
  );
}
