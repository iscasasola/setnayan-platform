import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  bootstrapPapicDriveFolders,
  exchangeDriveCodeForToken,
  fetchDriveUserInfo,
  getDriveOAuthConfig,
} from '@/lib/papic-drive';

// Iteration 0012 Papic — Google Drive OAuth callback.
//
// GET /api/oauth/drive/callback?code=<code>&state=<state>
//
// 1. Looks up the persisted state row (recovering event_id + initiated_by)
//    and deletes it regardless of outcome — state tokens are single-use.
// 2. Exchanges the authorization code for refresh + access tokens.
// 3. Fetches the connected Google account info (best-effort) for the
//    display label on the oauth_grants row.
// 4. Bootstraps the Setnayan folder structure inside the couple's Drive:
//      Setnayan/
//        [Event display_name]/
//          00_Cover/ 01_Pre-event/ 02_Ceremony/ 03_Reception/ 04_Auto-Recap/
//    The Papic capture pipeline (TODO(0012)) will read the resulting
//    folder id from oauth_grants.metadata.drive_folder_id to know where
//    to write photos.
// 5. Upserts public.oauth_grants keyed by (event_id, provider='drive').
//    Replaces any existing row in place; the unique constraint enforces a
//    single grant per (event, provider).
// 6. Redirects back to the Papic setup page with ?drive_connected=1 or
//    ?drive_error=<reason> so the UI can render a status banner.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATE_TTL_MIN = 10;

// Phase 0: this callback serves both the Papic Drive connect (returnTo='papic')
// and the Photo Delivery connect (returnTo='photo-delivery'). The return target
// is recovered from the oauth_state provider marker.
type ReturnTo = 'papic' | 'photo-delivery';

function pagePath(returnTo: ReturnTo, eventId: string): string {
  return `/dashboard/${eventId}/add-ons/${returnTo}`;
}

