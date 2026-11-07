/**
 * param-toast.ts — WHAT `<ToastFromParams>` does with a flagged address. Pure (no React, no DOM), so the rule is
 * tested directly (`param-toast.test.ts`); the component only reads the page and writes the address.
 *
 * ── THE DEFECT THIS EXISTS FOR (measured 2026-11-06) ─────────────────────────────────────────────────────────
 * A door that refuses something redirects to itself with `?error=…` and prints the reason ON THE PAGE —
 * /signup's "This password has appeared in a known data breach…", /reset-password, /join → set password,
 * Profile, ~70 pages in all. The app-wide bridge then saw `?error=`, fired a GENERIC toast ("Something went
 * wrong — please try again.") and `router.replace`d the address without it — a server round trip that drew
 * the page again WITHOUT its error. Measured on /signup?error=password_leaked: the banner is in the server
 * HTML, and gone once the page settles. A specific failure became a vague one, in a different place.
 *
 * ── THE RULE ─────────────────────────────────────────────────────────────────────────────────────────────────
 *   1. The flags still leave the address (a refresh must not fire the toast again) — but the component does it
 *      with `history.replaceState`, which the router follows WITHOUT asking the server for the page again, so
 *      whatever the page drew from the flag stays on screen.
 *   2. An error the page already SHOWS (a visible `role="alert"`) gets no second, vaguer toast.
 *   3. Everything else is unchanged: success flags toast; an error the page does not show toasts, with `msg`
 *      when given.
 */

/** The flags this bridge reads — and removes from the address. */
export const SUCCESS_PARAMS: ReadonlyArray<readonly [string, (v: string) => string]> = [
  ['saved', (v) => (v && v !== '1' ? `Saved — ${dec(v)}` : 'Saved.')],
  ['created', (v) => (v && v !== '1' ? `Created — ${dec(v)}` : 'Created.')],
  ['updated', (v) => (v && v !== '1' ? `Updated — ${dec(v)}` : 'Updated.')],
  ['added', (v) => (v && v !== '1' ? `Added ${dec(v)}` : 'Added.')],
  ['sent', () => 'Sent.'],
  ['removed', () => 'Removed.'],
  ['deleted', () => 'Deleted.'],
  ['completed', () => 'Done.'],
  ['done', (v) => (v === 'approved' ? 'Approved.' : v === 'rejected' ? 'Rejected.' : 'Done.')],
];

export const HANDLED_KEYS: readonly string[] = ['error', 'msg', ...SUCCESS_PARAMS.map(([k]) => k)];

export const GENERIC_ERROR = 'Something went wrong — please try again.';

function dec(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

export type ParamToastPlan = {
  /** The toast to fire, or null when the page already says it. */
  toast: { tone: 'error' | 'success'; message: string } | null;
  /** The address to leave behind (query without the handled flags, `?` included when non-empty). */
  search: string;
};

/**
 * null = the address carries no flag this bridge handles: do nothing.
 * `pageShowsError` = the page on screen already shows an error to the person (see the component).
 */
export function planParamToast(params: URLSearchParams, pageShowsError: boolean): ParamToastPlan | null {
  const msg = params.get('msg');
  let toast: ParamToastPlan['toast'] = null;
  let handled = false;

  if (params.get('error') !== null) {
    handled = true;
    // The page printed it (its own words, specific to what failed): a generic toast over it is a second,
    // vaguer message in a second place. Say it once.
    if (!pageShowsError) toast = { tone: 'error', message: msg ?? GENERIC_ERROR };
  } else {
    for (const [key, build] of SUCCESS_PARAMS) {
      const v = params.get(key);
      if (v !== null) {
        handled = true;
        toast = { tone: 'success', message: msg ?? build(v) };
        break;
      }
    }
  }
  if (!handled) return null;

  const next = new URLSearchParams(params.toString());
  for (const k of HANDLED_KEYS) next.delete(k);
  const qs = next.toString();
  return { toast, search: qs ? `?${qs}` : '' };
}
