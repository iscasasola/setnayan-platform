import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { setGuestSession } from '@/lib/guest-session';
import { resolveRenamedEventSlug } from '@/lib/slug-forwarding';
import { recordScan } from '@/lib/scan-trail';

// Resolves an `?invite=<token>` link by validating the token, signing the
// guest-session cookie, recording a scan_events row, and redirecting to
// the clean /[slug] URL. Lives as a Route Handler because Next.js only
// permits cookie writes inside Route Handlers + Server Actions.
//
// 🔴 OPEN REDIRECT — FIXED 2026-08-06. `slug` arrives from the QUERY STRING and
// was interpolated straight into the redirect: `new URL('/' + slug, origin)`.
// A slug of `/example.com` produces `//example.com`, which is PROTOCOL-RELATIVE,
// so the browser leaves the site entirely. Reproduced on live prod:
//     /cale-ice/redeem?slug=/example.com&token=x  ->  location: https://example.com/
// It did not even need a valid token — the `!event` branch redirects before the
// token is ever checked. A link that genuinely begins with our own domain, sent
// to people who have been trained by us to tap invitation links without reading
// them, is a phishing primitive. The seat-QR hop already validated its slug;
// this one did not.
//
// THE RULE NOW: the redirect target is NEVER built from caller-supplied text.
// An unsafe slug goes to the site root, and once the event is resolved every
// target is built from `event.slug` — the value the DATABASE returned.
//
// The same guard closes a second, quieter hole: `.ilike('slug', slug)` treats
// `%` and `_` as WILDCARDS, so `?slug=%` matched an arbitrary event. Rejecting
// anything outside [a-z0-9-] removes that too.

/** A real slug: lowercase alphanumerics and hyphens. No slashes, no dots, no
 *  backslashes, no colons, no wildcards — none of the characters that let a
 *  path turn into another origin or a LIKE pattern. */
const SAFE_SLUG = /^[a-z0-9][a-z0-9-]{0,99}$/;

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const rawSlug = url.searchParams.get('slug') ?? '';
  const token = url.searchParams.get('token') ?? '';

  // Normalise before validating so a stray capital does not send a real guest
  // to the site root — but anything still outside the allowlist is NOT echoed
  // back into a redirect under any circumstances.
  const slug = rawSlug.trim().toLowerCase();
  const slugIsSafe = SAFE_SLUG.test(slug);

  // The fallback target is ALWAYS same-origin and never contains caller text.
  const target = slugIsSafe ? new URL(`/${slug}`, url.origin) : new URL('/', url.origin);

  if (!slugIsSafe || !token) {
    target.searchParams.set('invite_error', 'missing');
    return NextResponse.redirect(target);
  }

  const admin = createAdminClient();

  const { data: event } = await admin
    .from('events')
    .select('event_id, slug')
    .ilike('slug', slug)
    .maybeSingle();

  if (!event) {
    // 🎟 THE ONE URL THAT IS ACTUALLY PRINTED ON AN INVITATION ENDS UP HERE.
    // A personal QR encodes `/{slug}?invite={token}` (lib/qr.ts), and the page
    // short-circuits every tokened URL straight to this route BEFORE any
    // forwarding runs — so after a rename the retired-address forward, which
    // only ever saw the bare URL, never got the chance to carry the token.
    //
    // What the guest experienced: this branch dropped the token and bounced
    // them to `/{oldSlug}`, which forwarded to the right event — as a COMPLETE
    // STRANGER. No seat, no RSVP, no find-my-table; a private lock screen
    // telling them to "scan your invitation QR", which is exactly what they
    // just did. Every re-scan of a card already in someone's hand reproduced
    // it. That is worse than the 404 this all replaced, because it reads as the
    // couple having shut them out rather than as a broken link.
    //
    // Carry the token to the CURRENT address instead. The bare word is what
    // this route needs, so it resolves the slug rather than a path.
    const movedToSlug = await resolveRenamedEventSlug(admin, slug);
    if (movedToSlug && SAFE_SLUG.test(movedToSlug)) {
      const moved = new URL(`/${movedToSlug}/redeem`, url.origin);
      moved.searchParams.set('slug', movedToSlug);
      moved.searchParams.set('token', token);
      return NextResponse.redirect(moved);
    }
    return NextResponse.redirect(target);
  }

  const { data: guest } = await admin
    .from('guests')
    .select(
      'guest_id, event_id, qr_token, first_name, plus_one_of_guest_id, plus_one_name_confirmed_at',
    )
    .eq('qr_token', token)
    .is('deleted_at', null)
    .maybeSingle();

  if (!guest || guest.event_id !== event.event_id) {
    target.searchParams.set('invite_error', 'invalid_token');
    return NextResponse.redirect(target);
  }

  await setGuestSession({
    guest_id: guest.guest_id,
    event_id: guest.event_id,
    qr_token: guest.qr_token,
  });

  // Record the scan. Best-effort; failures don't block the redirect — and a
  // guest who set `scan_tracking_opt_out` gets no row at all (lib/scan-trail.ts,
  // the one door that writes this table).
  await recordScan(admin, {
    eventId: guest.event_id,
    guestId: guest.guest_id,
    entry: 'invite_link',
    userAgent: request.headers.get('user-agent'),
    forwardedFor: request.headers.get('x-forwarded-for'),
  });

  // TBA +1 onboarding gate: a +1 row with a placeholder first_name routes to
  // the name-capture screen before they see the personal invitation site.
  const isTbaPlusOne =
    guest.plus_one_of_guest_id !== null &&
    (!guest.first_name ||
      guest.first_name === 'TBA' ||
      guest.first_name.toLowerCase() === 'tba');

  if (isTbaPlusOne && !guest.plus_one_name_confirmed_at) {
    // event.slug, not the query value — the database's own spelling.
    return NextResponse.redirect(new URL(`/${event.slug}/welcome`, url.origin));
  }

  return NextResponse.redirect(target);
}
