'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { decryptToken, encryptToken } from '@/lib/encryption';
import { encodeR2Ref } from '@/lib/uploads';
import { r2Upload, R2_BUCKETS } from '@/lib/r2';
import {
  fetchInstagramMedia,
  isInstagramConnectConfigured,
  refreshInstagramToken,
  type InstagramMediaItem,
} from '@/lib/vendor-instagram';
import { resolveMetaAppOAuth } from '@/lib/integration-config';

// Vendor Instagram sync + management — server actions.
//
// SECURITY: the access token is only ever decrypted inside this server module
// for the Graph API call — it's never returned, logged, or put in a redirect.
// Every action re-derives the caller's vendor_profile_id from the session
// (never trusts a client-supplied id) so a vendor can only touch their own
// connection + media.

// The Instagram card lives on My Shop → Website Editor now (relocated
// 2026-07-05). Revalidate that surface so a sync / visibility toggle /
// disconnect reflects immediately. The public microsite is revalidated too so
// synced posts appear on /v/[slug].
const SHOP_PATH = '/vendor-dashboard/shop';
const MAX_SYNC_ITEMS = 20;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB safety cap per fetched image

type SyncResult = { ok: boolean; message: string };

/** Re-derive the caller's own vendor_profile_id from the session. */
async function ownVendorProfileId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('vendor_profiles')
    .select('vendor_profile_id')
    .eq('user_id', user.id)
    .maybeSingle();
  return (data as { vendor_profile_id?: string } | null)?.vendor_profile_id ?? null;
}

/**
 * Download one IG media URL + re-host it in setnayan-media R2. Returns the
 * r2://… ref, or null on any failure (never throws — a single bad image just
 * drops out of the sync). IG media URLs are short-lived + CDN-signed, so we
 * copy the bytes for a stable public URL.
 */
async function rehostImage(
  vendorProfileId: string,
  igMediaId: string,
  imageUrl: string,
): Promise<string | null> {
  try {
    const res = await fetch(imageUrl, { headers: { 'Cache-Control': 'no-cache' } });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_IMAGE_BYTES) return null;
    // Stable key per (vendor, media) — a re-sync overwrites the same object.
    const safeId = igMediaId.replace(/[^a-zA-Z0-9_-]/g, '');
    const key = `vendors/${vendorProfileId}/ig/${safeId}.jpg`;
    await r2Upload({
      bucket: R2_BUCKETS.media,
      key,
      body: buf,
      contentType: contentType === 'image/jpeg' ? 'image/jpeg' : contentType,
    });
    return encodeR2Ref(R2_BUCKETS.media, key);
  } catch {
    return null;
  }
}

/**
 * Manual "Sync now": pull the vendor's recent IG posts and upsert them into
 * vendor_ig_media (dedupe on ig_media_id). Images re-hosted to R2; videos kept
 * as link-outs (permalink + optional thumbnail, no re-host). Never throws;
 * returns a structured result the UI shows as a flash.
 */
