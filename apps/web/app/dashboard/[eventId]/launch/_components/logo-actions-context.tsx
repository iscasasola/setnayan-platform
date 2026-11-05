'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { hubDraftAction } from '../../website/hub-draft-actions';

/**
 * The Logo page's one write — the SHIPPED draft door by default. The page takes `hubDraftAction` from here, under its own name, so the
 * dev lab (`/dev/maker-lab?studio=1`) can hand a stand-in that writes nothing (`app/dev/maker-lab/lab-logo-actions.tsx`). Nothing in the
 * app ever provides this context, so production runs the real action (`the-logo-lab-cannot-reach-the-database.test.ts`).
 * Rides the lazy `maker-details` chunk with the page that reads it — never the Maker's first load.
 */
export type LogoActions = { hubDraftAction: typeof hubDraftAction };
export const REAL_LOGO_ACTIONS: LogoActions = { hubDraftAction };
export const LogoActionsContext = createContext<Partial<LogoActions> | null>(null);

export function LogoActionsProvider({ actions, children }: { actions: Partial<LogoActions>; children: ReactNode }) {
  return <LogoActionsContext.Provider value={actions}>{children}</LogoActionsContext.Provider>;
}

export function useLogoActions(): LogoActions {
  const over = useContext(LogoActionsContext);
  return useMemo(() => (over ? { ...REAL_LOGO_ACTIONS, ...over } : REAL_LOGO_ACTIONS), [over]);
}
