import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { setGuestSession } from '@/lib/guest-session';
import { resolveRenamedEventSlug } from '@/lib/slug-forwarding';
import { findGuestSeatForUser } from '@/lib/guest-membership-session';

/**
 * /{slug}/enter — "open the event I was invited to", for somebody who is SIGNED
 * IN and whose seat we are already holding.
 *
 * The sibling of `/{slug}/redeem`, and deliberately shaped like it: a Route
 * Handler, because Next.js only permits cookie writes in Route Handlers and
 * Server Actions. Redeem mints a guest session from an invitation TOKEN; this
 * mints one from the `event_members` row that token already created.
 *
 * ── WHY IT EXISTS ───────────────────────────────────────────────────────────
 * The events board now shows invited events (PR #4415) and each card promises
 * the person their photos, their table and their RSVP. That promise only holds
 * while their guest cookie is alive — and it is a HARD 60 days carrying exactly
 * ONE event id. Save-the-dates go out 6–12 months ahead, so the ordinary case is
 * a guest who scanned their invitation on time and is a **stranger by the
 * wedding day**; and anybody invited to two events can only be recognised on
 * one. On a private event (3 of 5 in prod) they meet a screen telling them to
 * scan the QR they already scanned.
 *
 * 🔑 The binding is already in the database — only the cookie is missing. See
 * lib/guest-membership-session.ts for the gates, the reason this is a STRONGER
 * claim than the cookie it replaces, and the named QR-rotation trade-off.
 *
 * ── WHAT IT REFUSES, AND HOW ────────────────────────────────────────────────
 * Every failure lands the person somewhere real and discloses NOTHING about
 * whether the event exists or who is on its list:
 *   · not signed in        → /login, with this route as the return target
 *   · unsafe slug          → the site root (never echo caller text into a
 *                            redirect — the open-redirect this route's sibling
 *                            paid for on live prod, 2026-08-06)
 *   · no seat for this user → `/{slug}`, i.e. exactly what a direct visit gives
 *                            them. A private event still renders its own gate;
 *                            we do not turn a refusal into a 404, and we do not
 *                            turn one into an admission either.
 * 🔒 A signed-in ORGANISER gets no cookie here — `findGuestSeatForUser` requires
 * `member_type = 'guest'`. Their door is the dashboard.
 */

/** A real slug: lowercase alphanumerics and hyphens. No slashes, dots,
 *  backslashes, colons or LIKE wildcards — none of the characters that turn a
 *  path into another origin or a pattern. Copied from `redeem/route.ts` because
 *  it is the same guard against the same hole. */
const SAFE_SLUG = /^[a-z0-9][a-z0-9-]{0,99}$/;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const url = new URL(request.url);
  const { slug: rawSlug } = await params;
  const slug = (rawSlug ?? '').trim().toLowerCase();
  const slugIsSafe = SAFE_SLUG.test(slug);

  // The fallback is ALWAYS same-origin and never contains caller text.
  if (!slugIsSafe) return NextResponse.redirect(new URL('/', url.origin));

  const publicPage = new URL(`/${slug}`, url.origin);

  // Signed in? This route is only ever reachable from the account's own board,
  // but a shared or bookmarked URL must still behave.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const login = new URL('/login', url.origin);
    login.searchParams.set('next', `/${slug}/enter`);
    return NextResponse.redirect(login);
  }

  const admin = createAdminClient();
  const { data: event } = await admin
    .from('events')
    .select('event_id, slug')
    .ilike('slug', slug)
    .maybeSingle();

  if (!event) {
    // A RENAMED address must keep working here too. The board renders the
    // CURRENT slug, so this is for a bookmark or a shared link — the same reason
    // forwarding exists, and the same mistake (a resolver wired into the obvious
    // routes but not the ones carrying the real artefacts) that cost the printed
    // QR its seat on 2026-08-11. `resolveRenamedEventSlug` wants the bare word.
    const movedToSlug = await resolveRenamedEventSlug(admin, slug);
    if (movedToSlug && SAFE_SLUG.test(movedToSlug)) {
      return NextResponse.redirect(new URL(`/${movedToSlug}/enter`, url.origin));
    }
    return NextResponse.redirect(publicPage);
  }

  const seat = await findGuestSeatForUser(event.event_id as string, user.id);

  // No seat — or a read that was REJECTED rather than empty, which
  // findGuestSeatForUser deliberately cannot tell apart and therefore fails
  // closed on. Either way: the page a direct visit would have given them.
  // `event.slug` is the database's own spelling, never the query value.
  if (!seat) {
    return NextResponse.redirect(new URL(`/${event.slug}`, url.origin));
  }

  await setGuestSession({
    guest_id: seat.guestId,
    event_id: event.event_id as string,
    qr_token: seat.qrToken,
  });

  // Record it, exactly as redeem does — the couple's scan history should not
  // have a hole where "opened it from their own board" belongs. Best-effort;
  // a failure never blocks the redirect.
  const xff = request.headers.get('x-forwarded-for') ?? '';
  const ipFull = xff.split(',')[0]?.trim() ?? '';
  const ipAnon = ipFull ? ipFull.split('.').slice(0, 3).join('.') + '.0' : null;
  await admin.from('scan_events').insert({
    event_id: event.event_id as string,
    guest_id: seat.guestId,
    source: 'browser',
    user_agent: request.headers.get('user-agent') ?? null,
    ip_anon: ipAnon,
    context: { entry: 'board_invited_card' },
  });

  return NextResponse.redirect(new URL(`/${seat.slug}`, url.origin));
}
