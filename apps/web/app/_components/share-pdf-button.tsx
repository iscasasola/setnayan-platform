'use client';

import { useEffect, useState } from 'react';
import { Loader2, Printer, Share } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { usePrintSave } from '@/app/dashboard/[eventId]/launch/_components/print-save-button';
import { isNativeApp } from '@/lib/capacitor';
import { sharePdfPaperParam, type SharePdfPaper } from '@/lib/share-pdf-papers';
import { PaperPicker, readRememberedPaper, rememberPaper } from './paper-picker';

/**
 * 📤 SHARE — THE ONE BUTTON EVERY DATA VIEW USES TO HAND OVER A PDF OF WHAT IS ON SCREEN (owner 2026-10-29: *"each
 * print lives where its data lives"*). Budget is the first (`budget/_components/budget-file-actions.tsx`); the guest
 * list, the seat chart, the march and the map follow with the same button and their own route.
 *
 *   <SharePdfButton href={`/api/budget/${eventId}/export?format=pdf`} fileName="setnayan-rosa-ben-budget.pdf"
 *                   name="Share your budget (PDF)" papers="document" />
 *
 * `href` is the view's own PDF route (it draws with `lib/share-pdf.ts`); `papers` adds the `Paper ▾` choice
 * (`PaperPicker`: "document" = A4 · Letter · Long bond, "poster" = A4 … A0 · Custom), sent as `?paper=` and remembered
 * per device. The file is made when Share is pressed, never when the page opens.
 *
 * The save is the one every file in this app goes through (`usePrintSave`): fetched with the signed-in session, then
 *   · a phone or tablet — the iPhone / Android app's web view and the mobile browsers: the system SHARE SHEET, which
 *     itself offers Print, Save to Files, AirDrop, Messages, Mail, Viber, Messenger — every way the phone knows;
 *   · a computer: the PDF downloads, and a quiet "Print" opens it in the browser's own PDF viewer.
 * Nothing opens a page in the app's only view, so nothing can trap it; "Print" is never offered inside the app. A file
 * that outlives the tap (iOS refuses a share whose tap expired while the PDF was drawn) is kept and the button asks for
 * one more tap; a refusal says why in the route's own words — never the look of success. An app view with no share
 * sheet (Android's) has no Downloads folder either, so there it says so instead of "Sent to your downloads".
 * 🔒 lib/budget-share-is-one-file.test.ts
 */
export function SharePdfButton({
  href,
  fileName,
  name,
  papers,
}: {
  href: string;
  fileName: string;
  /** The accessible name — says WHAT is shared ("Share your budget (PDF)"). */
  name: string;
  /** Offer `Paper ▾`. Omitted → the route's default (A4). */
  papers?: 'document' | 'poster';
}) {
  const { state, save } = usePrintSave();
  const [paper, setPaper] = useState<SharePdfPaper>('a4');
  useEffect(() => {
    if (papers) setPaper(readRememberedPaper(papers));
  }, [papers]);
  const url = papers ? `${href}${href.includes('?') ? '&' : '?'}paper=${encodeURIComponent(sharePdfPaperParam(paper))}` : href;
  const word = state.k === 'working' ? 'Preparing…' : state.k === 'ready' ? 'Tap to share' : 'Share';
  // A computer that downloaded it can print it from here; the app never gets a second view to be trapped in.
  const printable = state.k === 'saved' && state.via === 'download' && !isNativeApp() ? state.file : null;

  return (
    <span className="inline-flex flex-col items-start gap-1" data-share-pdf="">
      <span className="inline-flex flex-wrap items-center gap-2">
        <ActionButton
          tone="neutral"
          waiting={state.k === 'working'}
          icon={state.k === 'working' ? <Loader2 aria-hidden className="animate-spin" strokeWidth={1.9} /> : Share}
          label={word}
          name={state.k === 'working' ? word : name}
          onClick={() => void save(url, fileName)}
        />
        {papers ? (
          <PaperPicker
            kind={papers}
            value={paper}
            onPick={(p) => {
              setPaper(p);
              rememberPaper(papers, p);
            }}
          />
        ) : null}
        {printable ? <ActionButton tone="neutral" quiet icon={Printer} label="Print" onClick={() => printFile(printable)} /> : null}
      </span>
      {state.k === 'error' ? (
        <span role="alert" className="max-w-[18rem] text-xs text-danger-700">
          {state.message}
        </span>
      ) : state.k === 'ready' ? (
        <span role="status" className="text-xs text-ink/60">
          Your PDF is ready.
        </span>
      ) : state.k === 'saved' && state.via === 'download' ? (
        isNativeApp() ? (
          <span role="alert" className="max-w-[18rem] text-xs text-danger-700">
            This app can&rsquo;t share files on this phone yet — open setnayan.com in your browser to share it.
          </span>
        ) : (
          <span role="status" className="text-xs text-ink/60">
            Sent to your downloads.
          </span>
        )
      ) : null}
    </span>
  );
}

/** Open the PDF already in hand in the browser's own viewer (it has Print). A computer only — see above. */
function printFile(file: File) {
  const url = URL.createObjectURL(file);
  window.open(url, '_blank');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