function redirectWithError(
  origin: URL,
  eventId: string | null,
  reason: string,
  returnTo: ReturnTo = 'papic',
): NextResponse {
  const target = eventId
    ? new URL(pagePath(returnTo, eventId), origin)
    : new URL('/dashboard', origin);
  // Papic page reads ?drive_error=; the Photo Delivery panel reads ?error=.
  target.searchParams.set(returnTo === 'photo-delivery' ? 'error' : 'drive_error', reason);
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
  //    Phase 0 consolidation: this callback now serves BOTH the Papic Drive
  //    connect (state provider='drive') and the Photo Delivery connect (state
  //    provider='drive_photo_delivery' — a return-page marker only; the grant
  //    we write is always provider='drive'). One consent, one redirect URI,
  //    one grant.
  const { data: stateRow } = await admin
    .from('oauth_state')
    .select('state_token, event_id, provider, initiated_by, created_at')
    .eq('state_token', state)
    .in('provider', ['drive', 'drive_photo_delivery'])
    .maybeSingle();
  if (!stateRow) {
    return redirectWithError(url, null, 'state_not_found');
  }
  const eventId = stateRow.event_id as string;
  const returnTo: ReturnTo =
    stateRow.provider === 'drive_photo_delivery' ? 'photo-delivery' : 'papic';
  const createdAt = new Date(stateRow.created_at as string).getTime();
  const ageMin = (Date.now() - createdAt) / 60_000;
  await admin.from('oauth_state').delete().eq('state_token', state);
  if (ageMin > STATE_TTL_MIN) {
    return redirectWithError(url, eventId, 'state_expired', returnTo);
  }

  // 2. Config sanity-check (should never fail if /start succeeded, but
  //    defend against rotation between start + callback).
  const config = getDriveOAuthConfig();
  if (!config.ready) {
    return redirectWithError(url, eventId, 'not_configured', returnTo);
  }

  // 3. Exchange code -> tokens
  let token;
  try {
    token = await exchangeDriveCodeForToken({
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
      returnTo,
    );
  }

  if (!token.refresh_token) {
    // With prompt=consent forced, Google should always return one. If we
    // don't get one, surface a clear error instead of silently persisting
    // a grant that we won't be able to refresh later.
    return redirectWithError(url, eventId, 'no_refresh_token', returnTo);
  }

  // 4. Fetch user info (best-effort — failure here doesn't block the
  //    grant write, since the refresh_token alone is enough to write to
  //    Drive).
  const userInfo = await fetchDriveUserInfo(token.access_token);

  // 5. Look up event display_name for the folder name. The events table
  //    is RLS-scoped but the admin client bypasses RLS — safe here since
  //    we already verified couple membership in /start.
  const { data: eventRow } = await admin
    .from('events')
    .select('display_name')
    .eq('event_id', eventId)
    .maybeSingle();
  const eventDisplayName =
    (eventRow?.display_name as string | undefined) ?? 'Wedding';

  // 6. Bootstrap the Drive folder structure. If this fails (most likely
  //    cause: Drive API quota, transient), redirect with an error — the
  //    grant write isn't attempted, so the next retry starts fresh. We
  //    do NOT persist a partial grant because the capture pipeline
  //    depends on metadata.drive_folder_id being present.
  let folderTree;
  try {
    folderTree = await bootstrapPapicDriveFolders({
      accessToken: token.access_token,
      eventDisplayName,
    });
  } catch (e) {
    return redirectWithError(
      url,
      eventId,
      `folder_bootstrap_failed:${(e as Error).message.slice(0, 64)}`,
      returnTo,
    );
  }

  // 7. Upsert the grant. Unique (event_id, provider) guarantees one row
  //    per Drive account; passing onConflict so a re-consent replaces in
  //    place and resurrects any prior `revoked_at`.
  const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();
  const metadata: Record<string, unknown> = {
    drive_folder_id: folderTree.rootFolderId,
    drive_folder_name: folderTree.rootFolderName,
    drive_subfolders: folderTree.subfolders,
  };
  if (userInfo?.picture) {
    metadata.picture_url = userInfo.picture;
  }
  if (userInfo?.name) {
    metadata.account_name = userInfo.name;
  }
  const { error: upsertError } = await admin
    .from('oauth_grants')
    .upsert(
      {
        event_id: eventId,
        provider: 'drive',
        scopes: token.scope ? token.scope.split(' ') : [],
        refresh_token: token.refresh_token,
        access_token: token.access_token,
        access_token_expires_at: expiresAt,
        external_account_id: userInfo?.id ?? null,
        external_account_display: userInfo?.email ?? 'Connected Drive',
        granted_at: new Date().toISOString(),
        revoked_at: null,
        last_refreshed_at: new Date().toISOString(),
        metadata,
      },
      { onConflict: 'event_id,provider' },
    );

  if (upsertError) {
    return redirectWithError(
      url,
      eventId,
      `persist_failed:${upsertError.message.slice(0, 64)}`,
      returnTo,
    );
  }

  // Phase 0: mirror the Photo Delivery panel-facing fields so a single Drive
  // connect lights up BOTH Papic and Photo Delivery. The release worker reads
  // events.photo_delivery_folder_id; point it at the connected folder root.
  await admin
    .from('events')
    .update({
      photo_delivery_provider: 'google_drive',
      photo_delivery_folder_id: folderTree.rootFolderId,
      photo_delivery_folder_name: folderTree.rootFolderName,
      photo_delivery_account_email: userInfo?.email ?? null,
      photo_delivery_oauth_expires_at: expiresAt,
      photo_delivery_status: 'connected',
    })
    .eq('event_id', eventId);

  const target = new URL(pagePath(returnTo, eventId), url);
  target.searchParams.set(
    returnTo === 'photo-delivery' ? 'connected' : 'drive_connected',
    '1',
  );
  return NextResponse.redirect(target);
}
