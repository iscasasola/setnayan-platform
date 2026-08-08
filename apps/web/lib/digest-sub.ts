/**
 * Does a digest row's second line earn its place?
 *
 * On the couple's Overview the "Needs you this week" panel became one line, one
 * number, one destination (design § 2.2). The grey second line survives ONLY when
 * it carries something a person cannot reconstruct from the row itself — a DATE or
 * a REFERENCE. Everything else it used to repeat is still written in full on the
 * decisions board directly below, so nothing is lost from the page.
 *
 * Grounded in the lines this panel actually renders, not in a guess:
 *
 *   "Order placed · ref A7K2QX"        → KEEP  (a reference the couple must quote)
 *   "Order placed · payment pending"   → drop  (the row's own chip already says it)
 *   "3 categories still open"          → drop  (the count is the row's right slot)
 *   "Saved options waiting on a lock"  → drop  (restates the label)
 *   "1 waiting"                        → drop
 *   "Key people your ceremony needs"   → drop
 *
 * 🪤 A BARE MONTH NAME IS NOT A DATE. "May" is a verb, "March" is a noun, and
 * "Saved options waiting on a lock" would sail past a naive month-word match the
 * moment someone writes "you may need to…". A month only counts as a date when a
 * NUMBER sits beside it, which is what an actual date always has. That single
 * requirement is the difference between this predicate and a coin toss.
 *
 * Presentation only — no href, no data, no behaviour changes with the answer.
 */

const MONTH =
  '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*';

/** `12 Dec`, `12 December 2026` — the app's day-first register. */
const DAY_FIRST = new RegExp(`\\b\\d{1,2}\\s+${MONTH}\\b`, 'i');
/** `Dec 12`, `December 12, 2026` — anything pasted in month-first. */
const MONTH_FIRST = new RegExp(`\\b${MONTH}\\.?\\s+\\d{1,2}\\b`, 'i');
/** `2026-12-12` — an ISO date that reached copy. */
const ISO_DATE = /\b\d{4}-\d{2}-\d{2}\b/;
/**
 * `ref ABC123`, `Ref: ABC123`, `reference A7K2QX`. Requires an actual code after
 * it — the word alone ("please reference your order") is prose, not a reference.
 *
 * 🪤 NO `i` FLAG, AND THAT IS THE WHOLE POINT. Written as `/…[A-Z0-9]{4,}/i`
 * this matched "Please **reference your** order": the flag makes `[A-Z0-9]` match
 * lowercase too, so the next four letters of ordinary prose became a "reference
 * code" and the line was kept forever. Order codes here are uppercase Crockford
 * base32, so the code half must stay case-SENSITIVE; only the word is spelled out
 * in its plausible casings. A case-insensitive class is not a looser match — it is
 * a different match, and this one silently disabled the rule it belonged to.
 */
const REFERENCE = /\b(?:ref|Ref|REF|reference|Reference|REFERENCE)\b[:\s#]*[A-Z0-9]{4,}\b/;

export function digestSubWorthShowing(sub: string | null | undefined): boolean {
  if (!sub) return false;
  const text = sub.trim();
  if (!text) return false;
  return (
    REFERENCE.test(text) || ISO_DATE.test(text) || DAY_FIRST.test(text) || MONTH_FIRST.test(text)
  );
}
