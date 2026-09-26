/**
 * lib/free-prints.ts — THE FREE GROUP of Prints & Tickets, as one list.
 *
 * Owner 2026-09-25, verbatim (DECISION_LOG "PRINTS & TICKETS HOLDS EVERY
 * PRINT"): *"add this to eventhub maker prints. Keep the rest we have now on
 * pro. and place all other prints for free there as well. so when they get
 * pro, they can print the pro prints."* — naming *"GuestList Registry 2D
 * SeatPlan QR Codes"*; the controller added what that list missed (table signs
 * and place cards, the caterer's meal counts, the event QR).
 *
 * 🔑 LINKED, NOT REBUILT. Every entry but the registry already shipped before
 * this list existed; each points at the route that already draws it:
 *   · guest-registry → /api/hub-print/guest-registry   (new, lib/print-guest-registry.ts)
 *   · qr-codes       → /api/hub-print/qr-codes         (#5977, the Guest list's QR PDF)
 *   · seat-plan      → /dashboard/<id>/seating/export  (lib/seating-pdf.ts, moodboard | blueprint)
 *   · seating-pack   → /dashboard/<id>/seating/print   (directory, table signs, place cards)
 *   · caterer        → /dashboard/<id>/seating/caterer (meal counts; CSV too)
 *   · event-qr       → /api/website/qr/<slug>          (the event's own QR, PNG)
 *
 * Each entry is a real thumbnail (`preview`) and one or more files to SAVE
 * (`saves`) — never a page to open. None is Pro and none is hidden in the
 * app-store shell: they are free, so there is nothing for App Review to see.
 * `lib/free-prints.test.ts` holds both.
 *
 * ⚠ The event QR here is the GUEST-facing one (it opens the Event Hub). The
 * page at /dashboard/<id>/event-qr is a different code — the CREW pairing QR,
 * carrying the event's master token — and must never be printed for guests.
 *
 * PURE — no I/O.
 */
import { printFileName } from '@/lib/print-pieces';

export type FreePrintSave = {
  /** The button's words. */
  label: string;
  /** Same-origin GET that answers with the file (Content-Disposition: attachment). */
  href: string;
  /** `<event slug>-<print>.<ext>` — the name the saved file gets. */
  file: string;
};

export type FreePrint = {
  key: 'guest-registry' | 'qr-codes' | 'seat-plan' | 'seating-pack' | 'caterer' | 'event-qr';
  label: string;
  /** One line: what it is and what it is for. */
  blurb: string;
  /** A same-origin image URL — the first page, or the thing itself. */
  preview: string;
  saves: FreePrintSave[];
};

export function freePrints(eventId: string, slug: string | null): FreePrint[] {
  const e = encodeURIComponent(eventId);
  const out: FreePrint[] = [
    {
      key: 'guest-registry',
      label: 'Guest list registry',
      blurb: 'The reception desk list — A to Z, party size, table, RSVP, a box to tick and a line to sign.',
      preview: `/api/hub-print/guest-registry?event=${e}&mode=screen`,
      saves: [{ label: 'Save PDF', href: `/api/hub-print/guest-registry?event=${e}`, file: printFileName(slug, 'guest-registry') }],
    },
    {
      key: 'qr-codes',
      label: 'Guest QR codes',
      blurb: 'Every guest’s own QR with their name, twelve to an A4 page.',
      preview: `/api/hub-print/qr-codes?event=${e}&mode=screen`,
      saves: [{ label: 'Save PDF', href: `/api/hub-print/qr-codes?event=${e}`, file: printFileName(slug, 'qr-codes') }],
    },
    {
      key: 'seat-plan',
      label: '2D seat plan',
      blurb: 'Your room from above — every table, every chair, and who sits where.',
      preview: `/dashboard/${e}/seating/export?format=preview&mode=moodboard`,
      saves: [
        { label: 'Save in your colours', href: `/dashboard/${e}/seating/export?mode=moodboard`, file: printFileName(slug, 'seat-plan') },
        { label: 'Save as blueprint', href: `/dashboard/${e}/seating/export?mode=blueprint`, file: printFileName(slug, 'seat-plan-blueprint') },
      ],
    },
    {
      key: 'seating-pack',
      label: 'Table signs & place cards',
      blurb: 'A table directory, one sign per table with its QR, and a place card for every seated guest.',
      preview: `/dashboard/${e}/seating/print?format=preview`,
      saves: [{ label: 'Save PDF', href: `/dashboard/${e}/seating/print?format=pdf`, file: printFileName(slug, 'seating-pack') }],
    },
    {
      key: 'caterer',
      label: 'Caterer meal counts',
      blurb: 'Meals per table and every dietary note, for confirmed guests.',
      preview: `/dashboard/${e}/seating/caterer?format=preview`,
      saves: [
        { label: 'Save PDF', href: `/dashboard/${e}/seating/caterer?format=pdf`, file: printFileName(slug, 'caterer-meal-counts') },
        { label: 'Save spreadsheet', href: `/dashboard/${e}/seating/caterer?format=csv`, file: printFileName(slug, 'caterer-meal-counts', 'csv') },
      ],
    },
  ];
  // The event QR encodes the Event Hub's address, so it needs one.
  if (slug) {
    const s = encodeURIComponent(slug);
    out.push({
      key: 'event-qr',
      label: 'Event QR',
      blurb: 'One code that opens your Event Hub — for a welcome sign, a table card or a screen.',
      preview: `/api/website/qr/${s}`,
      saves: [{ label: 'Save image', href: `/api/website/qr/${s}`, file: printFileName(slug, 'event-qr', 'png') }],
    });
  }
  return out;
}
