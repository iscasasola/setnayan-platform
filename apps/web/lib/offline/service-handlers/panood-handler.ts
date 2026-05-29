// V2 Cutover Phase G — Panood offline upload handler stub.
//
// CLAUDE.md 2026-05-28 third row "V1 → V2 ARCHITECTURAL PIVOT LOCK" —
// Panood (livestream cache) is one of 7 media services with offline-queue
// scaffolding. Stub returns `{ ok: false, error: 'V1.x post-pilot' }`
// until V1.x ships the real upload path (RTMP segment re-push or
// post-event archive sync, per the Panood architecture).

import type { OfflineItem, SyncResult } from '../types';

export async function syncOne(_item: OfflineItem): Promise<SyncResult> {
  // TODO(V1.x · Panood Phase G+2): Wire to RTMP segment re-push or
  // post-event Cloudflare Stream / YouTube archive sync per Panood
  // architecture. See CLAUDE.md 2026-05-28 third row.
  return { ok: false, error: 'V1.x post-pilot' };
}
