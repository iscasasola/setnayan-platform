import 'server-only';
import { randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { createAdminClient } from '@/lib/supabase/admin';
import { CopyObjectCommand } from '@aws-sdk/client-s3';
import { R2_BUCKETS, isR2Configured, publicUrlFor, r2List, requireR2Client, type R2BucketName } from '@/lib/r2';
import { displayUrlForPrivateStoredAsset } from '@/lib/uploads';
import { couplePhotoLookPolicy } from '@/lib/r2-client-ref';
import { couplePhotoLookScope } from '@/lib/cleanup-delete-scope';
import { cleanupDelete } from '@/lib/cleanup-delete';
import type { CoupleLook } from '@/lib/service-card-view-model';
import { COUPLE_LOOKS_PREFIX, coupleLookKey, coupleLookRef, shareIdOfCoupleLook, type CouplePhotoAudience } from '@/lib/couple-photo-share';

/**
 * 📸 A COUPLE'S PHOTO ON A SUPPLIER'S CARD — the server half that touches STORAGE (owner 2026-10-30; security review
 * #7089).
 *
 * 🔑 THE CARD NEVER SHOWS THE COUPLE'S BOARD ROW. At Approve the server COPIES the share's snapshot object (the key
 * the couple uploaded, `inspiration/<event>/…`) to a neutral key `couple-looks/<share_id>-<attempt>.<ext>` in the public media
 * bucket — no event id, no original file name (F3) — and the share publishes THAT key. The board row is editable by
 * every event member under its existing policy, so a live read would let anyone on the event swap the picture behind
 * an approved, credited card (F1). Every reader here maps a stored KEY to a URL; none trusts a stored URL.
 *
 * 👁 WHO SEES IT (owner 2026-10-30): a PUBLIC photo's copy lives in the public media bucket (a plain, cacheable URL,
 * read by the cached public page); every other audience's copy lives in the PRIVATE thread-files bucket and is only
 * ever handed out as a short-lived signed URL, to a signed-in viewer the database says is inside the audience
 * (`viewer_service_card_couple_photos`). Crossing the public line moves the copy (a new key, same shape).
 */
export const COUPLE_LOOKS_PER_CARD = 6;

/** Where a copy lives: Public → the public media bucket; any other audience → the private bucket. */
export function coupleLookBucket(isPublic: boolean): R2BucketName {
  return isPublic ? R2_BUCKETS.media : R2_BUCKETS.threadFiles;
}

/** A signed URL lives this long — long enough for one visit, short enough that a forwarded link dies. */
const SIGNED_LOOK_TTL_S = 60 * 60;

/** The PUBLIC URL of a key in the media bucket — null when storage is not configured. Public copies + snapshots only. */
export function coupleLookUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  try {
    return publicUrlFor(R2_BUCKETS.media, key);
  } catch {
    return null;
  }
}

/** A URL for a copy wherever it lives: public → the plain URL; non-public → a short-lived signed URL. */
export async function coupleLookUrlFor(key: string | null | undefined, isPublic: boolean): Promise<string | null> {
  if (!key) return null;
  if (isPublic) return coupleLookUrl(key);
  // The HOUSE private signer, scoped to THIS share's own folder (`couplePhotoLookPolicy`) — never a raw presign.
  const shareId = shareIdOfCoupleLook(key);
  if (!shareId) return null;
  try {
    return await displayUrlForPrivateStoredAsset(coupleLookRef(key, false), couplePhotoLookPolicy(shareId), { ttlSeconds: SIGNED_LOOK_TTL_S });
  } catch {
    return null;
  }
}

/**
 * THE CARD'S PUBLIC "FROM COUPLES" PHOTOS — ONE batched read for a whole gallery of cards, safe for the cached page.
 * It reads ONLY `service_card_couple_photos(ids)` (approved, audience PUBLIC, frozen copy, active card). Fail-soft.
 */
