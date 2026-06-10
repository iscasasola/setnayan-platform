// V2 Cutover Phase G — Camera Bridge offline upload handler stub.
//
// CLAUDE.md 2026-05-28 third row "V1 → V2 ARCHITECTURAL PIVOT LOCK" —
// Camera Bridge (DSLR transit) is one of 7 media services with
// offline-queue scaffolding. Stub returns
// `{ ok: false, error: 'V1.x post-pilot' }` until V1.x ships the
// DSLR-transit upload path (WiFi-SDK bridge → R2; USB tether is V2 —
// the locked V1 transport is WiFi-SDK only, see lib/camera-bridge).

import type { OfflineItem, SyncResult } from '../types';

export async function syncOne(_item: OfflineItem): Promise<SyncResult> {
  // TODO(V1.x · Camera Bridge O1): Wire to the DSLR transit upload path
  // (WiFi-SDK bridge → WAL → R2 + papic_photos INSERT) once the S0 Papic
  // sink ships. Core protocol + pairing FSM live in lib/camera-bridge
  // (build plan C1+C2); USB tether is V2.
  return { ok: false, error: 'V1.x post-pilot' };
}
