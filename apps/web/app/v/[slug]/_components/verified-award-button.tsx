'use client';

import { useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';

/**
 * ✅ THE SETNAYAN VERIFIED AWARD, OPENED FROM THE SHOP PAGE (v16: `data-vr` — the Awards row's Verified item and the top
 * bar's blue check both open it). The award kit's `VerifiedFullscreen` (app/_components/award, #7752), reused as
 * shipped and fetched only on the tap that opens it, so it is never in the page's first load.
 */
export const LazyVerifiedFullscreen = dynamic(
  () => import('@/app/_components/award/verified-fullscreen').then((m) => m.VerifiedFullscreen),
  { ssr: false },
);

/** The Awards row's Verified item: its badge + fact, as one button that opens the full-screen award. */
export function VerifiedAwardButton({
  art,
  shopName,
  className,
  children,
}: {
  /** The seal as the full screen shows it (the row's own blue-check seal, larger). */
  art: ReactNode;
  shopName: string;
  className?: string;
  /** The row's badge + fact. */
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Setnayan Verified — what it means" className={className}>
        {children}
      </button>
      {open ? <LazyVerifiedFullscreen art={art} shopName={shopName} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
