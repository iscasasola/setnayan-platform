import 'server-only';
import { cookies } from 'next/headers';
import { isLiveSessionCookie } from '@/lib/appearance';

/**
 * 🔑 Is anybody signed in on this request AT ALL — the request's cookie jar only, no trip to the auth server or the
 * database. A server page whose reads start BESIDE the layout's sign-in redirect (Next renders a layout and its page
 * side by side) asks this first, so a signed-out request — or one whose session the middleware could not refresh,
 * left as an emptied cookie (`isLiveSessionCookie`) — sends no read as anon. Live fault 21 Nov: `GET events` 42501 as
 * anon, from the event Home and the Guests page. WHO is signed in is still `getCurrentUser()`.
 */
export async function hasLiveSessionCookie(): Promise<boolean> {
  return (await cookies()).getAll().some(isLiveSessionCookie);
}