export async function fetchServiceCardCouplePhotos(
  client: SupabaseClient,
  vendorServiceIds: readonly string[],
): Promise<Map<string, CoupleLook[]>> {
  const out = new Map<string, CoupleLook[]>();
  if (vendorServiceIds.length === 0) return out;
  const { data, error } = await client.rpc('service_card_couple_photos', { p_vendor_service_ids: [...vendorServiceIds] });
  if (error) {
    logQueryError('fetchServiceCardCouplePhotos', error, { n: vendorServiceIds.length }, 'graceful_degrade');
    return out;
  }
  for (const r of (data ?? []) as Array<{ vendor_service_id: string; share_id: string; public_key: string; credit_line: string }>) {
    const list = out.get(r.vendor_service_id) ?? [];
    if (list.length >= COUPLE_LOOKS_PER_CARD) continue;
    const url = coupleLookUrl(r.public_key);
    if (!url) continue;
    list.push({ id: r.share_id, url, credit: r.credit_line });
    out.set(r.vendor_service_id, list);
  }
  return out;
}

/**
 * A SIGNED-IN viewer's extra photos — the NON-public approved shares the database says they are inside the audience
 * of (`viewer_service_card_couple_photos`, under their own session). Signed URLs, never cached; read after the page.
 */
export async function fetchViewerCouplePhotos(
  client: SupabaseClient,
  vendorServiceIds: readonly string[],
): Promise<Record<string, CoupleLook[]>> {
  const out: Record<string, CoupleLook[]> = {};
  if (vendorServiceIds.length === 0) return out;
  const { data, error } = await client.rpc('viewer_service_card_couple_photos', { p_vendor_service_ids: [...vendorServiceIds] });
  if (error) {
    logQueryError('fetchViewerCouplePhotos', error, { n: vendorServiceIds.length }, 'graceful_degrade');
    return out;
  }
  for (const r of (data ?? []) as Array<{ vendor_service_id: string; share_id: string; public_key: string; credit_line: string }>) {
    const list = (out[r.vendor_service_id] ??= []);
    if (list.length >= COUPLE_LOOKS_PER_CARD) continue;
    const url = await coupleLookUrlFor(r.public_key, false);
    if (url) list.push({ id: r.share_id, url, credit: r.credit_line });
  }
  return out;
}

/** The image type a copy is served with — REPLACE drops the source's, and every copy key ends in one of these. */
function imageTypeOf(key: string): string {
  const ext = key.slice(key.lastIndexOf('.') + 1).toLowerCase();
  return ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
}

/** One server-side COPY (no bytes through us), across buckets when the two differ. */
async function copyObject(fromBucket: R2BucketName, fromKey: string, toBucket: R2BucketName, toKey: string): Promise<void> {
  // REPLACE the metadata so a copy never inherits the board upload's hour of public caching — when a photo leaves the
  // public card (taken back, narrowed, removed), nothing keeps serving it from a cache.
  await requireR2Client().send(
    new CopyObjectCommand({
      Bucket: toBucket,
      CopySource: `${fromBucket}/${fromKey}`,
      Key: toKey,
      MetadataDirective: 'REPLACE',
      CacheControl: 'no-store',
      ContentType: imageTypeOf(toKey),
    }),
  );
}

const attempt = () => randomBytes(8).toString('hex');

/**
 * Make the frozen copy for one share, BEFORE the approve is recorded (the database refuses an approved share
 * without it), into the bucket its audience lives in. Null when storage is not configured or the copy failed.
 */
export async function publishCoupleLook(shareId: string, snapshotKey: string, isPublic: boolean): Promise<string | null> {
  if (!isR2Configured()) return null;
  const toKey = coupleLookKey(shareId, snapshotKey, attempt());
  try {
    await copyObject(R2_BUCKETS.media, snapshotKey, coupleLookBucket(isPublic), toKey);
    return toKey;
  } catch (e) {
    console.error('[couple-photo] the frozen copy could not be made', { shareId, error: e instanceof Error ? e.message : e });
    return null;
  }
}

