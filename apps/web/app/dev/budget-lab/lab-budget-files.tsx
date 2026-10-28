'use client';

import type { ReactNode } from 'react';
import { PrintFetchProvider } from '@/app/dashboard/[eventId]/launch/_components/print-fetch-context';

/**
 * The lab's file fetch for Budget's file buttons: `/api/budget/<id>/export?format=…` is answered by the lab's own
 * stand-in (`/dev/budget-lab/file`, the REAL PDF builder over the fixture), so a press in the lab reaches no route
 * that reads the database. Anything else (the calendar file) gets a tiny stand-in text file.
 */
export function LabBudgetFiles({ state, children }: { state: string; children: ReactNode }) {
  const labFetch: typeof fetch = (input) => {
    const url = new URL(String(input), window.location.origin);
    if (url.pathname.startsWith('/api/budget/') && url.pathname.endsWith('/export')) {
      return fetch(
        `/dev/budget-lab/file?format=${url.searchParams.get('format') ?? 'pdf'}&paper=${encodeURIComponent(url.searchParams.get('paper') ?? 'a4')}&state=${encodeURIComponent(state)}`,
      );
    }
    return Promise.resolve(new Response('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n', { headers: { 'Content-Type': 'text/calendar' } }));
  };
  return <PrintFetchProvider value={labFetch}>{children}</PrintFetchProvider>;
}
