// V2 Cutover Phase G — Papic offline upload handler stub.
//
// CLAUDE.md 2026-05-28 third row "V1 → V2 ARCHITECTURAL PIVOT LOCK"
// lists Papic (photo capture) as one of the 7 media services with offline
// queue scaffolding. Phase G ships ONLY the bus + stubs; the real upload
// path (R2 multipart, event_photos INSERT, face-detect kick-off) wires
// up in V1.x once the V2 Papic surface lands per the canonical brief.
//
// Stub contract: return `{ ok: false, error: 'V1.x post-pilot' }` so the
// sync daemon keeps items in the queue + the admin diagnostic surfaces
// the placeholder reason. Once a real handler lands here, it returns
// `{ ok: true }` on successful upload + the daemon dequeues.

import type { OfflineItem, SyncResult } from '../types';

/**
 * Upload one Papic capture from the offline queue. STUB — V1.x.
 *
 * @param item - Pending queue entry (unused in the stub).
 * @returns Always `{ ok: false, error: 'V1.x post-pilot' }` until the
 *          V1.x Papic upload pipeline ships.
 */
export async function syncOne(_item: OfflineItem): Promise<SyncResult> {
  // TODO(V1.x · Papic Phase G+1): Wire to R2 multipart upload + event_photos
  // INSERT. See CLAUDE.md 2026-05-28 third row for the V2 architecture.
  return { ok: false, error: 'V1.x post-pilot' };
}
