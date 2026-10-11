/**
 * lib/split-names.ts — ONE NAME LINE, SPLIT INTO THE PEOPLE IT NAMES.
 *
 * The page's own rule for `events.display_name` ("Maria & Juan", "Ana and Leo", "TEsting Event"), in a file of its
 * own so BOTH readers use the same one: the masthead that draws the cover (`pahina-masthead.tsx`, which re-exports
 * it) and the Maker's canvas that shows a name as it is typed (`type-in-place-canvas.ts` `setPartWords`). They were
 * two rules — the canvas split on "&" alone and never asked whether there WAS a second person — so one name typed
 * into a two-name cover left the joiner standing over nothing: "TEsting Event / and / (blank)" (owner, 2026-10-11).
 *
 * Pure. No React, no DOM.
 */

/**
 * Split "Maria & Jose" / "Maria and Jose" into stacked lines. Falls back to a
 * single line when no separator is found (solo-named events, debuts).
 *
 * `twoPeople` is the event's own fact — `terminology.person_b` is non-null, i.e.
 * this event HAS two people at its centre (`EventWords.twoPeople`). When it is
 * FALSE the name is one line whatever punctuation it contains, because the
 * stacked-with-a-gild-joiner treatment is the WEDDING masthead and an ampersand
 * in a company name is not two people:
 *
 *     "Ayala & Partners Year-End"  →  ONE line   (was: "Ayala" & "Partners…")
 *     "Bench & Co Summer Outing"   →  ONE line   (was: "Bench" & "Co Summer…")
 *     "Maria & Juan" (a wedding)   →  still split, unchanged
 *
 * 🔒 IT DEFAULTS TO `true`, WHICH IS TODAY'S BEHAVIOUR, and that direction is
 * deliberate — the same reasoning as `event-words-provider.tsx`'s wedding
 * fallback. Production is weddings; a caller that has not been wired yet must
 * keep splitting rather than silently flattening a real couple's masthead onto
 * one line. The invisibility that creates is closed by a guard, not by a scary
 * default: `event-words.test.ts` asserts every call site passes the flag.
 */
export function splitCoupleNames(
  displayName: string,
  twoPeople = true,
): {
  first: string;
  second: string | null;
  joiner: string | null;
} {
  if (!twoPeople) return { first: displayName, second: null, joiner: null };
  const amp = /\s*&\s*/.exec(displayName);
  if (amp) {
    const [first = '', ...rest] = displayName.split(/\s*&\s*/);
    return { first, second: rest.join(' & ') || null, joiner: '&' };
  }
  const and = /\s+and\s+/i.exec(displayName);
  if (and) {
    const first = displayName.slice(0, and.index);
    const second = displayName.slice(and.index + and[0].length);
    return { first, second: second || null, joiner: 'and' };
  }
  return { first: displayName, second: null, joiner: null };
}
