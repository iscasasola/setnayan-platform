'use client';

import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { HUB_FOCAL_POINTS, HUB_ZOOMS } from '@/lib/hub-canvas';
import {
  PICTURE_FRAME_FIELDS,
  PICTURE_ZOOM_LABEL,
  pictureFrameStyle,
  type FramedPicture,
  type PictureFrame,
} from '@/lib/picture-frame';

/**
 * 🖼 THE ONE ALIGN + ZOOM CONTROL for a round picture — the shop logo AND the person's profile picture.
 *
 * ⚖ Owner, 2026-11-06: the logo got *"zoom and align"* in the /open-shop gate walk (the Event Hub Maker photo's
 * control, reused as-is), and asked whether the profile picture gets the same: *"yes, use the same control"*. So
 * there is ONE control, here; `LogoFrameControl` is this with `picture="logo"`, and the profile picture's field
 * renders this with `picture="profile_photo"`. Never fork it — `lib/one-picture-frame-control.test.ts` fails if
 * either picture stops drawing through `PictureFrameControl`.
 *
 * The keypad is the Maker's "In frame" row from `website/editor/_components/scene-background-row.tsx`, unchanged:
 * the photo behind a 3 × 3 grid, one tap keeps that area in frame (`HUB_FOCAL_POINTS`, "Keep area N of 9 in frame"),
 * and "How close" is the same ONE dropdown over `HUB_ZOOMS` with the same words. Beside it, the round frame people
 * see, drawn through `pictureFrameStyle` — the one style every framed picture uses. (Extracted from the logo's copy,
 * not from the Maker file, because ~10 guards read that file's text.)
 *
 * Posts the picture's two columns as hidden inputs (`PICTURE_FRAME_FIELDS[picture]`) for the form it sits in.
 */
export function PictureFrameControl({
  picture,
  imageUrl,
  frame,
  onChange,
  previewAlt,
}: {
  /** Which picture — names the two posted fields. */
  picture: FramedPicture;
  /** The display URL of the picture (presigned, or a local blob), or null before one is chosen — then nothing is offered. */
  imageUrl: string | null;
  frame: PictureFrame;
  onChange: (frame: PictureFrame) => void;
  /** The round preview's words, e.g. "Your logo, as couples see it". */
  previewAlt: string;
}) {
  const fields = PICTURE_FRAME_FIELDS[picture];
  return (
    <div className="space-y-2" data-picture-frame={picture}>
      <input type="hidden" name={fields.focal} value={frame.focal} />
      <input type="hidden" name={fields.zoom} value={frame.zoom} />
      {imageUrl ? (
        <div className="flex items-center gap-4">
          {/* The round frame, as people will see it. */}
          <span
            className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border"
            style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper)' }}
            data-picture-frame-preview=""
          >
            {/* Presigned R2 URL — next/image can't optimise short-lived signed URLs (FileUpload's pattern). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={previewAlt} className="h-full w-full object-cover" style={pictureFrameStyle(frame)} />
          </span>
          <div className="min-w-0 space-y-2">
            <span className="block text-xs" style={{ color: 'var(--m-slate-3)' }}>
              What to keep in frame
            </span>
            <div className="flex items-center gap-3">
              <div
                className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-md border bg-cover"
                style={{ borderColor: 'var(--m-line)', backgroundImage: `url("${imageUrl}")`, backgroundPosition: 'center' }}
              >
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                  {HUB_FOCAL_POINTS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      aria-pressed={frame.focal === f}
                      aria-label={`Keep area ${f} of 9 in frame`}
                      onClick={() => onChange({ ...frame, focal: f })}
                      className={`border border-white/35 ${frame.focal === f ? 'bg-white/70' : 'hover:bg-white/25'}`}
                    />
                  ))}
                </div>
              </div>
              {/* One of three VALUES → the dropdown, never a row of segments (`INTERACTION_RULES.md` § 2, § 9). */}
              <PickMenu
                label="How close"
                dataAttr="data-picture-zoom"
                value={String(frame.zoom)}
                options={HUB_ZOOMS.map((z) => ({ key: String(z), label: PICTURE_ZOOM_LABEL[z] }))}
                onPick={(k) => {
                  const z = HUB_ZOOMS.find((x) => String(x) === k);
                  if (z) onChange({ ...frame, zoom: z });
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
