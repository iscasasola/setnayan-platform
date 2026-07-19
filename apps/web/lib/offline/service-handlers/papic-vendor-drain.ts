// Vendor on-the-day Papic capture — durable OFFLINE queue (recon item
// vendor-papic#offline).
//
// The vendor capture controller (merged #3388) fires uploads non-blocking, but
// until this module a tab dying offline lost the capture — and weak-signal
// venues are the norm. This mirrors the couple-side GUEST pattern in
// `papic-drain.ts` exactly: the vendor lane is the same shape (a cookie-authed
// multipart POST — here to /api/vendor/papic-capture — with server-side PUT +
// budget enforcement), so its drain re-POSTs the same form rather than
// presign+record. Items ride the SAME shared `papic` IndexedDB store,
// discriminated by `payload.mode === 'vendor'` (the established idiom — the
// guest path already discriminates with `mode: 'guest'`), so the existing sync
// daemon (foreground drain on mount/`online` + Background Sync where available)
// drains vendor items with zero orchestrator changes.
//
// A separate module (rather than growing `papic-drain.ts`) keeps the couple
// path's file untouched except a 2-line dispatch branch — the vendor lane can
// evolve without touching the shipped seat/guest drains.
//
// Flag posture: the capture surface AND /api/vendor/papic-capture are both
// gated by the `vendor_papic_capture` Data Privacy control (default OFF), so an
// item can only ever be ENQUEUED from the approved surface, and a drain that
// meets the closed gate (`disabled`) resolves the item — the browser never
// retains guest PI hammering a counsel-closed door.
//
// Failure policy (mirrors the guest drain):
//   • infra failure (network / 5xx / uploads_unavailable) → item stays queued,
//     the daemon retries (7-day TTL eviction is the backstop)
//   • TERMINAL server rejection (out_of_points / video_not_allowed / disabled /
//     consent_required / not_allowed / …) → the capture can never land, so the
//     drain resolves (drops) the item instead of retrying forever
//   • `no_session` is NOT terminal — the vendor may sign back in, after which
//     the same cookie-authed re-POST succeeds.

import { enqueueOfflineItem, listOfflineItems } from '../db';
import type { OfflineItem, SyncResult } from '../types';

/** Queue payload contract — written by `enqueuePapicVendorCapture`, read by the
 *  drain. `bytes` rides IndexedDB's structured clone as a Blob. `event_id`
 *  travels in the payload (the vendor route takes it from the form; the guest
 *  route infers it from the cookie) as well as on the item for admin scoping. */
export interface PapicVendorQueuePayload {
  mode: 'vendor';
  event_id: string;
  media_type: 'photo' | 'clip';
  content_type: string;
  filename: string;
  duration_ms?: number;
  device_model?: string;
  bytes: Blob | ArrayBuffer;
  poster_bytes?: Blob | ArrayBuffer | null;
  poster_filename?: string;
  captured_at_ms: number;
}

/**
 * Vendor server errors that resolve a queued item WITHOUT a successful land —
 * re-POSTing the identical capture can never succeed (tier budget only grows,
 * consent/booking/ownership don't appear on retry, and `disabled` means the
 * counsel gate closed — the compliant move is to stop holding the bytes). The
 * drain drops these (SyncResult only exposes ok:true as the dequeue signal)
 * instead of retrying to the 7-day TTL. Mirrors GUEST_RESOLVED_STATES.
 */
export const VENDOR_RESOLVED_ERRORS: ReadonlySet<string> = new Set([
  'disabled',
  'bad_request',
  'no_event',
  'no_file',
  'bad_type',
  'too_large',
  'too_long',
  'consent_required',
  'no_vendor',
  'not_allowed',
  'out_of_points',
  'video_not_allowed',
]);

/** True when a vendor capture error is permanent — the live UI rolls back its
 *  optimistic spend + surfaces the reason instead of queueing. */
export function isPapicVendorTerminalError(error: string | undefined): boolean {
  return !!error && VENDOR_RESOLVED_ERRORS.has(error);
}

/**
 * Offline backlog ceiling per event. The couple-seat precedent has no hard
 * count cap (TTL is the backstop), but the vendor lane is budgeted — Ltd is 70
 * capture points, so 90 pending items already exceeds any tier that can still
 * land, and an Unli vendor past 90 queued clips (~2 GB) is a storage-pressure
 * problem, not a durability one. Past the cap the enqueue refuses (returns
 * null) and the UI keeps its live "check your signal" affordance.
 */
export const VENDOR_OFFLINE_QUEUE_MAX = 90;

/** Pure cap check — unit-testable without IndexedDB. */
export function hasVendorQueueRoom(pendingCount: number): boolean {
  return pendingCount < VENDOR_OFFLINE_QUEUE_MAX;
}

function parseVendorPayload(payload: Record<string, unknown>): PapicVendorQueuePayload | null {
  const eventId = payload.event_id;
  const mediaType = payload.media_type;
  const contentType = payload.content_type;
  const filename = payload.filename;
  const bytes = payload.bytes;
  if (
    payload.mode !== 'vendor' ||
    typeof eventId !== 'string' ||
    !eventId ||
    (mediaType !== 'photo' && mediaType !== 'clip') ||
    typeof contentType !== 'string' ||
    typeof filename !== 'string' ||
    !(bytes instanceof Blob || bytes instanceof ArrayBuffer)
  ) {
    return null;
  }
  const poster = payload.poster_bytes;
  return {
    mode: 'vendor',
    event_id: eventId,
    media_type: mediaType,
    content_type: contentType,
    filename,
    duration_ms: typeof payload.duration_ms === 'number' ? payload.duration_ms : undefined,
    device_model: typeof payload.device_model === 'string' ? payload.device_model : undefined,
    bytes,
    poster_bytes: poster instanceof Blob || poster instanceof ArrayBuffer ? poster : null,
    poster_filename:
      typeof payload.poster_filename === 'string' ? payload.poster_filename : undefined,
    captured_at_ms:
      typeof payload.captured_at_ms === 'number' ? payload.captured_at_ms : 0,
  };
}

