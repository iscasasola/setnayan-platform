'use client';

import { useId, useState } from 'react';
import Image from 'next/image';
import { Sheet } from '@/app/_components/sheet';
import { recordVendorProfileView } from '@/lib/record-vendor-view';

/**
 * 👁 THE SHOP PAGE'S PORTFOLIO PHOTOS — each opens full size on a tap, and that open is ONE view of that photo (Build 3
 * Lane E item 11, owner: *"Add it. Count the views"*). The count is written by the ONE door
 * (`recordVendorProfileView({ photoKey })` → `recordPortfolioPhotoView` → the service-role RPC `record_portfolio_photo_view`), which refuses the shop's own people
 * and admins and keeps one per viewer per photo per day. Fire-and-forget: the photo opens the same whether or not it
 * was counted. `count = false` (a demo shop, a team preview) opens without counting.
 * 🔒 lib/portfolio-photo-views.test.ts
 */
export function PortfolioPhotoTiles({
  vendorProfileId,
  photos,
  label,
  count,
}: {
  vendorProfileId: string;
  photos: readonly { key: string; url: string }[];
  label: string;
  count: boolean;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const hid = useId();
  const shown = open !== null ? photos[open] : undefined;
  return (
    <>
      {photos.map((p, idx) => (
        <button
          key={p.key}
          type="button"
          onClick={() => {
            setOpen(idx);
            if (count) void recordVendorProfileView({ vendorProfileId, photoKey: p.key });
          }}
          className="relative aspect-[4/3] overflow-hidden rounded-xl bg-ink/5"
          aria-label={`Open ${label} portfolio photo ${idx + 1}`}
          data-portfolio-photo-open=""
        >
          <Image src={p.url} alt={`${label} portfolio ${idx + 1}`} fill sizes="(max-width: 640px) 50vw, 33vw" className="object-cover" />
        </button>
      ))}
      <Sheet open={shown !== undefined} onClose={() => setOpen(null)} labelledById={hid} rise>
        <div className="space-y-2 px-4 pb-6 pt-2" data-portfolio-photo-viewer="">
          <h2 id={hid} className="sr-only">
            {label} portfolio photo {open !== null ? open + 1 : ''}
          </h2>
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element -- a presigned display URL, shown whole
            <img src={shown.url} alt={`${label} portfolio ${open! + 1}`} className="max-h-[78dvh] w-full rounded-xl object-contain" />
          ) : null}
        </div>
      </Sheet>
    </>
  );
}
