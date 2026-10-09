'use client';

import { useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { StudioActionsProvider, type StudioActions } from '@/app/dashboard/[eventId]/launch/_components/studio-actions-context';
import { LAB_STUDIO_ACTIONS, LAB_STUDIO_REFUSALS } from './lab-studio-stand-ins';
import { labUploadStandIn } from './lab-upload-stand-in';

/**
 * The lab's stand-ins for the Studio pages' writes: they succeed LOCALLY and NEVER reach the database. A lab press must not be
 * able to reach production data (controller, 2026-10-09; the pattern is `app/dev/guests-lab/lab-guest-actions.tsx`).
 *
 *   · E-Gifts: show / hide a way, a way's number · name · QR, the registry link, the thank-you words, "Accept gifts?";
 *   · the QR upload goes through the lab's storage stand-in (`lab-upload-stand-in.ts`): the picked file stays in the browser.
 *   · `?refuse=1` makes every one of them refuse with the DATABASE'S OWN WORDS, on purpose, so the page's plain sentence can be seen.
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
  return <StudioActionsProvider actions={actions}>{children}</StudioActionsProvider>;
}
