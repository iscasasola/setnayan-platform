import 'server-only';

/**
 * oauth-refresh-sweep.ts — the Google grant refresh, as a JOB rather than a
 * route nobody calls.
 *
 * ─── WHY THIS FILE EXISTS ────────────────────────────────────────────────
 * The work below has lived in `app/api/cron/oauth-refresh/route.ts` since
 * iteration 0011, behind `OAUTH_REFRESH_CRON_SECRET`, under its own TODO:
 *
 *     // TODO(0011): wire the actual cron schedule.
 *     // the actual scheduling is an owner-side task.
 *
 * 🔑 THAT SCHEDULE WAS NEVER GOING TO ARRIVE, BECAUSE THIS REPO HAS NO
 * SCHEDULER BY DESIGN. `vercel.json` carries `"crons": []` and `cron.job` is
 * empty; all twenty-two periodic jobs ride request traffic through
 * `claim_periodic_job`. A route waiting for a cron was waiting for a mechanism
 * the project had decided not to have.
 *
 * ─── WHAT IT COST, MEASURED ON PRODUCTION 2026-09-18 ─────────────────────
 *     oauth_grants                2 rows · 2 refresh tokens · 2 access tokens EXPIRED
 *                                 (one since 2026-07-10, one since 2026-08-31)
 *     live_studio_channel_grants  3 rows · 3 refresh tokens · 3 access tokens EXPIRED
 *                                 (all since 2026-09-02)
 *
 * Five live Google connections — a couple's YouTube and Drive, and all three
 * Live Studio pool channels — with every access token long dead and nothing
 * renewing them. A couple finds out on the wedding day.
 *
 * 🔒 AND IT IS WHY NOTHING IS SEALED. This sweep is the only writer that calls
 * `sealToken`. The vault shipped on 13 September and has encrypted **zero
 * production rows**, because the one thing that would have written a sealed
 * value has never run. All five refresh tokens still match `1//%` — Google
 * plaintext — so they are readable text in every backup.
 *
 * ⚠ Registering this job does NOT retro-seal them. It seals each ACCESS token
 * as it refreshes; the five REFRESH tokens stay as they are until a backfill
 * opens and re-seals them. That is a separate change and is named here rather
 * than implied.
 *
 * The route keeps its secret and its JSON — an owner-side cron, if one ever
 * appears, still works. It just is no longer the only way this runs.
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getYoutubeOAuthConfig,
  refreshYoutubeAccessToken,
} from '@/lib/panood-youtube';
import {
  getDriveOAuthConfig,
  refreshDriveAccessToken,
} from '@/lib/papic-drive';
import { refreshPoolChannelGrants } from '@/lib/live-studio-channel-grants';
import { openStoredToken, sealToken } from '@/lib/oauth-token-vault';

export type RefreshSummary = {
  scanned: number;
  refreshed: number;
  failed: number;
  skipped: number;
  details: Array<{
    grant_id: string;
    provider: string;
    status: 'refreshed' | 'failed' | 'skipped';
    reason?: string;
  }>;
};

export type OAuthRefreshResult = RefreshSummary & {
  poolChannels: Awaited<ReturnType<typeof refreshPoolChannelGrants>>;
};

/**
 * Refresh every grant inside 24h of expiry, then the pool channels.
 *
 * ⚖ NEVER THROWS past its own error return — it runs inside `after()` on the
 * home page, where a throw is an unhandled rejection on somebody's page view.
 */
