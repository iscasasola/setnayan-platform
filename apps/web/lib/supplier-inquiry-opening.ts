import type { EventTypeProfile } from '@/lib/event-type-profile';

/**
 * lib/supplier-inquiry-opening.ts — the first message a host sends a supplier,
 * in the register of THEIR occasion. A pure decision.
 *
 * ── WHAT WAS WRONG ─────────────────────────────────────────────────────────
 * Two files hard-coded one sentence — `unlock-category.ts` and
 * `app/v/[slug]/inquiry-actions.ts`, byte-identical:
 *
 *   "Hi! We're planning our wedding and would love to hear about your
 *    availability and packages for our date."
 *
 * Every celebration type sent it. A birthday, a corporate event, a trip — and
 * a WAKE. A family arranging a funeral introduced themselves to a florist by
 * saying they were planning a wedding and would love to hear about packages.
 *
 * ── THE ANSWER COMES FROM THE PROFILE, NOT FROM A LIST OF TYPE NAMES ───────
 * `ProfileTerminology` already carries `eventWord` ('wedding' · 'wake' ·
 * 'celebration'), `organizerNoun` and `register`. A new event type inherits the
 * right sentence from its row instead of re-opening this file — the same shape
 * `lib/guest-side-question.ts` used for the same family of defect (#5560).
 *
 * 🔑 THE SOLEMN ARM IS DRAFTED, NOT DERIVED. Swapping one noun into the
 * celebratory sentence would still say "would love to hear" to a grieving
 * family. `register: 'solemn'` is documented in the profile as "a TONE build
 * across the whole guest tree, not a row in a table", and each site renders a
 * deliberately-written quiet arm. This is that arm, not a find-and-replace.
 */

/**
 * The opening message body for a first supplier inquiry.
 *
 * ⚠ NO TRAILING CONTEXT. Both callers append their own package/service details
 * after this; the returned string is the greeting and the ask, nothing else.
 */
export function supplierInquiryBody(profile: EventTypeProfile): string {
  const { eventWord, register } = profile.terminology;

  if (register === 'solemn') {
    /*
      A wake. No exclamation mark, no "would love to", no "packages" — the word
      the celebratory arm uses for a product menu reads as shopping for a
      funeral. Asks the two things that are actually needed and stops.
    */
    return (
      `Hello. We are arranging a ${eventWord} and would like to ask about your ` +
      'availability and rates for the date. Thank you.'
    );
  }

  return (
    `Hi! We're planning our ${eventWord} and would love to hear about your ` +
    'availability and packages for our date. Could you share your rates and ' +
    "what's included?"
  );
}
