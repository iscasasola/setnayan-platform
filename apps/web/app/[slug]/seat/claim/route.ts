import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { setGuestSession } from '@/lib/guest-session';

/**
 * /[slug]/seat/claim?slug=&t=  — the personal-QR cookie-set hop for the Seat
 * Pass (seat-finding PR 4/6). Mirrors /[slug]/redeem/route.ts.
 *
 * WHY a hop: the printed PERSONAL Custom-QR encodes …/{slug}/seat/claim?t={token}.
 * Scanning it BOTH signs the guest-session cookie AND lands on the pass —
 * without making the pass page (a pure Server Component read) depend on a raw
 * token in the URL. Next.js only permits cookie writes inside Route Handlers /
 * Server Actions, so the write lives here, then we redirect to the CLEAN
 * …/{slug}/seat URL (NO token), which renders the pass FROM the session cookie.
 * Swapping the per-guest token for a session keeps it out of browser history /
 * Referer (the privacy win over rendering ?t= directly).
 *
 * The pass page itself also funnels personal tokens here: a guest token hit on
 * …/{slug}/seat?t={token} REDIRECTS to this hop, so the only render path for a
 * personal pass is the clean, cookie-backed URL — never the raw-token URL.
 *
 * TABLE QRs encode the direct …/{slug}/seat?t={token} (no claim hop, fully
 * stateless public wayfinding). If `t` here resolves to a table token (or
 * nothing), there's no guest session to set — we bounce to …/{slug}/seat?t=…
 * so the pass page resolves the public table view (or notFound) on its own.
 */

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  // Slug comes from the route segment; accept the query param too for parity
  // with redeem, but the path segment is authoritative.
  const segMatch = url.pathname.match(/^\/([^/]+)\/seat\/claim/);
  const slug = segMatch?.[1] ?? url.searchParams.get('slug') ?? '';
  const token = url.searchParams.get('t') ?? '';

  const fallback = slug ? new URL(`/${slug}`, url.origin) : new URL('/', url.origin);
  if (!slug || !token) {
    return NextResponse.redirect(fallback);
  }

  const admin = createAdminClient();

  const { data: event } = await admin
    .from('events')
    .select('event_id, slug')
    .ilike('slug', slug)
    .maybeSingle();

  if (!event) {
    return NextResponse.redirect(fallback);
  }

  // Resolve the token as a GUEST token. If it isn't one (e.g. a table token),
  // skip the cookie-set and forward to the stateless pass URL (still carrying
  // the token, since a table view resolves from it).
  const { data: guest } = await admin
    .from('guests')
    .select('guest_id, event_id, qr_token')
    .eq('event_id', event.event_id)
    .eq('qr_token', token)
    .is('deleted_at', null)
    .maybeSingle();

  if (guest && guest.event_id === event.event_id) {
    await setGuestSession({
      guest_id: guest.guest_id,
      event_id: guest.event_id,
      qr_token: guest.qr_token,
    });

    // Record the scan. Best-effort; failures don't block the redirect.
    const userAgent = request.headers.get('user-agent') ?? null;
    const xff = request.headers.get('x-forwarded-for') ?? '';
    const ipFull = xff.split(',')[0]?.trim() ?? '';
    const ipAnon = ipFull ? ipFull.split('.').slice(0, 3).join('.') + '.0' : null;
    await admin.from('scan_events').insert({
      event_id: guest.event_id,
      guest_id: guest.guest_id,
      source: 'browser',
      user_agent: userAgent,
      ip_anon: ipAnon,
      context: { entry: 'personal_qr_scan' },
    });

    // CLEAN URL — no token. The pass page renders the personal pass from the
    // session cookie we just set, so the per-guest token never lands in the
    // address bar / history / Referer.
    return NextResponse.redirect(new URL(`/${slug}/seat`, url.origin));
  }

  // Not a guest token (table token or unknown) → forward to the stateless pass
  // URL with the token so the page resolves the public table view (or notFound).
  const passUrl = new URL(`/${slug}/seat`, url.origin);
  passUrl.searchParams.set('t', token);
  return NextResponse.redirect(passUrl);
}
