'use client';

import { Download, Loader2 } from 'lucide-react';
import { usePrintSave } from '@/app/dashboard/[eventId]/launch/_components/print-save-button';

/**
 * 📥 "⤓ Excel" on the Guest list — the list as a spreadsheet, SAVED, never shown in place.
 *
 * 🐞 Owner, 27 Oct 2026 (screenshot from the iPhone app): *"download excel on the app when pressed opened the file
 * with no close button and it did not download"* · *"shouldn't it try to open to if they have an app to open it. or
 * save it?"*. It was a bare `<a href download>`: the app's web view ignores `download` on a same-origin GET and
 * RENDERS the CSV in the app's only view — no back, no close, nothing saved.
 *
 * The fix is the save every Prints button already uses (`usePrintSave`): fetch the file with the signed-in session →
 * the phone's SHARE SHEET (Save to Files · open in Numbers / Excel / Sheets — "open it in an app, or save it"), and a
 * plain download on a computer. Not the in-app browser (`lib/open-external.ts`): that sheet has its OWN cookies, is
 * signed out, and would answer this private route with "Sign in".
 *
 * `href` + `download` stay on the anchor — a tap before hydration, or with scripting off, still gets the file the old
 * way. A failure says so in words beside the button (the route's own "nothing was downloaded" when it sent one) —
 * never the look of success.
 */
export function GuestsExcelButton({ eventId, className }: { eventId: string; className: string }) {
  const { state, save } = usePrintSave();
  const href = `/dashboard/${eventId}/guests/export`;
  const day = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  const word = state.k === 'working' ? 'Preparing…' : state.k === 'ready' ? 'Tap to save' : 'Excel';
  return (
    <>
      <a
        href={href}
        download
        className={className}
        aria-label="Download as Excel"
        aria-busy={state.k === 'working' || undefined}
        title="Download as Excel"
        data-guests-export=""
        onClick={(e) => {
          e.preventDefault();
          void save(href, `Guest-list-${day}.csv`);
        }}
      >
        {state.k === 'working' ? (
          <Loader2 aria-hidden className="animate-spin" strokeWidth={1.9} />
        ) : (
          <Download aria-hidden strokeWidth={1.9} />
        )}
        <span className="lbl">{word}</span>
      </a>
      {state.k === 'error' ? (
        <span role="alert" className="basis-full text-xs text-danger-700" data-guests-export-error="">
          {state.message}
        </span>
      ) : null}
    </>
  );
}
