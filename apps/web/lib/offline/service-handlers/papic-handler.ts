// Papic offline upload handler — drains the `papic` IndexedDB queue.
//
// Group A · PR A1 replaces the V2-Phase-G stub (which returned
// `{ ok: false, error: 'V1.x post-pilot' }` so items stayed parked). The real
// drain lives in `papic-drain.ts` and replays the shipped seat delivery
// (presign /api/upload → PUT to R2 → recordSeatCapture). The seat capture UI
// enqueues a capture here only on an INFRASTRUCTURE failure, so a venue WiFi
// blip — or the paparazzo closing the tab before reconnecting — never loses a
// shot: the sync daemon (foreground + Background Sync) drains it on reconnect.

import type { OfflineItem, SyncResult } from '../types';
import { drainPapicCapture } from './papic-drain';

/**
 * Upload one Papic capture from the offline queue.
 *
 * @param item - Pending queue entry (seat token + bytes + kind in `payload`).
 * @returns `{ ok: true }` on a successful land (daemon dequeues) or
 *          `{ ok: false, error }` to keep the item visible with its reason.
 */
export async function syncOne(item: OfflineItem): Promise<SyncResult> {
  return drainPapicCapture(item);
}
