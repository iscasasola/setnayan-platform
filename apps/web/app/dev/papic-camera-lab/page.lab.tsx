/**
 * /dev/papic-camera-lab — the REAL guest camera (`PapicGuestCapture`) and the REAL
 * supplier camera (`PapicCaptureController`) on fixture props, with no sign-in and
 * no database. DEV-ONLY: production builds 404 this route.
 *
 * Why it exists (2026-10-23, Papic "save first, send later"): the walk proves the
 * uploader in WebKit + Chromium — shoot offline, reconnect, everything lands once
 * — against an intercepted server (the walk script answers sign / record /
 * attach and the presigned PUTs itself), so nothing here reaches a real bucket or
 * the production database. The camera is the page's fake stream (the walk script
 * draws a real photograph into it).
 *
 *   (default)       the guest camera
 *   ?lane=vendor    the supplier camera
 *   ?pro=1          the guest camera on a PRO event (owner 2026-10-24 ruling)
 *   ?lane=seat      the seat camera (`PapicSeatCapture`) on fixture props
 *   &buy=1          the real floating "Add credits" doorway over the camera (one fixture rung)
 *   ?lane=challenges the REAL Challenges-page rows on fixture missions — a couple's own deletes by its swipe (2026-11-03)
 *   &chapter=1      📷 the camera shoots into a chapter ("Meeting with caterer", owner 2026-11-01) — named on it
 *   &ceiling=0      🔒 the host gave this guest NO shots (a ceiling of 0) — "The host hasn't opened your camera yet"
 *   &phone=1        📲 the guest holds a camera of their own → My shots draws "Add from your phone" (guest upload v2)
 *   ?lane=phone-review 📲 the couple's side on fixtures — "Photos from guests' phones" choice + the Recap's check
 */
import { LabPageSpotlight } from '@/app/dev/_components/lab-page-spotlight';
import { TOURS } from '@/lib/tours';
import { notFound } from 'next/navigation';
import { LabCamera } from './lab-camera';
import { LabChallenges } from './lab-challenges';
import { LabPhoneReview } from './lab-phone-review';

export default async function PapicCameraLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  if (sp.lane === 'challenges') return <LabChallenges />;
  if (sp.lane === 'phone-review') return <LabPhoneReview />;
  const lane = sp.lane === 'vendor' ? 'vendor' : sp.lane === 'seat' ? 'seat' : 'guest';
  // ?pro=1 — a Pro event's camera: the logo on the shutter, the theme colour, the monogram on the copies.
  // &spot=1 — the camera's first-visit spotlight (guest_papic_camera_v2), first run, nothing recorded.
  return (
    <>
      <LabCamera lane={lane} pro={sp.pro === '1'} buy={sp.buy === '1'} chapter={sp.chapter === '1'} ceilingZero={sp.ceiling === '0'} phone={sp.phone === '1'} />
      {sp.spot === '1' && lane === 'guest' ? <LabPageSpotlight tourKey="guest_papic_camera_v2" script={TOURS.guest_papic_camera_v2.spotlight!} /> : null}
    </>
  );
}
