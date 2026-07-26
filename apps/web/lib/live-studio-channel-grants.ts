import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getYoutubeOAuthConfig,
  refreshYoutubeAccessToken,
  revokeYoutubeToken,
} from '@/lib/panood-youtube';

/**
 * apps/web/lib/live-studio-channel-grants.ts
 *
 * ⭐ WAVE 9 — THE PLATFORM-LEVEL (channel-keyed) YouTube OAuth GRANT.
 * Owner-confirmed 2026-07-26 · Live_Studio_Unified_Spec_2026-07-25.md § 4h.
 *
 * ── THE MODEL, IN ONE LINE ─────────────────────────────────────────────────
 * ONE Setnayan YouTube account, connected ONCE by the owner. Every event streams
 * on a Setnayan-owned channel drawn from `live_studio_roam_channel_pool`. The
 * couple NEVER authorises Google, never owns a channel, never sees a token.
 *
 * ── WHY THAT SHAPE, AND NOT BYO ────────────────────────────────────────────
 * Because only Setnayan's own account authorises, the Google consent screen can
 * be **Internal** — and an Internal consent screen needs **no Google app
 * verification at all**. The brand/scope verification wall hit 2026-07-25
 * evaporates. Couple-BYO would force External + verification (weeks) AND impose
 * YouTube's ~24-hour first-stream wait on EVERY couple, so a couple buying the
 * day before their wedding simply could not stream.
 *
 * ── HOW THIS DIFFERS FROM THE BYO GRANT (lib/panood-broadcast.ts) ───────────
 *   BYO      · `oauth_grants`, keyed (event_id, provider). ONE event, the
 *              couple's OWN channel, readable by that couple under RLS.
 *   PLATFORM · `live_studio_channel_grants`, keyed channel_pool_id. MANY events
 *              over the channel's life, a SETNAYAN channel, readable by NOBODY
 *              except the service role (that table has RLS on and no policy).
 *
 * Both are deliberately alive at once. The BYO path is what the legacy Cast room
 * sells today; nothing here touches it. See the migration header for the three
 * concrete reasons `oauth_grants` could not host this grant.
 *
 * ── SECURITY POSTURE ───────────────────────────────────────────────────────
 * These tokens control a channel OTHER COUPLES' ceremonies also stream on, so
 * they are platform credentials, not user data:
 *   • `server-only` — this module can never be pulled into a client bundle.
 *   • every function takes a SERVICE-ROLE client as a parameter; there is no
 *     session-client path to a row.
 *   • no function returns a refresh_token to a caller. `PoolChannelGrantView`
 *     (the shape the admin board renders) has no token field at all — you cannot
 *     accidentally render one.
 *   • nothing here logs a token, an error body from the token endpoint, or a
 *     channel id at error level.
 */

import 'server-only';

/** Refresh when the access token is missing or within 5 minutes of expiry. */
const TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

const UNDEFINED_TABLE = '42P01';

export type ChannelGrantHealth = 'ok' | 'needs_reauth';

/**
 * The grant as the ADMIN BOARD sees it — deliberately token-free. Adding
 * `refresh_token` to this type is the one edit that turns a credential store into
 * a credential leak, so it is not here and there is no variant that has it.
 */
export type PoolChannelGrantView = {
  channelPoolId: number;
  youtubeChannelId: string;
  scopes: string[];
  /** Whether a usable (non-revoked) grant exists at all. */
  connected: boolean;
  health: ChannelGrantHealth;
  displayName: string | null;
  grantedAt: string | null;
  revokedAt: string | null;
  lastRefreshedAt: string | null;
  accessTokenExpiresAt: string | null;
};

type GrantRow = {
  id: number;
  channel_pool_id: number;
  youtube_channel_id: string;
  scopes: string[] | null;
  refresh_token: string;
  access_token: string | null;
  access_token_expires_at: string | null;
  external_account_display: string | null;
  connection_health: string | null;
  granted_at: string | null;
  revoked_at: string | null;
  last_refreshed_at: string | null;
};

const GRANT_SELECT =
  'id, channel_pool_id, youtube_channel_id, scopes, access_token_expires_at, external_account_display, connection_health, granted_at, revoked_at, last_refreshed_at';

/** The token-bearing select. Only `getPoolChannelAccessToken` and revoke use it. */
const GRANT_SELECT_WITH_SECRETS = `${GRANT_SELECT}, refresh_token, access_token`;

