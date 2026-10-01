import { parseGuestQrPayload } from '@/lib/checkin';

/**
 * "UPLOAD YOUR QR" — where a decoded picture of a guest's personal QR leads
 * (owner 2026-09-27, verbatim: *"Event Poster QR. will go to the event. sign in
 * to enter or upload your qr to login."*).
 *
 * The guest picks a photo or screenshot of their QR (the one sent to them on
 * Messenger); the browser decodes it (`jsqr`) and hands the text here. Pure.
 *
 *   · this event's personal invitation link (`/{slug}?invite={token}`, or the
 *     `/u/{owner}/{slug}` form) → that key, on THIS site: the normal key flow
 *     runs (the redeem route checks the token; the RSVP-first gate follows);
 *   · a bare 32-hex `qr_token` → the same;
 *   · a link to a DIFFERENT event, or anything else → null, and the page says
 *     "That code isn't an invitation to this event."
 *
 * 🔒 The address is always built here from THIS event's slug and the token —
 * never the decoded URL's own origin or path, so a crafted QR cannot send the
 * guest anywhere else.
 */
export const NOT_THIS_EVENTS_CODE = 'That code isn’t an invitation to this event.';

/**
 * No code could be READ in the picture at all — blurry, cropped, too dark, or
 * not a QR. A different fault from a code that belongs elsewhere, with a
 * different fix (guest text audit 2026-09-30: a blurry photo of the RIGHT QR
 * was told it "isn't an invitation to this event", so the guest gave up on the
 * one code that would have opened it).
 */
export const UNREADABLE_QR = 'We couldn’t read a QR code in that picture. Try a sharper photo, or a screenshot of the code.';

export function uploadedQrTarget(raw: string, slug: string): string | null {
  const text = (raw ?? '').trim();
  const token = parseGuestQrPayload(text);
  if (!token) return null;
  // A link must be THIS event's. A bare token is checked by the redeem route.
  if (!/^[0-9a-f]{32}$/i.test(text)) {
    let url: URL;
    try {
      url = new URL(text);
    } catch {
      return null;
    }
    const last = url.pathname.replace(/\/+$/, '').split('/').pop() ?? '';
    if (last.toLowerCase() !== slug.toLowerCase()) return null;
  }
  return `/${slug}?invite=${token}`;
}
