'use client';

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Sheet } from '@/app/_components/sheet';
import { StatusLine } from '@/app/_components/status-line';
import { requestMakerRefresh } from '@/lib/maker-refresh';
import { HubSavesImmediately } from '../../website/_components/hub-draft-field';
import { UndoToastHost } from '../../guests/_components/undo-toast';
import type { MarchCardResult } from '../march-card-actions';

/**
 * 🚶 A NAME ON THE WEDDING MARCH OPENS THEIR OWN GUEST CARD, RIGHT HERE (owner, verbatim, 2026-10-14: *"on Wedding march.
 * when we click a guest, we can show the guest card on the guest's page so they can rename edit it there and do not need to
 * go back to guests."*).
 *
 * The SAME sheet the parents' cards open in (Studio › Prints, `StudioParents` — `Sheet` with `rise`, drawn on <body> because
 * the dashboard's transformed box would capture `fixed`), holding the SAME card: `GuestCardBody`, the hand-drawn kit, the
 * shipped `updateGuest`. Nothing here is a second editor: the name, role, side, reply and every other field are the card's,
 * and they save the way the Guest list saves them — live, every column (`the-card-posts-every-column.test.ts`).
 *
 *   · The sheet opens AT the tap with the person's name and "Opening their card…"; the card arrives from ONE read
 *     (`openMarchGuestCard`) — the Maker does not read every walker's card up front.
 *   · LIVE, NOT DRAFTED: a guest edit is not a march move. It goes straight to the guest list (and so the live Event Hub), the
 *     line under the name says so (`HubSavesImmediately`), and Apply / ↺ Undo / Restore do not cover it — the card's OWN Undo
 *     does: each autosave offers "Undo" in the toast (`UndoToastHost`, mounted while the sheet is open — the Maker has no host
 *     of its own), which posts the previous card back through the same action.
 *   · Closing it after a save re-reads the Maker ONCE (`requestMakerRefresh`), so the march shows the new name or role at
 *     once — never a stale name. A sheet closed with nothing saved costs no read.
 *
 * Loaded with the march (the Details chunk), never in the Maker's first load.
 */
export type MarchCardPerson = { id: string; name: string };

export function MarchGuestCard({
  eventId,
  person,
  open: opener,
  onClose,
  onSaved,
}: {
  eventId: string;
  person: MarchCardPerson;
  /** How the card is read — the shipped action, or the dev lab's stand-in. */
  open: (eventId: string, guestId: string) => Promise<MarchCardResult>;
  onClose: () => void;
  /** After a sheet that saved closes: the march re-read (the Maker's one refresh by default). */
  onSaved?: () => void;
}) {
  const headId = useId();
  const [got, setGot] = useState<{ card: ReactNode } | { reason: string } | null>(null);
  const [tries, setTries] = useState(0);
  const saved = useRef(false);
  const [body, setBody] = useState<HTMLElement | null>(null);
  useEffect(() => setBody(document.body), []);

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

  const close = useCallback(() => {
    onClose();
    if (saved.current) (onSaved ?? requestMakerRefresh)();
  }, [onClose, onSaved]);

  if (!body) return null;
  return createPortal(
    <>
      <Sheet open onClose={close} labelledById={headId} rise>
        <div
          data-march-card={person.id}
          /* Every save the card makes is a submit of its own form (the autosave's `requestSubmit`) — heard here, so closing
             re-reads the march only when something was saved. */
          onSubmitCapture={() => {
            saved.current = true;
          }}
          className="flex min-h-0 flex-col gap-2 overflow-y-auto px-4 pb-6 pt-3"
        >
          <h2 id={headId} className="pr-12 text-[17px] font-semibold text-ink">
            {person.name}
          </h2>
          <HubSavesImmediately />
          {got === null ? (
            <p role="status" data-march-card-loading="" className="py-2 text-[13.5px] text-ink/65">
              Opening their card…
            </p>
          ) : 'card' in got ? (
            got.card
          ) : (
            <StatusLine tone="bad" data="march-card" action={{ label: 'Try again', onClick: () => setTries((n) => n + 1) }}>
              {got.reason}
            </StatusLine>
          )}
        </div>
      </Sheet>
      <UndoToastHost />
    </>,
    body,
  );
}