function toView(row: GrantRow): PoolChannelGrantView {
  const health: ChannelGrantHealth = row.connection_health === 'needs_reauth' ? 'needs_reauth' : 'ok';
  return {
    channelPoolId: row.channel_pool_id,
    youtubeChannelId: row.youtube_channel_id,
    scopes: Array.isArray(row.scopes) ? row.scopes : [],
    connected: !row.revoked_at,
    health,
    displayName: row.external_account_display,
    grantedAt: row.granted_at,
    revokedAt: row.revoked_at,
    lastRefreshedAt: row.last_refreshed_at,
    accessTokenExpiresAt: row.access_token_expires_at,
  };
}

/**
 * Every pool channel's grant, token-free, keyed by channel_pool_id — one query for
 * the admin board rather than one per row. Empty map on a pre-migration database.
 */
export async function fetchPoolChannelGrants(
  admin: SupabaseClient,
): Promise<Map<number, PoolChannelGrantView>> {
  const out = new Map<number, PoolChannelGrantView>();
  try {
    const { data, error } = await admin.from('live_studio_channel_grants').select(GRANT_SELECT);
    if (error) return out; // includes 42P01 on a pre-migration DB
    for (const row of (data ?? []) as GrantRow[]) {
      out.set(row.channel_pool_id, toView(row));
    }
    return out;
  } catch {
    return out;
  }
}

/**
 * ⭐ THE TOKEN ACCESSOR — an access token for the pool CHANNEL (not an event).
 *
 * Mirrors `getEventYoutubeAccessToken` (lib/panood-broadcast.ts) verb for verb —
 * cached token if it is still fresh, otherwise refresh and write back, otherwise
 * flag `needs_reauth` so the admin board can show a Reconnect button rather than
 * a provisioning run failing silently every time.
 *
 * Returns null when: no grant, the grant is revoked, the Google client env is
 * unset, or Google rejected the refresh token. A null here is what makes the
 * couple-facing readiness state say "not ready" honestly instead of pretending.
 */
export async function getPoolChannelAccessToken(
  admin: SupabaseClient,
  channelPoolId: number,
): Promise<string | null> {
  if (!Number.isFinite(channelPoolId)) return null;
  let grant: GrantRow | null = null;
  try {
    const { data, error } = await admin
      .from('live_studio_channel_grants')
      .select(GRANT_SELECT_WITH_SECRETS)
      .eq('channel_pool_id', channelPoolId)
      .maybeSingle();
    if (error) return null;
    grant = (data as GrantRow | null) ?? null;
  } catch {
    return null;
  }
  if (!grant || grant.revoked_at) return null;

  const expiresAt = grant.access_token_expires_at
    ? new Date(grant.access_token_expires_at).getTime()
    : 0;
  if (grant.access_token && expiresAt > Date.now() + TOKEN_REFRESH_THRESHOLD_MS) {
    return grant.access_token;
  }

  const cfg = await getYoutubeOAuthConfig();
  if (!cfg.ready) return null;

  try {
    const refreshed = await refreshYoutubeAccessToken({
      refreshToken: grant.refresh_token,
      clientId: cfg.clientId,
      clientSecret: cfg.clientSecret,
    });
    await admin
      .from('live_studio_channel_grants')
      .update({
        access_token: refreshed.access_token,
        access_token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        last_refreshed_at: new Date().toISOString(),
        connection_health: 'ok',
        updated_at: new Date().toISOString(),
      })
      .eq('id', grant.id);
    return refreshed.access_token;
  } catch {
    // Google rejected the refresh token (revoked in Setnayan's own Google security
    // settings, or a password change). Surface it — a pool channel whose grant has
    // died must stop reading as "ready to broadcast".
    await admin
      .from('live_studio_channel_grants')
      .update({ connection_health: 'needs_reauth', updated_at: new Date().toISOString() })
      .eq('id', grant.id);
    return null;
  }
}

/**
 * Persist a freshly-consented grant for a pool channel. Called ONLY from the OAuth
 * callback. Upsert on `channel_pool_id` so a re-consent (repairing a
 * `needs_reauth`) replaces in place and resurrects `revoked_at`.
 */
