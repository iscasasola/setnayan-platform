/**
 * lib/guest-host-note.ts — 💌 A NOTE FOR ONE GUEST, WRITTEN BY THE HOSTS, SEEN ONLY BY THAT GUEST (owner 2026-10-20,
 * DECISION_LOG "A NOTE FOR ONE GUEST — WRITTEN BY THE HOSTS, SEEN ONLY BY THAT GUEST, BESIDE THEIR ROLE'S NOTE").
 *
 * Owner, verbatim, on the guest card: *"we can also add a special note for each guests that will be customized aside
 * from their role notes."*
 *
 * THREE NOTES ON ONE GUEST ROW — three directions, never one column for two:
 *   `notes`                the couple's PRIVATE note about the guest ("Private note · only you") — never shown to them
 *   `guest_note`           the guest's own message to the couple (their RSVP box) — read-only to the couple
 *   `host_note_for_guest`  THIS: the hosts' note TO the guest ("Note for them · they see it") — shown on their own Me
 *
 * 🔒 WHERE IT GOES: the guest card writes it; the guest's OWN Me page reads it (`loadGuestOwnRow` — the reader's own row,
 * by their verified pass or account). Nothing else selects it: not the list (`GUEST_FIELDS`), the prints, the OG images
 * (`/api/og/*`), the Excel export or any other guest's view. `a-note-reaches-only-its-guest.test.ts` holds that.
 *
 * Pure. No I/O, no React.
 */

/** The column's own CHECK (migration `20271281265688`) — the card's box stops here and `updateGuest` cuts here. */
export const HOST_NOTE_MAX = 500;

/** The note as Me draws it — trimmed; null when there is nothing to say (no heading over an empty note). */
export function hostNoteShown(raw: string | null | undefined): string | null {
  const text = (raw ?? '').trim();
  return text ? text.slice(0, HOST_NOTE_MAX) : null;
}

/**
 * The heading over it on Me: "A note from Jodalicca & Claire" — the event's own names. An event without a name says
 * who in the event's own words ("A note from the couple" · "from the debutante").
 */
export function hostNoteHeading(eventNames: string | null | undefined, theOrganizer: string): string {
  const names = (eventNames ?? '').trim();
  return `A note from ${names || theOrganizer}`;
}
