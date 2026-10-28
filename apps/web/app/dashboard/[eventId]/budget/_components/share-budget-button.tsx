'use client';

import { Loader2, Printer, Share } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { usePrintSave } from '@/app/dashboard/[eventId]/launch/_components/print-save-button';
import { isNativeApp } from '@/lib/capacitor';

/**
 * 📤 SHARE — the budget as ONE PDF file (`lib/budget-pdf.ts`, `/api/budget/<id>/export?format=pdf`).
 *
 * Owner 2026-10-29, from the iPhone app: *"Print Budget can be just a share button if it has the print and share there
 * as well? and maximize every other method to share that file?"*. It replaced the "Print budget" link, which opened a
 * print PAGE — in the app that page needed its own "‹ Done" bar to get back out, and its buttons were not the house
 * template.
 *
 * The save is the one every file in this app goes through (`usePrintSave`, the Prints buttons' and the guest list's
 * Excel): the file is fetched with the signed-in session and handed to the device —
 *   · a phone or tablet (the iPhone / Android app's web view and the mobile browsers): the system SHARE SHEET, which
 *     itself offers Print, Save to Files, AirDrop, Messages, Mail, Viber, Messenger — every way the phone knows;
 *   · a computer: the PDF downloads, and a quiet "Print" opens it in the browser's own PDF viewer to print.
 * Nothing opens a page in the app's only view, so nothing can trap it. "Print" is never offered inside the app.
 *
 * The PDF is made when Share is pressed, never when Budget opens. A file that outlives the tap (iOS refuses a share
 * whose tap expired while the PDF was drawn) is kept and the button asks for one more tap; a refusal says why, in the
 * route's own words ("part of it didn't load") — never the look of success.
 * 🔒 lib/budget-share-is-one-file.test.ts
 */
export function ShareBudgetButton({ eventId, fileName }: { eventId: string; fileName: string }) {
  const { state, save } = usePrintSave();
  const href = `/api/budget/${eventId}/export?format=pdf`;
  const word = state.k === 'working' ? 'Preparing…' : state.k === 'ready' ? 'Tap to share' : 'Share';
  // A computer that downloaded it can print it from here; the app never gets a second view to be trapped in.
  const printable = state.k === 'saved' && state.via === 'download' && !isNativeApp() ? state.file : null;

  return (
    <span className="inline-flex flex-col items-start gap-1" data-budget-share="">
      <span className="inline-flex flex-wrap items-center gap-2">
        <ActionButton
          tone="neutral"
          waiting={state.k === 'working'}
          icon={state.k === 'working' ? <Loader2 aria-hidden className="animate-spin" strokeWidth={1.9} /> : Share}
          label={word}
          name={state.k === 'working' ? word : 'Share your budget (PDF)'}
          onClick={() => void save(href, fileName)}
        />
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
        <span role="status" className="text-xs text-ink/60">
          Sent to your downloads.
        </span>
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
