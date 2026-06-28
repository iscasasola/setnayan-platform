// Papic offline drain + enqueue — the real `papic` queue path (Group A · PR A1).
//
// Replaces the V2-Phase-G `papic-handler.ts` stub. The seat (paparazzo) capture
// UI keeps shooting through an in-memory upload queue; when a capture can't
// deliver because of an INFRASTRUCTURE failure (presign / PUT / network), the UI
// persists it into the IndexedDB `papic` store via `enqueuePapicSeatCapture`.
// The sync daemon (foreground + service-worker Background Sync) later drains each
// item through `drainPapicCapture`, which replays the SAME shipped delivery the
// live path uses:
//
//   presign POST /api/upload (papicSeatToken contract)
//     → PUT bytes to R2
//     → recordSeatCapture()  (papic_photos INSERT under the claimer's RLS)
//
// This mirrors the working `camera-bridge-handler.ts` drain, but against the SEAT
// presign contract (`{ papicSeatToken }`, not `{ pathPrefix }`) and it preserves
// a clip's `durationMs` (the sink's `record` dep arity drops it; we close over it
// here so a queued 5-second clip records with its real duration).
//
// Failure policy matches the live path + the sink:
//   • infra failure (presign/PUT/network) → item stays queued (daemon retries)
//   • SERVER REJECTION (not_your_seat / revoked / window closed / …) → NOT
//     re-queued at enqueue time, and a drain that hits one returns ok:false with
//     the reason so the admin diagnostic surfaces it (7-day TTL eviction is the
//     backstop). Retrying a rejected capture can never succeed.

import { enqueueOfflineItem } from '../db';
import type { OfflineItem, SyncResult } from '../types';
import { deliverCapture, type PapicSinkDeps } from '../../camera-bridge/papic-sink';
import type { CapturedFile } from '../../camera-bridge/types';

/**
 * Queue payload contract — written by the seat capture UI's enqueue helper,
 * read by the drain. `bytes` rides IndexedDB's structured clone as a Blob.
 */
export interface PapicSeatQueuePayload {
  seat_token: string;
  seat_index: number;
  kind: 'photo' | 'clip';
  content_type: string;
  captured_at_ms: number;
  duration_ms?: number;
  bytes: Blob | ArrayBuffer;
}

/**
 * Server-rejection error codes from `recordSeatCapture`. A capture that fails
 * with one of these can NEVER succeed on retry, so the enqueue helper drops it
 * (the UI already showed the user the terminal reason) and a drain that meets
 * one returns ok:false WITHOUT keeping the daemon hammering a dead item — though
 * the daemon's own TTL still evicts. Cap codes are handled by the UI separately
 * (the shot never reaches the queue), so they are intentionally absent here.
 */
export const PAPIC_TERMINAL_ERRORS: ReadonlySet<string> = new Set([
  'missing_input',
  'unauthenticated',
  'not_your_seat',
  'revoked',
  'not_owned',
  'clip_too_long',
  'capture_not_started',
  'capture_window_closed',
  'awaiting_payment',
]);

/** True when an error returned by the delivery path is permanent (don't queue). */
export function isPapicTerminalError(error: string | undefined): boolean {
  return !!error && PAPIC_TERMINAL_ERRORS.has(error);
}

function parsePayload(payload: Record<string, unknown>): PapicSeatQueuePayload | null {
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
 * Build the seat-contract sink deps for ONE queued capture. The presign body
 * uses `papicSeatToken` (the live seat contract — the server derives the bucket
 * + event/seat-scoped prefix from the token and verifies the claimer), and the
 * `record` dep closes over `durationMs` so a clip records with its real length.
 */
export function buildSeatSinkDeps(
  seatToken: string,
  durationMs: number | undefined,
  record: (
    token: string,
    r2Ref: string,
    kind: 'photo' | 'clip',
    posterR2Ref?: string,
    durationMs?: number,
  ) => Promise<{ ok: true; count: number; photoId: string | null } | { ok: false; error: string }>,
  extractClipPosterBytes: (bytes: Uint8Array, mimeType: string) => Promise<Uint8Array | null>,
): Omit<PapicSinkDeps, 'enqueueOffline'> {
  return {
    presign: async (req) => {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          papicSeatToken: seatToken,
          filename: req.filename,
          contentType: req.contentType,
          sizeBytes: req.sizeBytes,
        }),
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
    record: async (r2Ref, kind, posterR2Ref) => {
      const result = await record(seatToken, r2Ref, kind, posterR2Ref, durationMs);
      return result.ok ? { ok: true, count: result.count } : { ok: false, error: result.error };
    },
    extractPoster: async (file) => extractClipPosterBytes(file.bytes, file.mimeType),
  };
}

/** Core drain with injected deps — unit-testable without a browser. */
export async function drainPapicCaptureWith(
  deps: Omit<PapicSinkDeps, 'enqueueOffline'>,
  parsed: PapicSeatQueuePayload,
  bytes: Uint8Array,
): Promise<SyncResult> {
  const file: CapturedFile = {
    kind: parsed.kind === 'clip' ? 'clip' : 'still',
    bytes,
    mimeType: parsed.content_type,
    capturedAtMs: parsed.captured_at_ms,
    durationMs: parsed.duration_ms,
    pairedCameraBrand: null,
    pairedCameraModel: null,
  };
  const result = await deliverCapture(deps, file, { seatIndex: parsed.seat_index });
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

/**
 * Browser entry the sync daemon calls for the `papic` queue. Lazily imports the
 * server action + poster extractor so this module stays cheap in the daemon's
 * initial bundle.
 */
export async function drainPapicCapture(item: OfflineItem): Promise<SyncResult> {
  const parsed = parsePayload(item.payload);
  if (!parsed) return { ok: false, error: 'invalid_payload' };

  const { recordSeatCapture } = await import('@/app/papic/actions');
  const { extractClipPosterBytes } = await import('@/lib/clip-poster');

  const deps = buildSeatSinkDeps(
    parsed.seat_token,
    parsed.duration_ms,
    recordSeatCapture,
    extractClipPosterBytes,
  );
  return drainPapicCaptureWith(deps, parsed, await toBytes(parsed.bytes));
}

/**
 * Persist a seat capture that couldn't deliver live into the `papic` IndexedDB
 * queue. Called by the seat capture UI's upload worker on an INFRASTRUCTURE
 * failure (never on a terminal server rejection). Returns the queued item id, or
 * null if persistence isn't available (SSR / no IndexedDB) or fails — the caller
 * keeps its in-memory "tap to retry" affordance either way, so a queue miss is
 * never silent data loss within the session.
 */
export async function enqueuePapicSeatCapture(input: {
  eventId: string;
  seatToken: string;
  seatIndex: number;
  kind: 'photo' | 'clip';
  contentType: string;
  blob: Blob;
  capturedAtMs?: number;
  durationMs?: number;
  reason?: string;
}): Promise<string | null> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') return null;
  const payload: PapicSeatQueuePayload = {
    seat_token: input.seatToken,
    seat_index: input.seatIndex,
    kind: input.kind,
    content_type: input.contentType,
    captured_at_ms: input.capturedAtMs ?? Date.now(),
    duration_ms: input.durationMs,
    bytes: input.blob,
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
