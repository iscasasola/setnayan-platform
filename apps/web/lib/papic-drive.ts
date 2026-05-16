/**
 * Iteration 0012 Papic — Google Drive OAuth helpers (server-side only).
 *
 * Shipped 2026-05-16 alongside the V1 scope expansion that wires real OAuth
 * on the V1.5+ scaffold setup pages (see CLAUDE.md decision log row
 * 2026-05-16 "OAuth wiring for V1.5+ scaffold setup pages shipped early").
 *
 * Implements Google's OAuth 2.0 authorization-code flow against the Drive
 * API v3 for per-couple BYO Google Drive storage. Couples connect their own
 * Drive here; the V1.5+ Papic capture pipeline (still TODO(0012)) will use
 * the stored refresh token to write photos into the bootstrapped folder
 * structure inside the couple's Drive.
 *
 * Why the narrow `drive.file` scope (and NOT the full `drive` scope):
 *   drive.file restricts access to ONLY files the Setnayan app creates in
 *   the couple's Drive. We can never read, edit, or delete files the couple
 *   already has — strictly the photos we wrote ourselves. This is the
 *   minimum scope needed for Papic to work and the only one Google's review
 *   team will fast-track for a non-Google-Workspace consumer app.
 *
 * Google endpoints
 *   (per developers.google.com/identity/protocols/oauth2/web-server):
 *   AUTHORIZE      https://accounts.google.com/o/oauth2/v2/auth
 *   TOKEN          https://oauth2.googleapis.com/token
 *   REVOKE         https://oauth2.googleapis.com/revoke
 *   USERINFO       https://www.googleapis.com/oauth2/v2/userinfo
 *   FILES          https://www.googleapis.com/drive/v3/files
 *
 * Required env vars (owner action — Google Cloud project + Drive API v3
 * enabled + drive.file scope added to the consent screen + 1-4wk Google
 * review):
 *   GOOGLE_DRIVE_OAUTH_CLIENT_ID
 *   GOOGLE_DRIVE_OAUTH_CLIENT_SECRET
 *   GOOGLE_DRIVE_OAUTH_REDIRECT_URI — must exactly match the entry
 *                                     registered on the Google Cloud OAuth
 *                                     client (e.g.
 *                                     https://www.setnayan.com/api/oauth/drive/callback)
 *
 * Implementation note: YouTube (Panood) and Drive (Papic) can share the
 * SAME Google Cloud OAuth client because the redirect URI distinguishes
 * the consent flows. Keeping the env vars separate is a future-proofing
 * decision — if the owner decides to split projects later, only the env
 * needs to change, not the code.
 *
 * THIS MODULE IS SERVER-SIDE ONLY. Never import from a client component.
 */

import 'server-only';

const GOOGLE_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';

/**
 * Scopes requested at consent time. `drive.file` ONLY — restricts our
 * access to files the Setnayan app creates in the couple's Drive. We
 * cannot read, edit, or delete anything else they have. This is the
 * narrowest possible scope that lets Papic write photos to Drive.
 */
export const DRIVE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
] as const;

/**
 * Drive folder structure created automatically inside the couple's Drive
 * the first time they connect. Spec corpus 0012 calls out these exact
 * folder names so the post-event handoff PDF (V1.5+) can deep-link to
 * each folder. The capture pipeline (still TODO(0012)) routes photos
 * into the right sub-folder based on schedule-block tags.
 */
export const PAPIC_DRIVE_SUBFOLDERS = [
  '00_Cover',
  '01_Pre-event',
  '02_Ceremony',
  '03_Reception',
  '04_Auto-Recap',
] as const;

export type PapicDriveConfigStatus =
  | { ready: true; clientId: string; clientSecret: string; redirectUri: string }
  | { ready: false; missing: ReadonlyArray<string> };

/**
 * Read the Drive OAuth config from env. Returns a status object that lets
 * routes / UI surface a clear "Drive OAuth not yet configured — owner
 * action required" message rather than throwing at request time. This is
 * the graceful-fallback hook: until the owner finishes Google Cloud setup
 * (verified-app review 1-4wk), the "Use my Google Drive only" radio
 * option degrades to a "coming soon" placeholder and the Setnayan-storage
 * option remains the only working choice.
 */
