'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { SavePassCardButton } from '@/app/_components/save-pass-card-button';
import { LANDING_WORDS, ticketPopupDue, ticketSeenKey } from '@/lib/guest-landing';
import { PASS_CARD_WORDS } from '@/lib/pass-card';
import { useModalA11y } from '@/lib/use-modal-a11y';

/**
 * A NEW OR CHANGED TICKET POPS UP FIRST, WITH SAVE (owner 2026-09-30, verbatim:
 * *"if a new QR Code is created, then it should pop up first with the save
 * button when they open their personal link"*; prototype
 * `guest_landing_page_2026-09-30.html` frame 5).
 *
 * Once per ticket VERSION (`ticketFingerprint`, lib/guest-landing.ts: a fresh
 * code, an accepted request, the party changing, the seat added on the day),
 * never nagging: the version this browser last showed is remembered, and the
 * pop-up opens only when the ticket in hand is a different one
 * (`ticketPopupDue`). Closing it, or saving, remembers the new version.
 *
 * 🔑 THE PICTURE IS THE SAVED FILE — the ticket route's own PNG, the one Save
 * hands over. Storage that throws (a private window) simply never pops up: the
 * ticket is on the page underneath either way.
 */
export function TicketPopup({
  guestId,
  fingerprint,
  fresh,
  src,
  name,
  safariHref,
}: {
  guestId: string;
  fingerprint: string;
  /** The arrival says the ticket is new (a request just accepted). */
  fresh?: boolean;
  src: string;
  name: string;
  /** iPhone inside Messenger: Save reads "Open in Safari to save" and goes there. */
  safariHref?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const remember = () => {
    try {
      window.localStorage.setItem(ticketSeenKey(guestId), fingerprint);
    } catch {
      /* storage refused — the ticket is still on the page */
    }
  };

  useEffect(() => {
    let seen: string | null = null;
    try {
      seen = window.localStorage.getItem(ticketSeenKey(guestId));
    } catch {
      return;
    }
    if (ticketPopupDue({ current: fingerprint, seen, fresh })) setOpen(true);
    else remember();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per version, on arrival
  }, [guestId, fingerprint, fresh]);

  const close = () => {
    remember();
    setOpen(false);
  };
  // Focus in, Escape closes, focus handed back — the repo's one modal hook.
  useModalA11y({ open, onClose: close, containerRef: dialogRef });

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 pb-6 pt-16" data-ticket-popup="">
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="ticket-popup-title" className="relative w-full max-w-sm rounded-3xl bg-cream p-5 text-center shadow-xl">
        <button type="button" onClick={close} aria-label="Close" className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-full text-ink/60 hover:text-ink">
          <X aria-hidden className="h-5 w-5" />
        </button>
        <p id="ticket-popup-title" className="text-xs font-semibold uppercase tracking-[0.18em] text-mulberry">
          {LANDING_WORDS.ticketUpdated}
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element -- the route's own PNG, cookie-authenticated */}
        <img
          src={src}
          alt={`${name}’s ${PASS_CARD_WORDS.digitalTicket}`}
          width={300}
          height={400}
          className="mx-auto mt-3 block aspect-[3/4] h-auto w-[min(260px,100%)] drop-shadow-md"
        />
        <div className="mt-4 flex justify-center" onClickCapture={remember}>
          {safariHref ? (
            <a href={safariHref} className="button-primary w-full">
              {LANDING_WORDS.saveInSafari}
            </a>
          ) : (
            <SavePassCardButton hrefs={[src]} label={LANDING_WORDS.saveTicket} />
          )}
        </div>
      </div>
    </div>
  );
}
