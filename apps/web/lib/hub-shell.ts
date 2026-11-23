import 'server-only';

import { getCurrentUser } from '@/lib/auth';

/**
 * Does the `(hub)` layout draw the shared shell on this request? — the ONE answer both halves ask.
 *
 * `/` and `/dashboard` sit under one layout (`app/(hub)/layout.tsx`, owner 18 Nov 2026 "unify home and discover"),
 * which draws the top bar, the rail and the account bar for a signed-in person so they never remount between the two.
 * `FrontDoor` (`/`) still draws its own public shell for a stranger. If the layout and the page asked "signed in?" two
 * different ways — the rail's account read can fail soft to "signed out" while a session exists — a person could get
 * TWO bars (both drew) or NONE (neither did). So both ask this, and it is the same verified user every other read of
 * this request uses (`getCurrentUser`, cache()d): no new request.
 *
 * Returns the user (or null) so the layout can use it without asking again.
 */
export async function hubDrawsTheShell() {
  return getCurrentUser().catch(() => null);
}
