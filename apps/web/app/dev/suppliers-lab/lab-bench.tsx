'use client';

/**
 * The lab's Find body: the REAL `ShortlistCategories`, with the marketplace
 * read ("More to compare") answered from fixtures — the lab has no session and
 * no database. `&fail=1` makes that read fail; the supplier sheet's one request
 * is answered here too (`&sheetfail=1` fails it, `&slow=1` holds it 2.5 s).
 */
import type { ComponentProps } from 'react';
import { MoreRowStandInCtx, ShortlistCategories } from '@/app/dashboard/[eventId]/vendors/_components/shortlist-categories';
import { LAB_MARKET, labSheet } from './fixtures';

export function LabBench({
  fail,
  sheetFail,
  slow,
  ...props
}: ComponentProps<typeof ShortlistCategories> & { fail: boolean; sheetFail: boolean; slow: boolean }) {
  return (
    <MoreRowStandInCtx.Provider
      value={async ({ tile, query, sheetFor }) => {
        if (sheetFor) {
          // The supplier sheet's one request.
          await new Promise((r) => setTimeout(r, slow ? 2500 : 150));
          return { results: [], freeDaysByProfileId: {}, noProbeWindow: true, serviceCardByProfileId: {}, sheet: sheetFail ? null : labSheet(sheetFor) };
        }
        if (fail) throw new Error('lab: the read failed');
        const m = LAB_MARKET[tile];
        const q = (query ?? '').trim().toLowerCase();
        const rows = (m?.rows ?? []).filter((r) => !q || `${r.name} ${m?.cards[r.vendorProfileId]?.name ?? ''}`.toLowerCase().includes(q));
        return { results: rows, freeDaysByProfileId: {}, noProbeWindow: true, serviceCardByProfileId: m?.cards ?? {} };
      }}
    >
      <ShortlistCategories {...props} />
    </MoreRowStandInCtx.Provider>
  );
}
