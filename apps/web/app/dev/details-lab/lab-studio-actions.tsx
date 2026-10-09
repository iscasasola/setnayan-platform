'use client';

import { useEffect, useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { StudioActionsProvider, type StudioActions } from '@/app/dashboard/[eventId]/launch/_components/studio-actions-context';
import { announceMakerSave } from '@/lib/maker-save-status';
import { PrintFetchProvider } from '@/app/dashboard/[eventId]/launch/_components/print-fetch-context';
import { LAB_PRINT_FETCH, LAB_PRINT_FETCH_REFUSED, LAB_PRINT_WORDS_FORM, LAB_PRINT_WORDS_REFUSED, LAB_STUDIO_ACTIONS, LAB_STUDIO_REFUSALS } from './lab-studio-stand-ins';
import { labUploadStandIn } from './lab-upload-stand-in';

/**
 * The lab's stand-ins for the Studio pages' writes: they succeed LOCALLY and NEVER reach the database. A lab press must not be
 * able to reach production data (controller, 2026-10-09; the pattern is `app/dev/guests-lab/lab-guest-actions.tsx`).
 *
 *   · E-Gifts: show / hide a way, a way's number · name · QR, the registry link, the thank-you words, "Accept gifts?";
 *   · the QR upload goes through the lab's storage stand-in (`lab-upload-stand-in.ts`): the picked file stays in the browser.
 *   · `?refuse=1` makes every one of them refuse with the DATABASE'S OWN WORDS, on purpose, so the page's plain sentence can be seen.
 *   · Prints: every Save button's file is a stand-in PDF (`PrintFetchProvider`), and the print words form's submit is taken here (see the effect below).
 *   · `draft` — the Maker lab hands its own draft stand-in (it counts into ✓ Apply and honours `?fail=1`), used for "Accept gifts?".
 *
 * Drawn around the lab's whole Maker / Details, so the lazily loaded Studio pages (`details-lazy.tsx`) read it too — a context
 * travels through a `next/dynamic` boundary. NOT stubbed here: the other Studio pages' writes (their own stand-ins land with
 * their conversion); Studio › Info's rows ride `setStudioDraftDoor` (`maker-lab-shell.tsx`), Love Story/Schedule/RSVP their own fixtures.
 */
export function LabStudioActions({ draft, children }: { draft?: StudioActions['hubDraftAction']; children: ReactNode }) {
  const refuse = useSearchParams().get('refuse') === '1';
  const qrUploadSend = useMemo(() => labUploadStandIn(() => {}), []);
  const actions = useMemo<Partial<StudioActions>>(
    () => ({
      ...LAB_STUDIO_ACTIONS,
      ...(draft ? { hubDraftAction: draft } : {}),
      ...(refuse ? LAB_STUDIO_REFUSALS : {}),
      qrUploadSend,
    }),
    [refuse, draft, qrUploadSend],
  );
  /*
   * 🖨 THE PRINT WORDS FORM (Studio › Prints' include switches and Save): its submit is `SoftPost`'s, which is in the Maker's FIRST LOAD and so cannot read the
   * context. The seam is on the lab's side: a capture listener on the document takes the form's submit BEFORE `SoftPost` (target phase) hears it, sends nothing,
   * keeps what would have been posted in `window.__labPrintWords` (the stopwatch's way, as `__labDrafts`), and says what the real route's answer would say.
   */
  useEffect(() => {
    const take = (e: Event) => {
      const form = e.target;
      if (!(form instanceof HTMLFormElement) || form.id !== LAB_PRINT_WORDS_FORM) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const w = window as unknown as { __labPrintWords?: Array<Array<[string, string]>> };
      (w.__labPrintWords ??= []).push([...new FormData(form)].filter((p): p is [string, string] => typeof p[1] === 'string'));
      announceMakerSave(refuse ? { state: 'error', text: LAB_PRINT_WORDS_REFUSED } : { state: 'saved' });
    };
    document.addEventListener('submit', take, true);
    return () => document.removeEventListener('submit', take, true);
  }, [refuse]);
  return (
    <StudioActionsProvider actions={actions}>
      <PrintFetchProvider value={refuse ? LAB_PRINT_FETCH_REFUSED : LAB_PRINT_FETCH}>{children}</PrintFetchProvider>
    </StudioActionsProvider>
  );
}
