/**
 * DatePlaceLine — "Fri, Dec 18, 2026 · Seda Vertis North, Metro Manila", the
 * second line of the Suppliers screen (owner 2026-10-06: the event's date and
 * venue live in Suppliers; 2026-10-07: *"this is already found inside the date
 * and location on top"* — it is the ONLY place on this page they appear).
 *
 * A SERVER component: the page owns the event read; the shell only places it
 * (`factsSlot`), pinned above Find · Build · Booked.
 *
 * 🔑 NO SECOND EDITOR. Each value opens the SHIPPED field for its fact — the
 * Maker's own `DateEditor` / `VenuesEditor`, in the sheet Event Details opens
 * for that row (`recordFieldHref`; `every-fact-has-one-editor.test.ts`), with
 * that page's Undo · Apply. A date or a venue is a DRAFT until Apply, and a
 * date a booked supplier cannot do is asked of them, never moved (J51) — so
 * this line never writes. PR5 brings both sheets onto this screen.
 *
 * The words are `lib/suppliers-shell.ts`'s; a value that is still vague ("a
 * month", "an area") or not set reads in the accent, as the prototype's `.set`.
 */
import Link from 'next/link';
import { RotateCcw } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { recordFieldHref } from '@/lib/event-details-record';
import type { SuppliersFact } from '@/lib/suppliers-shell';

/* The dotted text stays (owner 2026-10-12, look call 5), with a 44-px press area: the link is a 44-px tall box and the
   dotted line sits on the words inside it (`DOTTED`). */
const VALUE =
  'inline-flex min-h-11 items-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sn-accent';
const DOTTED = 'border-b border-dotted pb-px';
/* The ONE accent token for a value still to set (it is tappable) — both themes. */
const tone = (f: SuppliersFact) =>
  f.open ? '[&>span]:border-sn-accent/60 text-sn-accent hover:[&>span]:border-sn-accent' : '[&>span]:border-ink/55 text-ink hover:[&>span]:border-ink';

export function DatePlaceLine({
  eventId,
  facts,
}: {
  eventId: string;
  /** Null = the event row could not be read. That is said — it is never drawn
   *  as "Pick your date" to a couple who has one. */
  facts: { date: SuppliersFact; place: SuppliersFact } | null;
}) {
  if (!facts) {
    return (
      <p data-suppliers-facts="unreadable" role="status" className="flex flex-wrap items-center gap-2 text-[15px] leading-snug text-ink/70">
        Couldn’t load your date and place.
        {/* A problem says so with Try again (§ 9 kind 16): the line is drawn on the
            server, so trying again is drawing the page again. */}
        <ActionButton tone="neutral" quiet icon={RotateCcw} label="Try again" href={`/dashboard/${eventId}/vendors`} prefetch={false} />
      </p>
    );
  }
  const { date, place } = facts;
  return (
    <p data-suppliers-facts="" className="flex flex-wrap items-center gap-x-1.5 gap-y-0 text-[15px] leading-snug">
      <Link
        href={recordFieldHref(eventId, 'date')}
        prefetch={false}
        data-fact="date"
        aria-label={`Date: ${date.text}`}
        className={`${VALUE} ${tone(date)}`}
      >
        <span className={DOTTED}>{date.text}</span>
      </Link>
      <span aria-hidden className="text-ink/55">
        ·
      </span>
      <Link
        href={recordFieldHref(eventId, 'venues')}
        prefetch={false}
        data-fact="place"
        aria-label={`Place: ${place.text}`}
        className={`${VALUE} ${tone(place)}`}
      >
        <span className={DOTTED}>{place.text}</span>
      </Link>
    </p>
  );
}