export async function upsertPoolChannelGrant(
  admin: SupabaseClient,
  input: {
    channelPoolId: number;
    youtubeChannelId: string;
    refreshToken: string;
    accessToken: string;
    expiresInSeconds: number;
    scopes: string[];
    displayName: string | null;
    thumbnailUrl?: string | null;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const nowIso = new Date().toISOString();
  const { error } = await admin.from('live_studio_channel_grants').upsert(
    {
      channel_pool_id: input.channelPoolId,
      youtube_channel_id: input.youtubeChannelId,
      scopes: input.scopes,
      refresh_token: input.refreshToken,
      access_token: input.accessToken,
      access_token_expires_at: new Date(Date.now() + input.expiresInSeconds * 1000).toISOString(),
      external_account_display: input.displayName,
      connection_health: 'ok',
      granted_at: nowIso,
      revoked_at: null,
      last_refreshed_at: nowIso,
      metadata: input.thumbnailUrl ? { thumbnail_url: input.thumbnailUrl } : {},
      updated_at: nowIso,
    },
    { onConflict: 'channel_pool_id' },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Disconnect a pool channel: tell Google to revoke, then mark the row revoked and
 * DROP BOTH TOKENS.
 *
 * Deleting the token text rather than only stamping `revoked_at` is deliberate —
 * a revoked row that still carries a live-looking refresh token is a credential
 * sitting in a table for no reason, and `revoked_at` is only a filter until
 * somebody writes a query that forgets it. Google's revoke is best-effort (it
 * 400s on an already-revoked token); our own row is the source of truth for
 * whether we will ever use it again.
 */
export async function revokePoolChannelGrant(
  admin: SupabaseClient,
  channelPoolId: number,
): Promise<boolean> {
  try {
    const { data, error } = await admin
      .from('live_studio_channel_grants')
      .select('id, refresh_token')
      .eq('channel_pool_id', channelPoolId)
      .maybeSingle();
    if (error || !data) return false;
    const row = data as { id: number; refresh_token: string };
    await revokeYoutubeToken(row.refresh_token);
    const { error: upErr } = await admin
      .from('live_studio_channel_grants')
      .update({
        // NOT NULL, so it is blanked rather than nulled — same effect, no schema change.
        refresh_token: '',
        access_token: null,
        access_token_expires_at: null,
        revoked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);
    return !upErr;
  } catch {
    return false;
  }
}

/**
 * The refresh sweep for platform grants, called by /api/cron/oauth-refresh
 * alongside its existing `oauth_grants` pass.
 *
 * REUSED rather than forked: the same worker, the same cadence, the same secret.
 * A second cron route would be a second thing to schedule and a second thing to
 * forget. Returns counts; never throws (a pre-migration database reports zeroes).
 */
export async function refreshPoolChannelGrants(
  admin: SupabaseClient,
  opts?: { horizonMs?: number; limit?: number },
): Promise<{ scanned: number; refreshed: number; failed: number; skipped: number }> {
  const summary = { scanned: 0, refreshed: 0, failed: 0, skipped: 0 };
  const horizon = new Date(Date.now() + (opts?.horizonMs ?? 24 * 60 * 60 * 1000)).toISOString();
  let rows: GrantRow[] = [];
  try {
    const { data, error } = await admin
      .from('live_studio_channel_grants')
      .select(GRANT_SELECT_WITH_SECRETS)
      .is('revoked_at', null)
      .or(`access_token_expires_at.is.null,access_token_expires_at.lt.${horizon}`)
      .limit(opts?.limit ?? 50);
    if (error) {
      if (error.code === UNDEFINED_TABLE) return summary; // pre-migration DB
      return summary;
    }
    rows = (data ?? []) as GrantRow[];
  } catch {
    return summary;
  }
  summary.scanned = rows.length;
  if (rows.length === 0) return summary;

  const cfg = await getYoutubeOAuthConfig();
  if (!cfg.ready) {
    summary.skipped = rows.length;
    return summary;
  }

  for (const row of rows) {
    // A blanked token belongs to a revoked-then-resurrected edge; nothing to refresh.
    if (!row.refresh_token) {
      summary.skipped += 1;
      continue;
    }
    try {
      const refreshed = await refreshYoutubeAccessToken({
        refreshToken: row.refresh_token,
        clientId: cfg.clientId,
        clientSecret: cfg.clientSecret,
      });
      await admin
        .from('live_studio_channel_grants')
        .update({
          access_token: refreshed.access_token,
          access_token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
          last_refreshed_at: new Date().toISOString(),
          connection_health: 'ok',
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      summary.refreshed += 1;
    } catch {
      await admin
        .from('live_studio_channel_grants')
        .update({ connection_health: 'needs_reauth', updated_at: new Date().toISOString() })
        .eq('id', row.id);
      summary.failed += 1;
    }
  }
  return summary;
}
