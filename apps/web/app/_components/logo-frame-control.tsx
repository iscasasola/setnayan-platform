'use client';

import { PictureFrameControl } from '@/app/_components/picture-frame-control';
import type { LogoFrame } from '@/lib/open-shop-logo';

/**
 * A shop logo's align + zoom (owner, the 2026-11-06 /open-shop gate walk: *"zoom and align"*). It IS the one picture
 * control, `PictureFrameControl`, with the logo's two fields (`logo_focal` + `logo_zoom`) — the same control the
 * profile picture uses (owner 2026-11-06: *"yes, use the same control"*). Nothing is drawn here; never add a second
 * keypad or zoom menu to this file (`lib/one-picture-frame-control.test.ts`).
 */
export function LogoFrameControl({
  imageUrl,
  frame,
  onChange,
}: {
  /** The display URL of the logo (presigned), or null before one is uploaded — then nothing is offered. */
  imageUrl: string | null;
  frame: LogoFrame;
  onChange: (frame: LogoFrame) => void;
}) {
  return (
    <PictureFrameControl
      picture="logo"
      imageUrl={imageUrl}
      frame={frame}
      onChange={onChange}
      previewAlt="Your logo, as couples see it"
    />
  );
}
