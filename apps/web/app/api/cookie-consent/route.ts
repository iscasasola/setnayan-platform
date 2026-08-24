import { NextResponse } from 'next/server';
import { CONSENT_STORAGE_KEY, CONSENT_COOKIE_MAX_AGE } from '@/lib/cookie-consent';

/**
 * POST /api/cookie-consent — persists the visitor's cookie choice for longer
 * than seven days.
 *
 * ── 🔴 THE BUG THE OWNER REPORTED: "it re-asks people who have already
 * answered." ─────────────────────────────────────────────────────────────────
 * The choice lived ONLY in `localStorage`, written by script. Safari's
 * Intelligent Tracking Prevention **deletes all script-writable storage after
 * seven days without a first-party interaction** — localStorage, IndexedDB and
 * `document.cookie` alike. So a visitor who answered, then came back a
 * fortnight later, was asked again, on a device where nothing was broken.
 *
 * 🔑 WHY A COOKIE FIXES IT AND `document.cookie` WOULD NOT. ITP's seven-day cap
 * is about HOW the value was written, not what it is: a cookie written by
 * script is capped exactly like localStorage. A cookie set by the FIRST-PARTY
 * SERVER, in a `Set-Cookie` header, is not. That is the whole reason this route
 * exists rather than one more line in `writeConsent`.
 *
 * ⚖ IT STAYS PER-DEVICE AND ANONYMOUS, WHICH IS THE BOUNDARY. This writes a
 * cookie to the browser that answered and nothing else: **no database row, no
 * account, no identifier.** Moving consent server-side KEYED TO A USER would
 * create an RA 10173 proof-of-consent record and is a DPO decision the owner
 * has not made. Do not cross that line while fixing a bug — if a durable record
 * is ever wanted, that is a separate change with a separate sign-off.
 *
 * ⚖ AND THE COOKIE ITSELF NEEDS NO CONSENT. Recording that someone declined
 * non-essential cookies is strictly necessary to honour the choice they just
 * made; a banner that cannot remember "no" would have to ask again forever.
 * That is the same reasoning `cookie-consent.ts` already applies to its use of
 * localStorage.
 *
 * NOT httpOnly, deliberately: the banner reads it synchronously on first paint
 * so a returning visitor never sees it flash before it hides itself.
 */
export async function POST(req: Request) {
  let analytics: unknown;
  try {
    ({ analytics } = (await req.json()) as { analytics?: unknown });
  } catch {
    return new NextResponse('Bad request.', { status: 400 });
  }
  if (typeof analytics !== 'boolean') {
    return new NextResponse('Bad request.', { status: 400 });
  }

  const value = JSON.stringify({ analytics, decidedAt: new Date().toISOString() });
  const res = new NextResponse(null, { status: 204 });
  res.cookies.set({
    name: CONSENT_STORAGE_KEY,
    value,
    maxAge: CONSENT_COOKIE_MAX_AGE,
    sameSite: 'lax',
    secure: true,
    httpOnly: false,
    path: '/',
  });
  return res;
}
