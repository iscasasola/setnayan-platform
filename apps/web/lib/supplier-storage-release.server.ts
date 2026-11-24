import 'server-only';

import { keyMayBeLedgered } from '@/lib/supplier-storage';

/**
 * lib/supplier-storage-release.server.ts — A DELETED SHOP UPLOAD STOPS COUNTING.
 *
 * The meter's ledger (`supplier_stored_files`, migration 20271360925434) counts an upload until its object is deleted.
 * The delete choke points call this after the object is gone: the cleanup executor (lib/cleanup-delete.ts) and
 * `deletePublicAsset` (lib/storage.ts). Best-effort: it never throws, and it asks the database only for a key the
 * ledger can hold (`keyMayBeLedgered`), so bulk sweeps of other folders add no call. Kept out of lib/r2.ts on purpose:
 * the R2 primitive must not reach a database client (app/sample/the-sample-hub-reaches-no-table.test.ts).
 */
export async function releaseDeletedShopUpload(bucket: string, key: string): Promise<void> {
  try {
    if (!keyMayBeLedgered(key)) return;
    const [{ createAdminClient }, { releaseShopUpload }] = await Promise.all([
      import('@/lib/supabase/admin'),
      import('@/lib/supplier-storage.server'),
    ]);
    await releaseShopUpload(createAdminClient(), `r2://${bucket}/${key}`);
  } catch (e) {
    console.error('[supplier-storage] delete not released from the meter', key, e instanceof Error ? e.message : e);
  }
}
