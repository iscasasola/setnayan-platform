'use client';

import { useEffect, useRef } from 'react';
import { usePrintSave } from '@/app/dashboard/[eventId]/launch/_components/print-save-button';

/**
 * 📥 "Save as Excel" — the Guest list as a spreadsheet, SAVED, never shown in place. Since the summary carousel
 * (owner 2026-10-27, "APPROVED — GUESTS CAROUSEL STYLE A") the counts strip that drew "⤓ Excel" is gone, so the export
 * is a choice in the Guests thumb row's ≡ menu, wearing the SHARE icon (owner 2026-10-27, "FILE BUTTONS ARE A SHARE
 * BUTTON": *"the button should be like the share icon where they can download it view it, open the file"*).
 *
 * 🐞 Owner, 27 Oct 2026 (screenshot from the iPhone app): *"download excel on the app when pressed opened the file
 * with no close button and it did not download"*. It was a bare `<a href download>`: the app's web view ignores
 * `download` on a same-origin GET and RENDERS the CSV in the app's only view — no back, no close, nothing saved.
 *
 * The save is the one every Prints button uses (`usePrintSave`): fetch the file with the signed-in session → the
 * phone's SHARE SHEET (Save to Files · open in Numbers / Excel / Sheets — "open it in an app, or save it"), and a plain
 * download on a computer. Never a link: a menu choice has no href to render in place. A failure is SAID (the route's own
 * "nothing was downloaded" when it sent one) — never the look of success; a share sheet whose tap expired while the file
 * was drawn asks for one more tap. 🔒 lib/guest-export-file.test.ts (test 6)
 */
export const GUESTS_EXCEL_KEY = 'file:excel';

export function useGuestsExcel(
  eventId: string,
  tell: { info: (text: string) => void; error: (text: string) => void },
): { label: string; save: () => void } {
  const { state, save } = usePrintSave();
  const href = `/dashboard/${eventId}/guests/export`;
  // What the last pick turned into — said once per change, in words.
  const said = useRef(state.k);
  useEffect(() => {
    if (said.current === state.k) return;
    said.current = state.k;
    if (state.k === 'error') tell.error(state.message);
    else if (state.k === 'ready') tell.info('Your Excel file is ready — tap Save as Excel again to share or save it.');
  }, [state, tell]);
  const label = state.k === 'working' ? 'Preparing Excel…' : state.k === 'ready' ? 'Tap to save Excel' : 'Save as Excel';
  return {
    label,
    save: () => {
      const day = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
      void save(href, `Guest-list-${day}.csv`);
    },
  };
}
