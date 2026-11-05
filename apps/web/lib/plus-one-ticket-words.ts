/**
 * 🎫 A PLUS-ONE'S TICKET ON ME — the words beside `PASS_CARD_WORDS` (owner 2026-10-21, guest_page_fixes_2_4 fix 4):
 * the row's one quiet line, and the sheet the ticket opens — "Pamela’s ticket · Show this at the door", with their
 * Save (`PASS_CARD_WORDS.saveOf`) inside. Its own FILE, beside `lib/pass-card.ts`: the Maker loads that module whole
 * and sits at its first-load budget (measured: even a second export there grew the Maker's first load), so only the
 * guest page, which imports this, carries these words.
 */
export const PLUS_ONE_TICKET_WORDS = {
  ofName: (first: string) => `${first}’s ticket`,
  tapToShow: 'Tap the ticket to show it',
  showAtDoor: 'Show this at the door',
} as const;
