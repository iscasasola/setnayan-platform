'use client';

import { useEffect, useState } from 'react';
import { QrActions } from '@/app/_components/qr-actions';

/**
 * ⋯ Scan to view's control strip — Download · Write to NFC · Copy link — for the master event QR the Maker's ⋯ sheet
 * draws (`MoreExtras` in `editor-shell.tsx`). Its own module since 2026-10-18 so it loads with the sheet's lazy group
 * (`details-lazy.tsx`, `maker-details`), never in the Maker's first load: the strip's NFC writer and tag codec alone
 * were ~4.6KB gz of a first load that sat AT its 507KB ceiling. The strip needs the absolute address, which only the
 * browser knows, so it draws once mounted — as it did inside `MoreExtras`.
 */
export function ScanQrStrip({ liveHref }: { liveHref: string }) {
  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  useEffect(() => {
    setLiveUrl(new URL(liveHref, window.location.origin).toString());
  }, [liveHref]);
  if (!liveUrl) return null;
  return (
    <QrActions
      url={liveUrl}
      download={{ href: `/api/website/qr${liveHref}`, filename: 'setnayan-event-qr.png' }}
      className="mt-2 flex flex-wrap gap-1.5"
    />
  );
}
