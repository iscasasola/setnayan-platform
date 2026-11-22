import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { storageAllowanceBytes, storageFits, storageFullMessage } from '@/lib/supplier-storage';
import { holdsBoughtExtras } from '@/lib/vendor-tier-caps';
import { readLiveUltraAddOns } from '@/lib/vendor-ultra-addons';

/**
 * lib/supplier-storage.server.ts — THE PLAN HOLDS STORAGE, THE READS (lib/supplier-storage.ts is the rule).
 *
 * Service role only: `vendor_storage_used_bytes` is granted to it alone. Every caller resolves the shop from the
 * SESSION first (a tenancy check, or the shop's own profile) and only then asks — the id is never taken from a client.
 */

/** What a shop stores against its allowance — or that it could not be read. Never a 0 in place of "unread". */
export type StoredBytesRead = { status: 'ok'; bytes: number } | { status: 'unread' };

/**
 * 🔑 HONEST READ: what the shop stores (`vendor_storage_used_bytes` — each stored copy a filed event file still points
 * at, once). A refused or malformed answer is `unread`, never 0 — "0 MB of 5 GB used" to a shop holding 4 GB would
 * invite the upload the database then refuses.
 */
export async function readStoredBytes(admin: SupabaseClient, vendorProfileId: string): Promise<StoredBytesRead> {
  try {
    const { data, error } = await admin.rpc('vendor_storage_used_bytes', { p_vendor_profile_id: vendorProfileId });
    if (error) {
      console.error('[supplier-storage] usage unreadable', vendorProfileId, error.message);
      return { status: 'unread' };
    }
    const bytes = typeof data === 'number' ? data : typeof data === 'string' ? Number(data) : NaN;
    if (!Number.isFinite(bytes) || bytes < 0) {
      console.error('[supplier-storage] usage malformed', vendorProfileId, data);
      return { status: 'unread' };
    }
    return { status: 'ok', bytes };
  } catch (e) {
    console.error('[supplier-storage] usage read threw', vendorProfileId, e instanceof Error ? e.message : e);
    return { status: 'unread' };
  }
}

export type StorageCheck =
  | { kind: 'fits' }
  /** The sentence names the plan, what is left, and the way up. */
  | { kind: 'full'; message: string }
  /**
   * The plan, the usage or the Ultra Add-ons the shop holds could not be read — the caller refuses with "couldn't
   * check" (a cap that waves uploads through when blind is no cap), and NEVER says "full": full is a measured fact.
   */
  | { kind: 'unavailable' };

/**
 * May `incomingBytes` more be stored by this shop? Asked by `/api/upload` BEFORE the PUT is signed, so a file that does
 * not fit never reaches storage. The plan is the shop's `tier_state` — the same column the database's backstop
 * (`enforce_supplier_storage_allowance`) reads, so the two cannot disagree about which plan applies.
 */
export async function checkSupplierStorage(
  admin: SupabaseClient,
  vendorProfileId: string,
  incomingBytes: number,
): Promise<StorageCheck> {
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
  // 🛒 +50 GB per Ultra Add-on held NOW (owner 2026-11-19; 28 days per payment) — the same live count the database
  // gate adds. Asked only on a plan that holds bought extras (Ultra); every other plan's allowance is the plan's own.
  const live = holdsBoughtExtras(plan) ? await readLiveUltraAddOns(admin, vendorProfileId) : ({ status: 'ok', count: 0 } as const);
  const used = await readStoredBytes(admin, vendorProfileId);
  if (used.status !== 'ok') return { kind: 'unavailable' };
  if (live.status !== 'ok') {
    // 🔑 A FAILED ADD-ON READ IS NEVER "FULL" (ship review of PR #8019, 22 Nov). It used to count as 0 add-ons, so an
    // Ultra shop paying for +50 GB was told "your Ultra plan's 20 GB of storage is full" — a sentence about the shop,
    // made from a read that failed. What is still known: the plan's OWN allowance is a floor (an add-on only adds),
    // so a file that fits it fits. Past that floor the answer is unknown: `unavailable`, said as "couldn't check".
    return storageFits(plan, used.bytes, incomingBytes, 0) ? { kind: 'fits' } : { kind: 'unavailable' };
  }
  return storageFits(plan, used.bytes, incomingBytes, live.count)
    ? { kind: 'fits' }
    : { kind: 'full', message: storageFullMessage(plan, used.bytes, incomingBytes, live.count) };
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
