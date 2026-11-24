/**
 * lib/save-in-place.ts — 📍 WHAT AN ACTION'S REDIRECT MEANS WHEN THE PRESS STAYS IN PLACE (owner, 2026-10-26,
 * DECISION_LOG "A SAVE NEVER RESETS THE SCREEN — APP-WIDE": *"saving minimum and maximum on papic resets the whole
 * screen. this should not happen"* · *"and same to the rest of the buttons and functions"* · *"same to the rest of the
 * website. avoid resetting the whole screen"*).
 *
 * Most server actions end in `redirect(<the same screen>?<news>)`. A plain `<form action={…}>` follows it — the page is
 * re-drawn from the top, the open sheet shuts, the scroll is lost. A `StayForm` (`app/_components/stay-form.tsx`) sends
 * the same form through the server door (`app/_actions/save-in-place.ts`), which runs the SAME action and hands the URL
 * it redirected to here, to be READ instead of followed:
 *   · a refusal — the area's own words (`StayWords.refuse`), else any `?…error=` / `?…err=` key, or an `=error` value →
 *     `{ ok: false, error }`, said on the row;
 *   · somewhere a press must really go — signed out (`/login…`, `/sign…`), not on this event (bare `/dashboard`,
 *     `/vendor-dashboard`), or outside the screens this door answers for (`within`) → `'navigate'` (the redirect is let
 *     through: a gate's bounce never reads as "saved");
 *   · anything else (`?saved=1`, `?…_set=…`, a bare back) → `{ ok: true }`: saved; the page re-renders in place.
 * Pure. Held by `lib/a-save-never-resets-the-screen.test.ts`.
 */

/** `note` — a landed save that still has something to say ("2 not coming were left as they were"). */
export type StayResult = { ok: true; note?: string } | { ok: false; error: string };

/** How one area reads its own redirect: its refusal words, and the screens a press may stay on. */
export type StayWords = {
  /** A refusal said in the area's own words, or `null` when this URL is not a refusal the area knows. */
  refuse?: (q: URLSearchParams, path: string) => string | null;
  /** A landed save's own line (the page's banner for a partial result), or `null`. */
  note?: (q: URLSearchParams) => string | null;
  /** `?<key>error=<code>` → the sentence for that code (falls back to `NOTHING_CHANGED`). */
  say?: Readonly<Record<string, string>>;
  /** The screens a press may stay on (a path prefix, or a pattern for the whole path); anything else navigates — a
   *  gate's "not on this event" bounce to `/dashboard/<ev>` must never read as "saved". */
  within: readonly (string | RegExp)[];
};

export const NOTHING_CHANGED = 'We could not save that. Nothing changed — please try again.';
export const COULD_NOT_SAVE = 'That could not be saved just now. Please try again.';

/** The path part of a redirect URL — no query, no hash. */
export function redirectPath(url: string): string {
  return url.split(/[?#]/)[0] ?? '';
}

/** A whole-path pattern for an event screen: `eventScreen('schedule')` → `/dashboard/<id>/schedule`. */
export function eventScreen(screen: string): RegExp {
  return new RegExp(`^/dashboard/[^/]+${screen ? `/${screen.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` : ''}$`);
}

/** A whole-path pattern for a supplier screen: `supplierScreen('calendar')` → `/vendor-dashboard/calendar`. */
export function supplierScreen(screen: string): RegExp {
  return new RegExp(`^/vendor-dashboard${screen ? `/${screen.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` : ''}$`);
}

const REFUSAL_KEY = /(^|_)(error|err)$/i;

export function inPlaceAnswer(url: string, words: StayWords): StayResult | 'navigate' {
  const path = redirectPath(url);
  if (!path || path.startsWith('/login') || path.startsWith('/sign') || path === '/dashboard' || path === '/vendor-dashboard') return 'navigate';
  if (!words.within.some((p) => (typeof p === 'string' ? path.startsWith(p) : p.test(path)))) return 'navigate';
  const query = url.includes('?') ? (url.slice(url.indexOf('?') + 1).split('#')[0] ?? '') : '';
  const q = new URLSearchParams(query);
  const own = words.refuse?.(q, path);
  if (own) return { ok: false, error: own };
  for (const [k, v] of q) {
    if (REFUSAL_KEY.test(k)) return { ok: false, error: words.say?.[v] ?? NOTHING_CHANGED };
    /* `?guestCameras=error` — the outcome is the VALUE, not the key (the Papic lesson, 2026-10-30). */
    if (v === 'error' || v === 'failed') return { ok: false, error: NOTHING_CHANGED };
  }
  const note = words.note?.(q);
  return note ? { ok: true, note } : { ok: true };
}
