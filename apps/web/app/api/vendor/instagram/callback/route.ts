import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { encryptToken } from '@/lib/encryption';
import {
  exchangeInstagramCodeForToken,
  fetchInstagramBusinessAccount,
  getMetaAppOAuthConfig,
} from '@/lib/vendor-instagram';

// Vendor Instagram connect — OAuth callback.
//
// GET /api/vendor/instagram/callback?code=<code>&state=<state>
//
// 1. Looks up the persisted state row (recovering vendor_profile_id) and
//    deletes it regardless of outcome — state tokens are single-use (CSRF).
// 2. Exchanges the code for a long-lived access token.
// 3. Resolves the connected IG account's profile (id + username) via /me.
// 4. Encrypts the token at-rest (lib/encryption) and upserts
//    public.vendor_ig_connections keyed by vendor_profile_id (one per vendor).
// 5. Redirects back to My Shop (/vendor-dashboard/shop) with a status flag,
//    deep-linking to the Gallery & media / Instagram section (#gallery-media).
//    (Repointed 2026-07-05 — the IG editor moved from the retired /profile page
//    into the My Shop → Website Editor.)
//
// SECURITY: the access token is encrypted before it touches the DB and NEVER
// leaves this route in a redirect param, log, or error. Error reasons are
// generic codes only.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATE_TTL_MIN = 10;
// My Shop → Website Editor hosts the Instagram card now (relocated 2026-07-05).
const SHOP_PATH = '/vendor-dashboard/shop';
// Deep-link to the Gallery & media section so the vendor lands on the IG card.
const IG_SECTION_HASH = '#gallery-media';

function redirectWithError(origin: URL, reason: string): NextResponse {
  const target = new URL(SHOP_PATH, origin);
  target.searchParams.set('ig_error', reason);
  target.hash = IG_SECTION_HASH;
  return NextResponse.redirect(target);
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

  // Meta can surface its own error (user canceled, scope denied, etc.).
  if (oauthError) {
    // error_reason is a safe, short enum (e.g. "user_denied").
    const reason = url.searchParams.get('error_reason') || 'denied';
    return redirectWithError(url, reason.slice(0, 40));
  }
  if (!code || !state) {
    return redirectWithError(url, 'missing_code_or_state');
  }

  const admin = createAdminClient();

  // 1. Pull + delete the state row (single-use, freshness-checked).
  const { data: stateRow } = await admin
    .from('vendor_ig_oauth_state')
    .select('state_token, vendor_profile_id, created_at')
    .eq('state_token', state)
    .maybeSingle();
  if (!stateRow) {
    return redirectWithError(url, 'state_not_found');
  }
  const vendorProfileId = (stateRow as { vendor_profile_id: string }).vendor_profile_id;
  const createdAt = new Date((stateRow as { created_at: string }).created_at).getTime();
  await admin.from('vendor_ig_oauth_state').delete().eq('state_token', state);
  if ((Date.now() - createdAt) / 60_000 > STATE_TTL_MIN) {
    return redirectWithError(url, 'state_expired');
  }

  // 2. Config sanity-check (defend against env rotation between start+callback).
  const config = getMetaAppOAuthConfig(url.origin);
  if (!config.ready) {
    return redirectWithError(url, 'not_configured');
  }

  // 3. Exchange code -> long-lived token.
  let token;
  try {
    token = await exchangeInstagramCodeForToken({
      code,
      appId: config.appId,
      appSecret: config.appSecret,
      redirectUri: config.redirectUri,
    });
  } catch {
    // Never echo the exchange error body — it can contain token fragments.
    return redirectWithError(url, 'exchange_failed');
  }

  // 4. Resolve the connected IG account's profile (id + username) via /me.
  const igAccount = await fetchInstagramBusinessAccount(token.accessToken);
  if (!igAccount) {
    return redirectWithError(url, 'profile_fetch_failed');
  }

  // 5. Encrypt + upsert the connection (one per vendor).
  let accessTokenEnc: string;
  try {
    accessTokenEnc = encryptToken(token.accessToken);
  } catch {
    // ENCRYPTION_KEY missing/invalid — refuse to persist a plaintext token.
    return redirectWithError(url, 'encryption_unavailable');
  }
  const expiresAt = new Date(
    Date.now() + token.expiresInSeconds * 1000,
  ).toISOString();
  const { error: upsertError } = await admin
    .from('vendor_ig_connections')
    .upsert(
      {
        vendor_profile_id: vendorProfileId,
        ig_user_id: igAccount.igUserId,
        ig_username: igAccount.username,
        access_token_enc: accessTokenEnc,
        token_expires_at: expiresAt,
        status: 'connected',
        status_detail: null,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'vendor_profile_id' },
    );
  if (upsertError) {
    return redirectWithError(url, 'persist_failed');
  }

  const target = new URL(SHOP_PATH, url);
  target.searchParams.set('ig_connected', '1');
  target.hash = IG_SECTION_HASH;
  return NextResponse.redirect(target);
}
