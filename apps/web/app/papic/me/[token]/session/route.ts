import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { setGuestSession } from '@/lib/guest-session';

// Mint a guest session from the personal QR token, then land on the decorator.
//
// /papic/me/[token] is token-scoped (no cookie), but /papic/decorate — and the
// /api/papic/guest-capture upload it uses — are session-scoped. A guest who
// arrived only via their raw token link therefore had no session and hit "open
// your invitation first". This bridge mints the session from a valid qr_token
// (the SAME pattern the invite-redeem + seat-claim routes already use — the
// token is the guest's camera credential), then redirects into the decorator.
// Route Handler because cookie writes are only allowed here, never in a render.

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const cleanToken = token?.trim();
  const decorate = new URL('/papic/decorate', new URL(req.url).origin);
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
