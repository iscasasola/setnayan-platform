import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  buildDriveAuthorizeUrl,
  generateDriveStateToken,
  getDriveOAuthConfig,
} from '@/lib/papic-drive';

// Iteration 0009 Photo Delivery — Google Drive OAuth start.
//
// GET /api/oauth/photo-delivery/start?event_id=<uuid>
//
// Phase 0 consolidation (Storage_and_Drive_Copy_Architecture_2026-06-03.md):
// the Photo Delivery connect now routes through the SAME Google consent +
// redirect URI as the Papic Drive connect (getDriveOAuthConfig →
// /api/oauth/drive/callback). One consent screen, one registered redirect URI,
// one provider='drive' grant per event. This route keeps inserting an
// oauth_state row with provider='drive_photo_delivery' purely as a
// return-page marker so the shared callback knows to redirect back to the
// Photo Delivery panel (the grant it writes is always provider='drive').
//
// Graceful fallback: when GOOGLE_DRIVE_OAUTH_* is unset (the owner hasn't yet
// registered the Drive redirect URI in Google Cloud + Vercel), the route
// returns a 503 with a structured payload and the panel shows a "coming soon —
// admin setup pending" placeholder until that owner action completes.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get('event_id');
  if (!eventId) {
    return NextResponse.json({ error: 'event_id required' }, { status: 400 });
  }

  // --- Auth check: signed-in user + couple membership on the event ---
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership || membership.member_type !== 'couple') {
    return NextResponse.json(
      { error: 'Only the couple can connect Photo Delivery for this event' },
      { status: 403 },
    );
  }

  // --- Graceful fallback when env vars missing ---
  const config = getDriveOAuthConfig();
  if (!config.ready) {
    return NextResponse.json(
      {
        error: 'drive_oauth_not_configured',
        message: 'Setnayan admin setup is still in progress. Check back soon.',
        missing: config.missing,
      },
      { status: 503 },
    );
  }

  // --- CSRF state nonce (single-use, 10-min TTL enforced in callback) ---
  const state = generateDriveStateToken();
  const admin = createAdminClient();
  const { error: stateError } = await admin.from('oauth_state').insert({
    state_token: state,
    event_id: eventId,
    provider: 'drive_photo_delivery',
    initiated_by: user.id,
  });
  if (stateError) {
    return NextResponse.json(
      { error: `Could not persist OAuth state: ${stateError.message}` },
      { status: 500 },
    );
  }

  const authorizeUrl = buildDriveAuthorizeUrl({
    clientId: config.clientId,
    redirectUri: config.redirectUri,
    state,
    // ?switch=1 → the couple is changing which Google account holds the Drive
    // copy; force the account chooser so they can actually pick a different one.
    forceAccountChooser: req.nextUrl.searchParams.get('switch') === '1',
  });

  return NextResponse.redirect(authorizeUrl);
}
