import { LAST_SEEN_WIPE_SCRIPT } from '@/lib/last-seen/wipe';

/**
 * 💾 SIGN-OUT EMPTIES THE LAST-SEEN STORE (owner 2026-10-02, DECISION_LOG
 * "LAST-SEEN DATA SHOWS INSTANTLY, THEN REFRESHES": *"wiped at sign-out (a
 * shared phone never shows the next person someone's guests)"*).
 *
 * An inline script for the pages a signed-out person lands on — the front door
 * (where `/auth/sign-out` redirects) and `/login` (where an expired session is
 * sent). If the browser holds no auth cookie, every last-seen key is removed
 * before anything else runs. Inline, not a client component: it adds nothing
 * to any JavaScript bundle (see `lib/last-seen/wipe.ts`).
 */
export function LastSeenSignedOutWipe() {
  return <script dangerouslySetInnerHTML={{ __html: LAST_SEEN_WIPE_SCRIPT }} />;
}
