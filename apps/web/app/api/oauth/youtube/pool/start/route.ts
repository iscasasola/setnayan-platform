import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdminAction } from '@/lib/admin/require-admin';
import { liveStudioRoamEnabled } from '@/lib/live-studio-roam';
import {
  buildYoutubeAuthorizeUrl,
  generateYoutubeStateToken,
  getYoutubeOAuthConfig,
} from '@/lib/panood-youtube';

/**
 * WAVE 9 — start the PLATFORM-LEVEL (pool channel) YouTube OAuth flow.
 * Live_Studio_Unified_Spec_2026-07-25.md § 4h.
 *
 * GET /api/oauth/youtube/pool/start[?channel_pool_id=<id>]
 *
 * This is the OWNER connecting SETNAYAN'S OWN YouTube account, once — not a couple
 * connecting theirs. Because only Setnayan's account ever authorises, the consent
 * screen can be **Internal**, which is what removes the Google app-verification
 * requirement entirely (the wall hit 2026-07-25).
 *
 * `channel_pool_id` present → RE-CONNECT that existing pool channel (repair a
 * `needs_reauth`). The callback then refuses if Google hands back a DIFFERENT
 * channel, so a slip of the account picker cannot silently repoint a pool row at
 * someone else's YouTube.
 * Absent → connect a NEW channel; the callback creates its pool row from whatever
 * channel Google reports.
 *
 * ── WHY IT REUSES THE PER-EVENT REDIRECT URI ───────────────────────────────
 * Google matches `redirect_uri` exactly against the values registered on the OAuth
 * client. A second route would mean a second registration the owner has to
 * remember — one more manual step between here and a working broadcast. So this
 * flow returns to the SAME `/api/oauth/youtube/callback`, which disambiguates on
 * the state token (per-event states live in `oauth_state`, pool states in
 * `live_studio_channel_oauth_state`; both are 48 hex chars of CSPRNG, so a
 * mis-route is not a thing that can happen).
 *
 * ADMIN ONLY, and flag-gated: a pool channel is platform infrastructure.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function boardUrl(req: NextRequest, params: Record<string, string>): URL {
  const url = new URL('/admin/live-studio-channels', req.nextUrl.origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url;
}

export async function GET(req: NextRequest) {
  // Throws 'Forbidden' for an authenticated non-admin, redirects an anonymous
  // caller to /login. The action variant is right here: this is a GET but it is a
  // mutation trigger, not a page.
  const { userId } = await requireAdminAction();

  if (!liveStudioRoamEnabled()) {
    return NextResponse.redirect(boardUrl(req, { error: 'live_studio_disabled' }));
  }

  const config = await getYoutubeOAuthConfig();
  if (!config.ready) {
    return NextResponse.redirect(
      boardUrl(req, { error: `not_configured:${config.missing.join(',')}` }),
    );
  }

  const raw = req.nextUrl.searchParams.get('channel_pool_id');
  const channelPoolId = raw ? Number(raw) : null;
  if (raw && (!Number.isInteger(channelPoolId) || (channelPoolId as number) <= 0)) {
    return NextResponse.redirect(boardUrl(req, { error: 'bad_channel_pool_id' }));
  }

  const state = generateYoutubeStateToken();
  const admin = createAdminClient();
  const { error } = await admin.from('live_studio_channel_oauth_state').insert({
    state_token: state,
    channel_pool_id: channelPoolId,
    initiated_by: userId,
  });
  if (error) {
    return NextResponse.redirect(
      boardUrl(req, { error: `state_failed:${error.message.slice(0, 64)}` }),
    );
  }

  return NextResponse.redirect(
    buildYoutubeAuthorizeUrl({
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      state,
    }),
  );
}
