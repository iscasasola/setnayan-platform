/**
 * 🧩 THE REPLY CARD'S OTHER THREE LINES, AND THE WORD EACH LINE OF THE RSVP STAGE HOLDS.
 *
 * Owner, on the live Maker's RSVP stage (2026-10-09): "why is this grouped?" · "shouldn't it be per element?" — and
 * on the prototype: "i like this idea. heading message then the whole group?" Every line is its own part, so every
 * line has words of its own: the eyebrow, the question and the hint join the two answers and the two notes
 * (`RSVP_WORD_KEYS`, `lib/rsvp-ask.ts`).
 *
 * ONE HOME for what each of the three says while the couple wrote nothing — read by the card that draws them
 * (`rsvp-widget.tsx`, `rsvp-one-at-a-time.tsx`) and by the Maker's "Automatic". Byte-identical to what the card
 * printed before these keys existed, so an event that never opens the Maker draws exactly as it did.
 *
 * Its own small module on purpose: `lib/rsvp-ask.ts` is read by the Maker's first load (`lib/hub-draft.ts`).
 */
import type { RsvpWordKey, RsvpWords } from './rsvp-ask';

export type RsvpFormWordKey = 'eyebrow' | 'question' | 'hint';

export const RSVP_FORM_WORD_DEFAULT: Readonly<Record<RsvpFormWordKey, { celebrate: string; solemn: string }>> = {
  eyebrow: { celebrate: 'Your reply', solemn: 'Your reply' },
  question: { celebrate: 'Will you celebrate with us?', solemn: 'Will you be with us?' },
  hint: { celebrate: 'Tap one to continue', solemn: 'Tap one to continue' },
};

/** One of the form's three lines: the couple's own words, else the card's. */
export function rsvpFormWord(words: RsvpWords | null | undefined, key: RsvpFormWordKey, solemn: boolean): string {
  return words?.[key] ?? RSVP_FORM_WORD_DEFAULT[key][solemn ? 'solemn' : 'celebrate'];
}

/**
 * The word a LINE holds, by the Maker part it belongs to (`lib/maker-parts.ts`: `rsvp` the form · `yesnote` ·
 * `nonote`) and the line's name (`RSVP_SECTION_LINES`, `rsvp-canvas-parts.ts`). A line that is not here has no words
 * to type — the pass's Save button: the app's own, the same for every event.
 */
export const RSVP_LINE_WORD: Readonly<Record<string, Readonly<Record<string, RsvpWordKey>>>> = {
  rsvp: { eyebrow: 'eyebrow', question: 'question', yes: 'attending', no: 'declined', hint: 'hint' },
  yesnote: { heading: 'thanksHeading', message: 'thanksMessage' },
  nonote: { heading: 'declineHeading', message: 'declineMessage' },
};

export function rsvpLineWord(part: string | null | undefined, line: string | null | undefined): RsvpWordKey | null {
  return (part && line ? RSVP_LINE_WORD[part]?.[line] : null) ?? null;
}
