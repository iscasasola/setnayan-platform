import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  exchangeDriveCodeForToken,
  fetchDriveUserInfo,
} from '@/lib/papic-drive';
import {
  buildPhotoDeliveryFolderName,
  createPhotoDeliveryFolder,
  getPhotoDeliveryOAuthConfig,
} from '@/lib/photo-delivery-drive';

// Iteration 0009 Photo Delivery — Google Drive OAuth callback.
//
// GET /api/oauth/photo-delivery/callback?code=<code>&state=<state>
//
// Mirrors Papic's /api/oauth/drive/callback. Differences:
//   - Looks up state with provider='drive_photo_delivery'.
//   - Creates ONE flat folder (no Papic subfolder tree).
//   - Persists folder pointer + account email to events.photo_delivery_*
//     and flips events.photo_delivery_status='connected'.
//   - Upserts oauth_grants with provider='drive_photo_delivery' so the
//     shared cron refresh worker (/api/cron/oauth-refresh) can sweep
//     these tokens uniformly once it's extended to know about the new
//     provider value (follow-up; not in this PR).
//   - Redirects back to /dashboard/[eventId]/add-ons/photo-delivery
//     with ?connected=1 or ?error=<reason>.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATE_TTL_MIN = 10;

function redirectWithError(
  origin: URL,
  eventId: string | null,
  reason: string,
): NextResponse {
  const target = eventId
    ? new URL(`/dashboard/${eventId}/add-ons/photo-delivery`, origin)
    : new URL('/dashboard', origin);
  target.searchParams.set('error', reason);
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

  // 1. State row lookup (single-use; delete after read regardless of outcome).
  const { data: stateRow } = await admin
    .from('oauth_state')
    .select('state_token, event_id, provider, initiated_by, created_at')
    .eq('state_token', state)
    .eq('provider', 'drive_photo_delivery')
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

  // 2. Config sanity-check.
  const config = getPhotoDeliveryOAuthConfig();
  if (!config.ready) {
    return redirectWithError(url, eventId, 'not_configured');
  }

  // 3. Exchange code -> tokens.
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
    );
  }
  if (!token.refresh_token) {
    return redirectWithError(url, eventId, 'no_refresh_token');
  }

  // 4. User info (best-effort).
  const userInfo = await fetchDriveUserInfo(token.access_token);

  // 5. Look up event display_name + event_date for the folder label.
  const { data: eventRow } = await admin
    .from('events')
    .select('display_name, event_date')
    .eq('event_id', eventId)
    .maybeSingle();
  const displayName =
    (eventRow?.display_name as string | undefined) ?? 'Wedding';
  const eventDate = (eventRow?.event_date as string | null | undefined) ?? null;
  const folderName = buildPhotoDeliveryFolderName({ displayName, eventDate });

  // 6. Create the single Photo Delivery folder.
  let folder;
  try {
    folder = await createPhotoDeliveryFolder({
      accessToken: token.access_token,
      folderName,
    });
  } catch (e) {
    return redirectWithError(
      url,
      eventId,
      `folder_create_failed:${(e as Error).message.slice(0, 64)}`,
    );
  }

  // 7. Upsert oauth_grants for the shared refresh + revoke surface.
  const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();
  const metadata: Record<string, unknown> = {
    drive_folder_id: folder.folderId,
    drive_folder_name: folder.folderName,
  };
  if (userInfo?.name) metadata.account_name = userInfo.name;
  if (userInfo?.picture) metadata.picture_url = userInfo.picture;

  const { error: upsertError } = await admin
    .from('oauth_grants')
    .upsert(
      {
        event_id: eventId,
        provider: 'drive_photo_delivery',
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
    );
  }

  // 8. Mirror the panel-facing fields onto events so the dashboard page
  //    can render without joining oauth_grants. Status flips to 'connected'.
  const { error: eventUpdateError } = await admin
    .from('events')
    .update({
      photo_delivery_provider: 'google_drive',
      photo_delivery_folder_id: folder.folderId,
      photo_delivery_folder_name: folder.folderName,
      photo_delivery_account_email: userInfo?.email ?? null,
      photo_delivery_oauth_expires_at: expiresAt,
      photo_delivery_status: 'connected',
    })
    .eq('event_id', eventId);
  if (eventUpdateError) {
    return redirectWithError(
      url,
      eventId,
      `event_update_failed:${eventUpdateError.message.slice(0, 64)}`,
    );
  }

  const target = new URL(
    `/dashboard/${eventId}/add-ons/photo-delivery`,
    url,
  );
  target.searchParams.set('connected', '1');
  return NextResponse.redirect(target);
}
