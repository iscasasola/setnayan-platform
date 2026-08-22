'use client';

/**
 * capture-bar.tsx — the ADD doorway at the head of the Living Roster.
 *
 * Capture-first (owner sign-off 2026-07-11): type one line and press Enter. The
 * pure grammar in `lib/guest-parse.ts` turns "Ana Cruz +1 groom vip #Barkada"
 * into a structured draft, `addSingleGuest` lands it, the field clears, focus
 * stays — so a host adds many in a row. An "Adding…" shimmer marks the in-flight
 * round-trip. The bulk-entry paths (full form · CSV import · quick-add list)
 * live in the overflow menu.
 *
 * FIND MOVED OUT (Living Roster search consolidation · owner sign-off
 * 2026-07-13): the old dual-mode [Add | Find] toggle is retired. Search is no
 * longer a mode-peer of Add — it now lives ALWAYS-VISIBLE in the SummaryFacetBar
 * query row (`guests-search.tsx`), which also owns the ⌘K shortcut. This bar is
 * Add-only, so on landing the cursor lands on the parser and search is still one
 * glance away in the facet bar. (This supersedes the 2026-07-11 "single doorway
 * for both Add and Find" P2 sign-off — the duplicate search box the owner
 * spotted was that model's failure tell.)
 *
 * Motion (the shimmer) is frozen by the global `prefers-reduced-motion` block.
 */

import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { MoreHorizontal, Plus } from 'lucide-react';
import { useToast } from '@/app/_components/toast/toast-provider';
import { parseGuestInput } from '@/lib/guest-parse';
import type { GuestSide } from '@/lib/guests';
import { OpenQuickAddButton } from './quick-add-sheet';
import { OpenAddFromPeopleButton } from './add-from-people-sheet';
import { addSingleGuest } from '../inline-actions';

export function CaptureBar({
  eventId,
  defaultSide,
}: {
  eventId: string;
  /** The active Side lens — a new guest inherits it (prototype `:855`). */
  defaultSide: GuestSide;
}) {
  const [value, setValue] = useState('');
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const submitAdd = () => {
    const raw = value;
    if (!raw.trim() || pending) return;
    const draft = parseGuestInput(raw, { defaultSide });
    startTransition(async () => {
      const res = await addSingleGuest(eventId, draft);
      if (!res.ok) {
        // Keep the text so the host can fix it (e.g. add a last name).
        toast.error(res.error);
        return;
      }
      setValue('');
      // Keep focus to add many in a row (prototype wireCapture :945-954).
      requestAnimationFrame(() => inputRef.current?.focus());
    });
  };

  return (
    /* NO FRAME (owner 2026-08-21: *"we want to remove the framings so it moves
       cleanly"*). The glass card around this row drew a box inside a box — the
       input already has its own border, so the panel was a second edge 8px out
       from the first, and stacked with the facet bar's panel below it the page
       read as three nested rectangles before a single guest existed. The row
       keeps its own spacing and every control is untouched; only the container
       stopped drawing. */
    <div className="relative">
      <div className="flex items-center gap-2 py-1">
        {/* Leading glyph */}
        <span aria-hidden className="shrink-0 pl-1 text-ink/35">
          <Plus className="h-4 w-4" strokeWidth={2} />
        </span>

        {/* Add input — the capture-first guest parser. */}
        <div className="min-w-0 flex-1">
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submitAdd();
              } else if (e.key === 'Escape') {
                setValue('');
              }
            }}
            placeholder="Type a name…  e.g. “Ana Cruz +1 groom vip #Barkada”  → Enter"
            aria-label="Add a guest"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="input-field w-full"
          />
        </div>

        {/* Hint / shimmer */}
        <span className="hidden shrink-0 items-center sm:inline-flex">
          {pending ? (
            <span className="gl-adding font-mono text-[11px] text-terracotta-700">
              Adding…
            </span>
          ) : (
            <span className="rounded-md border border-ink/10 px-1.5 py-0.5 font-mono text-[11px] text-ink/45">
              {'↵ add & keep going'}
            </span>
          )}
        </span>

        {/* Overflow — the bulk-entry paths that used to be the header's "More
            ways" disclosure. QuickAddSheet (full form) + CSV import stay wired. */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setOverflowOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={overflowOpen}
            aria-label="More ways to add"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink/50 hover:bg-ink/5 hover:text-ink"
          >
            <MoreHorizontal className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
          {overflowOpen ? (
            <>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOverflowOpen(false)}
                className="fixed inset-0 z-30 cursor-default"
              />
              <div
                role="menu"
                className="absolute right-0 z-40 mt-1 flex w-48 flex-col gap-0.5 rounded-lg border border-ink/10 bg-cream p-1 shadow-lg"
              >
                {/* FIRST, because it is the only one that does not ask the
                    host to type a name we already hold (owner 2026-08-21).
                    Rendered as a plain menu row, not a button-primary — the
                    overflow is a list of ways in, and one of them shouting is
                    what makes the other three look like second choices. */}
                {/* ⚠ THE OPENER IS IMPORTED, NEVER RE-DISPATCHED BY HAND.
                    Both sheets on this page are opened by a CustomEvent whose
                    name is a private constant in the sheet's own file; a menu
                    row that typed the string itself would keep compiling, keep
                    rendering and quietly stop opening anything the first time
                    that constant moved. A menu item that does nothing is the
                    hardest kind of broken to notice. */}
                <div onClick={() => setOverflowOpen(false)}>
                  <OpenAddFromPeopleButton className="w-full rounded-md px-3 py-2 text-left text-sm text-ink/80 hover:bg-terracotta/10 hover:text-terracotta-700" />
                </div>
                <div className="px-1 py-0.5" onClick={() => setOverflowOpen(false)}>
                  <OpenQuickAddButton label="Full add form" />
                </div>
                <Link
                  href={`/dashboard/${eventId}/guests/import`}
                  className="rounded-md px-3 py-2 text-sm text-ink/80 hover:bg-terracotta/10 hover:text-terracotta-700"
                >
                  Import CSV
                </Link>
                <Link
                  href={`/dashboard/${eventId}/guests/quick`}
                  className="rounded-md px-3 py-2 text-sm text-ink/80 hover:bg-terracotta/10 hover:text-terracotta-700"
                >
                  Quick add list
                </Link>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
