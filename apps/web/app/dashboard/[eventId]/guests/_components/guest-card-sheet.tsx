'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { InspectorColumn, InspectorSheetAlone } from '@/app/_components/inspector/inspector-column';
import { StatusLine } from '@/app/_components/status-line';
import { requestMakerRefresh } from '@/lib/maker-refresh';
import { UndoToastHost } from './undo-toast';
import type { GuestCardResult } from './guest-card';

/**
 * 🪪 A GUEST'S CARD, OPENED WHERE THERE IS NO GUEST LIST BEHIND IT — the Wedding March and the parents on the invitation
 * (owner 2026-10-24: *"the guest card on wedding march is not same with the guest card."*).
 *
 * The SAME card the Guest list opens (`GuestCard`, read by ONE action — `openGuestCard`), in the SAME sheet the Guest list
 * opens it in below 1280 (`InspectorSheetAlone`: the phone sheet with its peek, the 440 panel from 701 — and here at
 * ≥ 1280 too, where there is no rail to hand it to). Nothing here is a second card or a second editor.
 *
 *   · It opens AT the tap with the person's name and "Opening their card…" in the card's own header; the card arrives
 *     from ONE read — the Maker does not read every walker's card up front.
 *   · LIVE, NOT DRAFTED: a guest edit is not a march move. It goes straight to the guest list (the card's "✓ Saved"
 *     says so), and Apply / ↺ Undo / Restore do not cover it — the card's OWN Undo does: each autosave offers "Undo" in
 *     the toast (`UndoToastHost`, mounted while the sheet is open — the Maker has no host of its own).
 *   · Closing it after a save re-reads the Maker ONCE (`requestMakerRefresh`), so the march shows the new name or role at
 *     once — never a stale name. A sheet closed with nothing saved costs no read.
 *   · Drawn OVER the Maker: the Maker is a full-screen layer (`maker-shell.tsx`, `fixed … z-[80]`) and the sheet's own
 *     z-index is under it, so the portal is lifted in `GUEST_CARD_LAYER` — above the Maker, still under what the card
 *     itself opens (its dropdowns `z-[95]`, its ⓘ notes `z-[96]`, its toasts).
 */
export type GuestCardPerson = { id: string; name: string };

/**
 * The shipped readers, by surface — the one action (`openGuestCard`), loaded at the first tap (opening a surface reaches for
 * no server door). Module constants, so a sheet's read does not re-run on every render of the surface that opened it.
 */
export const SHIPPED_GUEST_CARD = {
  march: async (eventId: string, guestId: string): Promise<GuestCardResult> => (await import('../open-guest-card')).openGuestCard(eventId, guestId, 'march'),
  /* 🗂 R4 · Guests › Seats (owner 2026-10-29, *"tapping a seat can show a guest card"*): a face on the plan or the list. */
  seats: async (eventId: string, guestId: string): Promise<GuestCardResult> => (await import('../open-guest-card')).openGuestCard(eventId, guestId, 'seats'),
  invitation: async (eventId: string, guestId: string): Promise<GuestCardResult> =>
    (await import('../open-guest-card')).openGuestCard(eventId, guestId, 'invitation'),
} as const;

/** The card's layer on <body>: above the Maker's full-screen shell (`z-[80]`), under the card's own dropdowns (`z-[95]`). */
export const GUEST_CARD_LAYER = 'relative z-[90]';

export function GuestCardSheet({
  eventId,
  person,
  open: opener,
  onClose,
  onSaved,
  actions,
}: {
  eventId: string;
  person: GuestCardPerson;
  /** 🗂 R4 · the surface's own verbs for this person, drawn over their card (Guests › Seats: Remove · Swap). */
  actions?: ReactNode;
  /** How the card is read — the shipped action (`openGuestCard`), or a dev lab's stand-in. */
  open: (eventId: string, guestId: string) => Promise<GuestCardResult>;
  onClose: () => void;
  /** After a sheet that saved closes: the surface's re-read (the Maker's one refresh by default). */
  onSaved?: () => void;
}) {
  const [got, setGot] = useState<{ card: ReactNode } | { reason: string } | null>(null);
  const [tries, setTries] = useState(0);
  const saved = useRef(false);
  const closed = useRef(false);

  useEffect(() => {
    let live = true;
    setGot(null);
    opener(eventId, person.id)
      .then((r) => live && setGot(r.ok ? { card: r.card } : { reason: r.reason }))
      .catch(() => live && setGot({ reason: 'Their guest card couldn’t open just now — try again.' }));
    return () => {
      live = false;
    };
  }, [eventId, person.id, opener, tries]);

  /* ✕, Escape and the peek can each ask — the card closes, and the surface re-reads, once. */
  const close = useCallback(() => {
    if (closed.current) return;
    closed.current = true;
    onClose();
    if (saved.current) (onSaved ?? requestMakerRefresh)();
  }, [onClose, onSaved]);

  return (
    <>
      <InspectorSheetAlone onClose={close} layer={GUEST_CARD_LAYER}>
        <div
          data-guest-card-sheet={person.id}
          /* Every save the card makes is a submit of its own form (the autosave's `requestSubmit`) — heard here, so
             closing re-reads the surface only when something was saved. */
          onSubmitCapture={() => {
            saved.current = true;
          }}
        >
          {actions ? (
            <div data-guest-card-actions="" className="flex flex-wrap items-center gap-2 px-4 pb-1 pt-3">
              {actions}
            </div>
          ) : null}
          {got !== null && 'card' in got ? (
            got.card
          ) : (
            <InspectorColumn eyebrow="Guest" title={person.name} swapKey={person.id} ariaLabel={`${person.name} details`}>
              {got === null ? (
                <p role="status" data-guest-card-loading="" className="py-2 text-[13.5px] text-ink/65">
                  Opening their card…
                </p>
              ) : (
                <StatusLine tone="bad" data="guest-card-sheet" action={{ label: 'Try again', onClick: () => setTries((n) => n + 1) }}>
                  {got.reason}
                </StatusLine>
              )}
            </InspectorColumn>
          )}
        </div>
      </InspectorSheetAlone>
      {/* The host portals itself to <body> (z-[100]), over the card. */}
      <UndoToastHost />
    </>
  );
}
