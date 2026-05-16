import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  exchangeYoutubeCodeForToken,
  fetchYoutubeChannel,
  getYoutubeOAuthConfig,
} from '@/lib/panood-youtube';

// Iteration 0011 Panood — YouTube OAuth callback.
//
// GET /api/oauth/youtube/callback?code=<code>&state=<state>
//
// 1. Looks up the persisted state row (recovering event_id + initiated_by)
//    and deletes it regardless of outcome — state tokens are single-use.
// 2. Exchanges the authorization code for refresh + access tokens.
// 3. Fetches the connected channel info (best-effort) for the display label.
// 4. Upserts public.oauth_grants keyed by (event_id, provider='youtube').
//    Replaces any existing row in place; the unique constraint enforces a
//    single grant per (event, provider).
// 5. Redirects back to the Panood setup page with ?youtube_connected=1 or
//    ?youtube_error=<reason> so the UI can render a status banner.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATE_TTL_MIN = 10;

function redirectWithError(
  origin: URL,
  eventId: string | null,
  reason: string,
): NextResponse {
  const target = eventId
    ? new URL(`/dashboard/${eventId}/add-ons/panood`, origin)
    : new URL('/dashboard', origin);
  target.searchParams.set('youtube_error', reason);
  return NextResponse.redirect(target);
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

  // Google can surface its own error (user canceled, scope denied, etc.) —
  // forward it verbatim so the UI can show a sensible message.
  if (oauthError) {
    return redirectWithError(url, null, oauthError);
  }
  if (!code || !state) {
    return redirectWithError(url, null, 'missing_code_or_state');
  }

  const admin = createAdminClient();

  // 1. Pull state row + verify freshness, then delete (single-use).
  const { data: stateRow } = await admin
    .from('oauth_state')
    .select('state_token, event_id, provider, initiated_by, created_at')
    .eq('state_token', state)
    .eq('provider', 'youtube')
    .maybeSingle();
  if (!stateRow) {
    return redirectWithError(url, null, 'state_not_found');
  }
  const eventId = stateRow.event_id as string;
  const createdAt = new Date(stateRow.created_at as string).getTime();
  const ageMin = (Date.now() - createdAt) / 60_000;
  await admin.from('oauth_state').delete().eq('state_token', state);
  if (ageMin > STATE_TTL_MIN) {
    return redirectWithError(url, eventId, 'state_expired');
  }

  // 2. Config sanity-check (should never fail if /start succeeded, but
  //    defend against rotation between start + callback).
  const config = getYoutubeOAuthConfig();
  if (!config.ready) {
    return redirectWithError(url, eventId, 'not_configured');
  }

  // 3. Exchange code -> tokens
  let token;
  try {
    token = await exchangeYoutubeCodeForToken({
      code,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
    });
  } catch (e) {
    return redirectWithError(
      url,
      eventId,
      `exchange_failed:${(e as Error).message.slice(0, 64)}`,
    );
  }

  if (!token.refresh_token) {
    // With prompt=consent forced, Google should always return one. If we
    // don't get one, surface a clear error instead of silently persisting a
    // grant that we won't be able to refresh later.
    return redirectWithError(url, eventId, 'no_refresh_token');
  }

  // 4. Fetch channel info (best-effort — failure here doesn't block the
  //    grant write, since refresh_token alone is enough to broadcast).
  const channel = await fetchYoutubeChannel(token.access_token);

  // 5. Upsert the grant. Unique (event_id, provider) guarantees one row
  //    per channel; passing onConflict so a re-consent replaces in place
  //    and resurrects any prior `revoked_at`.
  const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();
  const { error: upsertError } = await admin
    .from('oauth_grants')
    .upsert(
      {
        event_id: eventId,
        provider: 'youtube',
        scopes: token.scope ? token.scope.split(' ') : [],
        refresh_token: token.refresh_token,
        access_token: token.access_token,
        access_token_expires_at: expiresAt,
        external_account_id: channel?.id ?? null,
        external_account_display: channel?.title ?? 'Connected channel',
        granted_at: new Date().toISOString(),
        revoked_at: null,
        last_refreshed_at: new Date().toISOString(),
        metadata: channel?.thumbnailUrl
          ? { thumbnail_url: channel.thumbnailUrl }
          : {},
      },
      { onConflict: 'event_id,provider' },
    );

  if (upsertError) {
    return redirectWithError(
      url,
      eventId,
      `persist_failed:${upsertError.message.slice(0, 64)}`,
    );
  }

  const target = new URL(`/dashboard/${eventId}/add-ons/panood`, url);
  target.searchParams.set('youtube_connected', '1');
  return NextResponse.redirect(target);
}