/** An approved copy crossing the public line: copied to the other bucket under a NEW key (the old one is deleted after). */
export async function moveCoupleLook(shareId: string, fromKey: string, fromPublic: boolean, toPublic: boolean): Promise<string | null> {
  if (!isR2Configured()) return null;
  const toKey = coupleLookKey(shareId, fromKey, attempt());
  try {
    await copyObject(coupleLookBucket(fromPublic), fromKey, coupleLookBucket(toPublic), toKey);
    return toKey;
  } catch (e) {
    console.error('[couple-photo] the copy could not be moved', { shareId, error: e instanceof Error ? e.message : e });
    return null;
  }
}

/**
 * Delete one frozen copy from the bucket it lives in — through the HOUSE cleanup executor, planned against THIS
 * share's own folder (`couplePhotoLookScope`), never a raw delete. Best-effort; the sweep is the net.
 */
export async function unpublishCoupleLook(key: string | null | undefined, isPublic: boolean | null | undefined): Promise<void> {
  const shareId = key ? shareIdOfCoupleLook(key) : null;
  if (!key || !shareId || !isR2Configured()) return;
  try {
    const outcome = await cleanupDelete(coupleLookRef(key, Boolean(isPublic)), couplePhotoLookScope(shareId));
    if (outcome === 'refused') console.error('[couple-photo] a frozen-copy delete was refused by its scope', { key });
  } catch (e) {
    console.error('[couple-photo] a frozen copy could not be deleted', { key, error: e instanceof Error ? e.message : e });
  }
}

/** A copy younger than this is never swept — it may be an Approve or a move still between its copy and its record. */
const SWEEP_GRACE_MS = 10 * 60 * 1000;
/** Keys per `.in()` question, and the most objects one sweep lists per bucket (paged by r2List, 1,000 a page). */
const SWEEP_CHUNK = 100;
const SWEEP_MAX_OBJECTS = 20_000;

/**
 * THE NET UNDER EVERY UNPUBLISH: in BOTH buckets, delete each `couple-looks/` object no APPROVED share names in THAT
 * bucket (a Public share's copy in the private bucket, or the reverse, is an orphan of a move). It catches what no
 * action saw — a share withdrawn by the board trigger, a cascade delete, a crash between copy and record. Run after
 * every share write; best-effort; a chunk it could not check is never deleted. ⚠ At scale this belongs on a
 * schedule — named, not hidden.
 */
export async function reconcileCoupleLooks(): Promise<void> {
  if (!isR2Configured()) return;
  try {
    const admin = createAdminClient();
    for (const isPublic of [true, false]) {
      const bucket = coupleLookBucket(isPublic);
      // Every page of the listing (r2List follows continuation tokens up to its ceiling).
      const { objects } = await r2List({ bucket, prefix: COUPLE_LOOKS_PREFIX, maxKeys: SWEEP_MAX_OBJECTS });
      const now = Date.now();
      const candidates = objects.filter((o) => shareIdOfCoupleLook(o.key) && (!o.lastModified || now - o.lastModified.getTime() > SWEEP_GRACE_MS));
      if (candidates.length === 0) continue;
      const live = new Set<string>();
      // Asked in chunks — one `.in()` of thousands of keys would outgrow the request URL.
      for (let i = 0; i < candidates.length; i += SWEEP_CHUNK) {
        const chunk = candidates.slice(i, i + SWEEP_CHUNK).map((o) => o.key);
        const { data, error } = await admin.from('couple_photo_shares').select('public_key, audience').eq('state', 'approved').in('public_key', chunk);
        if (error) {
          logQueryError('reconcileCoupleLooks', error, { n: chunk.length }, 'graceful_degrade');
          return;
        }
        for (const r of (data ?? []) as Array<{ public_key: string; audience: CouplePhotoAudience }>) {
          if ((r.audience === 'public') === isPublic) live.add(r.public_key);
        }
      }
      for (const o of candidates) if (!live.has(o.key)) await unpublishCoupleLook(o.key, isPublic);
    }
  } catch (e) {
    console.error('[couple-photo] the frozen-copy sweep failed', e instanceof Error ? e.message : e);
  }
}
