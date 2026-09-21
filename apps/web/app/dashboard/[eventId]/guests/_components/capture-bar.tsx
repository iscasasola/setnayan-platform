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
import { ClipboardList, ListPlus, Plus, Upload, Users } from 'lucide-react';
import { useToast } from '@/app/_components/toast/toast-provider';
import { parseGuestInput } from '@/lib/guest-parse';
import type { GuestSide } from '@/lib/guests';
import { OpenQuickAddButton } from './quick-add-sheet';
import { OpenAddFromPeopleButton } from './add-from-people-sheet';
import { addSingleGuest } from '../inline-actions';

// One size for all four doors. 36px is the smallest this row can give a tap
// target without pushing the name box off a 380px phone.
const ICON_BTN =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink/55 hover:bg-ink/5 hover:text-ink';

export function CaptureBar({
  eventId,
  defaultSide,
}: {
  eventId: string;
  /** The active Side lens — a new guest inherits it (prototype `:855`). */
  defaultSide: GuestSide;
}) {
  const [value, setValue] = useState('');
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
      {/* 🪤 `flex-wrap` + a floor on the name box, measured at 380px: with the
          four doors on the same line the box was 77px wide — "Type a r…" —
          and nobody can type "Ana Cruz +1 groom vip" into that. When the box
          cannot have 12rem beside the doors, the doors drop to their own line
          under it and the box takes the width. On a desktop nothing wraps. */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Leading glyph */}
        <span aria-hidden className="shrink-0 pl-1 text-ink/35">
          <Plus className="h-4 w-4" strokeWidth={2} />
        </span>

        {/* Add input — the capture-first guest parser. */}
        <div className="min-w-0 flex-1 basis-[12rem]">
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

        {/* ⚖ THE "…" MENU BECAME FOUR VISIBLE DOORS — owner 2026-09-20: *"this
            is already the quick add so no button needed for quick add. a button
            beside it with a form icon for the full form and import icon for the
            csv?"*, and People beside them. The box IS quick add, so what it
            cannot do is exactly what gets a button.

            🔑 FOUR, NOT THREE. The owner named form, CSV and People; the menu
            also held "Quick add list", which nobody asked to remove. A door
            that silently disappears in a redesign is the thing this repo's
            port-controls guard exists to catch — it stays, as a fourth icon.

            Order kept from the menu: People FIRST, because it is the only way
            in that does not ask the host to type a name we already hold (owner
            2026-08-21). The rule below is load-bearing and survives the move. */}
        {/* ⚠ THE OPENER IS IMPORTED, NEVER RE-DISPATCHED BY HAND.
            Both sheets on this page are opened by a CustomEvent whose name is a
            private constant in the sheet's own file; a button that typed the
            string itself would keep compiling, keep rendering and quietly stop
            opening anything the first time that constant moved. A control that
            does nothing is the hardest kind of broken to notice. */}
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          <span aria-hidden className="mx-1 h-5 w-px bg-ink/10" />
          <OpenAddFromPeopleButton
            ariaLabel="Add from your people"
            label={<Users className="h-4 w-4" strokeWidth={1.8} aria-hidden />}
            className={ICON_BTN}
          />
          <OpenQuickAddButton
            ariaLabel="Full add form"
            label={<ClipboardList className="h-4 w-4" strokeWidth={1.8} aria-hidden />}
            className={ICON_BTN}
          />
          <Link
            href={`/dashboard/${eventId}/guests/import`}
            aria-label="Import CSV"
            title="Import CSV"
            className={ICON_BTN}
          >
            <Upload className="h-4 w-4" strokeWidth={1.8} aria-hidden />
          </Link>
          <Link
            href={`/dashboard/${eventId}/guests/quick`}
            aria-label="Quick add list"
            title="Quick add list"
            className={ICON_BTN}
          >
            <ListPlus className="h-4 w-4" strokeWidth={1.8} aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}
