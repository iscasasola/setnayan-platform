import type { ReactNode } from 'react';
import { SavePassCardButton } from '@/app/_components/save-pass-card-button';
import { PASS_CARD_WORDS } from '@/lib/pass-card';

/**
 * ONE DIGITAL TICKET, AS A ROW — the small card, whose it is, and "Save"
 * (prototype `Setnayan/prototypes/guest_ticket_flow_2026-09-29.html`, frame A:
 * "Your Digital ticket" and each named guest under "Your guests").
 *
 * 🔑 THE PICTURE IS THE SAVED FILE ITSELF. `href` is the ticket route
 * (`/api/guest/pass-card[?guest=…]`, lib/pass-card.ts) — the same 1080 × 1440
 * PNG "Save" hands over, drawn small. Never a second drawing of the card, so
 * what the guest sees is exactly what lands in their Photos.
 *
 * The route decides who may see it (the guest, or the guest who brought them);
 * a refused picture leaves its alt text, never another person's ticket.
 */
export function TicketRow({
  href,
  name,
  sub,
  saveLabel = 'Save',
  saveNote,
  also,
}: {
  href: string;
  name: string;
  /** One quiet line under the name ("and 1 guest"). */
  sub?: string | null;
  /** The button's words — "Save", or "Save your Digital ticket" once accepted. */
  saveLabel?: string;
  /** A line under the button (frame D: why the old picture still says pending). */
  saveNote?: string | null;
  /** A second action beside Save (frame A: "Send" for a plus-one). */
  also?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3" data-ticket-row="">
      {/* eslint-disable-next-line @next/next/no-img-element -- the route's own PNG, cookie-authenticated; next/image would proxy it without the cookie */}
      <img
        src={href}
        alt={`${name}’s ${PASS_CARD_WORDS.digitalTicket}`}
        width={96}
        height={128}
        loading="lazy"
        className="h-32 w-24 shrink-0 rounded-md bg-ink/[0.04] object-cover shadow-sm"
      />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate font-serif text-lg leading-tight text-ink">{name}</p>
        {sub ? <p className="text-xs text-ink/60">{sub}</p> : null}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <SavePassCardButton hrefs={[href]} label={saveLabel} />
          {also}
        </div>
        {saveNote ? <p className="text-xs text-ink/60">{saveNote}</p> : null}
      </div>
    </div>
  );
}
