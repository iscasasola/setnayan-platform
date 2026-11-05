import { GUEST_CARD_ERROR_COPY } from './guest-card-body';
import { plainRefusal } from './plain-refusal';

/**
 * guestCardErrorCopy — WHAT THE CARD SAYS WHEN A SAVE CAME BACK WITH `?error=` (step 4C, 2026-10-09).
 *
 * The three pages that draw the card (the list's panel, the card page, the dev lab) used to print
 * `GUEST_CARD_ERROR_COPY[x] ?? decodeURIComponent(x)` (or `?? x`): a code the map did not know — or a database's own message,
 * which an action puts in `?error=` when a write is refused — reached the host as it was ("new row violates row-level security
 * policy…"). Here a known code says its sentence; anything else is shown only if it is plainly a sentence written for a person
 * (`plain-refusal.ts`); otherwise the card says one plain line of its own. Mapped on the SERVER side of the card, so nothing is
 * added to what the browser downloads — and this file is imported by the pages, never by the card body.
 */
export const GUEST_CARD_FALLBACK = 'That didn’t go through — nothing was changed. Please try again.';

export function guestCardErrorCopy(raw: string): string {
  const decoded = (() => {
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  })();
  return GUEST_CARD_ERROR_COPY[raw] ?? GUEST_CARD_ERROR_COPY[decoded] ?? plainRefusal(decoded, GUEST_CARD_FALLBACK);
}
