import { NextResponse, type NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  exchangeYoutubeCodeForToken,
  fetchYoutubeChannel,
  getYoutubeOAuthConfig,
} from '@/lib/panood-youtube';
import { upsertPoolChannelGrant } from '@/lib/live-studio-channel-grants';

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
    ? new URL(`/dashboard/${eventId}/studio/panood`, origin)
    : new URL('/dashboard', origin);
  target.searchParams.set('youtube_error', reason);
  return NextResponse.redirect(target);
}

/* ══════════════════════════════════════════════════════════════════════════════
   WAVE 9 — the PLATFORM (Setnayan-owned pool channel) half of this callback.
   Live_Studio_Unified_Spec_2026-07-25.md § 4h.

   Everything above this line is the per-couple BYO flow and is untouched. This
   function is reached ONLY when the incoming state matches no `oauth_state` row —
   i.e. exactly where the route previously returned `state_not_found` — so it
   cannot change the behaviour of a single existing connection. It returns null
   when the state is not a pool state either, and the caller falls through to the
   same error it always returned.
   ══════════════════════════════════════════════════════════════════════════════ */

function poolRedirect(origin: URL, params: Record<string, string>): NextResponse {
  const target = new URL('/admin/live-studio-channels', origin);
  for (const [k, v] of Object.entries(params)) target.searchParams.set(k, v);
  return NextResponse.redirect(target);
}

