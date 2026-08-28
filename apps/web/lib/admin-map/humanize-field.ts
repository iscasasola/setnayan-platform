/**
 * humanize-field.ts — turn a job's raw field name into a question a person can
 * answer, and back a value into the URL param the target form reads.
 *
 * `admin-jobs.generated.ts` carries the RAW argument names an action reads
 * (`tile_id`, `display_name_en`, `is_rental`, …) because that is what the scan
 * can prove — it never guesses a label or a field type. Turning that into a
 * question the admin can answer in the search box is a presentation problem,
 * not a schema one, so it lives here rather than in the generated file.
 */

/** A boolean-shaped field reads as a checkbox, everything else as text. */
export function fieldKind(name: string): 'boolean' | 'text' {
  return /^is_|^has_|_enabled$|^show_|^recurs_/.test(name) ? 'boolean' : 'text';
}

/**
 * "display_name_en" → "Display name". Strips the common locale/id suffixes
 * that would otherwise leak into the question ("Display name en", "Tile id").
 */
export function humanizeFieldLabel(name: string): string {
  let s = name.replace(/^is_/, '').replace(/_id$/, '').replace(/_en$/, '').replace(/_php$/, ' (₱)');
  s = s.replaceAll('_', ' ').trim();
  if (!s) s = name.replaceAll('_', ' ');
  const label = s.charAt(0).toUpperCase() + s.slice(1);
  return fieldKind(name) === 'boolean' ? `${label}?` : label;
}

/** The URL param key for a field's answer — prefixed so it can never collide
 *  with a page's own query params (`tab`, `q`, `_anchor`, …). */
export function askParamKey(field: string): string {
  return `aa_${field}`;
}

export const ADMIN_ASK_PARAM = 'admin_ask';

/**
 * The job hiding inside an href, or null if it carries none.
 *
 * Form-driven jobs travel as `${resolvedPath}?admin_ask=<jobName>` — a real
 * admin route, so a job is offered, validated and navigated exactly like a
 * page. Reading the marker back out is the only way to tell the two apart
 * again, and it is now needed in three places (the palette, the ranker, and
 * their guards).
 *
 * 🔑 IT LIVES HERE BECAUSE IT IS ONE RULE. It began as a private function
 * inside `admin-command-palette.tsx` — a `'use client'` component no test and
 * no server module can import — so anything else needing it had to write its
 * own copy against the same param. Two copies of a rule always drift, and this
 * one decides whether a job is treated as a job at all.
 */
export function jobNameFromAskHref(href: string): string | null {
  try {
    return new URL(href, 'https://admin.invalid').searchParams.get(ADMIN_ASK_PARAM);
  } catch {
    return null;
  }
}
