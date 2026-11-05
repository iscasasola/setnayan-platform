import { NextResponse, type NextRequest } from 'next/server';
import { eventIdForSlug, readGuestPassStanding } from '@/lib/guest-session';
import { HOST_PREVIEW_PASS_COOKIE_NAME, hostPreviewCookieValue } from '@/lib/pass-account-rule';

/**
 * POST /{slug}/open-as-pass — a HOST opens this browser's held guest pass as that guest, or goes back to themselves.
 *
 * 🪪 The account outranks the pass (owner bug 2026-10-19, `lib/pass-account-rule.ts`): signed in as a host, a pass
 * this browser holds for somebody else's row is SET ASIDE and the page says so — "This browser also holds <name>'s
 * invitation. Viewing as you." Hosts preview guests, so that line offers "Open as <name>", which lands here.
 *
 * 🔒 IT GRANTS NOTHING NEW. It only marks THIS browser session (a cookie with no max-age) with the one event + guest
 * the held pass already names, and only when the rule itself just answered `set_aside_host` for this event — i.e.
 * the database confirmed a host and the browser really holds that pass. Without the pass, or for anybody who is not a
 * host, nothing is set. A POST (a form), never a link: a prefetch would run it.
 *
 * `do=back` removes the mark: the host is themselves again. Nothing is written to the database either way.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = new URL(request.url);
  url.pathname = url.pathname.replace(/\/open-as-pass$/, '');
  url.search = '';
  const res = NextResponse.redirect(url, { status: 303 });

  const form = await request.formData().catch(() => null);
  if (form?.get('do') === 'back') {
    res.cookies.delete(HOST_PREVIEW_PASS_COOKIE_NAME);
    return res;
  }

  const eventId = await eventIdForSlug(slug).catch(() => null);
  if (!eventId) return res;
  const { setAside } = await readGuestPassStanding({ eventId });
  if (setAside?.standing === 'set_aside_host' && setAside.pass.event_id === eventId) {
    res.cookies.set({
      name: HOST_PREVIEW_PASS_COOKIE_NAME,
      value: hostPreviewCookieValue(eventId, setAside.pass.guest_id),
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
    });
  }
  return res;
}
