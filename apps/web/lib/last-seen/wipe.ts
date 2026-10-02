/**
 * 💾 LAST-SEEN DATA — THE WIPE (owner 2026-10-02, DECISION_LOG "LAST-SEEN DATA
 * SHOWS INSTANTLY, THEN REFRESHES — FOR A HOST'S MAIN PAGES (NEVER MONEY)":
 * *"wiped at sign-out (a shared phone never shows the next person someone's
 * guests)"*).
 *
 * 🔑 WHY THE WIPE RUNS ON PAGE LOAD AND NOT IN THE SIGN-OUT BUTTON. Sign-out has
 * many doors — `/auth/sign-out` from two menus, a forced sign-out in
 * `app/dashboard/layout.tsx`, an expired session, an admin "sign out
 * everywhere". A wipe wired to one button misses the others. Every one of them
 * ends the same way: the browser no longer holds a Supabase auth cookie. So the
 * pages a signed-out person lands on — the front door `/auth/sign-out`
 * redirects to, and `/login` where an expired session is sent — empty the
 * store as they load. (The store also refuses, on every read, to show one
 * account's snapshot to another: `./store.ts` `readLastSeen`.)
 *
 * 📦 IT COSTS THE SHARED BUNDLE NOTHING. The shared client bundle has bytes,
 * not kilobytes, of room (`scripts/check-bundle-size.mjs`), so the wipe is not
 * JavaScript in any bundle: `LAST_SEEN_WIPE_SCRIPT` below is a few hundred
 * bytes of inline `<script>` in those two pages' HTML
 * (`app/_components/last-seen/last-seen-wipe-script.tsx`), built from the SAME
 * prefix and cookie test as the functions here so the two cannot drift.
 */

/** Every key the store writes starts with this. The wipe removes all of them. */
export const LAST_SEEN_PREFIX = 'sn-ls:';

/** The minimal slice of `Storage` the store and the wipe use. */
export type LastSeenStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

/** Removes every last-seen key. Returns how many were removed. Never throws. */
export function wipeLastSeen(storage: LastSeenStorage | null | undefined): number {
  if (!storage) return 0;
  try {
    const doomed: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.startsWith(LAST_SEEN_PREFIX)) doomed.push(k);
    }
    for (const k of doomed) storage.removeItem(k);
    return doomed.length;
  } catch {
    return 0;
  }
}

/** The Supabase auth session cookie (`sb-<project>-auth-token`, or one of its `.0`/`.1` chunks). */
const AUTH_COOKIE = /(?:^|;\s*)sb-[^=;\s]+-auth-token(?:\.\d+)?=[^;]/;

/**
 * True when the cookie string carries a Supabase auth session cookie
 * (`sb-<project>-auth-token`, or one of its `.0`/`.1` chunks).
 */
export function hasAuthCookie(cookie: string): boolean {
  return AUTH_COOKIE.test(cookie);
}

/**
 * The page-load check: nobody is signed in on this browser → nothing of the
 * last person's may stay. Returns how many keys were removed.
 */
export function wipeLastSeenIfSignedOut(
  cookie: string,
  storage: LastSeenStorage | null | undefined,
): number {
  if (hasAuthCookie(cookie)) return 0;
  return wipeLastSeen(storage);
}

/**
 * The same check as `wipeLastSeenIfSignedOut`, as an inline script for a
 * signed-out landing page. Never throws (private mode, blocked storage).
 * `last-seen.test.ts` runs this exact string against a fake browser.
 */
export const LAST_SEEN_WIPE_SCRIPT =
  `try{if(!${AUTH_COOKIE}.test(document.cookie)){var s=localStorage,d=[],i=0,k;` +
  `for(;i<s.length;i++){k=s.key(i);if(k&&k.indexOf(${JSON.stringify(LAST_SEEN_PREFIX)})===0)d.push(k)}` +
  `for(i=0;i<d.length;i++)s.removeItem(d[i])}}catch(e){}`;
