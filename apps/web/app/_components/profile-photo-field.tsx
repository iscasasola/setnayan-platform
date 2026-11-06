'use client';

import { useState, type ReactNode } from 'react';

import { FileUpload } from '@/app/_components/file-upload';
import { PictureFrameControl } from '@/app/_components/picture-frame-control';
import { DEFAULT_PICTURE_FRAME, type PictureFrame } from '@/lib/picture-frame';

/**
 * 🖼 The profile picture with its align + zoom — the person's photo upload, and RIGHT BELOW it the ONE picture
 * control the shop logo uses (`PictureFrameControl`). ⚖ Owner 2026-11-06, asked whether the profile picture gets
 * the logo's align + zoom: *"yes, use the same control"*. Same placement as the logo screen (`add-your-logo.tsx`):
 * the upload, then the control; the control appears once there is a picture and sets the frame on the picture in
 * hand — a freshly picked file is framed from its local copy, without waiting for the upload to answer.
 *
 * Used where the profile picture is SET: `/dashboard/profile` and the signup "You" card. The upload's own props are
 * the caller's (its button, its row layout); this owns only the picture-in-hand and the frame. The frame posts as
 * `profile_photo_focal` / `profile_photo_zoom` with the form's own save (`planPersonalInfoPatch`), exactly as the
 * logo's frame posts with the logo — one save, never a second writer.
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
  /** What sits BESIDE the upload (the profile page's name block), laid out by `uploadRowClassName`. The frame
   *  control always sits below that row, full width — the logo screen's placement. */
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
            // The frame is set on the picture in hand — no wait for the upload to answer (the logo screen's rule).
            try {
              setPreview(URL.createObjectURL(file));
            } catch {
              setPreview(null);
            }
          }}
        />
        {aside}
      </div>
      <PictureFrameControl
        picture="profile_photo"
        imageUrl={ref ? preview : null}
        frame={frame}
        onChange={setFrame}
        previewAlt="Your photo, as people see it"
      />
    </div>
  );
}
