import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { readGuestSession } from '@/lib/guest-session';
import { renderInvitationQrPng } from '@/lib/qr';
import { resolveEventOwnerSlug } from '@/lib/public-event-url';

/**
 * GET /api/guest/qr — hands the signed-in guest their OWN invitation QR as a
 * PNG they can keep.
 *
 * WHY THIS EXISTS: all three guest QR surfaces draw the code as an inline SVG,
 * which a long-press cannot save, and the invitation QR card has been telling
 * guests "Save this to your phone." with no way on the page to do it. A
 * screenshot was the only answer. This is the missing file.
 *
 * ── AUTHENTICATION: THE COOKIE, AND NOTHING IN THE URL ──────────────────────
 * The caller is identified purely by their signed `setnayan_guest_session`
 * cookie. There is deliberately NO guestId, no token and no slug in the path:
 *
 *   - Nothing to enumerate. A route keyed on an id invites someone to try
 *     other ids and makes the authorization check the only thing standing
 *     between them and a stranger's sign-in code; with no id there is no other
 *     answer this route can give.
 *   - Nothing to leak. The qr_token IS a credential — it signs its holder in.
 *     Put it in a path and it lands in browser history, the Referer of the next
 *     hop, and every access log in between. The cookie is httpOnly and already
 *     carries it.
 *
 * This mirrors app/[slug]/rotate-qr-actions.ts, which authenticates the same
 * actor the same way, including the POSSESSION CHECK below.
 *
 * ── POSSESSION CHECK ────────────────────────────────────────────────────────
 * The session's embedded qr_token must still equal the guest row's CURRENT
 * qr_token. A session minted from a rotated (possibly leaked) code can
 * therefore not download the replacement — which is the whole point of
 * rotation, and would be quietly undone if this route trusted the cookie's
 * guest_id alone. Always on, independent of GUEST_SESSION_TOKEN_CHECK.
 *
 * ── NOT GATED ON A PURCHASE, ON PURPOSE ─────────────────────────────────────
 * This serves the plain ink-on-cream code the guest is ALREADY being shown for
 * free. Saving a picture of what is on your own screen is not a feature to
 * sell. The paid CUSTOM_QR_GUEST upgrade is a different file — the
 * palette-tinted branded PNG at /api/website/qr/guest/[guestId] — and is
 * untouched.
 */
/** What the caller is allowed to have. `deny` carries what to say and the code. */
export type GuestQrVerdict =
  | { allow: true }
  | { allow: false; status: 401 | 503; message: string };

export type GuestQrSession = { guest_id: string; event_id: string; qr_token: string };
export type GuestQrRow = { event_id: string; qr_token: string } | null;

/**
 * THE WHOLE GATE, as a pure function — extracted so every refusal can be
 * exercised by a test rather than asserted about by a grep. The route below is
 * the IO around it and makes no access decision of its own.
 *
 * `readFailed` is separate from a null row on purpose: see the 503 branch.
 */
export function decideGuestQrAccess(
  session: GuestQrSession | null,
  guest: GuestQrRow,
  readFailed: boolean,
): GuestQrVerdict {
  if (!session) {
    return { allow: false, status: 401, message: 'Open your invitation link first.' };
  }
  // A read that FAILED is not a guest who is missing. Answering 401 here would
  // tell a guest holding a perfectly good code that they are signed out, and
  // send them hunting for a replacement link they do not need.
  if (readFailed) {
    return { allow: false, status: 503, message: 'Could not reach your invitation. Try again.' };
  }
  // Possession check — the session must have been minted from the code the row
  // carries NOW. A session made from a rotated (possibly leaked) code cannot
  // fetch the replacement, which is the entire point of rotation.
  if (
    !guest ||
    guest.event_id !== session.event_id ||
    guest.qr_token !== session.qr_token
  ) {
    return {
      allow: false,
      status: 401,
      message: 'This code has been replaced. Open your current invitation link.',
    };
  }
  return { allow: true };
}

export async function GET() {
  const session = await readGuestSession();

  const admin = createAdminClient();

  const { data: guest, error: guestErr } = session
    ? await admin
        .from('guests')
        .select('guest_id, event_id, qr_token, first_name, display_name')
        .eq('guest_id', session.guest_id)
        .is('deleted_at', null)
        .maybeSingle()
    : { data: null, error: null };

  const verdict = decideGuestQrAccess(session, guest, Boolean(guestErr));
  if (!verdict.allow) {
    return new NextResponse(verdict.message, { status: verdict.status });
  }
  // Narrowing only — decideGuestQrAccess already refused every null.
  if (!guest) {
    return new NextResponse('Open your invitation link first.', { status: 401 });
  }

  const { data: event } = await admin
    .from('events')
    .select('event_id, slug')
    .eq('event_id', guest.event_id)
    .maybeSingle();
  if (!event?.slug) {
    return new NextResponse('Event not found.', { status: 404 });
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';
  const ownerSlug = await resolveEventOwnerSlug(admin, event.event_id);

  const png = await renderInvitationQrPng({
    appUrl,
    slug: event.slug,
    qrToken: guest.qr_token,
    ownerSlug,
  });

  return new NextResponse(new Uint8Array(png), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      // The `download` attribute on the link handles the save in every browser
      // that honours it; this is what makes the file save anyway in the ones
      // that don't, and gives it a name instead of "qr".
      'Content-Disposition': `attachment; filename="${guestQrFileName(guest.first_name, guest.display_name)}"`,
      // A QR encoding a sign-in credential must not sit in a shared cache, and
      // must not survive a rotation in a private one either.
      'Cache-Control': 'private, no-store',
    },
  });
}

/**
 * A filename the guest will recognise in their downloads folder six weeks
 * later. Falls back to a generic name rather than risking a header-breaking or
 * empty one — a saved file called "-.png" is worse than "my-invitation-qr.png".
 *
 * 🔒 THIS VALUE IS INTERPOLATED INTO A RESPONSE HEADER. A name is guest-supplied
 * data, so it is reduced to [a-z0-9-] — not escaped, reduced. A quote would end
 * the filename early and a CR/LF would start a header of the attacker's
 * choosing; neither character can survive this. Tested, not assumed.
 */
export function guestQrFileName(firstName: string | null, displayName: string | null): string {
  const slugified = (firstName ?? displayName ?? '')
    .normalize('NFKD')
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 40);
  return slugified ? `${slugified}-invitation-qr.png` : 'my-invitation-qr.png';
}
