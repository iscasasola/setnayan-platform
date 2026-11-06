import { NextResponse } from 'next/server';

/**
 * 🔌 A PRINT OR DOWNLOAD BUILT FROM A GUEST LIST WE COULD NOT READ (reads-are-honest, 2026-11-02 audit #14).
 *
 * `fetchGuestsByEvent` turns a refused read into `[]` — right for a page that must not crash, wrong for a file: the
 * caterer's sheet said "0 guests", the seat plan printed empty tables, the export was a header row. A route that
 * makes a file asks `fetchGuestsByEventMeasured` and, when it did not measure, answers THIS — a 503 that says so —
 * never a document of nobody. The same words `guests/export/route.ts` already used.
 */
export const GUEST_LIST_UNREAD_WORDS =
  "We couldn't read your guest list just now, so nothing was made. Nothing has been lost — try again in a moment.";

export function guestListUnreadResponse(): NextResponse {
  return new NextResponse(GUEST_LIST_UNREAD_WORDS, {
    status: 503,
    headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
