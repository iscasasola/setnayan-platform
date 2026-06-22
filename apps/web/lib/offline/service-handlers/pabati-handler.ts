// Pabati offline upload handler — drains a queued guest video greeting that
// couldn't deliver live (venue WiFi blip) through the SAME path the live
// surface uses: POST the clip (+ optional poster frame) to /api/pabati/clip,
// which PUTs to R2 and records it via the quota+cap RPC (pabati_record_clip).
// Replaces the V2-Phase-G stub.
//
// Mirrors the camera-bridge handler (the one real, non-stub handler): bytes
// ride IndexedDB's structured clone as a Blob/ArrayBuffer; a poster frame is
// extracted at drain time so a queued clip still gets its NSFW-screen proxy.
//
// Result contract: { ok: true } → the daemon dequeues. Any failure — including
// a server REJECTION ('quota_exhausted' / 'not_owned') — returns ok:false so
// the item stays visible in the admin diagnostic with the reason on last_error;
// the 7-day TTL eviction is the backstop.

import type { OfflineItem, SyncResult } from '../types';

/**
 * Queue payload contract (written by the future collector surface's
 * enqueueOffline dep). Bytes ride IndexedDB's structured clone. guest_id is
 * optional (an un-identified public greeting has none); the clip is always
 * scoped by item.event_id.
 */
export interface PabatiQueuePayload {
  content_type: string;
  duration_ms?: number;
  guest_label?: string;
  bytes: Blob | ArrayBuffer;
}

function parsePayload(payload: Record<string, unknown>): PabatiQueuePayload | null {
  const contentType = payload.content_type;
  const bytes = payload.bytes;
  if (
    typeof contentType !== 'string' ||
    !contentType ||
    !(bytes instanceof Blob || bytes instanceof ArrayBuffer)
  ) {
    return null;
  }
  return {
    content_type: contentType,
    duration_ms: typeof payload.duration_ms === 'number' ? payload.duration_ms : undefined,
    guest_label: typeof payload.guest_label === 'string' ? payload.guest_label : undefined,
    bytes,
  };
}

async function toBlob(b: Blob | ArrayBuffer, contentType: string): Promise<Blob> {
  return b instanceof Blob ? b : new Blob([b], { type: contentType });
}

/**
 * Drain one queued Pabati clip by POSTing it to /api/pabati/clip. The route
 * owns the R2 PUT + the RPC record + the NSFW screen, so this handler only
 * has to reconstruct the multipart body. The 5s cap + 300/event cap are
 * enforced server-side regardless of what the queued payload claims.
 */
export async function syncOne(item: OfflineItem): Promise<SyncResult> {
  const parsed = parsePayload(item.payload);
  if (!parsed) return { ok: false, error: 'invalid_payload' };

  const form = new FormData();
  const clipBlob = await toBlob(parsed.bytes, parsed.content_type);
  form.append('file', clipBlob, 'pabati.mp4');
  // event_id covers the authenticated couple/coordinator path; the route
  // prefers a live guest session cookie when one exists.
  form.append('event_id', item.event_id);
  if (typeof parsed.duration_ms === 'number') {
    form.append('duration_ms', String(parsed.duration_ms));
  }
  if (parsed.guest_label) {
    form.append('guest_label', parsed.guest_label);
  }

  // Extract the NSFW-screen poster frame at drain time (best-effort) so a
  // queued clip still gets screened. Never throws (the helper returns null on
  // any failure); a posterless clip just stays 'unscreened' server-side.
  try {
    const { extractClipPosterBytes } = await import('@/lib/clip-poster');
    const poster = await extractClipPosterBytes(
      new Uint8Array(await clipBlob.arrayBuffer()),
      parsed.content_type,
    );
    if (poster && poster.byteLength > 0) {
      // Copy into a fresh ArrayBuffer-backed view so the Blob part type is
      // ArrayBuffer (not the SharedArrayBuffer-possible ArrayBufferLike that a
      // bare Uint8Array can carry under strict lib.dom).
      const posterCopy = new Uint8Array(poster.byteLength);
      posterCopy.set(poster);
      form.append('poster', new Blob([posterCopy], { type: 'image/jpeg' }), 'poster.jpg');
    }
  } catch {
    // best-effort — screening degrades to 'unscreened', never blocks the drain
  }

  let res: Response;
  try {
    res = await fetch('/api/pabati/clip', { method: 'POST', body: form });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'network_error' };
  }

  if (!res.ok) {
    let reason = `http_${res.status}`;
    try {
      const json = (await res.json()) as { status?: string; error?: string };
      reason = json.status ?? json.error ?? reason;
    } catch {
      // keep the http_<status> reason
    }
    return { ok: false, error: reason };
  }

  return { ok: true };
}
