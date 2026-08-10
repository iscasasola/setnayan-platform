/**
 * What the "is this your place?" card should say about a dropped pin.
 *
 * ── WHY THIS IS A DECISION AND NOT A TERNARY ────────────────────────────────
 * The card is the last thing between a vendor and a shop record that will carry
 * their address for as long as the shop exists. Owner-locked 2026-08-10: the
 * pin is required, and answering this question is what completes the step. So
 * this card is now on the critical path for every vendor who ever signs up.
 *
 * 🔑 THE FAILING CASE WAS A QUESTION WITH NOTHING IN IT. When the geocoder
 * returned no name, the card asked *"Is this the right spot?"* and showed
 * nothing underneath — a confirmation with no information to confirm against.
 * That does not check anything; it trains people to tap yes. The owner noticed
 * it on sight, quoting the sentence back with no other comment.
 *
 * The fix is not better phrasing. It is showing what we actually know:
 *
 *   1. the lookup named a city   → name it, with the matched street beneath
 *   2. the lookup found a street → show the street; "Quezon City" alone cannot
 *                                  tell you whether it found YOUR building
 *   3. the lookup found nothing  → **fall back to what the vendor typed.** Their
 *                                  own words are the best thing on screen to
 *                                  check a pin against, and they are already
 *                                  right there in the address box.
 *   4. nothing at all            → say so plainly and point at the map, rather
 *                                  than asking a blank question.
 *
 * Case 3 is the one that earns this file. A vendor whose address does not
 * geocode still typed something, and until now that text was ignored by the
 * card sitting directly beneath it.
 */
export type PinConfirmCopy = {
  /** Set when the lookup named a city — rendered as "Are you in <city>?". */
  city: string | null;
  /** The question to ask when there is no city to name. */
  question: string | null;
  /** The line beneath the question: an address to check the pin against. */
  detail: string | null;
};

const NOTHING_FOUND =
  'We couldn’t name that spot. Is the pin where your business is?';

export function pinConfirmCopy(
  found: { city: string; address: string } | null,
  typedAddress: string,
): PinConfirmCopy {
  const city = found?.city?.trim() || null;
  const foundAddress = found?.address?.trim() || null;
  const typed = typedAddress.trim() || null;

  // The matched street always wins over the typed one when we have it: it is
  // what the pin actually resolves to, so it is what a wrong pin will disagree
  // with. The typed text is the fallback, not the preference.
  const detail = foundAddress ?? typed;

  if (city) return { city, question: null, detail };
  if (detail) return { city: null, question: 'Is this the right spot?', detail };
  return { city: null, question: NOTHING_FOUND, detail: null };
}
