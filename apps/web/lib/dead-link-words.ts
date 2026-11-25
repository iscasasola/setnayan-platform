/**
 * ⚖ A LEAF MODULE ON PURPOSE (24 Nov 2026). The sign-in card is a client component that loads with the Event Hub
 * Maker, so whatever it imports ships on the Maker's first tap. These words used to live in `auth-confirm-link.ts`,
 * whose landing rule imports `routes.ts` (26 KB) and `doors.ts`. Importing one constant from there put both on the
 * Maker's first load and took it over budget (`check-maker-js-budget.mjs`, #8263). Keep this file import-free.
 * `auth-confirm-link.ts` re-exports it, so server callers are unchanged.
 */

/** The sign-in card's words for a dead link — plain, and naming the one control that fixes it. */
export const DEAD_LINK_WORDS = {
  line: 'That link has expired or was already used. Send yourself a new one — it opens on any device.',
  button: 'Send a new link',
  pending: 'Sending…',
  sent: 'Open the newest email from Setnayan — its link works on your phone or your computer.',
  needEmail: 'Type the email you signed up with.',
} as const;
