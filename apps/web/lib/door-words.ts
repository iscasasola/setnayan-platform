/**
 * ⚖ A LEAF MODULE ON PURPOSE (24 Nov 2026), for the same reason as `dead-link-words.ts`: the client sign-in card
 * reads these words, and importing them from `doors.ts` shipped the whole host-routing module on the Event Hub
 * Maker's first load (#8263). Type-only import below, so nothing from `doors.ts` reaches the browser.
 * `doors.ts` re-exports this.
 */
import type { Door } from './doors';

/**
 * The sign-in card's words on a door — the heading slot only; the card itself is the one card. Its title only: the
 * simple sign-in card (owner 24 Nov 2026) draws no eyebrow and no sentence, the same as the guest's words.
 */
export const DOOR_SIGN_IN_WORDS: Record<Door, { title: string }> = {
  supplier: { title: 'Sign in to your shop.' },
  coordinator: { title: 'Sign in to your business.' },
};
