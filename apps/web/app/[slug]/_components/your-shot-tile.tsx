'use client';

import { useState } from 'react';
import { GalleryLightbox } from '@/app/_components/gallery/gallery-lightbox';
import { LightboxSaveButton } from '@/app/_components/gallery/lightbox-save-button';

/**
 * ONE OF "YOUR SHOTS", OPENED IN PLACE (owner 2026-10-24, the sweep after the gift QR: *"there is no way to go back"*).
 *
 * The tile was `<a href="/papic/me/<token>/photo?id=…" target="_blank">` — the full-resolution, metadata-stripped
 * photo ROUTE, served inline. In the app shell and the installed PWA that is a bare picture with no Setnayan around it
 * and nothing to press. Now a tap opens the shared viewer (`GalleryLightbox`) over the page, and its Save fetches THAT
 * SAME route — so the guest still gets the full-resolution, EXIF-stripped file (RA 10173), without leaving the Hub.
 */
export function YourShotTile({ previewUrl, saveUrl, id }: { previewUrl: string; saveUrl: string; id: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-your-shot=""
        data-save-src={saveUrl}
        aria-haspopup="dialog"
        aria-label="Open this photo"
        className="block h-full w-full p-0"
      >
        {/* Presigned URL — raw <img> (the optimizer would cache the expiry). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={previewUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
      </button>
      {open ? (
        <GalleryLightbox
          src={previewUrl}
          kind="photo"
          label="Your shot"
          onClose={() => setOpen(false)}
          actions={<LightboxSaveButton url={saveUrl} filename={`setnayan-photo-${id}.jpg`} />}
        />
      ) : null}
    </>
  );
}
