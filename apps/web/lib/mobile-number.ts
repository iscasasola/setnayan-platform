/**
 * A MOBILE NUMBER, FOR A YES — at least seven digits.
 *
 * A guest's walk, 2026-10-11 (fault N18): the reply card marks Mobile
 * "(required)" for a yes, and "abc" was accepted. The box only ever asked
 * "is it empty?" — in the browser (`required`) and on the server
 * (`submitRsvp`). Owner, the same day ("ok all"): a yes needs a mobile number
 * of at least 7 digits; a no does not need one.
 *
 * THE RULE, ONE PLACE. Digits are counted after the things people type around
 * a number are taken away — spaces, dashes, a leading +, brackets, dots:
 * "+63 917 123 4567", "(0917) 123-4567" and "8123 4567" all count. Seven is a
 * local landline; nothing here knows a country, and nothing longer is turned
 * away. Letters are not digits: "abc" has none.
 *
 * WHO ASKS IT:
 *   · the server — `submitRsvp` (app/[slug]/actions.ts), for a yes on an open
 *     list when the couple asks for a mobile. This is the half a crafted post
 *     or a phone with no script cannot skip;
 *   · the browser — `ReplyForm` (app/[slug]/_components/reply-form.tsx), before
 *     it sends, so the guest keeps the form and reads the reason under the
 *     button (`mobileNeededForPress` below decides whether THIS press needs
 *     one). The card's own HTML is not touched (its bytes are on record).
 *
 * THE WORDS are the ones the pages already say for a yes with no number
 * (`?rsvp=mobile`, app/[slug]/page.tsx and invite/reply/page.tsx) — one
 * sentence for one fact, pinned equal by lib/mobile-number.test.ts.
 *
 * NOT CHANGED: the key gate (`rsvpGate`, lib/guest-one-path.ts) still asks only
 * whether a number is on the row — a number the couple typed themselves is
 * never re-asked of a guest who has already replied.
 *
 * Pure and DOM-free.
 */
export const MOBILE_MIN_DIGITS = 7;

export const MOBILE_NEEDED =
  'Please add your mobile number so we can reach you. Your reply has not been saved yet.';

/** How many digits the number holds, once spaces, dashes, +, brackets and dots are taken away. */
export function mobileDigits(raw: string | null | undefined): number {
  return (raw ?? '').replace(/[\s\-+()[\].]/g, '').replace(/\D/g, '').length;
}

/** Is this enough of a number to reach someone on? */
export function mobileIsEnough(raw: string | null | undefined): boolean {
  return mobileDigits(raw) >= MOBILE_MIN_DIGITS;
}

/**
 * IS A NUMBER NEEDED FOR THIS PRESS? — what the form's own handler asks, from
 * what the card already shows:
 *   · the box is `required` (the card that asks only for what is missing), or
 *   · the answer being sent is a yes AND the card marks Mobile "(required)" for
 *     a yes (the `.attend-mark` beside its label — drawn only when the couple
 *     asks for a mobile, on an open list).
 *
 * ⚠ NOT "the box is `required`" ALONE. On the full card that property is set by
 * a line of script inside the card, and a script arriving by a client-side
 * navigation never runs (rsvp-widget.tsx says so) — seen in a real browser on
 * 2026-10-11: with only that reading, a yes with "abc" was sent. The mark is in
 * the HTML itself, so this holds however the page arrived.
 */
export function mobileNeededForPress(input: {
  /** `rsvp_status` as this press would send it. */
  answer: string | null | undefined;
  /** The box's own `required`. */
  boxRequired: boolean;
  /** The card marks Mobile as required for a yes. */
  markedRequiredForYes: boolean;
}): boolean {
  return input.boxRequired || (input.answer === 'attending' && input.markedRequiredForYes);
}
