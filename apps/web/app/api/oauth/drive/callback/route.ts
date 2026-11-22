import { NextResponse, type NextRequest, after } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runDriveCopyBatch } from '@/lib/drive-copy';
import {
  bootstrapPapicDriveFolders,
  exchangeDriveCodeForToken,
  fetchDriveUserInfo,
  getDriveOAuthConfig,
} from '@/lib/papic-drive';
import { sealToken } from '@/lib/oauth-token-vault';
import {
  DRIVE_COPY_START_PARAM,
  SHOP_DRIVE_BACK_COOKIE,
  SUPPLIER_DRIVE_PROVIDER,
  shopDriveBackPath,
  withParam,
} from '@/lib/supplier-drive-copy';
import { forgetShopDriveCopies } from '@/lib/supplier-drive-copy.server';

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
  return `/dashboard/${eventId}/studio/${returnTo}`;
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
    // ☁️ A supplier who cancelled on Google goes back to the row they pressed Copy on, not the couple's dashboard.
    if (state) {
      const { data: shopState } = await createAdminClient()
        .from('oauth_state')
        .select('event_id, provider')
        .eq('state_token', state)
        .eq('provider', SUPPLIER_DRIVE_PROVIDER)
        .maybeSingle();
      if (shopState) {
        // Single-use either way; a failed delete only leaves a row the 10-minute expiry already refuses.
        const { error: spentErr } = await createAdminClient().from('oauth_state').delete().eq('state_token', state);
        if (spentErr) console.error('[supabase-error] oauth/drive/callback · oauth_state.delete (shop, cancelled)', spentErr);
        return shopRedirect(req, shopState.event_id as string, 'drive_error', oauthError.slice(0, 64));
      }
    }
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
    .select('state_token, event_id, provider, initiated_by, created_at, vendor_profile_id')
    .eq('state_token', state)
    .in('provider', ['drive', 'drive_photo_delivery', 'drive_overflow', SUPPLIER_DRIVE_PROVIDER])
    .maybeSingle();
  if (!stateRow) {
    return redirectWithError(url, null, 'state_not_found');
  }
  const eventId = stateRow.event_id as string;
  // The 2nd Drive (owner 2026-07-11): a 'drive_overflow' state writes a separate
  // grant + does NOT touch events.photo_delivery_folder_id (that points at Drive
  // #1's folder). 'drive_photo_delivery' is a return-page marker only — its grant
  // is still the primary 'drive'.
  const isOverflow = stateRow.provider === 'drive_overflow';
  const grantProvider = isOverflow ? 'drive_overflow' : 'drive';
  const returnTo: ReturnTo =
    stateRow.provider === 'drive_photo_delivery' ? 'photo-delivery' : 'papic';
  const createdAt = new Date(stateRow.created_at as string).getTime();
  const ageMin = (Date.now() - createdAt) / 60_000;
  const { error: stateDeleteErr } = await admin.from('oauth_state').delete().eq('state_token', state);
  // Single-use either way; a failed delete only leaves a row the 10-minute expiry already refuses.
  if (stateDeleteErr) console.error('[supabase-error] oauth/drive/callback · oauth_state.delete', stateDeleteErr);

  // ☁️ A shop's own Drive (owner 2026-11-22, "Copy this event to Google Drive") — its own branch, below.
  if (stateRow.provider === SUPPLIER_DRIVE_PROVIDER) {
    if (ageMin > STATE_TTL_MIN) return shopRedirect(req, eventId, 'drive_error', 'state_expired');
    return connectShopDrive(req, {
      code,
      eventId,
      shopId: stateRow.vendor_profile_id as string,
      userId: (stateRow.initiated_by as string | null) ?? null,
    });
  }

  if (ageMin > STATE_TTL_MIN) {
    return redirectWithError(url, eventId, 'state_expired', returnTo);
  }

  // 2. Config sanity-check (should never fail if /start succeeded, but
  //    defend against rotation between start + callback).
  const config = await getDriveOAuthConfig();
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
  // The PRIMARY Drive bootstraps its Setnayan folder tree here (the capture
  // pipeline reads metadata.drive_folder_id). The OVERFLOW (2nd) Drive skips
  // it — the copy runner's ensureArtifactFolder('drive_overflow') creates that
  // Drive's single folder tree lazily on the first overflow upload, so we don't
  // create a redundant tree here.
  let folderTree: Awaited<ReturnType<typeof bootstrapPapicDriveFolders>> | null =
    null;
  if (!isOverflow) {
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
  }

  // 7. Upsert the grant. Unique (event_id, provider) guarantees one row
  //    per Drive account; passing onConflict so a re-consent replaces in
  //    place and resurrects any prior `revoked_at`.
  const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();
  const metadata: Record<string, unknown> = {};
  if (folderTree) {
    metadata.drive_folder_id = folderTree.rootFolderId;
    metadata.drive_folder_name = folderTree.rootFolderName;
    metadata.drive_subfolders = folderTree.subfolders;
  }
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
        provider: grantProvider,
        scopes: token.scope ? token.scope.split(' ') : [],
        refresh_token: sealToken(token.refresh_token),
        access_token: sealToken(token.access_token),
        access_token_expires_at: expiresAt,
        external_account_id: userInfo?.id ?? null,
        external_account_display: userInfo?.email ?? 'Connected Drive',
        // RA 10173 erasure attribution (migration 20271009200000) — the account
        // that completed this consent. Without it, account deletion cannot
        // prove whose Google credential this is and fails closed, leaving a
        // live cron-refreshed refresh token behind. See the column COMMENT.
        granted_by_user_id: (stateRow.initiated_by as string | null) ?? null,
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
  // OVERFLOW (2nd Drive) is skipped — these fields belong to Drive #1 and must
  // NOT be clobbered by connecting a second Drive.
  if (!isOverflow && folderTree) {
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
  }

  // Drive just connected — flush any pending drive_copy_artifacts (Papic
  // captures taken BEFORE this connect) into the couple's Drive in the
  // background so their "own copy in Drive" lands. Best-effort: never blocks the
  // redirect and swallows its own errors.
  after(() => runDriveCopyBatch({ eventId }).catch(() => {}));

  const target = new URL(pagePath(returnTo, eventId), url);
  target.searchParams.set(
    returnTo === 'photo-delivery' ? 'connected' : 'drive_connected',
    '1',
  );
  return NextResponse.redirect(target);
}

