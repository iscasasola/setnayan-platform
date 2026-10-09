'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { saveEgiftMethod, savePabuyaMessage, setEgiftMethodEnabled } from '../../pabuya/actions';
import { hubDraftAction } from '../../website/hub-draft-actions';
import type { UploadSend } from '@/lib/upload-send';

/**
 * The writes a STUDIO PAGE'S controls reach — the SHIPPED server actions by default (controller, 2026-10-09; the pattern is
 * `guests/_components/guest-actions-context.tsx`).
 *
 * Why this exists: the owner presses things on the dev labs (`/dev/maker-lab?studio=1`, `/dev/details-lab`), which draw the REAL
 * Studio pages on fixtures — and every one of these presses used to reach the real action, so a lab press could reach the
 * database. The lab hands in stand-ins that succeed LOCALLY (`app/dev/details-lab/lab-studio-actions.tsx`), and with `?refuse=1`
 * refuse with the database's own words so the page's plain sentence can be seen. NOTHING IN THE APP EVER PROVIDES THIS CONTEXT, so
 * production runs the real thing: `useStudioActions()` falls back to `REAL_STUDIO_ACTIONS` for every name the provider does not
 * override. (Held by `app/dev/details-lab/the-studio-lab-cannot-reach-the-database.test.ts`.)
 *
 * Call sites keep the action's OWN name (`const { saveEgiftMethod } = useStudioActions();`), so every call reads — and every guard
 * that pins "the page calls saveEgiftMethod(…)" still reads — as the real call.
 *
 * Pages on it so far: E-Gifts (`StudioEgifts`, `StudioThanks`, `AnswerPicker`). EACH PAGE CONVERTED LATER ADDS ITS WRITES HERE, in its
 * own commit — the context is not "done".
 *
 * Loaded with the pages that read it (`details-lazy.tsx`, the `maker-details` chunk) — never in the Maker's first load.
 */
export type StudioActions = {
  /** E-Gifts: show / hide a way, create / change a way (number, name, QR), the registry link and the thank-you words (the last, drafted). */
  setEgiftMethodEnabled: typeof setEgiftMethodEnabled;
  saveEgiftMethod: typeof saveEgiftMethod;
  savePabuyaMessage: typeof savePabuyaMessage;
  /** The Maker's draft door — "Accept gifts?" and the other Your-info answers. */
  hubDraftAction: typeof hubDraftAction;
  /**
   * A stand-in for storage for the QR upload (`FileUpload send`) — `undefined` = the real presigned upload. ONLY the lab provides one.
   */
  qrUploadSend: UploadSend | undefined;
};

export const REAL_STUDIO_ACTIONS: StudioActions = {
  setEgiftMethodEnabled,
  saveEgiftMethod,
  savePabuyaMessage,
  hubDraftAction,
  qrUploadSend: undefined,
};

export const StudioActionsContext = createContext<Partial<StudioActions> | null>(null);

export function StudioActionsProvider({ actions, children }: { actions: Partial<StudioActions>; children: ReactNode }) {
  return <StudioActionsContext.Provider value={actions}>{children}</StudioActionsContext.Provider>;
}

export function useStudioActions(): StudioActions {
  const over = useContext(StudioActionsContext);
  return useMemo(() => (over ? { ...REAL_STUDIO_ACTIONS, ...over } : REAL_STUDIO_ACTIONS), [over]);
}
