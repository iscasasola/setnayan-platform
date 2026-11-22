import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { getDriveOAuthConfig } from '@/lib/papic-drive';
import { enqueueDriveCopy, getShopDriveAccessToken, runDriveCopyBatch } from '@/lib/drive-copy';
import {
  SUPPLIER_DRIVE_ARTIFACT_TYPES,
  SUPPLIER_DRIVE_PROVIDER,
  copyStatusOf,
  supplierEventCopyFiles,
  type CopyRunResult,
  type ShopAlbumRow,
  type ShopDriveState,
  type ShopEventFileRow,
  type SupplierCopyFile,
} from '@/lib/supplier-drive-copy';

/**
 * ☁️ "COPY THIS EVENT TO GOOGLE DRIVE" — A SUPPLIER, PER EVENT. THE SERVER HALF (pure half: lib/supplier-drive-copy.ts).
 *
 * Every function takes a shop id the CALLER has already proved is the signed-in person's shop (`fetchOwnVendorProfile`)
 * and reads only that shop's rows — the service role is used because the copy ledger and the Drive grant are never
 * readable by a browser (RLS on, no policy), not to widen who is asked about.
 *
 * Reusable on purpose: the later "Make room" and grace-notice builds offer this same copy before originals go — they
 * call `copyShopEventToDrive` (through `/api/vendor/drive-copy`) and draw `CopyEventToDrive`
 * (app/vendor-dashboard/_components/copy-event-to-drive.tsx). Never counted, never a gate.
 */

/** One press works this long, then hands back "copying" so the page presses on (the route's own limit is 60 s). */
const PRESS_BUDGET_MS = 35_000;
/** Small batches, so a press stops close to its budget (one file in memory at a time inside a batch). */
const PRESS_BATCH = 3;

/** What the shop's own Drive looks like right now. A refused read is `unread`, never "not connected". */
export async function readShopDrive(shopId: string): Promise<ShopDriveState> {
  const admin = createAdminClient();
  const [cfg, grantRes] = await Promise.all([
    getDriveOAuthConfig(),
    admin
      .from('oauth_grants')
      .select('external_account_display, connection_health, revoked_at')
      .eq('vendor_profile_id', shopId)
      .eq('provider', SUPPLIER_DRIVE_PROVIDER)
      .maybeSingle(),
  ]);
  if (grantRes.error) {
    logQueryError('readShopDrive', grantRes.error, { vendor_profile_id: shopId }, 'graceful_degrade');
    return { status: 'unread' };
  }
  const g = grantRes.data as { external_account_display: string | null; connection_health: string | null; revoked_at: string | null } | null;
  if (!g || g.revoked_at) return cfg.ready ? { status: 'not_connected' } : { status: 'not_configured' };
  if (g.connection_health === 'needs_reauth') return { status: 'needs_reconnect', account: g.external_account_display };
  return { status: 'connected', account: g.external_account_display };
}

/** How much of each event the shop's Drive already holds (from the copy ledger). Null = the read was refused. */
export async function readShopEventsCopied(
  shopId: string,
  eventIds: readonly string[],
): Promise<Record<string, { total: number; copied: number }> | null> {
  if (eventIds.length === 0) return {};
  const { data, error } = await createAdminClient()
    .from('drive_copy_artifacts')
    .select('event_id, drive_file_id')
    .eq('vendor_profile_id', shopId)
    .in('event_id', [...eventIds]);
  if (error) {
    logQueryError('readShopEventsCopied', error, { vendor_profile_id: shopId }, 'graceful_degrade');
    return null;
  }
  const out: Record<string, { total: number; copied: number }> = {};
  for (const r of (data ?? []) as { event_id: string; drive_file_id: string | null }[]) {
    const e = (out[r.event_id] ??= { total: 0, copied: 0 });
    e.total += 1;
    if (r.drive_file_id) e.copied += 1;
  }
  return out;
}

/** The files ONE event's copy holds for ONE shop — its filed files and its private album. */
export async function readShopEventCopyFiles(
  shopId: string,
  eventId: string,
): Promise<{ status: 'ok'; files: SupplierCopyFile[] } | { status: 'unread' }> {
  const admin = createAdminClient();
  const [filesRes, albumRes] = await Promise.all([
    admin
      .from('event_supplier_files')
      .select('file_id, event_id, vendor_profile_id, grp, file_name, mime, size_bytes, portfolio_ref, supplier_media(r2_ref, mime, size_bytes)')
      .eq('event_id', eventId)
      .eq('vendor_profile_id', shopId)
      .neq('grp', 'links'),
    admin
      .from('vendor_papic_portfolio_photos')
      .select('photo_id, event_id, vendor_profile_id, r2_object_key, hidden_at, nsfw_checked, created_at')
      .eq('event_id', eventId)
      .eq('vendor_profile_id', shopId)
      .is('hidden_at', null),
  ]);
  const err = filesRes.error ?? albumRes.error;
  if (err) {
    logQueryError('readShopEventCopyFiles', err, { event_id: eventId, vendor_profile_id: shopId }, 'graceful_degrade');
    return { status: 'unread' };
  }
  return {
    status: 'ok',
    files: supplierEventCopyFiles({
      shopId,
      eventId,
      files: (filesRes.data ?? []) as unknown as ShopEventFileRow[],
      album: (albumRes.data ?? []) as unknown as ShopAlbumRow[],
    }),
  };
}

/** A `since` from the page: the start of this copy (its first press), within the last hour — else now. */
function sinceOf(raw: string | null | undefined, nowMs: number): number {
  const t = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(t) && t <= nowMs && nowMs - t < 60 * 60 * 1000 ? t : nowMs;
}

