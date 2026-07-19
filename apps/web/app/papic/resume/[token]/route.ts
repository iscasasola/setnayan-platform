import { NextResponse, type NextRequest } from 'next/server';
import { buildGuestSessionCookie } from '@/lib/guest-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { eventPapicGuestActive } from '@/lib/papic-guest';

// Papic WALK-UP "save my camera" — re-establish a walk-up guest's session from
// their OWN guests.qr_token (Papic_Walkup_Face_Identity_Plan_2026-06-29 §5, the
// saved-link recovery layer). The walk-up guest saves /papic/resume/<qr_token>
// (shown on the capture surface); opening it on any device/browser restores the
// setnayan_guest_session cookie and drops them back at /papic/guest.
//
// Cookie-resume (60d) already covers the same-browser case; this covers cleared
// cookies / a different browser, until the face engine adds cross-device face
// re-entry. RESTRICTED to self_registered (walk-up) guests — roster guests use
// /papic/me + their personal QR (which routes to their Limited roll seat).
//
// qr_token is the capability (same trust model as the personal invite); admin
// client because the surface has no Supabase auth session. Gated on guest
// cameras still being active, exactly like the join route + /papic/guest.

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

  const { data: g, error } = await admin
    .from('guests')
    .select('guest_id, event_id, qr_token, self_registered, deleted_at')
    .eq('qr_token', token)
    .maybeSingle();

  // Only a live, walk-up (self-registered) guest can resume here.
  if (error || !g || g.deleted_at || !g.self_registered) return fallback();

  if (!(await eventPapicGuestActive(admin, g.event_id as string))) return fallback();

  const cookie = await buildGuestSessionCookie({
    guest_id: g.guest_id as string,
    event_id: g.event_id as string,
    qr_token: g.qr_token as string,
  });
  const response = NextResponse.redirect(captureUrl);
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
