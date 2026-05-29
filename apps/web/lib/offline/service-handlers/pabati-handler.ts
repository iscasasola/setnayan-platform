// V2 Cutover Phase G — Pabati offline upload handler stub.
//
// CLAUDE.md 2026-05-28 third row "V1 → V2 ARCHITECTURAL PIVOT LOCK" —
// Pabati (guest clips) is one of 7 media services with offline-queue
// scaffolding. Stub returns `{ ok: false, error: 'V1.x post-pilot' }`
// until V1.x ships the guest-clip upload path.

import type { OfflineItem, SyncResult } from '../types';

export async function syncOne(_item: OfflineItem): Promise<SyncResult> {
  // TODO(V1.x · Pabati Phase G+4): Wire to guest-clip R2 upload + gallery
  // attach per V2 Pabati architecture. See CLAUDE.md 2026-05-28 third row.
  return { ok: false, error: 'V1.x post-pilot' };
}