/**
 * ONE PRESS of "Copy to Google Drive" for one event. Records every file of the event in the shared ledger (a file
 * already recorded is skipped — the no-duplicate rule), then copies what is not in the shop's Drive yet, for up to
 * `PRESS_BUDGET_MS`. Each file is tried at most ONCE per copy (`since` = the copy's first press): a file that failed
 * during this copy is counted as failed, never retried in a loop and never reported as copied.
 */
export async function copyShopEventToDrive(input: {
  shopId: string;
  eventId: string;
  since?: string | null;
}): Promise<CopyRunResult> {
  const startedAt = Date.now();
  const sinceMs = sinceOf(input.since, startedAt);
  const sinceIso = new Date(sinceMs).toISOString();
  const { shopId, eventId } = input;

  const read = await readShopEventCopyFiles(shopId, eventId);
  if (read.status !== 'ok') return { ok: false, reason: 'unread' };
  if (read.files.length === 0) return { ok: true, status: 'nothing_to_copy' };

  const cfg = await getDriveOAuthConfig();
  if (!cfg.ready) return { ok: false, reason: 'not_configured' };
  const token = await getShopDriveAccessToken(shopId);
  if (!token) {
    const drive = await readShopDrive(shopId);
    if (drive.status === 'unread') return { ok: false, reason: 'error' };
    return { ok: false, reason: drive.status === 'needs_reconnect' || drive.status === 'connected' ? 'needs_reconnect' : 'not_connected' };
  }

  try {
    // 1 · Record (no duplicates: the ledger's UNIQUE (event_id, r2_object_key) and enqueueDriveCopy's own skip).
    for (const type of SUPPLIER_DRIVE_ARTIFACT_TYPES) {
      const files = read.files.filter((f) => f.artifactType === type);
      if (files.length === 0) continue;
      await enqueueDriveCopy({
        eventId,
        artifactType: type,
        shopId,
        files: files.map((f) => ({
          r2ObjectKey: f.r2ObjectKey,
          fileName: f.fileName,
          mimeType: f.mimeType,
          sizeBytes: f.sizeBytes,
          sourceTable: f.sourceTable,
          sourceRef: f.sourceRef,
        })),
      });
    }

    const admin = createAdminClient();
    // 2 · A new copy gives every file not yet in the Drive a fresh go: files that failed BEFORE this copy started
    //     are tried again (a supplier's press is the retry). Files that failed during this copy stay failed.
    const { error: resetErr } = await admin
      .from('drive_copy_artifacts')
      .update({ attempt_count: 0 })
      .eq('vendor_profile_id', shopId)
      .eq('event_id', eventId)
      .is('drive_file_id', null)
      .or(`last_error_at.is.null,last_error_at.lt.${sinceIso}`);
    if (resetErr) {
      logQueryError('copyShopEventToDrive.reset', resetErr, { event_id: eventId }, 'graceful_degrade');
      return { ok: false, reason: 'error' };
    }

    // 3 · Copy until done or out of time. A batch that moved nothing means every file left failed during this copy.
    const notFailedThisCopy = (row: { last_error_at: string | null }) =>
      !row.last_error_at || Date.parse(row.last_error_at) < sinceMs;
    while (Date.now() - startedAt < PRESS_BUDGET_MS) {
      const r = await runDriveCopyBatch({ eventId, shopId, accessToken: token, batchSize: PRESS_BATCH, retryDue: notFailedThisCopy });
      if (r.uploaded === 0 && r.failed === 0) break;
    }

    // 4 · Count against the files the event holds NOW (a file removed from the event since an earlier copy is not owed).
    const { data, error } = await admin
      .from('drive_copy_artifacts')
      .select('r2_object_key, drive_file_id, last_error_at')
      .eq('vendor_profile_id', shopId)
      .eq('event_id', eventId);
    if (error) {
      logQueryError('copyShopEventToDrive.count', error, { event_id: eventId }, 'graceful_degrade');
      return { ok: false, reason: 'error' };
    }
    const byKey = new Map(
      ((data ?? []) as { r2_object_key: string; drive_file_id: string | null; last_error_at: string | null }[]).map((r) => [r.r2_object_key, r]),
    );
    let copied = 0;
    let failed = 0;
    for (const f of read.files) {
      const row = byKey.get(f.r2ObjectKey);
      if (row?.drive_file_id) copied += 1;
      else if (row && !notFailedThisCopy(row)) failed += 1;
    }
    const total = read.files.length;
    const counts = { total, copied, failed, remaining: Math.max(0, total - copied - failed) };
    return { ok: true, status: copyStatusOf(counts), since: sinceIso, ...counts };
  } catch (e) {
    console.error('[supplier-drive-copy] press failed', (e as Error).message);
    return { ok: false, reason: 'error' };
  }
}

/**
 * Forget the shop's copy bookkeeping (folders + per-file rows) — on disconnect, or when a DIFFERENT Google account is
 * connected: the folder ids and file ids belong to a Drive we can no longer write, and keeping them would make the next
 * copy skip every file. The files already in the old Drive are the supplier's and are not touched.
 */
export async function forgetShopDriveCopies(shopId: string): Promise<void> {
  const admin = createAdminClient();
  const [a, b] = await Promise.all([
    admin.from('drive_copy_artifacts').delete().eq('vendor_profile_id', shopId),
    admin.from('drive_copy_folders').delete().eq('vendor_profile_id', shopId),
  ]);
  const err = a.error ?? b.error;
  if (err) logQueryError('forgetShopDriveCopies', err, { vendor_profile_id: shopId }, 'graceful_degrade');
}
