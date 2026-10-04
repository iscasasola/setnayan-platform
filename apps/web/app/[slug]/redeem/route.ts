import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { setGuestSession } from '@/lib/guest-session';
import { resolveRenamedEventSlug } from '@/lib/slug-forwarding';
import { inviteEnterPath } from '@/lib/invite-arrival';
import { recordScan } from '@/lib/scan-trail';
import { readSeatHolder } from '@/lib/guest-one-path.server';
import { PLUS_ONE_WELCOMED_COOKIE, plusOneWelcomeDue } from '@/lib/plus-one-welcome';
import { requestKeyState } from '@/lib/request-key';
import { REQUEST_KEY_COOKIE, forgetRequestKey, rememberRequestKey } from '@/lib/request-key.server';
import { GUEST_SESSION_COOKIE_NAME, readGuestSession } from '@/lib/guest-session';
import {
  REENTRY_PARAM,
  isLinkPreviewFetch,
  passHeldKind,
  passHopMissFault,
  reentryDestinationOf,
  type PassHopMiss,
} from '@/lib/guest-pass-hop';
import { exchangeReentryCode, mintReentryCode, reentryCodeGuest } from '@/lib/guest-reentry.server';
import { recordFault } from '@/lib/telemetry/fault-log';

/** One Problems-log row for a personal-link visit that will not land on the
 *  invitation (lib/guest-pass-hop.ts `passHopMissFault` — no token, no code,
 *  no name). A link-preview robot's miss is not a guest's, so it is not one. */
async function recordMiss(request: NextRequest, miss: Omit<PassHopMiss, 'userAgent'>): Promise<void> {
  const userAgent = request.headers.get('user-agent');
  if (isLinkPreviewFetch(userAgent)) return;
  await recordFault(passHopMissFault({ ...miss, userAgent }));
}

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

/** What a link-preview fetcher gets here: the page in place, and nothing else —
 *  no Set-Cookie, no redirect, nothing it could follow to spend a code. */
