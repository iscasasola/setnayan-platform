'use client';

/**
 * The lab's Find body: the REAL `ShortlistCategories`, with the marketplace
 * read ("More to compare") answered from fixtures — the lab has no session and
 * no database. `&fail=1` makes that read fail; the supplier sheet's one request
 * is answered here too (`&sheetfail=1` fails it, `&slow=1` holds it 2.5 s).
 * Save and Remove on a card are answered here as well (0.6 s; `&writefail=1`
 * refuses them), so the lab shows a press answering in place.
 */
import type { ComponentProps } from 'react';
import { MoreRowStandInCtx, ShortlistCategories } from '@/app/dashboard/[eventId]/vendors/_components/shortlist-categories';
import { BenchWritesStandInCtx, type BenchWrites } from '@/app/dashboard/[eventId]/vendors/_components/bench-local';
import { AddOwnStandInCtx } from '@/app/dashboard/[eventId]/_components/add-your-own-walk';
import { LAB_CLAIM_URL, LAB_MARKET, labNameMatches, labSheet } from './fixtures';
import { labFind } from './find-fixtures';

export function LabBench({
  fail,
  sheetFail,
  slow,
  writeFail,
  claimQrSvg,
  findDates = null,
  findCards = null,
  ...props
}: ComponentProps<typeof ShortlistCategories> & {
  fail: boolean;
  sheetFail: boolean;
  slow: boolean;
  writeFail: boolean;
  /** The sample claim link's QR, drawn on the server (the QR library is server-only). */
  claimQrSvg: string;
  /** Find v4 — `&dates=unread|none` · `&cards=fail` (`find-fixtures.ts`). */
  findDates?: string | null;
  findCards?: string | null;
}) {
  const pause = () => new Promise((r) => setTimeout(r, 600));
  const writes: BenchWrites = {
    remove: async () => {
      await pause();
      if (writeFail) throw new Error('lab: refused');
    },
    save: async (fd) => {
      await pause();
      if (writeFail) return { status: 'error', message: 'lab: refused' };
      return { status: 'ok', eventVendorId: `lab-${String(fd.get('vendor_profile_id'))}`, eventName: null };
    },
    pin: async () => {
      await pause();
      return writeFail ? { ok: false, error: 'lab: refused' } : { ok: true };
    },
    unpin: async () => {
      await pause();
      return writeFail ? { ok: false, error: 'lab: refused' } : { ok: true };
    },
  };
  return (
    <BenchWritesStandInCtx.Provider value={writes}>
    {/* "Add your own": the walk's three calls, answered here — the lab has no
        session, so the real actions would all refuse. */}
    <AddOwnStandInCtx.Provider
      value={{
        search: async (query, category) => labNameMatches(query, category),
        inquire: async () => ({ ok: true }),
        // What the Add posted rides into the address (`&own=`), so the walk's
        // one refresh draws the record the way the real insert would store it.
        add: async (fd) => {
          const u = new URL(window.location.href);
          u.searchParams.set(
            'own',
            [fd.get('category'), fd.get('category_key') ?? '', fd.get('business_name')].map((v) => String(v ?? '')).join('~'),
          );
          window.history.replaceState(null, '', u.toString());
          return { ok: true, eventVendorId: 'v-own', invite: { url: LAB_CLAIM_URL, qrSvg: claimQrSvg } };
        },
      }}
    >
    <MoreRowStandInCtx.Provider
      value={async ({ tile, query, sheetFor }) => {
        if (sheetFor) {
          // The supplier sheet's one request.
          await new Promise((r) => setTimeout(r, slow ? 2500 : 150));
          return { results: [], freeDaysByProfileId: {}, noProbeWindow: true, serviceCardByProfileId: {}, sheet: sheetFail ? null : labSheet(sheetFor) };
        }
        if (fail) throw new Error('lab: the read failed');
        // Find v4: every card of the category, per service (Catering · Massage Chair).
        const all = labFind(tile, { dates: findDates, cards: findCards });
        if (all) {
          const q = (query ?? '').trim().toLowerCase();
          const results = all.results.filter((r) => !q || r.name.toLowerCase().includes(q));
          const ids = new Set(results.map((r) => r.vendorProfileId));
          return {
            results,
            freeDaysByProfileId: {},
            noProbeWindow: true,
            serviceCardByProfileId: {},
            cards: all.cards ? all.cards.filter((c) => ids.has(c.profileId)) : null,
            services: all.services,
            availability: all.availability,
            availabilityDays: all.availabilityDays,
          };
        }
        const m = LAB_MARKET[tile];
        const q = (query ?? '').trim().toLowerCase();
        const rows = (m?.rows ?? []).filter((r) => !q || `${r.name} ${m?.cards[r.vendorProfileId]?.name ?? ''}`.toLowerCase().includes(q));
        return { results: rows, freeDaysByProfileId: {}, noProbeWindow: true, serviceCardByProfileId: m?.cards ?? {} };
      }}
    >
      <ShortlistCategories {...props} />
    </MoreRowStandInCtx.Provider>
    </AddOwnStandInCtx.Provider>
    </BenchWritesStandInCtx.Provider>
  );
}
