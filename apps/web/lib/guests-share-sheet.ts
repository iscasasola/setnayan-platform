/**
 * 📤 WHAT EACH GUESTS VIEW CAN SHARE OR PRINT — the rows of the "Share or print" sheet its 📤 round opens (R4 slice 8;
 * owner 2026-10-29, prototype `printsFor`). One sheet per view, the view's own files, in the prototype's order:
 *
 *   List   · Guest list (as shown) · Check-in sheet · Meal count
 *   Map    · Guest list (the Map's groups)
 *   Seats  · Seat plan · Table list · Entrance seating chart · Table signs & place cards
 *   March  · Wedding march order
 *
 * 🔑 LINKED, NOT REDRAWN (Rule 0). Meal count, the seat plan, the entrance chart and the signs & place cards are the
 * prints that already ship (`lib/free-prints.ts` names the same routes); only the four documents no route made yet are
 * drawn on the shared engine by `guests/share` (`lib/guests-share-pdf.ts`). A file is made when Share is pressed,
 * never when the sheet opens (`SharePdfButton`).
 *
 * Not offered (no print engine draws them yet — said in the PR, not invented here): the prototype's Family map poster
 * and the march's Cue cards.
 *
 * PURE — no I/O. 🔒 lib/guests-share-or-print.test.ts
 */
import { printFileName } from '@/lib/print-pieces';
import { writeGuestsFilter, type GuestsFilter } from '@/lib/guests-filter';
import type { GuestsView } from '@/lib/guests-views';
import type { GuestsShareDocKey } from '@/lib/guests-share-pdf';

export type GuestsShareItem = {
  key: string;
  label: string;
  /** One line: what is on it. */
  line: string;
  /** Same-origin GET answering the PDF. */
  href: string;
  fileName: string;
  /** Paper ▾ — only where the route reads `?paper=` (the shared engine's documents). */
  papers?: 'document';
};

function shareDoc(eventId: string, doc: GuestsShareDocKey, extra?: URLSearchParams): string {
  const q = new URLSearchParams(extra);
  q.set('doc', doc);
  return `/dashboard/${encodeURIComponent(eventId)}/guests/share?${q.toString()}`;
}

export function guestsShareItems(
  view: GuestsView,
  ctx: {
    eventId: string;
    slug: string | null;
    /** The one ⇅ state — the Guest list prints what the view shows. */
    filter: GuestsFilter;
    /** "Everyone" · "Attending" … and "Role" · "Side" … as the ⇅ says them. */
    showLabel: string;
    groupLabel: string;
    /** The march's word ("Wedding march" at a wedding). */
    marchWord?: string;
  },
): GuestsShareItem[] {
  const e = encodeURIComponent(ctx.eventId);
  const file = (what: string) => printFileName(ctx.slug, what);
  const asShown = (from: 'list' | 'map'): GuestsShareItem => {
    const q = writeGuestsFilter(new URLSearchParams(), ctx.filter);
    q.set('from', from);
    return {
      key: 'guest-list',
      label: 'Guest list',
      line: from === 'map' ? `The Map’s groups as a list · ${ctx.showLabel.toLowerCase()} · grouped by ${ctx.groupLabel.toLowerCase()}` : `Everyone as shown · ${ctx.showLabel.toLowerCase()} · grouped by ${ctx.groupLabel.toLowerCase()}`,
      href: shareDoc(ctx.eventId, 'guest-list', q),
      fileName: file('guest-list'),
      papers: 'document',
    };
  };
  switch (view) {
    case 'list':
      return [
        asShown('list'),
        { key: 'check-in', label: 'Check-in sheet', line: 'Everyone coming, A to Z, with their table and a box to tick', href: shareDoc(ctx.eventId, 'check-in'), fileName: file('check-in-sheet'), papers: 'document' },
        { key: 'meal-count', label: 'Meal count', line: 'Meals per table and every dietary note, for the caterer', href: `/dashboard/${e}/seating/caterer?format=pdf`, fileName: file('caterer-meal-counts') },
      ];
    case 'map':
      return [asShown('map')];
    case 'seats':
      return [
        { key: 'seat-plan', label: 'Seat plan', line: 'The room as drawn · every table and name · A3', href: `/dashboard/${e}/seating/export?mode=moodboard`, fileName: file('seat-plan') },
        { key: 'table-list', label: 'Table list', line: 'Each table and who sits there', href: shareDoc(ctx.eventId, 'table-list'), fileName: file('table-list'), papers: 'document' },
        { key: 'entrance-chart', label: 'Entrance seating chart', line: 'Find your name, find your table · one sheet for the door', href: `/dashboard/${e}/seating/print?chart=table&format=pdf`, fileName: file('seating-chart-by-table') },
        { key: 'signs-cards', label: 'Table signs & place cards', line: 'One sign per table with its QR, a place card for every seated guest', href: `/dashboard/${e}/seating/print?format=pdf`, fileName: file('seating-pack') },
      ];
    case 'march':
      return [
        { key: 'march', label: `${ctx.marchWord ?? 'Wedding march'} order`, line: 'Every walk in order, with pairs', href: shareDoc(ctx.eventId, 'march'), fileName: file('wedding-march'), papers: 'document' },
      ];
  }
}
