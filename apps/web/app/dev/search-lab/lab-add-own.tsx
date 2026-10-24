'use client';

/**
 * The search lab's stand-in for the add walk's three calls (no session here) — the same answers the suppliers lab
 * gives (`app/dev/suppliers-lab/lab-bench.tsx`): Setnayan's name matches from its fixtures, an ask that succeeds,
 * and an add that returns the sample claim link and its QR.
 */
import type { ReactNode } from 'react';
import { AddOwnStandInCtx } from '@/app/dashboard/[eventId]/_components/add-your-own-walk';
import { LAB_CLAIM_URL, labNameMatches } from '@/app/dev/suppliers-lab/fixtures';

export function LabAddOwn({ claimQrSvg, children }: { claimQrSvg: string; children: ReactNode }) {
  return (
    <AddOwnStandInCtx.Provider
      value={{
        search: async (query, category) => labNameMatches(query, category),
        inquire: async () => ({ ok: true }),
        add: async () => ({ ok: true, eventVendorId: 'lab-own', invite: { url: LAB_CLAIM_URL, qrSvg: claimQrSvg } }),
      }}
    >
      {children}
    </AddOwnStandInCtx.Provider>
  );
}
