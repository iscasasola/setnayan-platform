import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  buildDriveAuthorizeUrl,
  generateDriveStateToken,
  getDriveOAuthConfig,
} from '@/lib/papic-drive';

// Iteration 0012 Papic — Google Drive OAuth start.
//
// GET /api/oauth/drive/start?event_id=<uuid>
//
// 1. Verifies the caller is signed in and is a couple on this event.
// 2. Checks GOOGLE_DRIVE_OAUTH_* env vars. If unset, returns 503 with a
//    structured payload — the calling page surfaces a "coming soon"
//    placeholder under the "Use my Google Drive only" radio option
//    instead of the live Connect button. The Setnayan-storage radio
//    remains fully functional. This is the graceful-fallback rule from
//    the 2026-05-16 V1 scope expansion: the feature ships safe before
//    the owner finishes Google Cloud setup.
// 3. Generates a random CSRF state token + inserts a row into
//    public.oauth_state (provider='drive').
// 4. 302 redirects to Google's authorize endpoint with offline access +
//    forced consent so we always get a fresh refresh_token.

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
      { error: 'Only the couple can connect Google Drive for this event' },
      { status: 403 },
    );
  }

  // --- Graceful fallback: 503 when GOOGLE_DRIVE_OAUTH_* env vars missing ---
  const config = getDriveOAuthConfig();
  if (!config.ready) {
    return NextResponse.json(
      {
        error: 'drive_oauth_not_configured',
        message:
          'Setnayan admin setup is still in progress. Check back soon.',
        missing: config.missing,
      },
      { status: 503 },
    );
  }

  // --- CSRF: persist a single-use state nonce via service role ---
  // Service role is used because oauth_state has no couple-write policy —
  // tokens never appear in browser-visible RLS scope.
  const state = generateDriveStateToken();
  const admin = createAdminClient();
  const { error: stateError } = await admin.from('oauth_state').insert({
    state_token: state,
    event_id: eventId,
    provider: 'drive',
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
