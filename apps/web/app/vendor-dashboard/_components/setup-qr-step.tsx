'use client';

import { Image as ImageIcon, ScanLine } from 'lucide-react';
import { QrCard } from '@/app/_components/qr-card';
import { useSetupTour } from './supplier-setup-folds';

/**
 * 📥 STEP 6 · DOWNLOAD YOUR QR (owner 7 Nov 2026, prototype `open-shop-redesign.html` v21 `paneQr`): the shop's own
 * code, drawn by the shipped `QrCard`, with Download as the one filled button and the prototype's two lines — where a
 * scan leads (the shop's Setnayan page, `/v/<slug>` — `myPageUrl`, never the couple Event Hub root) and that it goes
 * on their photos. The file keeps the shipped name (`setnayan-shop-qr.svg`). Once the file is handed over, the tour
 * after step 6 starts (`useSetupTour`).
 */
export const SETUP_QR_FILENAME = 'setnayan-shop-qr.svg';

export function SetupQrStep({ svg, url, title }: { svg: string | null; url: string; title: string }) {
  const tour = useSetupTour();
  const shown = url.replace(/^https?:\/\//, '');
  return (
    <QrCard
      svg={svg}
      url={url}
      title={title}
      filename={SETUP_QR_FILENAME}
      data="setup-shop"
      primary="download"
      onDownloaded={tour?.qrSaved}
      note={
        <div className="mt-1 w-full max-w-[24rem] space-y-2 text-left text-[13.5px] leading-snug text-[color:var(--m-slate-2)]" data-setup-qr-lines="">
          <p className="flex items-start gap-2.5">
            <ScanLine aria-hidden className="mt-0.5 h-4 w-4 flex-none text-sn-accent" strokeWidth={1.9} />
            <span>
              Scanning it opens your page — <b className="break-words font-semibold text-ink" data-setup-qr-url="">{shown}</b>
            </span>
          </p>
          <p className="flex items-start gap-2.5">
            <ImageIcon aria-hidden className="mt-0.5 h-4 w-4 flex-none text-sn-accent" strokeWidth={1.9} />
            <span>Put it on your photos, posts and cards so couples find you.</span>
          </p>
        </div>
      }
    />
  );
}
