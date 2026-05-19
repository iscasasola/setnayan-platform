import 'server-only';

// Iteration 0009 Photo Delivery — Drive-specific helpers that piggyback on
// the Papic (0012) OAuth primitives in apps/web/lib/papic-drive.ts.
//
// Why a separate file:
//   - Photo Delivery uses the SAME Google OAuth client as Papic but a
//     DIFFERENT redirect URI (PHOTO_DELIVERY_OAUTH_REDIRECT_URI), so
//     consent flows are distinguishable on Google's side and the callback
//     dispatches into the right iteration.
//   - The post-consent action differs from Papic: a single flat folder
//     (no subfolders) named after the wedding, not the multi-stage
//     pre/ceremony/reception tree.

export type PhotoDeliveryOAuthConfigStatus =
  | { ready: true; clientId: string; clientSecret: string; redirectUri: string }
  | { ready: false; missing: string[] };

/**
 * Reads Photo Delivery's Drive OAuth config. Reuses Papic's client_id /
 * client_secret (shared Google Cloud OAuth client) but the redirect URI
 * is iteration-specific — owners register both URIs against the same
 * OAuth client in Google Cloud.
 *
 * Returns { ready: false, missing } when any var is unset so the calling
 * route can render the graceful-fallback 503 + "coming soon" UI used by
 * the Papic flow.
 */
export function getPhotoDeliveryOAuthConfig(): PhotoDeliveryOAuthConfigStatus {
  const clientId = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID ?? '';
  const clientSecret = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET ?? '';
  const redirectUri = process.env.PHOTO_DELIVERY_OAUTH_REDIRECT_URI ?? '';
  const missing: string[] = [];
  if (!clientId) missing.push('GOOGLE_DRIVE_OAUTH_CLIENT_ID');
  if (!clientSecret) missing.push('GOOGLE_DRIVE_OAUTH_CLIENT_SECRET');
  if (!redirectUri) missing.push('PHOTO_DELIVERY_OAUTH_REDIRECT_URI');
  if (missing.length > 0) return { ready: false, missing };
  return { ready: true, clientId, clientSecret, redirectUri };
}

/**
 * Creates a single flat folder in the couple's Drive named after the
 * wedding (e.g. "Setnayan · Maria & Juan Wedding · 2026-10-24") and
 * returns its Drive file id + canonical name. Unlike Papic's bootstrap,
 * no subfolders — the upload worker (PR 4) writes finalized photos +
 * clips straight into this folder.
 */
export async function createPhotoDeliveryFolder(input: {
  accessToken: string;
  folderName: string;
}): Promise<{ folderId: string; folderName: string }> {
  const res = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: input.folderName,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Drive folder create failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { id?: string; name?: string };
  if (!json.id) {
    throw new Error('Drive folder create returned no id');
  }
  return { folderId: json.id, folderName: json.name ?? input.folderName };
}

/**
 * Builds the human-readable folder name for the couple's Photo Delivery
 * Drive folder. Format: "Setnayan · {display_name} · {YYYY-MM-DD}" — the
 * date is omitted when the event has no date set yet (DIY-mode couples
 * who haven't filled in their wedding date).
 */
export function buildPhotoDeliveryFolderName(input: {
  displayName: string;
  eventDate: string | null;
}): string {
  const base = `Setnayan · ${input.displayName}`;
  if (!input.eventDate) return base;
  // event_date is a Postgres DATE, so it serializes as 'YYYY-MM-DD' already.
  return `${base} · ${input.eventDate}`;
}
