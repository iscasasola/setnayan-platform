import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  buildAuthorizeUrl,
  getTiktokOAuthConfig,
} from '@/lib/patiktok-tiktok';

// Iteration 0017 Phase 3 — TikTok OAuth start.
//
// GET /api/tiktok/auth/start?event_id=<uuid>
//
// 1. Verifies the caller is signed in and is a couple on this event.
// 2. Reads TIKTOK_CLIENT_KEY/SECRET/REDIRECT_URI from env. If any are missing,
//    redirects back to the Patiktok page with ?tiktok_error=not_configured.
// 3. Generates a random state token + inserts into patiktok_oauth_state.
// 4. 302 redirects to TikTok's authorize endpoint.

function generateStateToken(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get('event_id');
  if (!eventId) {
    return NextResponse.json({ error: 'event_id required' }, { status: 400 });
  }

  // Auth check — must be a couple on this event
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
      { error: 'Only the couple can connect TikTok for this event' },
      { status: 403 },
    );
  }

  const config = getTiktokOAuthConfig();
  if (!config.ready) {
    const target = new URL(
      `/dashboard/${eventId}/add-ons/patiktok`,
      req.url,
    );
    target.searchParams.set('tiktok_error', 'not_configured');
    target.searchParams.set('missing', config.missing.join(','));
    return NextResponse.redirect(target);
  }

  // Persist the state token via service-role so we can read it back in the
  // callback (couples don't have a write policy on patiktok_oauth_state).
  const state = generateStateToken();
  const admin = createAdminClient();
  const { error: stateError } = await admin
    .from('patiktok_oauth_state')
    .insert({
      state_token: state,
      event_id: eventId,
      initiated_by: user.id,
    });
  if (stateError) {
    return NextResponse.json(
      { error: `Could not persist OAuth state: ${stateError.message}` },
      { status: 500 },
    );
  }

  const authorizeUrl = buildAuthorizeUrl({
    clientKey: config.clientKey,
    redirectUri: config.redirectUri,
    state,
  });

  return NextResponse.redirect(authorizeUrl);
}
