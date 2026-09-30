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
 * doors (`AddDoors` — People · Full form · Import · Quick add list). The row of
 * doors is hidden below `lg` ONLY because this sheet draws it — the lesson of
 * the Wedding March, which a `hidden lg:block` once deleted from every phone.
 */

import { useRef, useState } from 'react';
import { MoreHorizontal, X } from 'lucide-react';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { ROSTER_COLUMN_LABEL, type RosterColumn } from '@/lib/roster-columns';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { usePhoneColumn } from './phone-column-channel';

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
  const show = usePhoneColumn();
  const sheetRef = useRef<HTMLDivElement>(null);
  useModalA11y({ open, onClose: () => setOpen(false), containerRef: sheetRef });

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
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/[0.32] backdrop-blur-[4px] sm:items-center"
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
            <div className="flex items-center justify-between gap-3" data-guests-phone-menu-sort="">
              <span className="text-sm text-ink">Sort</span>
              {sort}
            </div>
            {/* Show ▾ — the phone's one column beside each name (E's pick,
                remembered per device). Only a phone draws that column. */}
            {show ? (
              <div className="flex items-center justify-between gap-3 lg:hidden" data-guests-phone-menu-show="">
                <span className="text-sm text-ink">Show</span>
                <PickMenu
                  compact
                  label="What each row shows"
                  value={show.column}
                  buttonText={ROSTER_COLUMN_LABEL[show.column]}
                  options={show.available.map((c) => ({ key: c, label: ROSTER_COLUMN_LABEL[c] }))}
                  onPick={(key) => show.pick(key as RosterColumn)}
                  dataAttr="data-roster-column-pick"
                />
              </div>
            ) : null}
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
        </div>
      ) : null}
    </div>
  );
}
