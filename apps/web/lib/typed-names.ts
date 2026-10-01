/**
 * typed-names.ts — ✍ THE EVENT'S NAMES, AS TYPED: one rule for what a typed
 * name may hold and how the two people's names become the page's names.
 *
 * Owner, 2026-10-01 (DECISION_LOG "ELEVEN OWNER ANSWERS" #1, *"wait for
 * apply"*): names typed in the Maker — on the hero (tap-to-type) or in Details ›
 * Your event — are DRAFT until Apply, like every Maker edit. So three places
 * read this rule and none may disagree:
 *
 *   · the Personalization page's writer (`updateEventMatchCriteria`), which
 *     writes the names live where the Maker is not involved;
 *   · the Maker's Details › Names editor, which drafts the very same columns;
 *   · the draft's sanitizer (`lib/hub-draft.ts`), the gate every drafted value
 *     passes on its way in and out.
 *
 * Pure and import-free on purpose: `lib/hub-draft.ts` is read in the browser,
 * and `lib/match-criteria.ts` (where `sanitizeName` used to live) pulls the
 * region list in with it.
 */

/** Letters, spaces, apostrophes and hyphens only — digits and symbols are dropped as typed. */
export function sanitizeName(raw: string): string {
  return (raw || '').replace(/[^\p{L}\s'-]/gu, '');
}

/** Per-field name length cap (matches the form input maxLength). */
export const MAX_NAME_LEN = 80;

/**
 * The longest page name (`events.display_name`) a draft holds — two full
 * names and their joiner ("Maria Clara Concepcion Reyes & …") fit.
 */
export const DISPLAY_NAME_MAX = 160;

/**
 * The page's names (`events.display_name`) as typed, or NULL when they cannot
 * be stored: nothing left after trimming, a control character, or markup
 * (`<` / `>`). Never repaired — a refused name is said, not silently changed.
 */
export function cleanDisplayName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f<>]/.test(raw.replace(/[\t\n\r]/g, ' '))) return null;
  const t = raw.replace(/\s+/g, ' ').trim();
  if (t.length === 0 || t.length > DISPLAY_NAME_MAX) return null;
  return t;
}

/**
 * ONE person's full name as `bride_name` / `groom_name` store it ("First
 * Last"): letters only, one space, capped. '' → null (cleared).
 */
export function cleanPersonName(raw: unknown): string | null | undefined {
  if (typeof raw !== 'string') return undefined;
  const t = sanitizeName(raw).replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LEN * 2 + 1);
  return t.length > 0 ? t : null;
}

/**
 * THE TWO PEOPLE'S NAMES → THE COLUMNS. `bride_name` / `groom_name` store
 * "First Last"; the page's names (`display_name`) are the FIRST names, "Ana &
 * Miguel" — the warm label onboarding writes. When neither first name is left
 * the page's names are NOT touched (`display_name` absent): a page is never
 * made nameless by clearing a form.
 */
export function coupleNameColumns(
  a: { first: string; last: string },
  b: { first: string; last: string },
): { bride_name: string | null; groom_name: string | null; display_name?: string } {
  const cap = (v: string) => sanitizeName(v).trim().slice(0, MAX_NAME_LEN);
  const aFirst = cap(a.first);
  const bFirst = cap(b.first);
  const bride = [aFirst, cap(a.last)].filter(Boolean).join(' ') || null;
  const groom = [bFirst, cap(b.last)].filter(Boolean).join(' ') || null;
  const display = [aFirst, bFirst].filter(Boolean).join(' & ');
  return { bride_name: bride, groom_name: groom, ...(display ? { display_name: display } : {}) };
}

/**
 * ✍ THE NAMES TYPED ON THE HERO → the page's names, or NULL (refused): empty,
 * markup, or — for two people — one side left blank ("Ana & " would print a
 * dangling joiner on every page). The two sides are joined the way the page
 * splits them (`splitCoupleNames`: " & "). One person's page keeps an "&" as
 * typed: it is their name, not a joiner.
 */
export function typedDisplayName(typed: string, twoPeople: boolean): string | null {
  const name = cleanDisplayName(typed);
  if (!name) return null;
  if (twoPeople && /&/.test(name) && name.split(/\s*&\s*/).some((s) => s.trim().length === 0)) return null;
  return name;
}