export async function syncInstagramMedia(): Promise<SyncResult> {
  if (!isInstagramConnectConfigured()) {
    return { ok: false, message: 'Instagram connect is not available yet.' };
  }
  const vendorProfileId = await ownVendorProfileId();
  if (!vendorProfileId) {
    return { ok: false, message: 'Not signed in as a vendor.' };
  }

  const admin = createAdminClient();
  const { data: conn } = await admin
    .from('vendor_ig_connections')
    .select('ig_user_id, access_token_enc, token_expires_at')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  if (!conn) {
    return { ok: false, message: 'Connect your Instagram account first.' };
  }

  const row = conn as {
    ig_user_id: string;
    access_token_enc: string;
    token_expires_at: string | null;
  };

  let accessToken: string;
  try {
    accessToken = decryptToken(row.access_token_enc);
  } catch {
    return {
      ok: false,
      message: 'Your Instagram connection needs to be re-authorized.',
    };
  }

  // Refresh the long-lived token opportunistically if it's within 7 days of
  // expiry (best-effort — the fetch still runs on the current token if refresh
  // fails and it's not yet expired).
  const { appId, appSecret } = resolveMetaAppOAuth();
  const expiresAtMs = row.token_expires_at
    ? new Date(row.token_expires_at).getTime()
    : 0;
  if (expiresAtMs && expiresAtMs - Date.now() < 7 * 24 * 60 * 60 * 1000) {
    const refreshed = await refreshInstagramToken({ accessToken, appId, appSecret });
    if (refreshed) {
      accessToken = refreshed.accessToken;
      try {
        await admin
          .from('vendor_ig_connections')
          .update({
            access_token_enc: encryptToken(refreshed.accessToken),
            token_expires_at: new Date(
              Date.now() + refreshed.expiresInSeconds * 1000,
            ).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('vendor_profile_id', vendorProfileId);
      } catch {
        /* non-fatal — keep syncing with the refreshed in-memory token */
      }
    }
  }

  let media: InstagramMediaItem[];
  try {
    media = await fetchInstagramMedia(row.ig_user_id, accessToken, MAX_SYNC_ITEMS);
  } catch {
    await admin
      .from('vendor_ig_connections')
      .update({
        status: 'error',
        status_detail: 'Sync failed — try reconnecting.',
        updated_at: new Date().toISOString(),
      })
      .eq('vendor_profile_id', vendorProfileId);
    return {
      ok: false,
      message: 'Could not reach Instagram. Try reconnecting your account.',
    };
  }

  let synced = 0;
  for (const item of media.slice(0, MAX_SYNC_ITEMS)) {
    // Preserve the vendor's existing show_on_profile choice on re-sync.
    const { data: existing } = await admin
      .from('vendor_ig_media')
      .select('vendor_ig_media_id, r2_key, thumbnail_r2_key') // gitleaks:allow — R2 object-key column names, not a secret
      .eq('vendor_profile_id', vendorProfileId)
      .eq('ig_media_id', item.id)
      .maybeSingle();
    const prev = existing as
      | { r2_key: string | null; thumbnail_r2_key: string | null }
      | null;

    let r2Key: string | null = prev?.r2_key ?? null;
    let thumbnailKey: string | null = prev?.thumbnail_r2_key ?? null;

    if (item.mediaType === 'VIDEO') {
      // Don't re-host video — only (re-)host its thumbnail for the link-out card.
      if (!thumbnailKey && item.thumbnailUrl) {
        thumbnailKey = await rehostImage(vendorProfileId, `${item.id}_thumb`, item.thumbnailUrl);
      }
    } else {
      // IMAGE / CAROUSEL_ALBUM — re-host the image if we don't already have it.
      if (!r2Key && item.mediaUrl) {
        r2Key = await rehostImage(vendorProfileId, item.id, item.mediaUrl);
      }
      // Skip an image we couldn't re-host (no stable URL to show).
      if (!r2Key) continue;
    }

    const { error: upsertErr } = await admin.from('vendor_ig_media').upsert(
      {
        vendor_profile_id: vendorProfileId,
        ig_media_id: item.id,
        media_type: item.mediaType,
        r2_key: r2Key,
        thumbnail_r2_key: thumbnailKey,
        permalink: item.permalink,
        caption: item.caption ? item.caption.slice(0, 2000) : null,
        taken_at: item.timestamp,
        synced_at: new Date().toISOString(),
      },
      { onConflict: 'vendor_profile_id,ig_media_id' },
    );
    if (!upsertErr) synced += 1;
  }

  await admin
    .from('vendor_ig_connections')
    .update({
      status: 'connected',
      status_detail: null,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('vendor_profile_id', vendorProfileId);

  revalidatePath(SHOP_PATH);
  return {
    ok: true,
    message:
      synced > 0
        ? `Synced ${synced} post${synced === 1 ? '' : 's'} from Instagram.`
        : 'No new posts to sync.',
  };
}

/** Server-action form wrapper for the "Sync now" button. */
export async function syncInstagramMediaAction(): Promise<void> {
  await syncInstagramMedia();
  revalidatePath(SHOP_PATH);
}

/** Toggle one synced item's visibility on the public portfolio. */
export async function toggleInstagramMediaVisibility(
  formData: FormData,
): Promise<void> {
  const mediaId = formData.get('vendor_ig_media_id');
  if (typeof mediaId !== 'string' || mediaId.length === 0) return;
  const vendorProfileId = await ownVendorProfileId();
  if (!vendorProfileId) return;

  const admin = createAdminClient();
  // Re-derive current value + confirm ownership (never trust a client "next").
  const { data: current } = await admin
    .from('vendor_ig_media')
    .select('show_on_profile, vendor_profile_id')
    .eq('vendor_ig_media_id', mediaId)
    .maybeSingle();
  const cur = current as
    | { show_on_profile: boolean; vendor_profile_id: string }
    | null;
  if (!cur || cur.vendor_profile_id !== vendorProfileId) return;

  await admin
    .from('vendor_ig_media')
    .update({ show_on_profile: !cur.show_on_profile })
    .eq('vendor_ig_media_id', mediaId)
    .eq('vendor_profile_id', vendorProfileId);

  revalidatePath(SHOP_PATH);
}

/**
 * Disconnect Instagram: revoke the stored connection + clear synced media. Best
 * effort — the local row deletions are the source of truth.
 */
export async function disconnectInstagram(): Promise<void> {
  const vendorProfileId = await ownVendorProfileId();
  if (!vendorProfileId) return;
  const admin = createAdminClient();
  await admin
    .from('vendor_ig_media')
    .delete()
    .eq('vendor_profile_id', vendorProfileId);
  await admin
    .from('vendor_ig_connections')
    .delete()
    .eq('vendor_profile_id', vendorProfileId);
  revalidatePath(SHOP_PATH);
}
