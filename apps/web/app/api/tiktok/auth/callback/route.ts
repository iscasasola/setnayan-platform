import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  exchangeCodeForToken,
  fetchTiktokUserInfo,
  getTiktokOAuthConfig,
} from '@/lib/patiktok-tiktok';

// Iteration 0017 Phase 3 — TikTok OAuth callback.
//
// GET /api/tiktok/auth/callback?code=<code>&state=<state>
//
// 1. Pulls the persisted state row (and recovers the originating event_id +
//    initiated_by). Deletes the row regardless of outcome — state tokens are
//    single-use.
// 2. Exchanges the authorization code for access + refresh tokens.
// 3. Fetches TikTok user info (best-effort, for the handle).
// 4. Upserts patiktok_oauth_grants (one active grant per event — older grants
//    are revoked via the partial unique index trigger pattern; here we just
//    soft-revoke any prior).
// 5. Redirects back to the Patiktok page with ?tiktok_connected=1 or an error.

const STATE_TTL_MIN = 10;

function redirectWithError(
  origin: URL,
  eventId: string | null,
  reason: string,
): NextResponse {
  const target = eventId
    ? new URL(`/dashboard/${eventId}/studio/patiktok`, origin)
    : new URL('/dashboard', origin);
  target.searchParams.set('tiktok_error', reason);
  return NextResponse.redirect(target);
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

  if (oauthError) {
    return redirectWithError(url, null, oauthError);
  }
  if (!code || !state) {
    return redirectWithError(url, null, 'missing_code_or_state');
  }

  const admin = createAdminClient();

  // 1. Pull the state row + verify freshness, then delete (single-use).
  const { data: stateRow } = await admin
    .from('patiktok_oauth_state')
    .select('state_token, event_id, initiated_by, created_at')
    .eq('state_token', state)
    .maybeSingle();
  if (!stateRow) {
    return redirectWithError(url, null, 'state_not_found');
  }
  const eventId = stateRow.event_id as string;
  const initiatedBy = stateRow.initiated_by as string;
  const createdAt = new Date(stateRow.created_at as string).getTime();
  const ageMin = (Date.now() - createdAt) / 60_000;
  await admin.from('patiktok_oauth_state').delete().eq('state_token', state);
  if (ageMin > STATE_TTL_MIN) {
    return redirectWithError(url, eventId, 'state_expired');
  }

  // 2. Config check
  const config = getTiktokOAuthConfig();
  if (!config.ready) {
    return redirectWithError(url, eventId, 'not_configured');
  }

  // 3. Exchange code → tokens
  let token;
  try {
    token = await exchangeCodeForToken({
      code,
      clientKey: config.clientKey,
      clientSecret: process.env.TIKTOK_CLIENT_SECRET ?? '',
      redirectUri: config.redirectUri,
    });
  } catch (e) {
    return redirectWithError(
      url,
      eventId,
      `exchange_failed:${(e as Error).message.slice(0, 64)}`,
    );
  }

  // 4. Fetch user info (best-effort)
  const userInfo = await fetchTiktokUserInfo(token.access_token);

  // 5. Soft-revoke any previous active grants for this event (unique index
  //    on (event_id) WHERE revoked_at IS NULL enforces single active grant).
  await admin
    .from('patiktok_oauth_grants')
    .update({
      revoked_at: new Date().toISOString(),
      revoked_reason: 'superseded_by_new_grant',
      updated_at: new Date().toISOString(),
    })
    .eq('event_id', eventId)
    .is('revoked_at', null);

  const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();
  const { error: insertError } = await admin.from('patiktok_oauth_grants').insert({
    event_id: eventId,
    granted_by: initiatedBy,
    tiktok_open_id: token.open_id ?? userInfo?.open_id ?? '',
    tiktok_union_id: userInfo?.union_id ?? null,
    tiktok_handle: userInfo?.display_name ?? null,
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    scope: token.scope,
    expires_at: expiresAt,
  });
  if (insertError) {
    return redirectWithError(
      url,
      eventId,
      `persist_failed:${insertError.message.slice(0, 64)}`,
    );
  }

  const target = new URL(`/dashboard/${eventId}/studio/patiktok`, url);
  target.searchParams.set('tiktok_connected', '1');
  return NextResponse.redirect(target);
}
