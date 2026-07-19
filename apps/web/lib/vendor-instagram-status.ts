import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { displayUrlForStoredAsset } from '@/lib/uploads';

// Server-side loaders for the vendor Instagram card + the public-profile render.
// Both read via the service role so the token column is never in scope; only
// non-secret status + media fields are ever selected.

export type VendorIgConnectionStatus = {
  igUsername: string | null;
  status: 'connected' | 'error' | 'revoked' | null;
  statusDetail: string | null;
  connectedAt: string | null;
  lastSyncedAt: string | null;
};

export type VendorIgMediaRow = {
  id: string;
  mediaType: 'IMAGE' | 'CAROUSEL_ALBUM' | 'VIDEO';
  displayUrl: string | null;
  permalink: string | null;
  caption: string | null;
  takenAt: string | null;
  showOnProfile: boolean;
};

/** Read the vendor's connection status (never the token). Null when unconnected. */
export async function fetchVendorIgConnection(
  vendorProfileId: string,
): Promise<VendorIgConnectionStatus | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('vendor_ig_connections')
      .select('ig_username, status, status_detail, connected_at, last_synced_at')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle();
    if (!data) return null;
    const row = data as {
      ig_username: string | null;
      status: string | null;
      status_detail: string | null;
      connected_at: string | null;
      last_synced_at: string | null;
    };
    return {
      igUsername: row.ig_username,
      status: (row.status as VendorIgConnectionStatus['status']) ?? null,
      statusDetail: row.status_detail,
      connectedAt: row.connected_at,
      lastSyncedAt: row.last_synced_at,
    };
  } catch {
    return null;
  }
}

/**
 * Read the vendor's synced IG media for the DASHBOARD (all rows, both hidden +
 * shown), resolving each stored ref to a display URL. Best-effort, capped.
 */
export async function fetchVendorIgMediaForOwner(
  vendorProfileId: string,
  limit = 30,
): Promise<VendorIgMediaRow[]> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('vendor_ig_media')
      .select(
        'vendor_ig_media_id, media_type, r2_key, thumbnail_r2_key, permalink, caption, taken_at, show_on_profile',
      )
      .eq('vendor_profile_id', vendorProfileId)
      .order('taken_at', { ascending: false, nullsFirst: false })
      .limit(limit);
    return await resolveMediaRows(data);
  } catch {
    return [];
  }
}

/**
 * Read the vendor's PUBLIC (show_on_profile=TRUE) synced IG media for the public
 * profile render. Resolves display URLs. Best-effort, capped.
 */
export async function fetchVendorIgMediaForPublic(
  vendorProfileId: string,
  limit = 20,
): Promise<VendorIgMediaRow[]> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('vendor_ig_media')
      .select(
        'vendor_ig_media_id, media_type, r2_key, thumbnail_r2_key, permalink, caption, taken_at, show_on_profile',
      )
      .eq('vendor_profile_id', vendorProfileId)
      .eq('show_on_profile', true)
      .order('taken_at', { ascending: false, nullsFirst: false })
      .limit(limit);
    return await resolveMediaRows(data);
  } catch {
    return [];
  }
}

async function resolveMediaRows(data: unknown): Promise<VendorIgMediaRow[]> {
  const rows = (data ?? []) as Array<{
    vendor_ig_media_id: string;
    media_type: string;
    r2_key: string | null;
    thumbnail_r2_key: string | null;
    permalink: string | null;
    caption: string | null;
    taken_at: string | null;
    show_on_profile: boolean;
  }>;
  return Promise.all(
    rows.map(async (r) => {
      const mediaType = (r.media_type as VendorIgMediaRow['mediaType']) ?? 'IMAGE';
      // Images show their re-hosted r2_key; videos show their thumbnail (if any).
      const ref = mediaType === 'VIDEO' ? r.thumbnail_r2_key : r.r2_key;
      const displayUrl = ref ? await displayUrlForStoredAsset(ref) : null;
      return {
        id: r.vendor_ig_media_id,
        mediaType,
        displayUrl,
        permalink: r.permalink,
        caption: r.caption,
        takenAt: r.taken_at,
        showOnProfile: r.show_on_profile,
      };
    }),
  );
}
