// V2 Cutover Phase G — Same-day-edit (SDE) offline upload handler stub.
//
// CLAUDE.md 2026-05-28 third row "V1 → V2 ARCHITECTURAL PIVOT LOCK" —
// SDE (same-day-edit working copies) is one of 7 media services with
// offline-queue scaffolding. Stub returns
// `{ ok: false, error: 'V1.x post-pilot' }` until V1.x ships the SDE
// working-copy sync path (FFmpeg working render + callback to editor).

import type { OfflineItem, SyncResult } from '../types';

export async function syncOne(_item: OfflineItem): Promise<SyncResult> {
  // TODO(V1.x · SDE Phase G+5): Wire to FFmpeg working-render upload +
  // editor callback per V2 SDE architecture. See CLAUDE.md 2026-05-28
  // third row.
  return { ok: false, error: 'V1.x post-pilot' };
}