function linkPreviewAnswer(): NextResponse {
  return new NextResponse(
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Your invitation</title>' +
      '<meta name="robots" content="noindex, nofollow"></head>' +
      '<body><main><p>Open this link on your phone to see your invitation.</p></main></body></html>',
    { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'private, no-store' } },
  );
}

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

  const reentryCode = url.searchParams.get(REENTRY_PARAM) ?? '';

  if (!slugIsSafe || (!token && !reentryCode)) {
    await recordMiss(request, { rule: 'redeem:missing', steps: ['redeem'], held: 'none', carriedCode: false });
    target.searchParams.set('invite_error', 'missing');
    return NextResponse.redirect(target);
  }

  /* 🤖 A LINK-PREVIEW FETCHER NEVER SPENDS ANYTHING (2026-10-04, the train-g
     audit). A chat app that previews a pasted landing address
     (`/{slug}/invite/enter?k=` → here) used to EXCHANGE the guest's single-use
     re-entry code and take the Set-Cookie — the guest's own tap then found the
     code spent. A personal link redeemed here the same way minted a pass for a
     robot and a false "opened" scan. A fetcher is answered IN PLACE: a 200,
     no redirect, no code spent, no pass written, no database read — the same
     rule as the personal-link branch of `app/[slug]/page.tsx`. */
  if (isLinkPreviewFetch(request.headers.get('user-agent'))) {
    return linkPreviewAnswer();
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
      if (token) moved.searchParams.set('token', token);
      else moved.searchParams.set(REENTRY_PARAM, reentryCode);
      if (url.searchParams.has('to')) moved.searchParams.set('to', reentryDestinationOf(url.searchParams.get('to')));
      return NextResponse.redirect(moved);
    }
    return NextResponse.redirect(target);
  }

  /* 🔁 A RE-ENTRY CODE (`?k=`, lib/guest-reentry.server.ts) — the SAME guest,
     carried into ANOTHER cookie jar once: a chat app's own "Open in Safari"
     from the landing (`to=landing`), or the iPhone home-screen tile, which
     keeps its own cookies (`to=hub`, the tile's start address).
     ⚠ Unlike a personal link, a code is SPENT, so it is asked of the phone
     first: a jar that already holds a pass for THIS event (the tile's second
     launch, a reload) goes on with no code spent and nothing logged. Only a
     phone with no pass here spends it; a refused code goes where the guest
     would have gone without it — the Event Hub — and is logged. */
  if (!token && reentryCode) {
    const to = reentryDestinationOf(url.searchParams.get('to'));
    const destination = new URL(to === 'landing' ? inviteEnterPath(event.slug) : `/${event.slug}`, url.origin);
    const steps = ['reentry', to === 'landing' ? 'enter' : 'hub'];
    const held = await readGuestSession();
    if (held && held.event_id === event.event_id) {
      // …but only if it is THIS code's guest (or a code long gone): a phone
      // holding ANOTHER guest's pass for this event — the host's own phone —
      // is re-keyed by the code, exactly as a personal link re-keys it.
      const owner = await reentryCodeGuest({ code: reentryCode, eventId: event.event_id });
      if (owner === null || owner === held.guest_id) return NextResponse.redirect(destination);
    }
    const spent = await exchangeReentryCode({ code: reentryCode, eventId: event.event_id });
    if (!spent.ok) {
      await recordMiss(request, {
        rule: 'reentry:refused',
        steps,
        held: passHeldKind({
          cookiePresent: Boolean(request.cookies.get(GUEST_SESSION_COOKIE_NAME)?.value),
          pass: held,
          eventId: event.event_id,
        }),
        carriedCode: true,
        reason: spent.reason,
      });
      return NextResponse.redirect(new URL(`/${event.slug}`, url.origin));
    }
    await setGuestSession({ guest_id: spent.guestId, event_id: spent.eventId, qr_token: spent.qrToken });
    return NextResponse.redirect(destination);
  }

  // Read WITH removed rows: a Declined or Linked request's key still answers
  // (lib/request-key.ts). Every other removed row stays `invalid_token` below.
  const { data: keyRow } = await admin
    .from('guests')
    .select(
      'guest_id, event_id, qr_token, first_name, plus_one_of_guest_id, plus_one_name_confirmed_at, entry_source, deleted_at, custom_tags',
    )
    .eq('qr_token', token)
    .maybeSingle();

  if (!keyRow || keyRow.event_id !== event.event_id) {
    await recordMiss(request, { rule: 'redeem:unknown-token', steps: ['link', 'redeem'], held: 'none', carriedCode: false });
    target.searchParams.set('invite_error', 'invalid_token');
    return NextResponse.redirect(target);
  }

  /* 🔓 A REQUESTER'S KEY (owner 2026-09-29, "A REQUESTER GETS THEIR QR AT ONCE;
     IT UNLOCKS ONLY WHEN THE COUPLE ACCEPTS"; prototype frames C · D · E).
     Pending or declined → NO guest session: the key is remembered as a REQUEST
     (its own cookie, which no guest page reads) and they see their request
     screen — "Waiting for the couple to confirm you", or "Sorry, your request
     was not approved." Accepted → the same key opens their invitation below;
     Linked → it opens the guest they were joined to. Asked LIVE, every time. */
  const keyState = requestKeyState(keyRow);
  if (keyState.kind === 'pending' || keyState.kind === 'declined') {
    await rememberRequestKey(keyRow.qr_token as string);
    return NextResponse.redirect(new URL(`/${event.slug}/request`, url.origin));
  }
  if (keyState.kind === 'none') {
    target.searchParams.set('invite_error', 'invalid_token');
    return NextResponse.redirect(target);
  }
  let guest = keyRow;
  if (keyState.kind === 'linked') {
    const { data: joined } = await admin
      .from('guests')
      .select(
        'guest_id, event_id, qr_token, first_name, plus_one_of_guest_id, plus_one_name_confirmed_at, entry_source, deleted_at, custom_tags',
      )
      .eq('guest_id', keyState.into)
      .eq('event_id', event.event_id)
      .is('deleted_at', null)
      .maybeSingle();
    if (!joined) {
      target.searchParams.set('invite_error', 'invalid_token');
      return NextResponse.redirect(target);
    }
    guest = joined;
  }
  // "You're in!" (frame D) — only for the browser that sent the request, or a
  // Linked key (which only a requester ever held).
  const wasRequest =
    keyState.kind === 'linked' || request.cookies.get(REQUEST_KEY_COOKIE)?.value === keyRow.qr_token;

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

  if (wasRequest) {
    await forgetRequestKey();
    return NextResponse.redirect(new URL(`/${event.slug}/invite/enter?in=1`, url.origin));
  }

  if (isTbaPlusOne && !guest.plus_one_name_confirmed_at) {
    // event.slug, not the query value — the database's own spelling.
    return NextResponse.redirect(new URL(`/${event.slug}/welcome`, url.origin));
  }

  // 👋 A NAMED plus-one opening THEIR OWN link (owner 2026-09-29, prototype
  // frame F): the short welcome first — "Welcome, Ben", what Maria already
  // filled marked "from Maria", only what is missing asked, one "Save to my
  // account", and "Not now — just show my pass". Once per browser
  // (`PLUS_ONE_WELCOMED_COOKIE`, set by either button), and never for a seat
  // already kept in an account. Never the full reply — a plus-one is asked the
  // minimum (lib/plus-one-welcome.ts).
  if (
    guest.plus_one_of_guest_id !== null &&
    plusOneWelcomeDue({
      guestId: guest.guest_id,
      welcomedCookie: request.cookies.get(PLUS_ONE_WELCOMED_COOKIE)?.value,
      seatHeld: (await readSeatHolder(guest.event_id, guest.guest_id)) !== null,
    })
  ) {
    return NextResponse.redirect(new URL(`/${event.slug}/welcome`, url.origin));
  }

  /* 🚪 THE PERSONAL LINK OPENS THE GUEST'S OWN LANDING PAGE (owner 2026-09-30,
     DECISION_LOG row of that name): the couple's message, "Reply to the
     invitation" until they reply, their Digital ticket, their guests, how to
     use it, and "Open the invitation". Built from `event.slug` — the
     database's own spelling, never the query's. */
  /* 🔁 …carrying a short-lived landing code (`?k=`), so the landing's OWN
     address re-enters this guest once in another browser — a chat app's
     "Open in Safari" opens the address bar, which never held the token. A code
     that cannot be minted leaves the address bare (the behaviour before). */
  const landing = new URL(inviteEnterPath(event.slug), url.origin);
  const landingCode = await mintReentryCode({ eventId: guest.event_id, guestId: guest.guest_id, purpose: 'landing' });
  if (landingCode) landing.searchParams.set(REENTRY_PARAM, landingCode);
  return NextResponse.redirect(landing);
}
