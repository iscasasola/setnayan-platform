/**
 * uploads-seat-claim.ts — WHAT ONE PRESS OF "Choose photos" DOES WITH THE UPLOADS CAMERA, AND WHAT IT SAYS WHEN IT
 * CANNOT (owner 2026-10-26, live: "on memories. it seems there is no add photos" · "the turn on is not working as well
 * fix it").
 *
 * 🔑 THE DEFECT THIS REPLACES. + Add photos opened a sheet that said "Turn this on". Its action read the event's Uploads
 * camera (`paparazzi_seats`, seat `PAPIC_UPLOADS_CAMERA_INDEX`) and, finding NO ROW, answered `uploads_error=no_camera`
 * — "could not be turned on just now. Please try again." No retry could ever fix it: the row is minted by a couple-
 * checked RENDER, and since 2026-10-24 the only render that minted it (the studio Papic page) redirects the couple to
 * Home before it gets there. Measured in production 2026-10-26: 7 of 13 live events had no Uploads camera, and a press
 * at 12:24:23Z read the seat, found nothing, and never reached `papic_claim_seat` (the row appeared at 12:30:33Z, six
 * minutes later, when something else opened the studio page).
 *
 * So the Memories render now mints the camera too (couple-checked, like the studio's — `the-uploads-camera-has-no-back-
 * door.test.ts`), and the press is ONE step: pick the files, the camera is claimed on the way (`startAddingPhotos`),
 * the files go up. A claim that cannot happen is SAID on the sheet, in words a person can act on — never a banner
 * promising a retry that cannot work.
 *
 * Pure — `uploads-seat-claim.test.ts`. The claim itself is `papic_claim_seat`, idempotent in the database
 * (`tests/db/the-uploads-camera-is-claimed-once.db.test.ts`).
 */

export type UploadsClaimCode =
  | 'signed_out'
  | 'not_host'
  | 'unavailable'
  | 'no_camera'
  | 'taken'
  | 'full'
  | 'claim_failed';

/** The seat as the action reads it (service role — the token is never sent to the browser before the claim lands). */
export type UploadsSeatRead = { claim_qr_token: string | null } | null;

/** Before the claim: is there a camera to claim? */
export function uploadsClaimStep(seat: UploadsSeatRead, readFailed: boolean): { claim: string } | { refuse: UploadsClaimCode } {
  // ⚠ A refused read is not "there is no camera" — said as "couldn't open", never as missing.
  if (readFailed) return { refuse: 'unavailable' };
  const token = seat?.claim_qr_token ?? null;
  if (!token) return { refuse: 'no_camera' };
  return { claim: token };
}

/**
 * After the claim: `papic_claim_seat`'s answer. 'claimed' is BOTH "it is yours now" and "it was already yours" — the
 * second press is a no-op in the database, so it is a no-op here. 'taken' is somebody else's: since every host has their
 * own camera (owner 2026-10-31), that is only ever another host claiming the same spare a moment earlier.
 */
export function uploadsClaimAnswer(status: string | null | undefined): { ok: true } | { refuse: UploadsClaimCode } {
  if (status === 'claimed') return { ok: true };
  if (status === 'taken') return { refuse: 'taken' };
  if (status === 'unauthenticated') return { refuse: 'signed_out' };
  if (status === 'invalid') return { refuse: 'no_camera' };
  return { refuse: 'claim_failed' };
}

/*
 * 👥 THERE IS NO "IT IS THE OTHER HOST'S" LINE ANY MORE (owner 2026-10-31, *"yes. papic credits still"*): every host —
 * each couple member and each co-host — has their own host camera (`hostCameraPick`, `lib/papic-cameras.ts`), so no host
 * is ever sent to somebody else's account to add a photo. `UPLOADS_TAKEN_LINE` was deleted with the one-camera model.
 */

/** Every refusal in words that name something the reader can do. */
export function uploadsClaimWords(code: UploadsClaimCode): string {
  switch (code) {
    case 'signed_out':
      return 'You’ve been signed out — sign in and try again. Nothing was uploaded.';
    case 'not_host':
      return 'Only the hosts of this event can add photos here. Nothing was uploaded.';
    case 'unavailable':
      return 'We couldn’t open adding photos just now — nothing was uploaded. Try again in a moment.';
    case 'no_camera':
      return 'Adding photos isn’t ready on this event yet — close this, pull down to refresh, and pick again. Nothing was uploaded.';
    case 'taken':
      return 'Another host took that camera a moment ago — close this, pull down to refresh, and pick again. Nothing was uploaded.';
    case 'full':
      return 'Every host camera on this event is already in use, so adding photos can’t start from this account. Nothing was uploaded.';
    case 'claim_failed':
      return 'Adding photos didn’t start — nothing was uploaded. Try again in a moment.';
  }
}
