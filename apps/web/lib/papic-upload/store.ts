// lib/papic-upload/store.ts — where a saved shot waits: the existing IndexedDB
// `papic` store (lib/offline/db.ts), the same one the old offline queue used.
//
// Two kinds of item, told apart by `payload.mode`:
//   'save-first'      — one per shot: its state (QueuedShot). Small; rewritten
//                       as the shot progresses.
//   'save-first-blob' — one per piece: the bytes. Written once, deleted the
//                       moment its piece is settled with the server, so the
//                       phone keeps only what it has not sent yet — and only
//                       compressed copies (relay: "the queue keeps only
//                       compressed copies").
//
// Splitting them means a state change never rewrites megabytes of bytes.
//
// `lib/offline/sync-daemon.ts` SKIPS both kinds: the page-side replayer
// (`replayer.ts`) is the only thing that sends them. Two senders over one
// queue race (brief 2026-10-23).

import {
  dequeueOfflineItem,
  enqueueOfflineItem,
  listOfflineItems,
  updateOfflineItem,
} from '../offline/db';
import type { OfflineItem } from '../offline/types';
import type { QueuedShot } from './schedule';
import type { CaptureTier } from './tiers';

export const SHOT_MODE = 'save-first';
export const BLOB_MODE = 'save-first-blob';
/** Bytes kept locally that are never uploaded (the clean frame for the face pass). */
export type LocalPiece = CaptureTier | 'face' | 'source';

const shotItemId = (id: string) => `ps:${id}`;
const blobItemId = (id: string, piece: LocalPiece) => `pb:${id}:${piece}`;

export async function saveShot(shot: QueuedShot): Promise<void> {
  const item: OfflineItem = {
    item_id: shotItemId(shot.id),
    event_id: shot.eventId,
    queued_at: new Date(shot.queuedAtMs).toISOString(),
    payload: { mode: SHOT_MODE, shot: shot as unknown as Record<string, unknown> },
    retry_count: shot.attempts,
    last_error: shot.lastError ?? undefined,
  };
  await updateOfflineItem('papic', item);
}

export async function saveBlob(shot: Pick<QueuedShot, 'id' | 'eventId'>, piece: LocalPiece, blob: Blob): Promise<void> {
  try {
    await enqueueOfflineItem('papic', {
      item_id: blobItemId(shot.id, piece),
      event_id: shot.eventId,
      payload: { mode: BLOB_MODE, shot_id: shot.id, piece, blob },
    });
  } catch {
    // 🧭 SAFARI'S PRIVATE / EPHEMERAL STORAGE REFUSES A Blob IN IndexedDB
    // ("Error preparing Blob/File data to be stored") but takes the same bytes
    // as an ArrayBuffer. Measured in Playwright WebKit, 2026-10-23.
    const buffer = await blob.arrayBuffer();
    await enqueueOfflineItem('papic', {
      item_id: blobItemId(shot.id, piece),
      event_id: shot.eventId,
      payload: { mode: BLOB_MODE, shot_id: shot.id, piece, buffer, type: blob.type },
    });
  }
}

export async function loadBlob(shotId: string, piece: LocalPiece): Promise<Blob | null> {
  // listOfflineItems has no by-key read; a shot's pieces are few, and the
  // getAll handles are lazy (the bytes are not read until used).
  const items = await listOfflineItems('papic');
  const hit = items.find((i) => i.item_id === blobItemId(shotId, piece));
  const blob = hit?.payload?.blob;
  if (blob instanceof Blob) return blob;
  const buffer = hit?.payload?.buffer;
  if (buffer instanceof ArrayBuffer) {
    return new Blob([buffer], { type: typeof hit?.payload?.type === 'string' ? hit.payload.type : '' });
  }
  return null;
}

export async function deleteBlob(shotId: string, piece: LocalPiece): Promise<void> {
  await dequeueOfflineItem('papic', blobItemId(shotId, piece));
}

export async function deleteShot(shot: Pick<QueuedShot, 'id'>, pieces: readonly LocalPiece[]): Promise<void> {
  for (const p of pieces) await dequeueOfflineItem('papic', blobItemId(shot.id, p)).catch(() => {});
  await dequeueOfflineItem('papic', shotItemId(shot.id));
}

/** Every saved shot (state only). */
export async function loadShots(): Promise<QueuedShot[]> {
  const items = await listOfflineItems('papic');
  return items
    .filter((i) => i.payload?.mode === SHOT_MODE && i.payload.shot && typeof i.payload.shot === 'object')
    .map((i) => i.payload.shot as unknown as QueuedShot);
}

/** Old-format items (multipart payloads, before 2026-10-23) to re-file as shots. */
export async function loadLegacyItems(): Promise<OfflineItem[]> {
  const items = await listOfflineItems('papic');
  return items.filter((i) => i.payload?.mode === 'guest' || i.payload?.mode === 'vendor');
}

export async function dropLegacyItem(itemId: string): Promise<void> {
  await dequeueOfflineItem('papic', itemId);
}
