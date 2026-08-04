/**
 * `return_to` — let a website-editor panel send the couple back to the EDITOR
 * after a save, instead of to the sub-page an action was written for
 * (Unified Website Editor · PR-3).
 *
 * Every `/website/*` action ends with `redirect('/dashboard/[id]/website/<sub>')`.
 * That is correct when the couple came from that sub-page — but the unified
 * editor calls the SAME actions from inline panels, and being bounced out of the
 * editor to a sub-page is exactly the jumping-around the editor exists to end.
 *
 * Rather than fork the write layer (a second set of actions would be the drift
 * hazard the whole program is removing), each action now asks this helper where
 * to land. It is **opt-in and default-identical**: with no `return_to` field —
 * i.e. every existing sub-page form, unchanged — it returns the action's own
 * fallback, so those flows behave exactly as before.
 *
 * SAFETY: the value is attacker-supplied form data, so it is validated as an
 * INTERNAL dashboard path before use — never an open redirect. Anything that is
 * not a same-origin `/dashboard/…` path falls back.
 */

/**
 * Resolve the post-save destination.
 *
 * @param formData the submitted form (may carry `return_to`)
 * @param fallback the action's own default path (today's behavior)
 * @param suffix   query to append when the caller supplied a `return_to`
 *                 (e.g. `'?saved=1'`); ignored for the fallback, which callers
 *                 already build with their own query.
 */
export function resolveReturnTo(
  formData: FormData,
  fallback: string,
  suffix = '',
): string {
  const raw = formData.get('return_to');
  if (typeof raw !== 'string' || raw.length === 0) return fallback;
  if (!isSafeInternalPath(raw)) return fallback;
  if (!suffix) return raw;
  const query = suffix.replace(/^[?&]/, '');
  if (!query) return raw;
  return `${raw}${raw.includes('?') ? '&' : '?'}${query}`;
}

/**
 * TRUE only for a plain internal dashboard path: starts with a single `/`,
 * is under `/dashboard/`, and carries no scheme, host, backslash, control
 * character, or protocol-relative `//` prefix.
 */
export function isSafeInternalPath(value: string): boolean {
  if (!value.startsWith('/dashboard/')) return false;
  if (value.startsWith('//')) return false;
  if (value.includes('\\')) return false;
  // Reject whitespace + C0/C1 control characters (header-splitting shapes).
  if (/[\s\u0000-\u001f\u007f-\u009f]/.test(value)) return false;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) return false; // scheme
  return true;
}
