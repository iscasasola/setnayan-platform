'use client';

/**
 * capture-bar.tsx — the ADD doorway at the head of the Living Roster.
 *
 * Capture-first (owner sign-off 2026-07-11): type one line and press Enter. The
 * pure grammar in `lib/guest-parse.ts` turns "Ana Cruz +1 groom vip #Barkada"
 * into a structured draft, the field clears AT ONCE, focus stays — so a host
 * adds many in a row — and the name is queued (`guest-add-queue.ts`): drawn
 * now, written in order by `addSingleGuest`, its own row saying "Adding…",
 * "Added" or why not (2026-10-19). The bulk-entry paths (full form · CSV
 * import · quick-add list) live in the overflow menu.
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
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ClipboardList, ListPlus, Plus, Upload, Users } from 'lucide-react';
import type { GuestSide } from '@/lib/guests';
import { OpenQuickAddButton } from './quick-add-sheet';
import { OpenAddFromPeopleButton } from './add-from-people-sheet';
import { useGuestActions } from './guest-actions-context';
import { guestAdds, queueTypedGuest } from './guest-add-queue';

// One size for all four doors. 36px is the smallest this row can give a tap
// target without pushing the name box off a 380px phone.
const ICON_BTN =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink/55 hover:bg-ink/5 hover:text-ink';

export function CaptureBar({
  eventId,
  defaultSide,
  withDoors = true,
  placeholder = 'Type a name…  e.g. “Ana Cruz +1 groom vip #Barkada”  → Enter',
  initialValue = '',
}: {
  eventId: string;
  /** The active Side lens — a new guest inherits it (prototype `:855`). */
  defaultSide: GuestSide;
  /** Inside the add sheet the four doors are rows under the box, not icons. */
  withDoors?: boolean;
  /** The add sheet says "Type a name…" and puts an example that fits THIS
   *  event under the box (`lib/quick-add-tips.ts`) — never two examples. */
  placeholder?: string;
  /** What the Guests search box held when its ＋ Add opened the sheet (PR 4f). */
  initialValue?: string;
}) {
  const [value, setValue] = useState(initialValue);
  const [needs, setNeeds] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { addSingleGuest } = useGuestActions();
  // The list re-reads ONCE when every queued name is written (guest-add-queue.ts).
  useEffect(() => guestAdds.setRefresher(() => router.refresh()), [router]);

  /* ⚡ ONE ENTER = ONE GUEST, AT ONCE (owner 2026-10-19: "need to enter button twice to add … adding multiple person needs
     to be fast and easy"). The name goes on screen and into the ordered queue NOW; the box clears and keeps the focus for
     the next name. Nothing waits on the server, and no Enter is ever refused while an earlier name is still being written
     — that refusal (`if (pending) return`) is what dropped 8 of 10 names typed in a row.
     🔒 guests/_components/one-enter-adds-one-guest-at-once.test.ts */
  const submitAdd = () => {
    const res = queueTypedGuest(eventId, value, defaultSide, addSingleGuest);
    if (!res.ok) {
      // Keep the text so the host can fix it (e.g. add a last name) — said at once, never sent to be refused.
      if (res.error) setNeeds(res.error);
      return;
    }
    setValue('');
    setNeeds(null);
    inputRef.current?.focus();
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
        {/* Add input — the capture-first guest parser. */}
        {/* ⚖ Owner 2026-09-21: "same to the add text box. insert the + inside"
            — the "+" sits inside the box at its end, matching the search box
            on the other side of the row. */}
        <div className="relative min-w-0 flex-1 basis-[12rem]">
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setNeeds(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                // A keyboard still composing a word (an IME, a phone's suggestion) owns this Enter — it finishes the word.
                if (e.nativeEvent.isComposing) return;
                e.preventDefault();
                submitAdd();
              } else if (e.key === 'Escape') {
                setValue('');
              }
            }}
            placeholder={placeholder}
            aria-label="Add a guest"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="input-field w-full pr-11"
          />
          {/* ⚖ THE + ADDS (owner, live iPhone test 2026-10-02: *"tapping +
              did nothing; only pressing Enter added the guest"*). It used to be
              a picture of a button (`pointer-events-none`) — on a phone, whose
              keyboard may say "return" or "go" and whose host never guesses
              that Enter is the way, the one visible control did nothing. It is
              now the SAME submit Enter runs, so the two can never differ.
              `onMouseDown` keeps the keyboard up so the host can add the next. */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={submitAdd}
            disabled={!value.trim()}
            aria-label="Add this guest"
            title="Add this guest"
            data-capture-add=""
            className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-ink/55 hover:text-ink disabled:text-ink/30"
          >
            <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        {/* Hint — the box never waits, so there is no "Adding…" here: each name says it on its own row (just-added.tsx). */}
        <span className="hidden shrink-0 items-center sm:inline-flex">
          <span className="rounded-md border border-ink/10 px-1.5 py-0.5 font-mono text-[11px] text-ink/45">
            {'↵ add & keep going'}
          </span>
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
        {/* On a phone these four doors are rows in the ⋯ (frame 2 of the
            approved simple phone app) — the SAME `AddDoors` — so the name box
            keeps one line and the first guest stays in the top third. */}
        {withDoors ? (
          <div className="ml-auto hidden shrink-0 items-center gap-0.5 lg:flex">
            <span aria-hidden className="mx-1 h-5 w-px bg-ink/10" />
            <AddDoors eventId={eventId} />
          </div>
        ) : null}
      </div>
      {needs ? (
        <p role="alert" className="mt-1.5 text-xs text-danger-700" data-capture-needs="">
          {needs}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The four ways in beside the name box, in plain words (first-timer fix 21,
 * 2026-10-02): From your people · Add with details · Import a file · Paste many
 * names. ONE list, drawn twice: as icons beside the box (a computer) and as
 * labelled rows in the phone's ⋯ (the approved simple phone app, frame 2 —
 * DECISION_LOG 2026-10-01 "THE SIMPLE PHONE APP — APPROVED": setup lives behind
 * ⋯, the add box becomes the round +). Same openers, same links.
 */
export function AddDoors({ eventId, rows = false }: { eventId: string; rows?: boolean }) {
  const cls = rows
    ? 'flex min-h-[44px] w-full items-center gap-3 rounded-lg px-2 text-left text-sm text-ink hover:bg-ink/5'
    : ICON_BTN;
  const door = (icon: React.ReactNode, words: string) =>
    rows ? (
      <>
        {icon}
        <span>{words}</span>
      </>
    ) : (
      icon
    );
  return (
    <>
      <OpenAddFromPeopleButton
        ariaLabel="From your people"
        label={door(<Users className="h-4 w-4" strokeWidth={1.8} aria-hidden />, 'From your people')}
        className={cls}
      />
      <OpenQuickAddButton
        ariaLabel="Add with details"
        label={door(<ClipboardList className="h-4 w-4" strokeWidth={1.8} aria-hidden />, 'Add with details')}
        className={cls}
      />
      <Link href={`/dashboard/${eventId}/guests/import`} aria-label="Import a file" title="Import a file" className={cls}>
        {door(<Upload className="h-4 w-4" strokeWidth={1.8} aria-hidden />, 'Import a file')}
      </Link>
      <Link href={`/dashboard/${eventId}/guests/quick`} aria-label="Paste many names" title="Paste many names" className={cls}>
        {door(<ListPlus className="h-4 w-4" strokeWidth={1.8} aria-hidden />, 'Paste many names')}
      </Link>
    </>
  );
}
