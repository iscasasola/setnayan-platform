// 🎫 Check-in desk offline handler — drains the `checkin` IndexedDB queue (EV3, owner 2026-10-28: "scans and photo
// uploads QUEUE offline and sync later; double claims surfaced, never lost").
//
// The desk enqueues a check-in here only when it could not reach the server (no signal, or the request failed on the
// way). The daemon replays it through the SHIPPED action (`checkInGuest`), with the time it was scanned at the door.
//
// THE THREE ENDINGS, none of them silent:
//   · sent                          → dequeued; the desk's "back online · N sent" counts it.
//   · ALREADY checked in (another phone got there first) → dequeued, and a NOTE says so, with the earlier time kept.
//   · REFUSED now (the couple declined the request since, the guest was removed, the scanner lost the door) →
//     dequeued, and a NOTE says why — the door crew sees it; nothing is quietly dropped.
//   · no signal / a server error    → stays queued (`ok: false`); the next pass retries.
// A scan made by one account is only ever sent by that same account (`payload.viewer` must equal the account the desk
// says is signed in, `setCheckinViewer`) — a second person on a shared phone never sends, or reads, the first's scans.

import type { OfflineItem, SyncResult } from '../types';

export type CheckinMethod = 'qr_scan' | 'nfc_tap' | 'manual_search';

export type CheckinPayload = {
  viewer: string;
  guestId: string;
  /** The guest's name as the desk showed it — for the note, if one is needed. */
  name: string;
  method: CheckinMethod;
  /** When it was scanned at the door (ISO). */
  scannedAt: string;
};

export type CheckinNote = {
  viewer: string;
  eventId: string;
  guestId: string;
  name: string;
  scannedAt: string;
  kind: 'already' | 'refused' | 'gave-up';
  detail: string;
};

const NOTES_KEY = 'sn-offline-checkin-notes:v1';
const MAX_NOTES = 200;

let activeViewer: string | null = null;

/** The desk says who is signed in; only that account's queued scans are sent. */
export function setCheckinViewer(viewer: string | null): void {
  activeViewer = viewer;
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function readAll(): CheckinNote[] {
  const s = storage();
  if (!s) return [];
  try {
    const parsed = JSON.parse(s.getItem(NOTES_KEY) ?? '[]');
    return Array.isArray(parsed) ? (parsed as CheckinNote[]) : [];
  } catch {
    return [];
  }
}

function writeAll(notes: CheckinNote[]): void {
  try {
    storage()?.setItem(NOTES_KEY, JSON.stringify(notes.slice(-MAX_NOTES)));
  } catch {
    // Quota / private mode: the note cannot be kept — the scan's server outcome stands either way.
  }
}

export function recordCheckinNote(note: CheckinNote): void {
  writeAll([...readAll().filter((n) => !(n.viewer === note.viewer && n.eventId === note.eventId && n.guestId === note.guestId)), note]);
}

/** This account's notes for this event — what the desk shows under "Needs a look". */
export function readCheckinNotes(viewer: string, eventId: string): CheckinNote[] {
  return readAll().filter((n) => n.viewer === viewer && n.eventId === eventId);
}

export function dismissCheckinNote(viewer: string, eventId: string, guestId: string): void {
  writeAll(readAll().filter((n) => !(n.viewer === viewer && n.eventId === eventId && n.guestId === guestId)));
}

function payloadOf(item: OfflineItem): Partial<CheckinPayload> {
  return (item.payload ?? {}) as Partial<CheckinPayload>;
}

function clock(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' });
  } catch {
    return '';
  }
}

/** The daemon gave up on an item (7 days / 50 tries): it is NOT dropped silently — a note says so. */
export function noteGaveUp(item: OfflineItem): void {
  const p = payloadOf(item);
  if (!p.viewer || !p.guestId) return;
  recordCheckinNote({
    viewer: p.viewer,
    eventId: item.event_id,
    guestId: p.guestId,
    name: p.name ?? 'A guest',
    scannedAt: p.scannedAt ?? item.queued_at,
    kind: 'gave-up',
    detail: `Scanned at ${clock(p.scannedAt ?? item.queued_at)} but never reached Setnayan — check them in again.`,
  });
}

export async function syncOne(item: OfflineItem): Promise<SyncResult> {
  const p = payloadOf(item);
  if (!p.viewer || p.viewer !== activeViewer) return { ok: false, error: 'Waiting for the account that scanned it.' };
  if (!p.guestId) return { ok: false, error: 'No guest on this scan.' };
  let result: Awaited<ReturnType<typeof import('@/app/dashboard/[eventId]/guests/checkin/actions').checkInGuest>>;
  try {
    // Imported on use: the daemon module is also read where a server action cannot be (its unit tests, the admin page).
    const { checkInGuest } = await import('@/app/dashboard/[eventId]/guests/checkin/actions');
    result = await checkInGuest(item.event_id, p.guestId, p.method ?? 'qr_scan', p.scannedAt);
  } catch {
    return { ok: false, error: 'No signal — kept on this phone.' };
  }
  const base = {
    viewer: p.viewer,
    eventId: item.event_id,
    guestId: p.guestId,
    name: p.name ?? 'A guest',
    scannedAt: p.scannedAt ?? item.queued_at,
  };
  if (result.ok) {
    if (result.already) {
      recordCheckinNote({
        ...base,
        kind: 'already',
        detail: `Already checked in at ${clock(result.checkedInAt)} — that earlier time is kept.`,
      });
    }
    return { ok: true };
  }
  if (result.refused) {
    recordCheckinNote({ ...base, kind: 'refused', detail: result.error });
    return { ok: true };
  }
  return { ok: false, error: result.error };
}
