/**
 * The Profile group's identity tile — the photo (with its align + zoom) beside the name and @tag. Split out of
 * `profile/page.tsx` on 2026-11-06 so `/dev/profile-photo-lab` can draw the REAL tile on fixtures (the page reads its
 * own session). Nothing here reads or writes: it sits inside the Profile form, whose Save posts the photo and its
 * frame (`planPersonalInfoPatch`).
 *
 * 🖼 Below the photo, its align + zoom — the ONE control the shop logo uses (owner 2026-11-06, asked whether the
 * profile picture gets the logo's frame: "yes, use the same control"), via `ProfilePhotoField`.
 *
 * Profile photo upload (owner directive 2026-06-12: the account avatar is the account's OWN photo, never the event
 * logo). Same R2 presigned-PUT pipeline as the vendor logo. No watermark: the 2026-05-21 directive covers marketplace
 * photos, not account identity. Clearing the photo nulls the column → the avatar falls back to the account initial.
 */
import { ProfilePhotoField } from '@/app/_components/profile-photo-field';
import type { PictureFrame } from '@/lib/picture-frame';

export function ProfileIdentityTile({
  userId,
  storedPhoto,
  photoDisplayMap,
  frame,
  displayName,
  tag,
  composedFormalName,
}: {
  userId: string;
  storedPhoto: string | null;
  photoDisplayMap: Record<string, string>;
  frame: PictureFrame;
  displayName: string | null;
  tag: string | null;
  composedFormalName: string | null;
}) {
  return (
    <div className="sn-tile">
      <ProfilePhotoField
        userId={userId}
        storedPhoto={storedPhoto}
        initialDisplayUrls={photoDisplayMap}
        frame={frame}
        unsavedHint="press Save below"
        slotSays="Add a photo"
        help="Your avatar across the app · PNG / JPG / WebP, up to 2 MB"
        uploadRowClassName="grid items-center gap-5 sm:grid-cols-[17rem_minmax(0,1fr)]"
        aside={
          <div className="min-w-0 text-center sm:text-left">
            <p className="font-display text-3xl font-semibold leading-tight text-ink">{displayName ?? 'Add your name'}</p>
            {tag || composedFormalName ? (
              <p className="mt-1.5 text-sm text-ink/70">
                {tag ? <span className="font-semibold text-terracotta-700">{tag}</span> : null}
                {tag && composedFormalName ? ' · ' : null}
                {composedFormalName}
              </p>
            ) : null}
          </div>
        }
      />
    </div>
  );
}
