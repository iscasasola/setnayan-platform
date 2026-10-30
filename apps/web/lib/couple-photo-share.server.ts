import 'server-only';
import { randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { createAdminClient } from '@/lib/supabase/admin';
import { R2_BUCKETS, isR2Configured, publicUrlFor, r2Copy, r2Delete, r2List } from '@/lib/r2';
import type { CoupleLook } from '@/lib/service-card-view-model';
import { COUPLE_LOOKS_PREFIX, coupleLookKey, shareIdOfCoupleLook } from '@/lib/couple-photo-share';

/**
 * 📸 A COUPLE'S PHOTO ON A SUPPLIER'S CARD — the server half that touches STORAGE (owner 2026-10-30; security review
 * #7089).
 *
 * 🔑 THE CARD NEVER SHOWS THE COUPLE'S BOARD ROW. At Approve the server COPIES the share's snapshot object (the key
 * the couple uploaded, `inspiration/<event>/…`) to a neutral key `couple-looks/<share_id>.<ext>` in the public media
 * bucket — no event id, no original file name (F3) — and the share publishes THAT key. The board row is editable by
 * every event member under its existing policy, so a live read would let anyone on the event swap the picture behind
 * an approved, credited card (F1). Every reader here maps a stored KEY to a URL; none trusts a stored URL.
 */
export const COUPLE_LOOKS_PER_CARD = 6;

/** The public URL of a key in the media bucket — null when storage is not configured (the photo is then not drawn). */
export function coupleLookUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  try {
    return publicUrlFor(R2_BUCKETS.media, key);
  } catch {
    return null;
  }
}

/**
 * THE CARD'S "FROM COUPLES" PHOTOS — ONE batched read for a whole gallery of cards. It reads ONLY
 * `service_card_couple_photos(ids)` (approved shares, their frozen copy, active cards). Fail-soft: a refused read
 * logs and returns an empty map — the card renders exactly as it did before this feature.
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
 * Make the frozen copy for one share, BEFORE the approve is recorded (the database refuses an approved share
 * without it). Same-bucket server copy — no bytes pass through us. Null when storage is not configured or the copy
 * failed: the caller then refuses the approve and nothing changes.
 */
export async function publishCoupleLook(shareId: string, snapshotKey: string): Promise<string | null> {
  if (!isR2Configured()) return null;
  const toKey = coupleLookKey(shareId, snapshotKey, randomBytes(6).toString('hex'));
  try {
    await r2Copy({ bucket: R2_BUCKETS.media, fromKey: snapshotKey, toKey });
    return toKey;
  } catch (e) {
    console.error('[couple-photo] the frozen copy could not be made', { shareId, error: e instanceof Error ? e.message : e });
    return null;
  }
}

/** Delete one frozen copy (withdraw · decline · take off · THIS attempt's copy after a refused approve). Best-effort; the sweep is the net. */
export async function unpublishCoupleLook(key: string | null | undefined): Promise<void> {
  if (!key || !shareIdOfCoupleLook(key) || !isR2Configured()) return;
  try {
    await r2Delete({ bucket: R2_BUCKETS.media, key });
  } catch (e) {
    console.error('[couple-photo] a frozen copy could not be deleted', { key, error: e instanceof Error ? e.message : e });
  }
}

/** A copy younger than this is never swept — it may be an Approve still between its copy and its record. */
const SWEEP_GRACE_MS = 10 * 60 * 1000;
/** Keys per `.in()` question, and the most objects one sweep lists (paged by r2List, 1,000 a page). */
const SWEEP_CHUNK = 100;
const SWEEP_MAX_OBJECTS = 20_000;

/**
 * THE NET UNDER EVERY UNPUBLISH: delete each `couple-looks/` object no APPROVED share names. It catches what no
 * action saw — a share withdrawn by the board trigger (a photo removed or changed on the board), a cascade delete
 * (an event or account erased), a crash between copy and record. Run after every share write; best-effort, bounded
 * (≤20,000 objects, paged; keys checked 100 at a time). ⚠ At scale this belongs on a schedule — named, not hidden.
 */
export async function reconcileCoupleLooks(): Promise<void> {
  if (!isR2Configured()) return;
  try {
    // Every page of the listing (r2List follows continuation tokens up to its ceiling).
    const { objects } = await r2List({ bucket: R2_BUCKETS.media, prefix: COUPLE_LOOKS_PREFIX, maxKeys: SWEEP_MAX_OBJECTS });
    const now = Date.now();
    const candidates = objects.filter((o) => shareIdOfCoupleLook(o.key) && (!o.lastModified || now - o.lastModified.getTime() > SWEEP_GRACE_MS));
    if (candidates.length === 0) return;
    const admin = createAdminClient();
    const live = new Set<string>();
    // Asked in chunks — one `.in()` of thousands of keys would outgrow the request URL.
    for (let i = 0; i < candidates.length; i += SWEEP_CHUNK) {
      const chunk = candidates.slice(i, i + SWEEP_CHUNK).map((o) => o.key);
      const { data, error } = await admin.from('couple_photo_shares').select('public_key').eq('state', 'approved').in('public_key', chunk);
      if (error) {
        // Fail SAFE: a chunk we could not check is never deleted.
        logQueryError('reconcileCoupleLooks', error, { n: chunk.length }, 'graceful_degrade');
        return;
      }
      for (const r of (data ?? []) as Array<{ public_key: string }>) live.add(r.public_key);
    }
    for (const o of candidates) if (!live.has(o.key)) await unpublishCoupleLook(o.key);
  } catch (e) {
    console.error('[couple-photo] the frozen-copy sweep failed', e instanceof Error ? e.message : e);
  }
}
