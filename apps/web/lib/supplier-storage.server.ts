import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  isMediaContentType,
  roomFullMessage,
  storageAllowanceBytes,
  storageFitsUpload,
  mediaFullMessage,
  storageTotal,
  type StorageBreakdown,
  type StorageBreakdownRead,
  type UploadKind,
} from '@/lib/supplier-storage';

/**
 * lib/supplier-storage.server.ts — THE PLAN HOLDS STORAGE, THE READS (lib/supplier-storage.ts is the rule).
 *
 * Service role only: `vendor_storage_used_bytes` is granted to it alone. Every caller resolves the shop from the
 * SESSION first (a tenancy check, or the shop's own profile) and only then asks — the id is never taken from a client.
 */

/** What a shop stores against its allowance — or that it could not be read. Never a 0 in place of "unread". */
export type StoredBytesRead = { status: 'ok'; bytes: number } | { status: 'unread' };

/**
 * 🔑 HONEST READ: everything the shop stores — the TOTAL of the one breakdown read (`readStorageBreakdown`), so the
 * limits sheet, the Plans page meter and the upload gate cannot disagree. A refused or malformed answer is `unread`,
 * never 0 — "0 MB of 5 GB used" to a shop holding 4 GB would invite the upload the database then refuses.
 */
export async function readStoredBytes(admin: SupabaseClient, vendorProfileId: string): Promise<StoredBytesRead> {
  const read = await readStorageBreakdown(admin, vendorProfileId);
  return read.status === 'ok' ? { status: 'ok', bytes: storageTotal(read.breakdown) } : { status: 'unread' };
}

export type StorageCheck =
  | { kind: 'fits' }
  /** The sentence names the plan, what is left, and the way up. */
  | { kind: 'full'; message: string }
  /** The plan or the usage could not be read — the caller refuses (a cap that waves uploads through when blind is no cap). */
  | { kind: 'unavailable' };

/**
 * 📏 THE ONE READ (`vendor_storage_breakdown`, migration 20271360925434): Photos & video · Files · Records, the chat &
 * documents room's use and the evidence share, in ONE call. A refused or malformed answer is `unread`, never zeros.
 * Service role only — the caller resolved the shop from the session first.
 */
export async function readStorageBreakdown(admin: SupabaseClient, vendorProfileId: string): Promise<StorageBreakdownRead> {
  try {
    const { data, error } = await admin.rpc('vendor_storage_breakdown', { p_vendor_profile_id: vendorProfileId });
    if (error) {
      console.error('[supplier-storage] breakdown unreadable', vendorProfileId, error.message);
      return { status: 'unread' };
    }
    const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null | undefined;
    const n = (k: string): number => {
      const v = row?.[k];
      const x = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
      return Number.isFinite(x) && x >= 0 ? x : NaN;
    };
    const breakdown: StorageBreakdown = {
      photosVideo: n('photos_video_bytes'),
      files: n('files_bytes'),
      records: n('records_bytes'),
      room: n('room_bytes'),
      evidence: n('evidence_bytes'),
      recordsMeasuredAt: typeof row?.records_measured_at === 'string' ? row.records_measured_at : null,
    };
    if ([breakdown.photosVideo, breakdown.files, breakdown.records, breakdown.room, breakdown.evidence].some((x) => Number.isNaN(x))) {
      console.error('[supplier-storage] breakdown malformed', vendorProfileId, data);
      return { status: 'unread' };
    }
    return { status: 'ok', breakdown };
  } catch (e) {
    console.error('[supplier-storage] breakdown read threw', vendorProfileId, e instanceof Error ? e.message : e);
    return { status: 'unread' };
  }
}

/**
 * May `incomingBytes` more be stored by this shop? Asked by `/api/upload` BEFORE the PUT is signed (every shop upload,
 * not only event files), so a file that does not fit never reaches storage. The plan is the shop's `tier_state` — the
 * same column the database's backstop (`enforce_supplier_storage_allowance`) reads. `kind` says media or a document,
 * and whether it is EVIDENCE (contracts, receipts, payment proofs, verification papers): evidence always fits — it is
 * counted, never refused (owner 22 Nov, spec § ★ K). Default: media, not evidence.
 */
