/**
 * in-business-since.ts — the "In business since" question, asked ONCE on open-shop step 2.
 *
 * Owner "Yes to all", 2026-10-22 (journey_fixes_2026-10-22.html § Supplier 2 · Option A): a new shop
 * used to open "unfinished" for EST, a field the opening steps never asked (`businessProfileChecklist`
 * counts it). It is now asked where it is easy to answer — one dropdown (a year is a choice set, owner
 * 28 Sep), "Just starting" first — and once answered it is never asked again. Optional to answer;
 * approval asks nothing new and nothing less.
 *
 * Pure: the wizard draws the choices, the server action parses the post, the guard asks both.
 */

/** The oldest year offered — the same floor `updateVendorProfileField` refuses below. */
export const SINCE_FLOOR = 1950;

export type SinceChoice = { key: string; label: string };

/** "Just starting" (this year), then every earlier year down to the floor — newest first. */
export function inBusinessSinceChoices(thisYear: number): SinceChoice[] {
  const out: SinceChoice[] = [{ key: String(thisYear), label: 'Just starting' }];
  for (let y = thisYear - 1; y >= SINCE_FLOOR; y -= 1) out.push({ key: String(y), label: String(y) });
  return out;
}

/** The posted year, or null when unanswered / not a year we offer. Never a year in the future. */
export function parseInBusinessSince(raw: unknown, thisYear: number): number | null {
  if (typeof raw !== 'string' || !/^\d{4}$/.test(raw.trim())) return null;
  const y = Number(raw.trim());
  return y >= SINCE_FLOOR && y <= thisYear ? y : null;
}
