import { NextResponse, type NextRequest } from 'next/server';
import { buildGuestSessionCookie, readGuestSession } from '@/lib/guest-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { eventPapicGuestActive } from '@/lib/papic-guest';

// Papic WALK-UP entry — scan the EVENT walk-up QR, get a camera, no roster / no
// name (Papic_Walkup_Face_Identity_Plan_2026-06-29 §1, §5).
//
// The walk-up QR encodes /papic/join/<events.papic_walkup_token> — a DEDICATED
// guest-facing token, separate from the privileged crew master_qr_token. This
// handler does the "resume-or-create" of an anonymous walk-up identity, then
// drops the guest at the existing capture surface (/papic/guest):
//
//   1. RESUME — a valid setnayan_guest_session cookie already bound to THIS
//      event → reuse the same camera (the fix for "re-scan makes a new camera").
//   2. CREATE — otherwise mint a lightweight walk-up guest via the gated
//      papic_walkup_register RPC (which requires the event to own PAPIC_GUEST),
//      set the cookie, and continue.
//
// A Route Handler (not a page) because it WRITES a cookie + redirects; the cookie
// is attached to the redirect response directly so it can't be dropped. Admin
// client: this is a public surface with no Supabase auth session (the cookie is
// the identity), exactly like /papic/guest.
//
// PR1 scope: same-device resume (cookie) + create. Cross-device face re-entry,
// the saved-link fallback, the consent/enroll step, and the first-5-free walk-up
// free tier are later phases. Failures fall back to /papic/guest, whose existing
// empty states ("open your invitation" / "cameras aren't on") cover them.

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const captureUrl = new URL('/papic/guest', req.nextUrl.origin);
  const fallback = () => NextResponse.redirect(captureUrl);

  if (!token || token.length < 16) return fallback();

  const admin = createAdminClient();

  // Resolve the event behind this walk-up token so we can RESUME a same-event cookie.
  const { data: ev, error: evErr } = await admin
    .from('events')
    .select('event_id')
    .eq('papic_walkup_token', token)
    .maybeSingle();
  if (evErr || !ev) return fallback();

  // Authoritative gate: walk-up is available IFF the capture surface it leads to
  // (/papic/guest) is — same alias/bundle-aware check, so we never mint a guest
  // for an event whose capture page would just reject them. The RPC repeats a DB
  // backstop for direct calls.
  if (!(await eventPapicGuestActive(admin, ev.event_id as string))) return fallback();

  // RESUME — already have a camera for THIS event on this device.
  const session = await readGuestSession();
  if (session && session.event_id === ev.event_id) {
    return NextResponse.redirect(captureUrl);
  }

  // CREATE — mint a lightweight walk-up guest (RPC enforces PAPIC_GUEST ownership).
  const { data, error } = await admin.rpc('papic_walkup_register', {
    p_walkup_token: token,
  });
  if (error) return fallback();

  const result = data as {
    status?: string;
    guest_id?: string;
    event_id?: string;
    qr_token?: string;
  } | null;

  if (
    !result ||
    result.status !== 'ok' ||
    !result.guest_id ||
    !result.event_id ||
    !result.qr_token
  ) {
    // not_owned / invalid_token / unexpected → fall back to the capture surface's
    // own empty states rather than crash.
    return fallback();
  }

  const cookie = await buildGuestSessionCookie({
    guest_id: result.guest_id,
    event_id: result.event_id,
    qr_token: result.qr_token,
  });
  const response = NextResponse.redirect(captureUrl);
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
