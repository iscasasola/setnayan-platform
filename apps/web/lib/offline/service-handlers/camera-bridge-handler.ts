// V2 Cutover Phase G — Camera Bridge offline upload handler stub.
//
// CLAUDE.md 2026-05-28 third row "V1 → V2 ARCHITECTURAL PIVOT LOCK" —
// Camera Bridge (DSLR transit) is one of 7 media services with
// offline-queue scaffolding. Stub returns
// `{ ok: false, error: 'V1.x post-pilot' }` until V1.x ships the
// DSLR-transit upload path (USB/WiFi tether bridge → R2).

import type { OfflineItem, SyncResult } from '../types';

export async function syncOne(_item: OfflineItem): Promise<SyncResult> {
  // TODO(V1.x · Camera Bridge Phase G+6): Wire to DSLR transit upload
  // path (USB/WiFi tether bridge → R2 + event_photos INSERT) per V2
  // Camera Bridge architecture. See CLAUDE.md 2026-05-28 third row.
  return { ok: false, error: 'V1.x post-pilot' };
}
