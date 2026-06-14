/**
 * apps/web/lib/camera-bridge/papic-sink.ts
 *
 * S0 — the Papic SINK: delivers a `CapturedFile` (from ANY CameraBridge
 * implementation — mock, phone-internal, later Canon) through the SAME
 * shipped pipeline the seat capture UI already uses:
 *
 *   presign POST /api/upload → PUT bytes to R2 → recordSeatCapture()
 *   (papic_photos INSERT under the claimer's RLS + Drive-copy via after()).
 *
 * Build-plan note: S0 turned out to be mostly REUSE — the seat path shipped
 * end-to-end (papic-seat-capture.tsx → actions.ts:recordSeatCapture). This
 * module extracts that chain behind a dependency-injected `deliverCapture`
 * so (a) the bridge panel, (b) the O1 offline transit handler, and (c) unit
 * tests all share one delivery orchestration. The dispatch invariant holds:
 * file-producing bridge methods feed THIS sink; streams feed Patiktok/Panood
 * sinks (separate, later phases).
 *
 * Failure policy: an infrastructure failure (presign/PUT/network) queues the
 * capture into the camera_bridge offline queue (when a queue dep is given) so
 * a venue WiFi blip never loses a shot; a SERVER REJECTION (not_your_seat /
 * revoked / …) does NOT queue — retrying a rejected capture can't succeed.
 */

import type { CapturedFile } from './types';

export interface PresignRequest {
  pathPrefix: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
}

export interface PapicSinkDeps {
  /** POST /api/upload — returns null on any failure. */
  presign(req: PresignRequest): Promise<{ uploadUrl: string; r2Ref: string } | null>;
  /** PUT the bytes to R2 — returns false on any failure. */
  put(uploadUrl: string, bytes: Uint8Array, contentType: string): Promise<boolean>;
  /** The recordSeatCapture server action (passed in — lib never imports app/). */
  record(
    r2Ref: string,
    kind: 'photo' | 'clip',
    posterR2Ref?: string,
  ): Promise<{ ok: true; count: number } | { ok: false; error: string }>;
  /**
   * Optional: extract one poster JPEG from a CLIP so the server's always-on
   * NSFW screen can classify it (nsfwjs is image-only; the lambda has no
   * ffmpeg). Browser deps wire lib/clip-poster.ts; node contexts may omit it.
   * Returning null — or any poster-leg failure — NEVER blocks delivery: the
   * clip ships without a poster and stays 'unscreened' (every guest-facing
   * surface excludes clips structurally, so unscreened clips never project).
   */
  extractPoster?(file: CapturedFile): Promise<Uint8Array | null>;
  /**
   * Optional: stash the capture in the camera_bridge offline queue (O1 drains
   * it later). Returns true when queued. Omitted in contexts with no queue
   * (e.g. the offline handler itself — it IS the drain).
   */
  enqueueOffline?(file: CapturedFile, reason: string): Promise<boolean>;
}

export type SinkDelivery =
  | { ok: true; count: number }
  | { ok: false; error: string; queued: boolean };

/** Derive the upload filename/Content-Type for a captured file. */
export function captureUploadMeta(file: CapturedFile): { filename: string; contentType: string } {
  const isClip = file.kind === 'clip';
  const ext = isClip ? (file.mimeType.includes('webm') ? 'webm' : 'mp4') : 'jpg';
  return {
    filename: `bridge-${file.capturedAtMs}.${ext}`,
    contentType: file.mimeType,
  };
}

/** Derive the upload filename/Content-Type for a clip's poster frame. */
export function posterUploadMeta(file: CapturedFile): { filename: string; contentType: string } {
  return {
    filename: `bridge-${file.capturedAtMs}-poster.jpg`,
    contentType: 'image/jpeg',
  };
}

/**
 * Deliver one captured file to the Papic gallery. Never throws — the camera
 * must keep working regardless of what delivery does (the 0012 posture).
 */
