/**
 * row-tap.ts — A TAP ON A GUEST CARD'S WHITE SPACE OPENS THE GUEST CARD.
 *
 * ⚖ Frame F (computer rows, "Open · click anywhere on the row") and owner
 * 2026-10-03 (the phone card): tapping a guest row's white space opens the guest card,
 * the same as tapping the name — without stealing the taps that already do
 * something: the side dot, the role, + group, Invite, ⋯ and the reply pill.
 *
 * 🔑 "Already does something" is decided by what the tap LANDED on, not by a
 * list of today's controls: anything a person can press (a link, a button, a
 * field, a menu) keeps its tap, so a control added to the row tomorrow is safe
 * without anyone remembering this file. And a tap inside a menu or sheet the
 * row opened is never white space — those are drawn on the page (portalled),
 * outside the row's own box, so `row.contains` rules them out.
 */

/** What keeps its own tap inside a guest row. */
export const ROW_OWN_TAPS = [
  'a',
  'button',
  'input',
  'label',
  'select',
  'textarea',
  'summary',
  '[role="button"]',
  '[role="menu"]',
  '[role="menuitem"]',
  '[role="dialog"]',
  '[contenteditable="true"]',
  '[data-sheet]',
  '[data-row-own-tap]',
].join(',');

type Closest = { closest(selector: string): unknown };
type Contains = { contains(node: unknown): boolean };

/** Did this tap land on the row's white space (not on a control, not outside it)? */
export function isWhiteSpaceTap(target: unknown, row: Contains): boolean {
  const el = target as Partial<Closest> | null;
  if (!el || typeof el.closest !== 'function') return false;
  if (!row.contains(el)) return false;
  const hit = el.closest(ROW_OWN_TAPS);
  return !(hit && row.contains(hit));
}
