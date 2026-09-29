import { Ticket } from 'lucide-react';

/**
 * 🎟 "GET TICKETS" — the organizer's own ticket page, on a PUBLIC event.
 *
 * Owner, 2026-09-29 (DECISION_LOG "DISCOVER — UNPARKED", item b): a public
 * event may carry a "Where to get tickets" link. THE ORGANIZER SELLS THE
 * TICKETS — NEVER SETNAYAN — so this is a plain link out, in a new tab, with
 * `rel="noopener noreferrer"`: the ticket page gets no handle on this page and
 * no referrer from it.
 *
 * `url` is already `publicTicketUrl(...)` (lib/ticket-url.ts): null unless the
 * event is Public and the stored link parses as https. Null draws nothing.
 */
export function GetTickets({ url }: { url: string | null }) {
  if (!url) return null;
  return (
    <div className="mx-auto max-w-md" data-get-tickets="">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="button-primary flex min-h-[52px] w-full items-center justify-center gap-2"
      >
        <Ticket aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        Get tickets
      </a>
      <p className="mt-1.5 text-center text-xs text-ink/55">
        Tickets are sold by the organizer, on their own page.
      </p>
    </div>
  );
}
