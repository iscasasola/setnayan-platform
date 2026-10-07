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
import { recordFieldHref } from '@/lib/event-details-record';
import type { SuppliersFact } from '@/lib/suppliers-shell';

const VALUE =
  'border-b border-dotted pb-px transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mulberry';
const tone = (f: SuppliersFact) =>
  f.open ? 'border-mulberry-700/60 text-mulberry-700 hover:border-mulberry-700' : 'border-ink/55 text-ink hover:border-ink';

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
      <p data-suppliers-facts="unreadable" role="status" className="text-[15px] leading-snug text-ink/70">
        Couldn’t load your date and place.
      </p>
    );
  }
  const { date, place } = facts;
  return (
    <p data-suppliers-facts="" className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[15px] leading-snug">
      <Link
        href={recordFieldHref(eventId, 'date')}
        prefetch={false}
        data-fact="date"
        aria-label={`Date: ${date.text}`}
        className={`${VALUE} ${tone(date)}`}
      >
        {date.text}
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
        {place.text}
      </Link>
    </p>
  );
}
