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
