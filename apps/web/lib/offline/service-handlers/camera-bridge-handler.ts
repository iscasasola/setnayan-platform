// Camera Bridge offline transit handler — O1 of the Camera Bridge build plan
// (corpus 0012_papic/Camera_Bridge_Build_Plan_2026-06-11.md). Replaces the
// V2-Phase-G stub: a bridge capture that couldn't deliver live (venue WiFi
// blip) is queued by the bridge panel into the camera_bridge store; this
// handler drains it through the SAME pipeline the live path uses —
// presign /api/upload → PUT to R2 → recordSeatCapture (papic_photos INSERT
// + Drive-copy). Transport context is WiFi-SDK only (USB tether is V2).
//
// Result contract: { ok: true } → the daemon dequeues. Any failure —
// including a server REJECTION (e.g. not_your_seat after a seat reissue) —
// returns ok:false so the item stays visible in the admin diagnostic with
// the reason on last_error; a venue operator resolves or evicts it (the
// 7-day TTL eviction is the backstop).

import type { OfflineItem, SyncResult } from '../types';
import { deliverCapture, type PapicSinkDeps } from '../../camera-bridge/papic-sink';
import type { CapturedFile } from '../../camera-bridge/types';

/**
 * Queue payload contract (written by the bridge panel's enqueueOffline dep):
 * bytes ride IndexedDB's structured clone as a Blob or ArrayBuffer.
 */
export interface CameraBridgeQueuePayload {
  seat_token: string;
  seat_index: number;
  kind: 'photo' | 'clip';
  content_type: string;
  captured_at_ms: number;
  duration_ms?: number;
  bytes: Blob | ArrayBuffer;
}

function parsePayload(payload: Record<string, unknown>): CameraBridgeQueuePayload | null {
  const seatToken = payload.seat_token;
  const seatIndex = payload.seat_index;
  const kind = payload.kind;
  const contentType = payload.content_type;
  const capturedAtMs = payload.captured_at_ms;
  const bytes = payload.bytes;
  if (
    typeof seatToken !== 'string' ||
    !seatToken ||
    typeof seatIndex !== 'number' ||
    (kind !== 'photo' && kind !== 'clip') ||
    typeof contentType !== 'string' ||
    typeof capturedAtMs !== 'number' ||
    !(bytes instanceof Blob || bytes instanceof ArrayBuffer)
  ) {
    return null;
  }
  return {
    seat_token: seatToken,
    seat_index: seatIndex,
    kind,
    content_type: contentType,
    captured_at_ms: capturedAtMs,
    duration_ms: typeof payload.duration_ms === 'number' ? payload.duration_ms : undefined,
    bytes,
  };
}

async function toBytes(b: Blob | ArrayBuffer): Promise<Uint8Array> {
  return b instanceof Blob ? new Uint8Array(await b.arrayBuffer()) : new Uint8Array(b);
}

/**
 * Core drain logic with injected sink deps — unit-testable without a browser.
 * NOTE: no enqueueOffline dep here — this handler IS the queue's drain; a
 * failure keeps the item in place (the daemon records last_error).
 */
export async function syncOneWith(
  deps: Omit<PapicSinkDeps, 'enqueueOffline'>,
  item: OfflineItem,
): Promise<SyncResult> {
  const parsed = parsePayload(item.payload);
  if (!parsed) return { ok: false, error: 'invalid_payload' };

  const file: CapturedFile = {
    kind: parsed.kind === 'clip' ? 'clip' : 'still',
    bytes: await toBytes(parsed.bytes),
    mimeType: parsed.content_type,
    capturedAtMs: parsed.captured_at_ms,
    durationMs: parsed.duration_ms,
    // Queued transit uploads may be DSLR- or phone-originated; per-brand
    // stamping travels in the payload once brand adapters land. Conservative:
    pairedCameraBrand: null,
    pairedCameraModel: null,
  };

  const result = await deliverCapture(deps, file, { seatIndex: parsed.seat_index });
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

/**
 * Browser entry the sync daemon calls. Lazily imports the server action so
 * this module stays cheap in the daemon's initial bundle.
 */
export async function syncOne(item: OfflineItem): Promise<SyncResult> {
  const parsed = parsePayload(item.payload);
  if (!parsed) return { ok: false, error: 'invalid_payload' };

  const { recordSeatCapture } = await import('@/app/papic/actions');
  const deps: Omit<PapicSinkDeps, 'enqueueOffline'> = {
    presign: async (req) => {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket: 'media', ...req }),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { uploadUrl?: string; r2Ref?: string };
      return json.uploadUrl && json.r2Ref
        ? { uploadUrl: json.uploadUrl, r2Ref: json.r2Ref }
        : null;
    },
    put: async (uploadUrl, bytes, contentType) => {
      const res = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: new Uint8Array(bytes),
      });
      return res.ok;
    },
    record: (r2Ref, kind) => recordSeatCapture(parsed.seat_token, r2Ref, kind),
  };

  return syncOneWith(deps, item);
}
