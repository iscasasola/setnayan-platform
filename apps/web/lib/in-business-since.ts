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

/**
 * 🗓 "SINCE" IS TWO LINES (owner 2026-10-29, Supplier dashboard v13 note 1 — *"Since will be how long they have had their
 * business? or how long have they been part of setnayan?"*): BOTH. "In business since" is THEIR OWN year
 * (`in_business_since_year`, editable, shown on their page as "N years in business"); "On Setnayan since" is the
 * month their shop opened here (`vendor_profiles.created_at`, read-only). These two words are the only place either
 * is phrased, so Your details and the lab cannot drift.
 */
export const IN_BUSINESS_SINCE_LABEL = 'In business since';
export const IN_BUSINESS_SINCE_HELP = 'Your own start year — shown on your page';
export const ON_SETNAYAN_SINCE_LABEL = 'On Setnayan since';

/** "2023 · 3 years" · "2026 · this year" · "2025 · 1 year". Null when no year was given (never a made-up one). */
export function inBusinessSinceLine(year: number | string | null | undefined, thisYear: number): string | null {
  const y = typeof year === 'string' ? Number(year.trim()) : year;
  if (typeof y !== 'number' || !Number.isInteger(y) || y < SINCE_FLOOR || y > thisYear) return null;
  const n = thisYear - y;
  return `${y} · ${n === 0 ? 'this year' : n === 1 ? '1 year' : `${n} years`}`;
}

/** "Oct 2026" from the shop row's `created_at` (Manila time). Null when the stamp is missing or unreadable — the row
 *  then says it could not be read, never a date. */
export function onSetnayanSinceLine(createdAt: string | null | undefined): string | null {
  if (!createdAt) return null;
  const t = Date.parse(createdAt);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toLocaleDateString('en-PH', { month: 'short', year: 'numeric', timeZone: 'Asia/Manila' });
}
