/**
 * 🗣 THE RECORD NOTICE'S WORDS (RA 10173 — `scan-trail-notice.tsx` draws them): the line, and what its ⓘ adds.
 *
 * "AT THIS EVENT" (owner 2026-10-24, the Me redraw: the event type's word → "event") — our own copy says "event",
 * never the event type's word (the house rule). Pure, so a guard can read it without drawing the page.
 */
/** The record notice's words: the line, and what its ⓘ adds (null: nothing to add). */
export function scanTrailLines(optedOut: boolean | null): { main: string; more: string | null } {
  if (optedOut === null) {
    return { main: 'We couldn’t check just now whether we keep a record of when you open your invitation at this event.', more: null };
  }
  return optedOut
    ? { main: 'We keep no record of when you open your invitation or scan your code at this event.', more: 'This page will greet you the same way every time.' }
    : { main: 'We keep a record of when you open your invitation or scan your code at this event.', more: 'It is how this page knows to welcome you when you first arrive.' };
}

