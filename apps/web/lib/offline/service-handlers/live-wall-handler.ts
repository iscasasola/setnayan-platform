// V2 Cutover Phase G — Live Wall offline upload handler stub.
//
// CLAUDE.md 2026-05-28 third row "V1 → V2 ARCHITECTURAL PIVOT LOCK" —
// Live Wall (gallery cache) is one of 7 media services with offline-
// queue scaffolding. Stub returns `{ ok: false, error: 'V1.x post-pilot' }`
// until V1.x ships the gallery-cache sync path (Live Wall WebSocket
// reconnect + replay).

import type { OfflineItem, SyncResult } from '../types';

export async function syncOne(_item: OfflineItem): Promise<SyncResult> {
  // TODO(V1.x · Live Wall Phase G+7): Wire to Live Wall WebSocket
  // reconnect + replay per V2 Live Wall architecture. See CLAUDE.md
  // 2026-05-28 third row.
  return { ok: false, error: 'V1.x post-pilot' };
}
