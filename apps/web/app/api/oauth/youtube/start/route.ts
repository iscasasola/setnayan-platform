import { NextResponse, type NextRequest } from 'next/server';
import {
  liveStudioPoolOnly,
  POOL_ONLY_CONNECT_NOTICE,
} from '@/lib/live-studio-pool-only';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  buildYoutubeAuthorizeUrl,
  generateYoutubeStateToken,
  getYoutubeOAuthConfig,
} from '@/lib/panood-youtube';

// Iteration 0011 Panood — YouTube OAuth start.
//
// GET /api/oauth/youtube/start?event_id=<uuid>
//
// 1. Verifies the caller is signed in and is a couple on this event.
// 2. Checks YOUTUBE_OAUTH_* env vars. If unset, returns 503 with a
//    structured payload — the calling page surfaces a "coming soon"
//    placeholder instead of the live Connect button. This is the
//    graceful-fallback rule from the 2026-05-16 V1 scope expansion: the
//    feature ships safe before the owner finishes Google Cloud setup.
// 3. Generates a random CSRF state token + inserts a row into
//    public.oauth_state (provider='youtube').
// 4. 302 redirects to Google's authorize endpoint with offline access +
//    forced consent so we always get a fresh refresh_token.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // ⭐ POOL-ONLY — THE DOOR THE VERIFICATION EXEMPTION DEPENDS ON.
  //
  // FIRST, ahead of auth and ahead of every Google call, because the property being
  // protected is "no user outside Setnayan's Google organisation ever reaches the
  // consent screen". A refusal that ran after the auth check would still be correct
  // here, but the ordering states the rule: this is not an authorization decision
  // about WHO may connect, it is that the BYO door itself is closed. With an
  // Internal-audience OAuth client, Google would refuse these users anyway with
  // `org_internal` — this turns that dead end into a plain sentence.
  //
  // See lib/live-studio-pool-only.ts for the sequencing: do NOT enable this before a
  // verified Setnayan channel is connected, or Live Studio has no route to air.
  if (liveStudioPoolOnly()) {
    return NextResponse.json(
      { error: 'pool_only', message: POOL_ONLY_CONNECT_NOTICE },
      { status: 409 },
    );
  }

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
      { error: 'Only the couple can connect YouTube for this event' },
      { status: 403 },
    );
  }

  // --- Graceful fallback: 503 when YOUTUBE_OAUTH_* env vars are missing ---
  const config = await getYoutubeOAuthConfig();
  if (!config.ready) {
    return NextResponse.json(
      {
        error: 'youtube_oauth_not_configured',
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
  const state = generateYoutubeStateToken();
  const admin = createAdminClient();
  const { error: stateError } = await admin.from('oauth_state').insert({
    state_token: state,
    event_id: eventId,
    provider: 'youtube',
    initiated_by: user.id,
  });
  if (stateError) {
    return NextResponse.json(
      { error: `Could not persist OAuth state: ${stateError.message}` },
      { status: 500 },
    );
  }

  const authorizeUrl = buildYoutubeAuthorizeUrl({
    clientId: config.clientId,
    redirectUri: config.redirectUri,
    state,
  });

  return NextResponse.redirect(authorizeUrl);
}
