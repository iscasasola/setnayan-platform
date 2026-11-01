/**
 * lib/how-guests-answer.ts — ❓ HOW GUESTS ANSWER: the words of the ONE setting over `rsvp_ask_config.oneAtATime`
 * (owner 2026-10-06: *"on RSVP, it can show all the questions or the data to fill like a form or ask one by one"*).
 *
 * Two named things, so a pill selector everywhere it is drawn (owner 2026-10-08, the templates). Lifted out of
 * `maker-rsvp-ask.tsx` (which re-exports them, word for word) in R1 (owner 2026-10-28, "RSVP moves into the Guests ⚙
 * sheet"): Guests ⚙ draws the same row now that the Studio RSVP tile is gone, and the guests page must not load the
 * Maker's RSVP panel to say two words. Pure strings: no React, no I/O.
 */
export const HOW_GUESTS_ANSWER_LABEL = 'How guests answer';
export const HOW_GUESTS_ANSWER_OPTIONS = [
  { key: 'all', label: 'All at once', hint: 'Every question on one page, like a form' },
  { key: 'one', label: 'One by one', hint: 'One question per screen · Next › Send' },
] as const;
/** Behind the row's ⓘ: what each of the two means — the options' own lines, word for word. */
export const HOW_GUESTS_ANSWER_ABOUT = HOW_GUESTS_ANSWER_OPTIONS.map((o) => `${o.label}: ${o.hint}.`).join(' ');
