'use client';

// lib/papic-upload/browser.ts — the ONE uploader on this page, wired to the
// browser: IndexedDB, fetch, the page's events, the Wake Lock, the tab lock.
//
// Every camera on the page (guest camera, supplier camera) hands shots to this
// same instance, so there is never a second sender.

import { PapicUploader, type UploaderDeps, type NewShot } from './replayer';
import * as store from './store';
import { attachBody, callLane, recordBody, signBody } from './lanes';
import { papicTransport } from './transport';
import { faceVectorsFrom, makeClipWebCopy, makePhotoPieces, makePoster } from './prepare';
import { newClientCaptureId } from '../papic-client-capture-id';

const TAB_LOCK = 'setnayan-papic-uploader';
const CHANNEL = 'setnayan-papic-uploader';

type ConnectionLike = { type?: string; saveData?: boolean };

/** An original goes on Wi-Fi, or when the browser will not say (iOS Safari). */
function fullAllowed(): boolean {
  const c = (navigator as Navigator & { connection?: ConnectionLike }).connection;
  if (!c) return true;
  if (c.saveData) return false;
  if (typeof c.type !== 'string' || c.type === 'unknown' || c.type === 'other') return true;
  return c.type === 'wifi' || c.type === 'ethernet';
}

function makeDeps(): UploaderDeps {
  return {
    store,
    transport: papicTransport,
    call: callLane,
    bodies: { sign: signBody, record: recordBody, attach: attachBody },
    prepare: {
      photoPieces: makePhotoPieces,
      poster: makePoster,
      clipWeb: makeClipWebCopy,
      faceVectors: faceVectorsFrom,
    },
    now: () => Date.now(),
    random: () => Math.random(),
    fullAllowed,
    online: () => navigator.onLine !== false,
    setTimer: (fn, ms) => window.setTimeout(fn, ms),
    clearTimer: (t) => window.clearTimeout(t as number),
  };
}

let instance: PapicUploader | null = null;
let channel: BroadcastChannel | null = null;
let wakeLock: { release: () => Promise<void> } | null = null;

async function syncWakeLock(u: PapicUploader): Promise<void> {
  const wl = (navigator as Navigator & {
    wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void>; addEventListener?: (e: string, f: () => void) => void }> };
  }).wakeLock;
  const want = u.pending() > 0 && document.visibilityState === 'visible';
  try {
    if (want && !wakeLock && wl) {
      const lock = await wl.request('screen');
      wakeLock = lock;
      lock.addEventListener?.('release', () => {
        if (wakeLock === lock) wakeLock = null;
      });
    } else if (!want && wakeLock) {
      const l = wakeLock;
      wakeLock = null;
      await l.release();
    }
  } catch {
    // Not supported / refused (battery saver): the queue still works.
  }
}

/** Re-file shots saved by the old queue (multipart payloads, before 2026-10-23). */
async function adoptLegacy(u: PapicUploader): Promise<void> {
  let items: Awaited<ReturnType<typeof store.loadLegacyItems>> = [];
  try {
    items = await store.loadLegacyItems();
  } catch {
    return;
  }
  for (const item of items) {
    const p = item.payload as Record<string, unknown>;
    const bytes = p.bytes;
    const primary =
      bytes instanceof Blob ? bytes : bytes instanceof ArrayBuffer ? new Blob([bytes], { type: String(p.content_type ?? '') }) : null;
    if (!primary) {
      await store.dropLegacyItem(item.item_id).catch(() => {});
      continue;
    }
    const poster = p.poster_bytes instanceof Blob ? p.poster_bytes : null;
    const shot: NewShot = {
      id: typeof p.client_capture_id === 'string' ? p.client_capture_id : newClientCaptureId(),
      lane: p.mode === 'vendor' ? 'vendor' : 'guest',
      eventId: p.mode === 'vendor' ? String(p.event_id ?? item.event_id) : item.event_id,
      media: p.media_type === 'clip' ? 'clip' : 'photo',
      capturedAtMs: typeof p.captured_at_ms === 'number' && p.captured_at_ms > 0 ? p.captured_at_ms : Date.parse(item.queued_at) || Date.now(),
      durationMs: typeof p.duration_ms === 'number' ? p.duration_ms : undefined,
      sharePublicly: p.share_publicly === true,
      consent: p.mode === 'vendor' ? true : undefined,
      deviceModel: typeof p.device_model === 'string' ? p.device_model : undefined,
      primary,
      poster,
    };
    try {
      await u.addShot(shot);
      await store.dropLegacyItem(item.item_id);
    } catch {
      // leave it for the next visit
    }
  }
}

/** The page's uploader. Starts it on first use (browser only). */
export function papicUploader(): PapicUploader {
  if (instance) return instance;
  const u = new PapicUploader(makeDeps());
  instance = u;
  if (typeof window === 'undefined') return u;

  // One sender across tabs (Web Locks: Safari 15.4+, Chrome 69+). A tab that is
  // not the sender saves shots and tells the sender; when the sender's tab
  // closes, the next tab takes over. Without Web Locks every tab sends — safe,
  // because every piece and every record is idempotent by the shutter's id.
  const locks = (navigator as Navigator & {
    locks?: { request: (name: string, cb: () => Promise<void>) => Promise<void> };
  }).locks;
  if (locks) {
    u.sender = false;
    void locks.request(TAB_LOCK, () => {
      u.sender = true;
      void u.reload();
      return new Promise<void>(() => {}); // held for the life of the page
    });
  }
  try {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = () => void u.reload();
  } catch {
    channel = null;
  }

  // Ask the browser to keep this site's storage under pressure (the queue holds
  // shots nobody else has yet). Best-effort; never asked twice per page.
  try {
    void navigator.storage?.persist?.();
  } catch {
    /* unsupported */
  }

  const wake = () => u.wake();
  window.addEventListener('online', wake);
  window.addEventListener('offline', () => u.wake());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') u.wake();
    void syncWakeLock(u);
  });
  // The sender tells the other tabs whenever its queue moves, so their chip
  // follows the truth instead of a stale "Sending" (review 2026-10-23, minor 9).
  let postTimer: number | null = null;
  u.subscribe(() => {
    void syncWakeLock(u);
    if (!u.sender || !channel || postTimer !== null) return;
    // Trailing, at most twice a second — the last change is always announced.
    postTimer = window.setTimeout(() => {
      postTimer = null;
      try {
        channel?.postMessage('changed');
      } catch {
        /* closed */
      }
    }, 500);
  });

  void (async () => {
    await u.load();
    await adoptLegacy(u);
    u.kick();
  })();
  return u;
}

/** Hand a shot to the uploader and tell other tabs. */
export async function saveShot(shot: NewShot): Promise<void> {
  const u = papicUploader();
  await u.addShot(shot);
  try {
    channel?.postMessage('changed');
  } catch {
    /* closed */
  }
}
