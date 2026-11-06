/**
 * lib/maker-leaving.ts — 🔁 "UPDATING SETNAYAN…": the words said as the Maker reloads ITSELF (owner 08 Oct, live:
 * *"clicking on music reset the maker and reloaded"*). What reloaded and why: `lib/maker-resume.ts`.
 *
 * ⚡ Split out of `maker-resume.ts` (batch 3, 2026-10-12): only the lazy announcer (`maker-updating.tsx`) reads these,
 * so they never ride the Maker's first load. Pure. No React.
 */

const pathOf = (url: string): string | null => {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return null;
  }
};

/** What the page says while Next reloads it onto a newer version (its build-mismatch navigation). */
export const MAKER_UPDATING_WORDS = 'Updating Setnayan…';
/** …and while it reloads itself for any other reason (a chunk that moved, a request the phone cut off, the
 *  updated-site bar's Reload) — it says what it does, never an update it cannot know happened. */
export const MAKER_RELOADING_WORDS = 'Reloading Setnayan…';

/**
 * The words to show as the page starts to leave — or null: say nothing. Only for the page reloading ITSELF by
 * script (Next's build-mismatch navigation, a stale-bundle reload, the "Reload" of the updated-site bar): never
 * for a link or the browser's own buttons (`userInitiated`), a move inside the page, Back / Forward, or a
 * navigation to any other page — each of those is the person going somewhere, not the site updating under them.
 */
export function makerLeavingWords(nav: {
  userInitiated: boolean;
  /** `NavigateEvent.navigationType`. */
  type: string;
  /** `NavigateEvent.destination.url`. */
  to: string;
  sameDocument: boolean;
  here: string;
}): string | null {
  if (nav.userInitiated || nav.sameDocument) return null;
  if (nav.type !== 'push' && nav.type !== 'replace' && nav.type !== 'reload') return null;
  const here = pathOf(nav.here);
  if (here === null || pathOf(nav.to) !== here) return null;
  return nav.type === 'reload' ? MAKER_RELOADING_WORDS : MAKER_UPDATING_WORDS;
}