export async function checkSupplierStorage(
  admin: SupabaseClient,
  vendorProfileId: string,
  incomingBytes: number,
  kind: UploadKind = { media: true, evidence: false },
): Promise<StorageCheck> {
  if (kind.evidence) return { kind: 'fits' }; // never refused, never even blind-refused
  const shop = await admin
    .from('vendor_profiles')
    .select('tier_state')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle()
    .then(
      (r) => r,
      () => ({ data: null, error: { message: 'threw' } }),
    );
  if (shop.error || !shop.data) {
    console.error('[supplier-storage] plan unreadable', vendorProfileId, shop.error?.message ?? 'no row');
    return { kind: 'unavailable' };
  }
  const plan = (shop.data as { tier_state: string | null }).tier_state;
  if (storageAllowanceBytes(plan) === null) return { kind: 'fits' }; // no allowance on this plan
  const read = await readStorageBreakdown(admin, vendorProfileId);
  if (read.status !== 'ok') return { kind: 'unavailable' };
  const fit = storageFitsUpload(plan, read.breakdown, incomingBytes, kind);
  if (fit.fits) return { kind: 'fits' };
  return {
    kind: 'full',
    message: fit.inRoom ? roomFullMessage(plan) : mediaFullMessage(plan, read.breakdown, incomingBytes),
  };
}

/**
 * 🧾 THE SIZE OF AN UPLOAD NO OTHER TABLE RECORDS (`supplier_stored_files`). Written when the upload is signed — the
 * presign pins the length, so `bytes` is the real size. One row per object (a re-sign of the same key replaces it).
 * Never throws: a failed write is logged and the upload goes on (the nightly measure does not see files, so a missed
 * row is a file the meter under-counts — said in the log, never a refused upload).
 */
export async function recordShopUpload(
  admin: SupabaseClient,
  row: { vendorProfileId: string; objectRef: string; bytes: number; contentType: string | null; evidence?: boolean },
): Promise<void> {
  try {
    const { error } = await admin.from('supplier_stored_files').upsert(
      {
        object_ref: row.objectRef,
        vendor_profile_id: row.vendorProfileId,
        bytes: Math.max(0, Math.round(row.bytes)),
        content_type: row.contentType,
        room: isMediaContentType(row.contentType) ? 'media' : 'documents',
        evidence: Boolean(row.evidence),
        released_at: null,
      },
      { onConflict: 'object_ref' },
    );
    if (error) console.error('[supplier-storage] upload size not recorded', row.objectRef, error.message);
  } catch (e) {
    console.error('[supplier-storage] upload size record threw', row.objectRef, e instanceof Error ? e.message : e);
  }
}

/**
 * The same, for a file a SERVER ACTION stored for the shop (`uploadPublicAsset` / `r2Upload`): a handover file, a
 * mood-board suggestion, the marked public copy of a shop photo (SHOP_UPLOAD_ROOTS `server-ledger`).
 */
export async function recordServerShopUpload(
  admin: SupabaseClient,
  vendorProfileId: string,
  stored: { bucket: string; key: string; bytes: number; contentType: string | null },
): Promise<void> {
  await recordShopUpload(admin, {
    vendorProfileId,
    objectRef: `r2://${stored.bucket}/${stored.key}`,
    bytes: stored.bytes,
    contentType: stored.contentType,
  });
}

/** The object was deleted: it stops counting (`r2Delete` calls this). Never throws. */
export async function releaseShopUpload(admin: SupabaseClient, objectRef: string): Promise<void> {
  try {
    const { error } = await admin
      .from('supplier_stored_files')
      .update({ released_at: new Date().toISOString() })
      .eq('object_ref', objectRef)
      .is('released_at', null);
    if (error) console.error('[supplier-storage] release not recorded', objectRef, error.message);
  } catch (e) {
    console.error('[supplier-storage] release threw', objectRef, e instanceof Error ? e.message : e);
  }
}

/**
 * The sentence for the DATABASE's refusal (`enforce_supplier_storage_allowance` — a re-link of a copy whose last file
 * was removed, or a chat photo filed under a service): the same words `/api/upload` uses, with this shop's numbers. When
 * those cannot be read, the plain reason without numbers — still with the way up.
 */
export async function storageRefusalWords(admin: SupabaseClient, vendorProfileId: string, incomingBytes: number): Promise<string> {
  const room = await checkSupplierStorage(admin, vendorProfileId, incomingBytes).catch(() => ({ kind: 'unavailable' }) as const);
  return room.kind === 'full'
    ? room.message
    : 'This file does not fit the storage your plan holds. Remove files from an event to make room, or move to a plan that holds more. Nothing you stored was changed.';
}
