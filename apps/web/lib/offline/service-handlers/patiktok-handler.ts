// V2 Cutover Phase G — Patiktok offline upload handler stub.
//
// CLAUDE.md 2026-05-28 third row "V1 → V2 ARCHITECTURAL PIVOT LOCK" —
// Patiktok (booth video) is one of 7 media services with offline-queue
// scaffolding. Stub returns `{ ok: false, error: 'V1.x post-pilot' }`
// until V1.x ships the WASM-compiled booth video upload path per the
// V2 Patiktok architecture.

import type { OfflineItem, SyncResult } from '../types';

export async function syncOne(_item: OfflineItem): Promise<SyncResult> {
  // TODO(V1.x · Patiktok Phase G+3): Wire to WASM-compiled booth video
  // upload + TikTok master-channel post per V2 Patiktok architecture.
  // See CLAUDE.md 2026-05-28 third row + iteration 0017.
  return { ok: false, error: 'V1.x post-pilot' };
}