export interface VendorPostResult {
  ok: boolean;
  status: number;
  body: { status?: string; error?: string } | null;
}

/** Core vendor drain with an injected `post` — unit-testable without a browser.
 *  Rebuilds the SAME multipart form the live controller sends (consent='1' is a
 *  faithful replay: the controller only captures behind the consent gate, so a
 *  queued item was attested at capture time). */
export async function drainVendorCaptureWith(
  post: (form: FormData) => Promise<VendorPostResult>,
  parsed: PapicVendorQueuePayload,
): Promise<SyncResult> {
  const form = new FormData();
  form.set('event_id', parsed.event_id);
  form.set('media_type', parsed.media_type);
  form.set('consent', '1');
  const fileBlob =
    parsed.bytes instanceof Blob
      ? parsed.bytes
      : new Blob([parsed.bytes], { type: parsed.content_type });
  form.set('file', fileBlob, parsed.filename);
  if (parsed.media_type === 'clip') {
    if (typeof parsed.duration_ms === 'number') {
      form.set('duration_ms', String(parsed.duration_ms));
    }
    if (parsed.poster_bytes) {
      const posterBlob =
        parsed.poster_bytes instanceof Blob
          ? parsed.poster_bytes
          : new Blob([parsed.poster_bytes], { type: 'image/jpeg' });
      form.set('poster', posterBlob, parsed.poster_filename ?? 'poster.jpg');
    }
  }
  if (parsed.device_model) form.set('device_model', parsed.device_model);

  let res: VendorPostResult;
  try {
    res = await post(form);
  } catch {
    return { ok: false, error: 'network' };
  }

  if (res.ok && res.body?.status === 'ok') return { ok: true };
  // Terminal: the capture can never land — resolve the item so the daemon
  // drops it (ok:true is the only dequeue signal SyncResult exposes).
  if (isPapicVendorTerminalError(res.body?.error)) return { ok: true };
  // Anything else (no_session, 5xx, transient) — keep it; the daemon retries.
  return { ok: false, error: res.body?.error ?? `http_${res.status}` };
}

/** Drain one queued VENDOR capture — dispatched by `drainPapicCapture` on
 *  `payload.mode === 'vendor'`. */
export async function drainVendorCapture(item: OfflineItem): Promise<SyncResult> {
  const parsed = parseVendorPayload(item.payload);
  if (!parsed) return { ok: false, error: 'invalid_payload' };
  return drainVendorCaptureWith(async (form) => {
    const res = await fetch('/api/vendor/papic-capture', { method: 'POST', body: form });
    const body = (await res.json().catch(() => null)) as
      | { status?: string; error?: string }
      | null;
    return { ok: res.ok, status: res.status, body };
  }, parsed);
}

/** Count the vendor-mode items pending for one event — drives the controller's
 *  "waiting for signal" chip + the enqueue cap. 0 on SSR / IDB failure. */
export async function countPapicVendorQueued(eventId: string): Promise<number> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') return 0;
  try {
    const items = await listOfflineItems('papic', eventId);
    return items.filter((i) => i.payload.mode === 'vendor').length;
  } catch {
    return 0;
  }
}

/**
 * Persist a VENDOR capture that couldn't deliver live into the shared `papic`
 * queue. Called by the vendor capture controller on an INFRASTRUCTURE failure
 * (never on a terminal server rejection — the UI already rolled back + showed
 * the reason). Returns the queued item id, or null when persistence isn't
 * available (SSR / no IndexedDB), the per-event backlog cap is hit, or the
 * write fails — the caller falls back to its live "check your signal" toast so
 * a queue miss is never silent data loss within the session.
 */
export async function enqueuePapicVendorCapture(input: {
  eventId: string;
  mediaType: 'photo' | 'clip';
  contentType: string;
  filename: string;
  blob: Blob;
  posterBlob?: Blob | null;
  posterFilename?: string;
  durationMs?: number;
  deviceModel?: string;
  capturedAtMs?: number;
  reason?: string;
}): Promise<string | null> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') return null;
  try {
    const pending = await countPapicVendorQueued(input.eventId);
    if (!hasVendorQueueRoom(pending)) return null;
  } catch {
    return null;
  }
  const payload: PapicVendorQueuePayload = {
    mode: 'vendor',
    event_id: input.eventId,
    media_type: input.mediaType,
    content_type: input.contentType,
    filename: input.filename,
    duration_ms: input.durationMs,
    device_model: input.deviceModel,
    bytes: input.blob,
    poster_bytes: input.posterBlob ?? null,
    poster_filename: input.posterFilename,
    captured_at_ms: input.capturedAtMs ?? Date.now(),
  };
  try {
    return await enqueueOfflineItem('papic', {
      event_id: input.eventId,
      payload: payload as unknown as Record<string, unknown>,
      last_error: input.reason,
    });
  } catch {
    return null;
  }
}