export async function deliverCapture(
  deps: PapicSinkDeps,
  file: CapturedFile,
  opts: { seatIndex: number },
): Promise<SinkDelivery> {
  const { filename, contentType } = captureUploadMeta(file);

  const queue = async (reason: string): Promise<SinkDelivery> => {
    let queued = false;
    if (deps.enqueueOffline) {
      queued = await deps.enqueueOffline(file, reason).catch(() => false);
    }
    return { ok: false, error: reason, queued };
  };

  // 1. Presign (same request shape as the shipped seat capture UI).
  let presigned: { uploadUrl: string; r2Ref: string } | null = null;
  try {
    presigned = await deps.presign({
      pathPrefix: `papic/seat-${opts.seatIndex}`,
      filename,
      contentType,
      sizeBytes: file.bytes.byteLength,
    });
  } catch {
    presigned = null;
  }
  if (!presigned) return queue('presign_failed');

  // 2. PUT to R2.
  let put = false;
  try {
    put = await deps.put(presigned.uploadUrl, file.bytes, contentType);
  } catch {
    put = false;
  }
  if (!put) return queue('upload_failed');

  // 2b. CLIP poster leg (best-effort, fail-open): extract one JPEG frame and
  // PUT it next to the clip so the server's NSFW screen — which is image-only
  // — can classify the clip by proxy. ANY failure here just drops the poster:
  // the clip still records, stays 'unscreened', and guest surfaces exclude it.
  let posterR2Ref: string | undefined;
  if (file.kind === 'clip' && deps.extractPoster) {
    try {
      const posterBytes = await deps.extractPoster(file);
      if (posterBytes && posterBytes.byteLength > 0) {
        const posterMeta = posterUploadMeta(file);
        const posterPresigned = await deps.presign({
          pathPrefix: `papic/seat-${opts.seatIndex}`,
          filename: posterMeta.filename,
          contentType: posterMeta.contentType,
          sizeBytes: posterBytes.byteLength,
        });
        if (posterPresigned) {
          const posterPut = await deps.put(
            posterPresigned.uploadUrl,
            posterBytes,
            posterMeta.contentType,
          );
          if (posterPut) posterR2Ref = posterPresigned.r2Ref;
        }
      }
    } catch {
      posterR2Ref = undefined;
    }
  }

  // 3. Record the papic_photos row (RLS-validated server action).
  try {
    const result = await deps.record(
      presigned.r2Ref,
      file.kind === 'clip' ? 'clip' : 'photo',
      posterR2Ref,
    );
    if (!result.ok) {
      // A server rejection is FINAL — queueing a not_your_seat/revoked capture
      // would retry forever. Surface it, don't queue it.
      return { ok: false, error: result.error, queued: false };
    }
    return { ok: true, count: result.count };
  } catch {
    // Network failure on the action — the row may not exist; safe to retry.
    return queue('record_failed');
  }
}

/**
 * Browser deps for the live seat surface. `record` is the recordSeatCapture
 * server action — passed in by the page component so this lib stays free of
 * app/ imports (the 0052 import-boundary posture).
 */
export function makeBrowserSinkDeps(args: {
  record: PapicSinkDeps['record'];
  enqueueOffline?: PapicSinkDeps['enqueueOffline'];
}): PapicSinkDeps {
  return {
    // Lazy import keeps the poster module out of the panel's initial bundle;
    // extractClipPosterBytes itself never throws (null on any trouble).
    extractPoster: async (file) => {
      const { extractClipPosterBytes } = await import('@/lib/clip-poster');
      return extractClipPosterBytes(file.bytes, file.mimeType);
    },
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
      // Copy into a fresh ArrayBuffer-backed view so BodyInit is satisfied
      // even when the source bytes ride a SharedArrayBuffer-typed buffer.
      const body = new Uint8Array(bytes);
      const res = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body,
      });
      return res.ok;
    },
    record: args.record,
    enqueueOffline: args.enqueueOffline,
  };
}