export function getDriveOAuthConfig(): PapicDriveConfigStatus {
  const clientId = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID ?? '';
  const clientSecret = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET ?? '';
  const redirectUri = process.env.GOOGLE_DRIVE_OAUTH_REDIRECT_URI ?? '';
  const missing: string[] = [];
  if (!clientId) missing.push('GOOGLE_DRIVE_OAUTH_CLIENT_ID');
  if (!clientSecret) missing.push('GOOGLE_DRIVE_OAUTH_CLIENT_SECRET');
  if (!redirectUri) missing.push('GOOGLE_DRIVE_OAUTH_REDIRECT_URI');
  if (missing.length > 0) return { ready: false, missing };
  return { ready: true, clientId, clientSecret, redirectUri };
}

/**
 * Build the Google OAuth consent URL. `access_type=offline` +
 * `prompt=consent` forces a refresh_token to be returned every time
 * (without prompt=consent, a returning user who already approved the
 * same scopes does NOT get a fresh refresh_token — Google reuses the
 * prior grant).
 */
export function buildDriveAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: 'code',
    scope: DRIVE_OAUTH_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: input.state,
  });
  return `${GOOGLE_AUTHORIZE_URL}?${params.toString()}`;
}

export type DriveTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: 'Bearer';
};

/**
 * Exchange the authorization `code` returned by Google for an access +
 * refresh token pair. Throws on non-200 responses; the callback route
 * catches and redirects with a user-visible error.
 */
