import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { setGuestSession } from '@/lib/guest-session';
import { CAMERA_BACK_PARAM, cameraBackTab } from '@/app/[slug]/_lib/hub-tabs';

// Mint a guest session from the personal QR token, then land on the decorator.
//
// /papic/me/[token] is token-scoped (no cookie), but /papic/decorate — and the
// /api/papic/guest-capture upload it uses — are session-scoped. A guest who
// arrived only via their raw token link therefore had no session and hit "open
// your invitation first". This bridge mints the session from a valid qr_token
// (the SAME pattern the invite-redeem + seat-claim routes already use — the
// token is the guest's camera credential), then redirects into the decorator.
// Route Handler because cookie writes are only allowed here, never in a render.
//
// ?next= picks the landing among a FIXED allowlist of session-scoped surfaces
// (default: the decorator; 'pool' → the Shared Pool Gallery). Allowlisted-only
// — never a caller-supplied path (no open redirect).

export const dynamic = 'force-dynamic';

const NEXT_DESTINATIONS: Record<string, string> = {
  decorate: '/papic/decorate',
  pool: '/papic/pool',
  /* Added 2026-08-25. /papic/me only ever resolved the PAID Limited roll camera,
     so on an event running the free pool — which is every production event — a
     guest scanning their printed QR was told cameras were off while the pool
     camera stood open. It is session-scoped like the other two, so it needs the
     same bridge. Allowlisted key, fixed path: no caller-supplied redirect. */
  guest: '/papic/guest',
};

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const cleanToken = token?.trim();
  const url = new URL(req.url);
  const destPath = NEXT_DESTINATIONS[url.searchParams.get('next') ?? ''] ?? '/papic/decorate';
  const decorate = new URL(destPath, url.origin);
  // 📸 The camera opened from the Event Hub keeps the way back (owner
  // 2026-10-01: "Camera exit → the page they came from"). Two values pass
  // through, each re-checked here as well as on the camera page: the event
  // (a slug — never a path) and the tab (one of the tab keys). Anything else is
  // dropped, so this is still no open redirect.
  if (destPath === '/papic/guest') {
    const from = url.searchParams.get('from') ?? '';
    if (/^[a-z0-9][a-z0-9-]{0,79}$/.test(from)) {
      decorate.searchParams.set('from', from);
      const back = cameraBackTab(url.searchParams.get(CAMERA_BACK_PARAM));
      if (back) decorate.searchParams.set(CAMERA_BACK_PARAM, back);
    }
  }
  if (!cleanToken) return NextResponse.redirect(decorate);

  const admin = createAdminClient();
  const { data: guest } = await admin
    .from('guests')
    .select('guest_id, event_id, qr_token')
    .eq('qr_token', cleanToken)
    .is('deleted_at', null)
    .maybeSingle();

  if (guest) {
    await setGuestSession({
      guest_id: guest.guest_id as string,
      event_id: guest.event_id as string,
      qr_token: guest.qr_token as string,
    });
  }
  // Bad/reissued token → still land on the decorator, which shows the friendly
  // "open your invitation first" state (never leak why the token didn't resolve).
  return NextResponse.redirect(decorate);
}