export async function runOAuthRefreshSweep(): Promise<OAuthRefreshResult | { error: string }> {
  const admin = createAdminClient();
  const horizon = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data: grants, error } = await admin
    .from('oauth_grants')
    .select(
      'grant_id, event_id, provider, refresh_token, access_token_expires_at',
    )
    .is('revoked_at', null)
    .or(`access_token_expires_at.is.null,access_token_expires_at.lt.${horizon}`)
    .limit(200);
  // Returned, not thrown: the caller decides whether that is a 500 or a
  // logged job failure.
  if (error) return { error: `query failed: ${error.message}` };

  const summary: RefreshSummary = {
    scanned: grants?.length ?? 0,
    refreshed: 0,
    failed: 0,
    skipped: 0,
    details: [],
  };

  for (const grant of grants ?? []) {
    const grantId = grant.grant_id as string;
    const provider = grant.provider as string;
    /*
      🔒 Opened before use. A grant written before sealing existed still holds
      plaintext and passes straight through; an envelope we cannot open is
      skipped rather than sent, because a refresh built from ciphertext is how
      Google is persuaded to revoke a grant that was perfectly healthy.
    */
    const refreshToken = openStoredToken(grant.refresh_token as string | null);
    if (!refreshToken) {
      summary.skipped += 1;
      summary.details.push({ grant_id: grantId, provider, status: 'skipped', reason: 'token_unopenable' });
      continue;
    }

    // Per-provider config + refresh dispatch. Both Google providers use
    // the same OAuth token endpoint (oauth2.googleapis.com/token) so the
    // refresh helpers differ only in which env-driven client_id/secret
    // they pass through.
    let refreshed: { access_token: string; expires_in: number } | null = null;
    let skipReason: string | null = null;
    let failReason: string | null = null;

    if (provider === 'youtube') {
      const config = await getYoutubeOAuthConfig();
      if (!config.ready) {
        skipReason = 'youtube_oauth_not_configured';
      } else {
        try {
          refreshed = await refreshYoutubeAccessToken({
            refreshToken,
            clientId: config.clientId,
            clientSecret: config.clientSecret,
          });
        } catch (e) {
          failReason = (e as Error).message.slice(0, 128);
        }
      }
    } else if (provider === 'drive') {
      const config = await getDriveOAuthConfig();
      if (!config.ready) {
        skipReason = 'drive_oauth_not_configured';
      } else {
        try {
          refreshed = await refreshDriveAccessToken({
            refreshToken,
            clientId: config.clientId,
            clientSecret: config.clientSecret,
          });
        } catch (e) {
          failReason = (e as Error).message.slice(0, 128);
        }
      }
    } else {
      // tiktok grants still live in patiktok_oauth_grants for V1 (see
      // 20260516240000_iteration_0017_patiktok_oauth.sql + its own
      // refresh sweep). If a 'tiktok' row ever lands in oauth_grants
      // before consolidation, skip it here so we don't blow up.
      skipReason = 'provider_not_yet_implemented';
    }

    if (skipReason) {
      summary.skipped += 1;
      summary.details.push({
        grant_id: grantId,
        provider,
        status: 'skipped',
        reason: skipReason,
      });
      continue;
    }

    if (failReason || !refreshed) {
      summary.failed += 1;
      summary.details.push({
        grant_id: grantId,
        provider,
        status: 'failed',
        reason: failReason ?? 'no_refresh_response',
      });
      continue;
    }

    const expiresAt = new Date(
      Date.now() + refreshed.expires_in * 1000,
    ).toISOString();
    await admin
      .from('oauth_grants')
      .update({
        access_token: sealToken(refreshed.access_token),
        access_token_expires_at: expiresAt,
        last_refreshed_at: new Date().toISOString(),
      })
      .eq('grant_id', grantId);
    summary.refreshed += 1;
    summary.details.push({
      grant_id: grantId,
      provider,
      status: 'refreshed',
    });
  }

  // ── WAVE 9 · the PLATFORM (Setnayan channel pool) grants ────────────────────
  // Reused rather than forked: same worker, same cadence, same secret. A second
  // cron route would be a second thing to schedule and a second thing to forget —
  // and a pool channel whose access token silently went stale is a wedding that
  // cannot provision its broadcasts. Its own module owns the sweep; it never
  // throws and reports zeroes on a pre-migration database, so it cannot break the
  // existing oauth_grants pass above.
  const poolChannels = await refreshPoolChannelGrants(admin);

  return { ...summary, poolChannels };
}