export async function exchangeDriveCodeForToken(input: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<DriveTokenResponse> {
  const body = new URLSearchParams({
    code: input.code,
    client_id: input.clientId,
    client_secret: input.clientSecret,
    redirect_uri: input.redirectUri,
    grant_type: 'authorization_code',
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache',
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Drive token exchange failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as DriveTokenResponse & {
    error?: string;
    error_description?: string;
  };
  if (json.error) {
    throw new Error(
      `Drive token exchange error: ${json.error} ${json.error_description ?? ''}`,
    );
  }
  return json;
}

/**
 * Refresh an expired access_token using the long-lived refresh_token.
 * Called by the /api/cron/oauth-refresh worker (shared with YouTube).
 * Drive uses the same Google OAuth token endpoint so the flow is
 * identical — only the client_id / client_secret differ.
 */
export async function refreshDriveAccessToken(input: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<{ access_token: string; expires_in: number; scope?: string }> {
  const body = new URLSearchParams({
    refresh_token: input.refreshToken,
    client_id: input.clientId,
    client_secret: input.clientSecret,
    grant_type: 'refresh_token',
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache',
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Drive token refresh failed: ${res.status} ${text}`);
  }
  return res.json();
}

export type DriveUserInfo = {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
};

/**
 * Fetch the authenticated user's Google account info via the OAuth2
 * userinfo endpoint. Used to populate `external_account_display` on the
 * oauth_grants row so the UI can show "Connected to Drive as <email>".
 * Best-effort — failure here doesn't block the grant write, since the
 * refresh_token + access_token are what the capture pipeline actually
 * needs.
 */
export async function fetchDriveUserInfo(
  accessToken: string,
): Promise<DriveUserInfo | null> {
  try {
    const res = await fetch(GOOGLE_USERINFO_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Cache-Control': 'no-cache',
      },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      id?: string;
      email?: string;
      name?: string;
      picture?: string;
    };
    if (!json.email) return null;
    return {
      id: json.id ?? '',
      email: json.email,
      name: json.name ?? null,
      picture: json.picture ?? null,
    };
  } catch {
    return null;
  }
}

export type DriveFolderTree = {
  rootFolderId: string;
  rootFolderName: string;
  subfolders: Array<{ name: string; id: string }>;
};

/**
 * Bootstrap the Setnayan folder structure inside the couple's Drive:
 *
 *   Setnayan/
 *     [Event display_name]/
 *       00_Cover/
 *       01_Pre-event/
 *       02_Ceremony/
 *       03_Reception/
 *       04_Auto-Recap/
 *
 * Created lazily on first connect via the Drive API. Idempotency on
 * re-connect is NOT enforced here — `drive.file` scope means we can't
 * search the user's whole Drive for an existing "Setnayan" folder, only
 * for files we ourselves created (which is fine since the metadata
 * lookup via metadata.drive_folder_id is the source of truth on our
 * side). If a couple disconnects and reconnects, we just create a new
 * top-level folder; the old one becomes inert (we can't delete it
 * without the user explicitly granting drive.file again, but they can
 * delete it manually from Drive).
 *
 * Returns the bootstrapped folder tree so the callback route can store
 * `metadata.drive_folder_id` on the oauth_grants row. The future Papic
 * capture pipeline (TODO(0012)) reads this id to know where to write.
 */
export async function bootstrapPapicDriveFolders(input: {
  accessToken: string;
  eventDisplayName: string;
}): Promise<DriveFolderTree> {
  // 1. Create the top-level "Setnayan" folder. (Per the spec we always
  //    nest event folders under a single "Setnayan" parent so the couple
  //    sees one entry in their Drive root, not one per event.)
  const setnayanRoot = await createDriveFolder({
    accessToken: input.accessToken,
    name: 'Setnayan',
    parentId: null,
  });

  // 2. Create the event-display-name folder inside Setnayan/.
  //    Use the raw display_name so the couple sees a recognizable name
  //    in their Drive. Drive allows almost any UTF-8 in folder names.
  const eventFolder = await createDriveFolder({
    accessToken: input.accessToken,
    name: input.eventDisplayName,
    parentId: setnayanRoot,
  });

  // 3. Create the 5 sub-folders inside the event folder, in order. Use
  //    Promise.all for parallelism — Drive API tolerates parallel creates
  //    just fine and the round-trip latency dominates wall-clock time.
  const subfolderResults = await Promise.all(
    PAPIC_DRIVE_SUBFOLDERS.map(async (name) => ({
      name,
      id: await createDriveFolder({
        accessToken: input.accessToken,
        name,
        parentId: eventFolder,
      }),
    })),
  );

  return {
    rootFolderId: eventFolder,
    rootFolderName: input.eventDisplayName,
    subfolders: subfolderResults,
  };
}

/**
 * Internal: create one folder via the Drive API. Returns the new folder
 * id. Throws on non-200; callers catch upstream.
 */
async function createDriveFolder(input: {
  accessToken: string;
  name: string;
  parentId: string | null;
}): Promise<string> {
  const body: Record<string, unknown> = {
    name: input.name,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (input.parentId) {
    body.parents = [input.parentId];
  }
  const res = await fetch(DRIVE_FILES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Drive folder create failed for "${input.name}": ${res.status} ${text}`,
    );
  }
  const json = (await res.json()) as { id?: string; error?: { message?: string } };
  if (!json.id) {
    throw new Error(
      `Drive folder create returned no id for "${input.name}"${
        json.error?.message ? ` — ${json.error.message}` : ''
      }`,
    );
  }
  return json.id;
}

/**
 * POST the refresh token to Google's revoke endpoint. Best-effort —
 * Google returns 200 if the token was valid, 400 if it was already
 * revoked. We treat both as success (revoked_at is set regardless on our
 * side).
 *
 * Note: this revokes Setnayan's app access to the couple's Drive. The
 * folder structure we already created REMAINS in the couple's Drive
 * (they own those files now); they can keep, move, or delete them. We
 * just lose the ability to read/write into them.
 */
export async function revokeDriveToken(refreshToken: string): Promise<void> {
  const body = new URLSearchParams({ token: refreshToken });
  await fetch(GOOGLE_REVOKE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache',
    },
    body: body.toString(),
  }).catch(() => {
    // Swallow network errors — the local revoked_at update is the source
    // of truth for whether we'll ever use this token again.
  });
}

/**
 * Generate a high-entropy random state token for the OAuth CSRF check.
 * 24 bytes → 48 hex chars. Same scheme as the YouTube + TikTok OAuth
 * flows so the shared `oauth_state` table sees uniform-looking nonces.
 */
export function generateDriveStateToken(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