/** Back to the supplier's row (the start's cookie, re-checked), with one query parameter. The cookie is spent. */
function shopRedirect(req: NextRequest, eventId: string, key: string, value: string): NextResponse {
  const back = shopDriveBackPath(req.cookies.get(SHOP_DRIVE_BACK_COOKIE)?.value, eventId);
  const res = NextResponse.redirect(new URL(withParam(back, key, value), req.nextUrl));
  res.cookies.set(SHOP_DRIVE_BACK_COOKIE, '', { path: '/api/oauth/drive', maxAge: 0 });
  return res;
}

/**
 * ☁️ The shop's grant: provider 'drive_supplier', no event, one per shop (oauth_grants_one_drive_per_shop). No folder
 * tree is built here — the copy builds one folder per event when it first copies that event. Connecting a DIFFERENT
 * Google account forgets the old Drive's bookkeeping, so the next copy fills the new Drive instead of skipping every
 * file as "already copied". On success the supplier lands back on the row with `drive_copy=start`, and the copy they
 * pressed for starts there.
 */
async function connectShopDrive(
  req: NextRequest,
  ctx: { code: string; eventId: string; shopId: string; userId: string | null },
): Promise<NextResponse> {
  const fail = (reason: string) => shopRedirect(req, ctx.eventId, 'drive_error', reason);
  const config = await getDriveOAuthConfig();
  if (!config.ready) return fail('not_configured');

  let token;
  try {
    token = await exchangeDriveCodeForToken({
      code: ctx.code,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
    });
  } catch {
    return fail('exchange_failed');
  }
  if (!token.refresh_token) return fail('no_refresh_token');

  const userInfo = await fetchDriveUserInfo(token.access_token);
  const admin = createAdminClient();
  const { data: existing, error: readErr } = await admin
    .from('oauth_grants')
    .select('grant_id, external_account_id, revoked_at')
    .eq('vendor_profile_id', ctx.shopId)
    .eq('provider', SUPPLIER_DRIVE_PROVIDER)
    .maybeSingle();
  if (readErr) return fail('persist_failed');

  const prevAccount = (existing?.external_account_id as string | null | undefined) ?? null;
  if (existing && (existing.revoked_at || prevAccount !== (userInfo?.id ?? null))) {
    await forgetShopDriveCopies(ctx.shopId);
  }

  const now = new Date().toISOString();
  const row = {
    vendor_profile_id: ctx.shopId,
    event_id: null,
    provider: SUPPLIER_DRIVE_PROVIDER,
    scopes: token.scope ? token.scope.split(' ') : [],
    refresh_token: sealToken(token.refresh_token),
    access_token: sealToken(token.access_token),
    access_token_expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
    external_account_id: userInfo?.id ?? null,
    external_account_display: userInfo?.email ?? 'Connected Drive',
    // RA 10173 erasure attribution — the account that completed this consent (lib/erasure/purge.ts deletes by it).
    granted_by_user_id: ctx.userId,
    granted_at: now,
    revoked_at: null,
    last_refreshed_at: now,
    connection_health: 'ok',
    metadata: userInfo?.name ? { account_name: userInfo.name } : {},
  };
  const { error } = existing
    ? await admin.from('oauth_grants').update(row).eq('grant_id', existing.grant_id as string)
    : await admin.from('oauth_grants').insert(row);
  if (error) return fail('persist_failed');

  return shopRedirect(req, ctx.eventId, DRIVE_COPY_START_PARAM, 'start');
}
