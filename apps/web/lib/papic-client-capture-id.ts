/**
 * apps/web/lib/papic-client-capture-id.ts
 *
 * 🔁 ONE SHUTTER, ONE ROW, ONE SPEND (event-day L1·2, migration 20271272777206).
 *
 * The guest camera mints this id AT THE GRAB (`newClientCaptureId`) and sends
 * it — unchanged — with the live POST, with every retry, and from the offline
 * queue (`PapicGuestQueuePayload.client_capture_id`). The capture route and
 * `papic_record_guest_capture` answer a repeat with the first row and charge
 * nothing, and the R2 object is named by it, so a retry overwrites one object
 * instead of leaving two.
 *
 * Pure — no I/O — shared by the phone (mint) and the route (read).
 */
const CLIENT_CAPTURE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The form field the camera and the offline queue both post. */
export const CLIENT_CAPTURE_ID_FIELD = 'client_capture_id';

/** A fresh id for one shutter press. */
export function newClientCaptureId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // Older Safari (before 15.4) has getRandomValues but no randomUUID — a v4 id by hand.
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** The posted id, or null when absent or malformed (an old cached camera records as before). */
export function readClientCaptureId(raw: unknown): string | null {
  const v = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return CLIENT_CAPTURE_ID.test(v) ? v : null;
}
