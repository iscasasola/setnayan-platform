import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getYoutubeOAuthConfig,
  refreshYoutubeAccessToken,
} from '@/lib/panood-youtube';
import {
  getDriveOAuthConfig,
  refreshDriveAccessToken,
} from '@/lib/papic-drive';

// OAuth refresh worker — shared by Panood (youtube) + Papic (drive).
//
// POST /api/cron/oauth-refresh
// Header: x-cron-secret: <OAUTH_REFRESH_CRON_SECRET>
//
// Walks `oauth_grants` rows with access_token_expires_at < now() + 24h AND
// revoked_at IS NULL, refreshes each via the provider's token endpoint,
// and updates the row in place. Designed to run hourly via Cloudflare /
// Supabase pg_cron — the actual scheduling is an owner-side task.
//
// 2026-05-16 update: Drive provider branch wired (Agent B, iteration 0012).
// Both Google providers (youtube, drive) call the same Google OAuth token
// endpoint but use SEPARATE env vars / client credentials so they can be
// rotated independently. The branch below dispatches by provider string.
//
// TODO(0011): wire the actual cron schedule. Recommended cadence: hourly
// from PHT 06:00-23:00 (peak broadcast hours). Lower-priority overnight
// run handles slow drift. The cron-runner must POST with the
// x-cron-secret header matching OAUTH_REFRESH_CRON_SECRET.
//
// TODO(0017, Agent C): tiktok rows live in `patiktok_oauth_grants` for V1;
// either migrate them into oauth_grants or fork a sibling refresh worker.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RefreshSummary = {
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

function timingSafeEqual(a: string, b: string): boolean {
  // Constant-time comparison to avoid timing attacks on the cron secret.
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function POST(req: NextRequest) {
  // --- Auth: x-cron-secret header must match OAUTH_REFRESH_CRON_SECRET ---
  const secret = req.headers.get('x-cron-secret') ?? '';
  const expected = process.env.OAUTH_REFRESH_CRON_SECRET ?? '';
  if (!expected) {
    return NextResponse.json(
      { error: 'OAUTH_REFRESH_CRON_SECRET not configured' },
      { status: 503 },
    );
  }
  if (!secret || !timingSafeEqual(secret, expected)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

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
  if (error) {
    return NextResponse.json(
      { error: `query failed: ${error.message}` },
      { status: 500 },
    );
  }

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
    const refreshToken = grant.refresh_token as string;

    // Per-provider config + refresh dispatch. Both Google providers use
    // the same OAuth token endpoint (oauth2.googleapis.com/token) so the
    // refresh helpers differ only in which env-driven client_id/secret
    // they pass through.
    let refreshed: { access_token: string; expires_in: number } | null = null;
    let skipReason: string | null = null;
    let failReason: string | null = null;

    if (provider === 'youtube') {
      const config = getYoutubeOAuthConfig();
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
      const config = getDriveOAuthConfig();
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
        access_token: refreshed.access_token,
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

  return NextResponse.json(summary, { status: 200 });
}
