import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  buildDriveAuthorizeUrl,
  generateDriveStateToken,
} from '@/lib/papic-drive';
import { getPhotoDeliveryOAuthConfig } from '@/lib/photo-delivery-drive';

// Iteration 0009 Photo Delivery — Google Drive OAuth start.
//
// GET /api/oauth/photo-delivery/start?event_id=<uuid>
//
// Mirrors the Papic /api/oauth/drive/start route. Differences:
//   - Reads PHOTO_DELIVERY_OAUTH_REDIRECT_URI (distinct from Papic's
//     GOOGLE_DRIVE_OAUTH_REDIRECT_URI so Google can dispatch consent
//     callbacks to the right iteration).
//   - Inserts oauth_state with provider='drive_photo_delivery' (added by
//     the PR 3 migration extending the provider CHECK).
//
// Graceful fallback: when PHOTO_DELIVERY_OAUTH_REDIRECT_URI is unset (the
// owner hasn't yet registered the URI in Google Cloud + Vercel), the
// route returns a 503 with a structured payload. The Photo Delivery
// panel surfaces a "coming soon — admin setup pending" placeholder
// under the Connect button until that owner action completes.

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
  const config = getPhotoDeliveryOAuthConfig();
  if (!config.ready) {
    return NextResponse.json(
      {
        error: 'photo_delivery_oauth_not_configured',
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
  });

  return NextResponse.redirect(authorizeUrl);
}
