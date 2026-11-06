/**
 * 🔤 THE REPLY'S QUESTION LINE — drawn once, in a file with no imports, so the plus-ones box (a client component) can
 * wear it without downloading the screen's lines. `rsvp-lines.tsx` re-exports both for everything that already reads
 * them from there.
 */
export const RSVP_FORM_QUESTION_CLASS = {
  led: 'mt-2 block font-serif text-[32px] font-medium leading-[1.1] tracking-tight text-ink',
  out: 'block pb-3 font-serif text-[32px] font-medium leading-[1.1] tracking-tight text-ink',
} as const;
/**
 * 🔤 EVERY LATER STEP'S QUESTION WEARS STEP 1's (hub leftovers 2026-10-13: steps 2+ drew 20 px against the couple's 32 px
 * question line). The tagging question, "Who are you bringing?", the note / contact / song / meal labels and any other
 * question the one-at-a-time flow turns into a screen heading take THIS class — the `out` spelling of the line above
 * (it sits out of a legend, so it keeps the `pb-3` room under it). One class, so a step cannot drift again.
 */
export const RSVP_STEP_QUESTION_CLASS = RSVP_FORM_QUESTION_CLASS.out;
