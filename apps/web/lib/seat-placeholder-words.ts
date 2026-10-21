/**
 * lib/seat-placeholder-words.ts — THE WORDS THE APP WRITES INTO A NAME COLUMN FOR A +1 NOBODY HAS NAMED YET.
 *
 * ⚖ Owner 2026-10-21, on the guest card of "dally BIR’s +1 · TBA": *"Why is the +1 listed as the +1's last name? when
 * there is no last name yet until we type on it or it is filled up by the guest via RSVP"*.
 *
 * `guests.first_name` / `last_name` are NOT NULL, so an unnamed seat is stored with stand-in words: first "TBA"
 * (`PLACEHOLDER_FIRST_NAME`), last "+1" (`PLACEHOLDER_LAST_NAME`), and a seat label as its "Shown as" ("+1 · TBA", or an
 * older "+ TBA · brought by …"). The seat engine, the welcome door, the pass and the prints all KEY on those words
 * (`isPlaceholderSeat`, `plusOneUnnamed`, `redeem/route.ts`), so they stay stored. What changes is that they are never
 * DRAWN or SENT as if somebody typed them: a NAME BOX shows them empty ("Add"), a greeting skips them, a file leaves them
 * blank, and a save never writes them back as a typed name (`lib/extra-seats.ts` `seatNameAsTyped` / `plusOneNameSave`).
 *
 * No imports — `lib/guests.ts` and `lib/extra-seats.ts` both read it.
 * 🔒 lib/an-unnamed-plus-one-has-no-name.test.ts
 */

export const PLACEHOLDER_FIRST_NAME = 'TBA';
export const PLACEHOLDER_LAST_NAME = '+1';

export type NamePart = 'first' | 'last' | 'display';

/** True when `value` is one of the stand-in words the app writes for an unnamed seat — never a name a person typed. */
export function isPlaceholderNameWord(part: NamePart, value: string | null | undefined): boolean {
  const v = (value ?? '').replace(/\s+/g, ' ').trim();
  if (!v) return false;
  // A seat's label — "+1 · TBA", "+ TBA · brought by Maria", "+ TBA 3 · brought by …" — or the two words run together.
  // It is a stand-in in ANY box (an older page could post one into First); no real name starts with "+".
  const label = /^\+\s*\d*\s*·?\s*TBA\b/i.test(v) || /^TBA(\s+\+\d*)?$/i.test(v);
  if (part === 'display') return label;
  // In a name box either stand-in word is one — the RSVP writes "TBA" first and "+1" last, a host may type either anywhere.
  return label || v.toUpperCase() === PLACEHOLDER_FIRST_NAME || /^\+\d*$/.test(v);
}

/** The value with a stand-in word read as empty. */
export function withoutPlaceholderWord(part: NamePart, value: string | null | undefined): string {
  const v = (value ?? '').trim();
  return isPlaceholderNameWord(part, v) ? '' : v;
}

/**
 * First + last for a compact or formal name: a stand-in part is dropped when the OTHER part is a real name, so a seat
 * named "Ben" (its last still the stored "+1") reads "Ben", never "Ben +1". Both stand-ins → kept as they are (the
 * caller's own fallback, unchanged).
 */
export function realNameParts(first: string | null | undefined, last: string | null | undefined): { first: string; last: string } {
  const f = (first ?? '').trim();
  const l = (last ?? '').trim();
  const fp = isPlaceholderNameWord('first', f);
  const lp = isPlaceholderNameWord('last', l);
  if (fp && lp) return { first: f, last: l };
  return { first: fp ? '' : f, last: lp ? '' : l };
}