async function completePoolChannelConnect(input: {
  admin: SupabaseClient;
  code: string;
  state: string;
  url: URL;
}): Promise<NextResponse | null> {
  const { admin, code, state, url } = input;

  const { data: row } = await admin
    .from('live_studio_channel_oauth_state')
    .select('state_token, channel_pool_id, created_at')
    .eq('state_token', state)
    .maybeSingle();
  if (!row) return null; // not a pool state → caller reports state_not_found

  const stateRow = row as { channel_pool_id: number | null; created_at: string };
  // Single-use, deleted regardless of outcome — a replayed code must not be able
  // to re-mint a platform credential.
  await admin.from('live_studio_channel_oauth_state').delete().eq('state_token', state);

  const ageMin = (Date.now() - new Date(stateRow.created_at).getTime()) / 60_000;
  if (ageMin > STATE_TTL_MIN) return poolRedirect(url, { error: 'state_expired' });

  const config = await getYoutubeOAuthConfig();
  if (!config.ready) return poolRedirect(url, { error: 'not_configured' });

  let token;
  try {
    token = await exchangeYoutubeCodeForToken({
      code,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
    });
  } catch {
    // The exchange error body can echo request parameters — never forward it into
    // a URL for a credential flow.
    return poolRedirect(url, { error: 'exchange_failed' });
  }
  if (!token.refresh_token) return poolRedirect(url, { error: 'no_refresh_token' });

  // ⚠ The channel read is BEST-EFFORT for a BYO grant but MANDATORY here: the
  // pool is keyed by channel, so without knowing which channel just authorised we
  // have nothing to key the grant to, and guessing would mean writing Setnayan's
  // credentials against the wrong pool row.
  const channel = await fetchYoutubeChannel(token.access_token);
  if (!channel) return poolRedirect(url, { error: 'channel_lookup_failed' });

  let channelPoolId = stateRow.channel_pool_id;

  if (channelPoolId != null) {
    // RE-CONNECT. Refuse if Google handed back a different channel than this pool
    // row is for — an account-picker slip must not silently repoint a pool channel
    // (and with it every event scheduled on it) at another YouTube account.
    const { data: existing } = await admin
      .from('live_studio_roam_channel_pool')
      .select('id, youtube_channel_id')
      .eq('id', channelPoolId)
      .maybeSingle();
    if (!existing) return poolRedirect(url, { error: 'channel_row_missing' });
    if ((existing as { youtube_channel_id: string }).youtube_channel_id !== channel.id) {
      return poolRedirect(url, { error: 'channel_mismatch' });
    }
  } else {
    // NEW CHANNEL. `youtube_channel_id` is UNIQUE, so re-authorising an
    // already-pooled channel lands on its existing row instead of a duplicate.
    const { data: found } = await admin
      .from('live_studio_roam_channel_pool')
      .select('id')
      .eq('youtube_channel_id', channel.id)
      .maybeSingle();
    if (found) {
      channelPoolId = (found as { id: number }).id;
    } else {
      const { data: inserted, error: insErr } = await admin
        .from('live_studio_roam_channel_pool')
        .insert({
          youtube_channel_id: channel.id,
          label: channel.title,
          status: 'available',
          // ⚠ verified stays FALSE. Setnayan cannot see whether YouTube has
          // enabled live streaming on this channel or whether its 24-hour
          // first-stream wait has elapsed (owner action G1). An admin ticks
          // "verified" after checking — the provisioner only claims verified
          // channels, so a not-yet-live channel can never be handed to a wedding.
          verified: false,
        })
        .select('id')
        .maybeSingle();
      if (insErr || !inserted) return poolRedirect(url, { error: 'pool_row_failed' });
      channelPoolId = (inserted as { id: number }).id;
    }
  }

  const saved = await upsertPoolChannelGrant(admin, {
    channelPoolId: channelPoolId as number,
    youtubeChannelId: channel.id,
    refreshToken: token.refresh_token,
    accessToken: token.access_token,
    expiresInSeconds: token.expires_in,
    scopes: token.scope ? token.scope.split(' ') : [],
    displayName: channel.title,
    thumbnailUrl: channel.thumbnailUrl,
  });
  if (!saved.ok) return poolRedirect(url, { error: 'persist_failed' });

  return poolRedirect(url, { connected: '1' });
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

  // Google can surface its own error (user canceled, scope denied, etc.) —
  // forward it verbatim so the UI can show a sensible message.
  //
  // ⭐ ONE EXCEPTION — `org_internal`, translated rather than forwarded.
  //
  // Google returns it when a NON-ORG user hits a consent screen whose Audience is
  // Internal. That is not a failure a couple can act on; it is the CORRECT answer
  // under the Setnayan-owned channel model, arriving through the one door that model
  // closes. Forwarding it verbatim renders "YouTube connection failed (org_internal).
  // Try again, or contact support" — three lies in one sentence: nothing failed,
  // retrying cannot help, and support cannot fix it either.
  //
  // WHY THIS IS A REAL PATH AND NOT DEFENSIVE PADDING: the BYO route and the pool
  // route share ONE OAuth client (`getYoutubeOAuthConfig`). The moment Internal
  // credentials are configured, the couple-facing BYO door starts answering
  // `org_internal` — and it keeps doing so until `NEXT_PUBLIC_LIVE_STUDIO_POOL_ONLY`
  // is flipped. Those two changes are made by a human, in two different systems
  // (Google Cloud and Vercel), and nothing enforces their ordering. This closes the
  // window between them.
  if (oauthError === 'org_internal') {
    return redirectWithError(url, null, 'pool_only');
  }
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
    // ── WAVE 9 · the PLATFORM (pool channel) branch ─────────────────────────
    // Setnayan's own channel has no event_id, so its CSRF nonce cannot live in
    // `oauth_state` (event_id is NOT NULL REFERENCES events). It lives in
    // `live_studio_channel_oauth_state` instead, and this is where that flow
    // rejoins. Placed AFTER the per-event lookup and reached only where the
    // route already returned an error, so the couple-BYO path is byte-for-byte
    // unchanged: a per-event state always matches above and never gets here.
    // A pool state row exists only if the admin-gated, flag-gated
    // /api/oauth/youtube/pool/start created one.
    const pool = await completePoolChannelConnect({ admin, code, state, url });
    if (pool) return pool;
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
  const config = await getYoutubeOAuthConfig();
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
        // RA 10173 erasure attribution (migration 20271009200000) — the account
        // that completed this consent. This grant is the clearest case for the
        // column: `external_account_display` here is a YouTube CHANNEL TITLE,
        // which identifies no Setnayan account at all, so nothing else on the
        // row can tell erasure whose credential it is. See the column COMMENT.
        granted_by_user_id: (stateRow.initiated_by as string | null) ?? null,
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

  const target = new URL(`/dashboard/${eventId}/studio/panood`, url);
  target.searchParams.set('youtube_connected', '1');
  return NextResponse.redirect(target);
}
