/**
 * open-shop-sent-to.ts — WHERE "We sent a link to <email>" KEEPS THE ADDRESS (W1-B4, walk 16 Nov 2026).
 *
 * The check-your-email screen used to carry the address in the URL (`/open-shop?check_inbox=you@shop.ph`): it went into
 * the browser history, the server logs, analytics and any screenshot of the address bar. Now the action parks it in a
 * short-lived, http-only cookie on this browser and the URL says only that the screen is due (`?check_inbox=1`). The
 * page reads the cookie back; with no cookie (another browser, an hour later) the screen still says to check the
 * inbox, without naming one.
 *
 * Pure apart from the `cookies()` calls — the name, the flag value and the shape are tested in
 * `app/open-shop/the-w1-walk-16-nov.test.ts`.
 */
import { cookies } from 'next/headers';

export const OPEN_SHOP_SENT_TO_COOKIE = 'setnayan_open_shop_sent_to';
/** The URL's only word for the screen — never the address itself. */
export const CHECK_INBOX_FLAG = '1';
/** Long enough to read the screen and open the email app; short enough not to linger. */
const SENT_TO_MAX_AGE_S = 60 * 60;

/** A plausible address, trimmed and capped as the screen draws it — anything else is not drawn. */
export function sentToFromCookie(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim().slice(0, 254);
  return v.includes('@') ? v : null;
}

/** Called by the action right before it redirects to `?check_inbox=1`. */
export async function parkSentTo(email: string): Promise<void> {
  const jar = await cookies();
  jar.set(OPEN_SHOP_SENT_TO_COOKIE, email.trim().slice(0, 254), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/open-shop',
    maxAge: SENT_TO_MAX_AGE_S,
  });
}

/** The page's read: the parked address, or null (the screen then says "your email" without naming it). */
export async function readSentTo(): Promise<string | null> {
  const jar = await cookies();
  return sentToFromCookie(jar.get(OPEN_SHOP_SENT_TO_COOKIE)?.value);
}
