'use client';

import { createContext, useContext, type ReactNode } from 'react';

/**
 * The file fetch behind every Prints Save button (`PrintSaveButton`: `/api/hub-print/…`, the pass zip, the free prints) — the REAL `fetch` by default.
 *
 * Why: the dev labs draw the real Prints page on fixtures, and a Save pressed there asked the real route to draw a file from the database
 * (controller 2026-10-09: *a lab press must not reach the database*). The lab provides a stand-in that answers with a tiny PDF and asks nothing
 * (`app/dev/details-lab/lab-studio-actions.tsx`); NOTHING IN THE APP PROVIDES THIS CONTEXT. Its own file, with no action imported, because
 * `PrintSaveButton` is rendered by pure-render tests and must not load a server action. Guard:
 * `app/dev/details-lab/the-studio-lab-cannot-reach-the-database.test.ts`.
 */
const REAL_PRINT_FETCH: typeof fetch = (input, init) => fetch(input, init);

export const PrintFetchContext = createContext<typeof fetch | null>(null);

export function PrintFetchProvider({ value, children }: { value: typeof fetch; children: ReactNode }) {
  return <PrintFetchContext.Provider value={value}>{children}</PrintFetchContext.Provider>;
}

export function usePrintFetch(): typeof fetch {
  return useContext(PrintFetchContext) ?? REAL_PRINT_FETCH;
}
