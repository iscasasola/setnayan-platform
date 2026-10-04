'use client';

/**
 * guests-phone-menu.tsx — the ⋯ beside the Guest list's title, on a phone.
 *
 * ⚖ The approved simple phone app, frame 2 (owner 2026-10-01, DECISION_LOG "THE
 * SIMPLE PHONE APP — APPROVED", `prototypes/phone_app_simple_2026-10-01_fable.html`):
 * *Guests = title + ⋯ · one search · one Filter ▾ · counts line · rows … Setup
 * lives behind ⋯, never as banners.* The phone's head is three lines, and the
 * first guest sits in the top third.
 *
 * 🔑 NOTHING HERE IS NEW, AND NOTHING IS DROPPED. Every control in this sheet is
 * the SAME component the computer shows in the page's rows, handed in by the
 * page: Sort ▾ (`RosterSort`), the roster's doors (`RosterTabs` — Share the
 * link, the List · Mind map switch, Scan tickets after the day), and the add
 * doors (`AddDoors` — From your people · Add with details · Import a file · Paste many names). The row of
 * doors is hidden below `lg` ONLY because this sheet draws it — the lesson of
 * the Wedding March, which a `hidden lg:block` once deleted from every phone.
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, X } from 'lucide-react';
import { useModalA11y } from '@/lib/use-modal-a11y';

export function GuestsPhoneMenu({
  sort,
  doors,
  addDoors,
}: {
  sort: React.ReactNode;
  doors: React.ReactNode;
  addDoors: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  useModalA11y({ open, onClose: () => setOpen(false), containerRef: sheetRef });
  useEffect(() => setMounted(true), []);

  return (
    // ⚖ At EVERY width (controller, owner reminder 2026-10-01: "Desktop keeps its
    // header row but the same controls (one Filter ▾ + ⋯)"). A computer also
    // keeps Sort ▾ and the doors in its row — it may show more, never different.
    <div data-guests-phone-menu="">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="More for the guest list"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-ink/15 text-ink/70 hover:bg-ink/5"
      >
        <MoreHorizontal className="h-5 w-5" strokeWidth={1.8} aria-hidden />
      </button>
      {/* ⚖ THE SHEET IS DRAWN ON <body>, NOT IN THE PAGE (owner, live iPhone
          review 2026-10-04: the bottom bar sat OVER this sheet). The page's
          <main> carries `view-transition-name` (`.sn-vt-page`), which makes it
          its own stacking context — so a `z-50` drawn inside it can never rise
          above the bottom bar's `z-30`, drawn outside it. On <body> it does.
          The blur behind it is light (1px, the Drawer's): at 4px the header's
          round + dissolved into a plain black circle. */}
      {open && mounted ? createPortal(
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/[0.32] backdrop-blur-[1px] sm:items-center"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="More for the guest list"
            className="max-h-[85vh] w-full space-y-4 overflow-y-auto rounded-t-3xl bg-cream px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 sm:max-w-md sm:rounded-3xl"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-ink">Guest list</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex h-11 w-11 items-center justify-center rounded-full text-ink/60 hover:bg-ink/5"
              >
                <X className="h-5 w-5" strokeWidth={1.8} aria-hidden />
              </button>
            </div>
            {/* ONE Sort (owner 2026-10-04: "Sort" was a row label AND the
                button's own word) — the dropdown names itself. */}
            <div className="flex items-center gap-3" data-guests-phone-menu-sort="">
              {sort}
            </div>
            {/* A door that goes somewhere closes the sheet behind it (a link to
                this same page would otherwise leave it open over the result). */}
            <div
              data-guests-phone-menu-doors=""
              onClickCapture={(e) => {
                if ((e.target as HTMLElement).closest('a')) setOpen(false);
              }}
            >
              {doors}
            </div>
            {/* Every add door opens its own sheet or page — this one steps aside. */}
            <div
              className="space-y-0.5 border-t border-ink/10 pt-3"
              data-guests-phone-menu-add=""
              onClickCapture={(e) => {
                if ((e.target as HTMLElement).closest('a, button')) setOpen(false);
              }}
            >
              {addDoors}
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
