'use client';

// 🎫 The Check-in desk's side of the offline queue (EV3). A thin layer over the SHIPPED offline daemon
// (`lib/offline/db.ts` + `lib/offline/sync-daemon.ts`) — the desk has no queue of its own; a scan made with no signal
// is an `OfflineItem` in the daemon's `checkin` store, and it is sent by the daemon's `triggerSyncNow()`.
// Lazy-loaded by the desk (`import()`), so none of this is in the desk's first load.

import { dequeueOfflineItem, enqueueOfflineItem, listOfflineItems } from './db';
import { triggerSyncNow } from './sync-daemon';
import { setCheckinViewer, type CheckinMethod, type CheckinPayload } from './service-handlers/checkin-handler';

export { readCheckinNotes, dismissCheckinNote, type CheckinNote } from './service-handlers/checkin-handler';

export type QueuedCheckin = { itemId: string; guestId: string; scannedAt: string };

export async function queueCheckin(input: {
  viewer: string;
  eventId: string;
  guestId: string;
  name: string;
  method: CheckinMethod;
}): Promise<QueuedCheckin> {
  const scannedAt = new Date().toISOString();
  const payload: CheckinPayload = { viewer: input.viewer, guestId: input.guestId, name: input.name, method: input.method, scannedAt };
  const itemId = await enqueueOfflineItem('checkin', { event_id: input.eventId, payload, queued_at: scannedAt });
  return { itemId, guestId: input.guestId, scannedAt };
}

/** This account's unsent scans for this event, oldest first. */
export async function queuedCheckins(viewer: string, eventId: string): Promise<QueuedCheckin[]> {
  const items = await listOfflineItems('checkin');
  return items
    .filter((i) => i.event_id === eventId && (i.payload as Partial<CheckinPayload>).viewer === viewer)
    .map((i) => {
      const p = i.payload as Partial<CheckinPayload>;
      return { itemId: i.item_id, guestId: String(p.guestId ?? ''), scannedAt: String(p.scannedAt ?? i.queued_at) };
    })
    .filter((q) => q.guestId)
    .sort((a, b) => (a.scannedAt < b.scannedAt ? -1 : 1));
}

/** An unsent scan undone at the door — taken out of the queue before it is ever sent. */
export async function unqueueCheckin(itemId: string): Promise<void> {
  await dequeueOfflineItem('checkin', itemId);
}

/** Send what this account has queued (the daemon's own pass over every queue). Returns how many check-ins left. */
export async function sendQueuedCheckins(viewer: string): Promise<number> {
  setCheckinViewer(viewer);
  const summary = await triggerSyncNow();
  return summary.find((s) => s.service === 'checkin')?.synced ?? 0;
}
