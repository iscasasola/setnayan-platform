/**
 * lib/papic-host-door.ts — 📷 A HOST WHO OPENS THE EVENT HUB CAMERA GETS THEIR OWN CAMERA (owner 2026-11-22, live fix:
 * "On — everyone, now" was on and the Hub camera did not work for him).
 *
 * THE CAUSE. The Hub's bar draws the couple a live Camera ("Unconditional. It is their wedding." — `site-nav.ts`) and
 * sends it to `/papic/guest`, a page that knows ONE kind of person: an invited guest carrying a guest-session cookie.
 * A host has no guest row and no such cookie, so the tab ended on "Open your invitation first. Scan your personal QR…"
 * — a dead end for the one person who certainly may shoot.
 *
 * THE FIX IS NOT A SECOND CAMERA. Every host already has their own host camera (owner 2026-10-31, "yes. papic credits
 * still" — `lib/papic-cameras.ts`, the block that starts at the Uploads camera): the same seat, the same claim and the
 * same capture page (`/papic/seat/[token]`) the Memories "Add photos" door uses. The guest-camera page hands a host to
 * that one. Its metering and its "adding is off" switch are that camera's own and are unchanged here.
 *
 * Pure: the decision and its words. The reads are `lib/papic-host-door.server.ts`.
 */
import type { UploadsClaimCode } from '@/lib/uploads-seat-claim';

export type HostCameraDoor =
  /** Not a signed-in host of this event — the guest page goes on as it always did. */
  | { kind: 'not_host' }
  /** This host's own camera, claimed — go there. */
  | { kind: 'camera'; token: string }
  /** A host, but the camera cannot open right now — said in words, with a way on. Never a dead button. */
  | { kind: 'refused'; title: string; words: string; eventId: string };

/**
 * The camera page for a claimed host camera. The token is a path segment, never a query.
 *
 * ↩️ `back` — the Event Hub tab the camera was opened from (owner 2026-11-22: *"we want them back to where they were
 * last"*). It rides along as `?back=<tab>` so the camera's ✕ returns to that tab; the seat page re-checks it against
 * the tab keys (`cameraBackTab`) and builds the exit from the event's own slug, never from this value.
 */
export function hostCameraHref(token: string, back?: string | null): string {
  const path = `/papic/seat/${encodeURIComponent(token)}`;
  return back && /^[a-z][a-z0-9_-]{0,31}$/.test(back) ? `${path}?back=${back}` : path;
}

/** Why a host's camera did not open — one plain sentence each, and what to do. */
export function hostCameraRefusal(reason: 'adding_off' | UploadsClaimCode): { title: string; words: string } {
  switch (reason) {
    case 'adding_off':
      return {
        title: 'Your camera is switched off.',
        words: 'Adding photos is off for this event, and your own camera follows that switch. Turn it on in Memories, then open the camera again.',
      };
    case 'no_camera':
      return {
        title: 'Your camera isn’t set up yet.',
        words: 'Open Memories once and your own camera is made for you. Then open the camera again.',
      };
    case 'full':
      return {
        title: 'Every host camera is taken.',
        words: 'This event already has the most host cameras it can hold. Shoot from a camera you hand out in Memories instead.',
      };
    default:
      return {
        title: 'Your camera didn’t open.',
        words: 'Nothing went wrong on your side. Try again in a moment, or open it from Memories.',
      };
  }
}
