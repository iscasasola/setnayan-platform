/**
 * Kwento scrapbook — where a finished page goes when it is SAVED (browser only).
 *
 * Owner 2026-10-03, option A: pages are unlimited and downloading one is free;
 * a page saved to the couple's gallery counts like ONE PHOTO. So neither path
 * here is new — each is the door a single photo already goes through, and the
 * credit, the per-guest ceiling, the safety screen, the wall and the Drive copy
 * come with it unchanged:
 *
 *   guest  → POST /api/papic/guest-capture  (exactly what the one-photo
 *            Kwento Decorator posts)
 *   couple → /api/upload + recordSeatCapture through the couple's own UPLOADS
 *            camera (exactly what "Add to your library" does)
 *
 * Every refusal comes back as words, and the one a guest can fix on another
 * page carries the door to it.
 */

import { recordSeatCapture } from '@/app/papic/actions';
import { EVENT_PUT_AWAY_CAPTURE_COPY } from '@/lib/event-accepts-captures-rule';
import { putSeatUpload } from '@/lib/papic-seat-upload';

export type SaveTarget =
  | { kind: 'guest' }
  | { kind: 'couple'; uploadsToken: string }
  /** Saving is not possible from here; the page says why and where to fix it. */
  | { kind: 'none'; reason: string; href?: string; hrefLabel?: string };

export type SaveOutcome =
  | { ok: true; message: string }
  | { ok: false; message: string; href?: string; hrefLabel?: string };

export async function saveGuestPage(blob: Blob): Promise<SaveOutcome> {
  const form = new FormData();
  form.append('file', blob, `kwento-scrapbook-${Date.now()}.jpg`);
  form.append('media_type', 'photo');
  let resp: Response;
  try {
    resp = await fetch('/api/papic/guest-capture', { method: 'POST', body: form });
  } catch {
    return { ok: false, message: 'Couldn’t reach us — check your connection and try again.' };
  }
  const data = (await resp.json().catch(() => ({}))) as { status?: string };
  if (resp.ok && data.status === 'ok') return { ok: true, message: 'Saved to the host’s gallery. It counted as one photo.' };
  switch (data.status) {
    case 'event_put_away':
      return { ok: false, message: EVENT_PUT_AWAY_CAPTURE_COPY };
    case 'quota_exhausted':
    case 'camera_points_exhausted':
      return { ok: false, message: 'You’ve used all your photos for this event, so this page can’t go in. You can still keep it on your phone.' };
    case 'terms_required':
      return { ok: false, message: 'Accept the photo terms on the camera page first.', href: '/papic/guest', hrefLabel: 'Open the camera page' };
    default:
      return { ok: false, message: 'Couldn’t save — please try again.' };
  }
}

function coupleRefusal(code: string | undefined): string {
  switch (code) {
    case 'out_of_points':
    case 'pool_exhausted':
      return 'You’re out of Papic credits. Add more on the Papic page and save again.';
    case 'capture_not_started':
      return 'Your camera dates haven’t started yet.';
    case 'capture_window_closed':
      return 'Your camera dates have finished.';
    case 'uploads_closed':
      return 'Adding photos by hand is switched off. Turn “Your uploads” back on on the Papic page.';
    case 'too_fast':
      return 'Slow down a moment and try again.';
    case 'unauthenticated':
      return 'You’ve been signed out — sign in and try again.';
    case 'upload_failed':
    case 'upload_refused':
      return 'The page didn’t upload — check your connection and try again.';
    default:
      return 'That didn’t go in. Try again in a moment.';
  }
}

export async function saveCouplePage(blob: Blob, uploadsToken: string): Promise<SaveOutcome> {
  try {
    const ref = await putSeatUpload(uploadsToken, blob, 'image/jpeg', 'jpg');
    const res = await recordSeatCapture(uploadsToken, ref, 'photo');
    if (!res.ok) return { ok: false, message: coupleRefusal(res.error) };
    return { ok: true, message: 'Saved to your gallery. It used one Papic credit.' };
  } catch (e) {
    return { ok: false, message: coupleRefusal(e instanceof Error ? e.message : undefined) };
  }
}
