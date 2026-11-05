import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { setGuestSession } from '@/lib/guest-session';
import { recordScan } from '@/lib/scan-trail';
import { withSchemaRetry } from '@/lib/read-retry';
import { logQueryError } from '@/lib/supabase/error-detect';
import { didNotLoadAnswer } from '@/lib/guest-did-not-load';

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
 *
 * 🔌 A READ THAT FAILED IS NOT "NO SUCH EVENT" OR "NOT A GUEST'S CODE"
 * (2026-10-11). Both reads below threw their `error` away. A failed EVENT read
 * bounced the guest to the event's page with their code dropped — a stranger
 * at the door, a printed QR in hand. A failed CODE read was taken for a table
 * code and forwarded to the pass page, which (reading the same code a moment
 * later) sends a guest's code straight back here. Each read is now retried
 * through a blip (`withSchemaRetry`) and one that still failed is answered IN
 * PLACE with the guest boundary's words — `didNotLoadAnswer`, the same answer
 * as `/[slug]/redeem`: the address keeps the code, so "Try again" re-runs this
 * hop. A throw (a cookie that could not be written) gets the same answer.
 * 🛡 app/[slug]/a-failed-read-is-not-an-absence.test.ts
 */

export async function GET(request: NextRequest) {
  // The address this request can be asked again at — set once the slug and the
  // code are in hand, built with the URL API (never raw caller text).
  const retry: { href: string | null } = { href: null };
  try {
    return await claim(request, retry);
  } catch (err) {
    if (!retry.href) throw err;
    logQueryError('seat claim (threw)', err, {}, 'graceful_degrade');
    return didNotLoadAnswer(retry.href);
  }
}

async function claim(request: NextRequest, retry: { href: string | null }): Promise<NextResponse> {
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

  {
    const again = new URL(url.pathname, url.origin);
    again.searchParams.set('t', token);
    retry.href = `${again.pathname}${again.search}`;
  }
  const tryAgainHref = retry.href;

  const admin = createAdminClient();

  const { data: event, error: eventError } = await withSchemaRetry(() =>
    admin.from('events').select('event_id, slug').ilike('slug', slug).maybeSingle(),
  );
  if (eventError) {
    logQueryError('seat claim (events)', eventError, { slug }, 'graceful_degrade');
    return didNotLoadAnswer(tryAgainHref);
  }

  if (!event) {
    return NextResponse.redirect(fallback);
  }

  // Resolve the token as a GUEST token. If it isn't one (e.g. a table token),
  // skip the cookie-set and forward to the stateless pass URL (still carrying
  // the token, since a table view resolves from it).
  const { data: guest, error: guestError } = await withSchemaRetry(() =>
    admin
      .from('guests')
      .select('guest_id, event_id, qr_token')
      .eq('event_id', event.event_id)
      .eq('qr_token', token)
      .is('deleted_at', null)
      .maybeSingle(),
  );
  // Could not READ the code ≠ not a guest's code. Answered before the forward.
  if (guestError) {
    logQueryError('seat claim (guests by code)', guestError, { event_id: event.event_id }, 'graceful_degrade');
    return didNotLoadAnswer(tryAgainHref);
  }

  if (guest && guest.event_id === event.event_id) {
    await setGuestSession({
      guest_id: guest.guest_id,
      event_id: guest.event_id,
      qr_token: guest.qr_token,
    });

    // Record the scan. Best-effort; failures don't block the redirect — and a
    // guest who set `scan_tracking_opt_out` gets no row at all
    // (lib/scan-trail.ts, the one door that writes this table).
    await recordScan(admin, {
      eventId: guest.event_id,
      guestId: guest.guest_id,
      entry: 'personal_qr_scan',
      userAgent: request.headers.get('user-agent'),
      forwardedFor: request.headers.get('x-forwarded-for'),
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
