'use client';

import { useState, type ReactNode } from 'react';

import { FileUpload } from '@/app/_components/file-upload';
import { PictureFrameControl } from '@/app/_components/picture-frame-control';
import { DEFAULT_PICTURE_FRAME, type PictureFrame } from '@/lib/picture-frame';

/**
 * 🖼 The profile picture, framed by hand — the ONE control the shop logo uses (`PictureFrameControl`, A3/A4).
 * ⚖ Owner 2026-11-06, asked whether the profile picture gets the logo's frame: *"yes, use the same control"*; owner
 * 7 Nov, prototype v21 (the logo step): *"drag and pinch to zoom"*. So the photo is framed exactly as the logo is:
 * drag to move, pinch / wheel / − slider + to zoom, x / y 0–100 and zoom 100–300 (`users.profile_focal_x` /
 * `profile_focal_y` / `profile_zoom`).
 *
 * ONE PICTURE (the controller's review of the logo step, 7 Nov): the circle comes first and is the only picture; the
 * upload under it is `[Replace photo] [Remove]` once a photo is in (`FileUpload pills`). Before one is in, the upload
 * is the caller's own empty slot — the You card's 72 px row, the profile tile's round slot.
 *
 * Used where the profile picture is SET: `/dashboard/profile` and the signup "You" card. The frame posts as the three
 * `PICTURE_FRAME_FIELDS.profile_photo` fields with the form's own save (`planPersonalInfoPatch`), exactly as the
 * logo's frame posts with the logo — one save, never a second writer. A new picture starts centred.
 */
export function ProfilePhotoField({
  userId,
  storedPhoto,
  initialDisplayUrls,
  frame: savedFrame,
  unsavedHint,
  help,
  slotSays,
  row,
  aside,
  uploadRowClassName,
}: {
  userId: string;
  /** The stored ref (`r2://…`) or null. */
  storedPhoto: string | null;
  /** r2Ref → display URL, so a returning account's photo paints on load. */
  initialDisplayUrls: Record<string, string>;
  /** The saved frame (`readProfilePhotoFrame`). */
  frame: PictureFrame;
  /** The tail of the upload's "Not saved yet — …", naming this form's own button. */
  unsavedHint: string;
  help?: string;
  slotSays?: string;
  row?: { title: string; titleClassName?: string; hintClassName?: string; actionClassName?: string };
  /** What sits BESIDE the photo (the profile page's name block), laid out by `uploadRowClassName`. */
  aside?: ReactNode;
  uploadRowClassName?: string;
}) {
  const storedDisplay = storedPhoto
    ? (initialDisplayUrls[storedPhoto] ?? (/^https?:\/\//.test(storedPhoto) ? storedPhoto : null))
    : null;
  const [ref, setRef] = useState<string>(storedPhoto ?? '');
  const [preview, setPreview] = useState<string | null>(storedDisplay);
  const [frame, setFrame] = useState<PictureFrame>(savedFrame ?? DEFAULT_PICTURE_FRAME);

  return (
    <div className="space-y-3" data-profile-photo-field="">
      <div className={uploadRowClassName}>
        <div className="min-w-0 space-y-3">
          <PictureFrameControl
            picture="profile_photo"
            imageUrl={ref ? preview : null}
            frame={frame}
            onChange={setFrame}
            alt="Your photo, as people see it"
            tipTitle="The circle is what people see"
            size={132}
          />
          <FileUpload
            bucket="media"
            pathPrefix={`profile-photo/${userId}`}
            name="profile_photo_url"
            unsavedHint={unsavedHint}
            currentValue={storedPhoto}
            initialDisplayUrls={initialDisplayUrls}
            maxSizeMB={2}
            acceptedTypes={['image/png', 'image/jpeg', 'image/webp']}
            variant="square"
            roundPreview
            pills={{ replace: 'Replace photo' }}
            slotSays={slotSays}
            help={help}
            row={row}
            onChange={(v) => {
              const next = Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
              setRef(next);
              if (!next) setPreview(null);
              else if (next === storedPhoto) setPreview(storedDisplay);
            }}
            onFilePicked={(file) => {
              // The frame is set on the picture in hand — no wait for the upload to answer — and a new picture starts
              // centred: the old frame belonged to the old picture (the logo's rule).
              setFrame(DEFAULT_PICTURE_FRAME);
              try {
                setPreview(URL.createObjectURL(file));
              } catch {
                setPreview(null);
              }
            }}
          />
        </div>
        {aside}
      </div>
    </div>
  );
}
