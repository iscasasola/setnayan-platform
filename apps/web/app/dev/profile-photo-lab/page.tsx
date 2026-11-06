/**
 * /dev/profile-photo-lab — the Profile group's identity tile (`/dashboard/profile`) on fixtures: no sign-in, no
 * database. DEV-ONLY: production builds 404 it, the same kill-switch as every `/dev/*` lab.
 *
 * ⚖ Owner 2026-11-06, asked whether the profile picture gets the business logo's align + zoom: "yes, use the same
 * control". This draws the REAL tile (`ProfileIdentityTile`, what the page renders) so the photo and its frame
 * control can be walked at phone width without an account. The form posts nowhere: Save is a plain GET back here.
 *
 *   ?state=framed   a photo on file, framed up and a little left at 1.5× (default)
 *   ?state=plain    a photo on file, never framed (centre, as uploaded)
 *   ?state=none     no photo yet — the control is not offered
 */
import { notFound } from 'next/navigation';
import { ProfileIdentityTile } from '@/app/dashboard/(account)/profile/_components/profile-identity-tile';
import { DEFAULT_PICTURE_FRAME, type PictureFrame } from '@/lib/picture-frame';

export const dynamic = 'force-dynamic';

const LAB_PHOTO_REF = 'r2://media/profile-photo/lab-user/isabel.avif';
// One real photo, never a collage: every /portraits/*.avif is a three-panel strip, which reads as seams in the circle.
const LAB_PHOTO_URL = '/event-types/gala_night.webp';

const STATES: Record<string, { photo: string | null; frame: PictureFrame }> = {
  framed: { photo: LAB_PHOTO_REF, frame: { x: 35, y: 20, zoom: 150 } },
  plain: { photo: LAB_PHOTO_REF, frame: DEFAULT_PICTURE_FRAME },
  none: { photo: null, frame: DEFAULT_PICTURE_FRAME },
};

export default async function ProfilePhotoLabPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const key = sp.state && sp.state in STATES ? sp.state : 'framed';
  const s = STATES[key]!;
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-6" data-profile-photo-lab={key}>
      <p className="text-xs uppercase tracking-[0.14em] text-ink/60">Who you are</p>
      <h1 className="font-display text-2xl font-semibold text-ink">Profile</h1>
      {/* The lab's Save is a plain GET back to the lab: nothing is saved, nothing is sent. */}
      <form action="/dev/profile-photo-lab" className="space-y-6">
        <ProfileIdentityTile
          userId="lab-user"
          storedPhoto={s.photo}
          photoDisplayMap={s.photo ? { [s.photo]: LAB_PHOTO_URL } : {}}
          frame={s.frame}
          displayName="Isabel Santos"
          tag="@isabel-santos"
          composedFormalName="Ms. Isabel Santos"
        />
      </form>
    </main>
  );
}
