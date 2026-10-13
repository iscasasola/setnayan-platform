'use client';

/**
 * The lab's Booked body: the REAL rows, with the two things a row asks the
 * server for answered from fixtures — the lab has no session and no database.
 * A Nudge "sends"; "Your record" opens the real sheet on a fixture record; the
 * Pay sheet's one request is answered by `pay-fixtures.ts`.
 */
import { useMemo, type ReactNode } from 'react';
import { BookedStandInCtx, type BookedStandIns } from '@/app/dashboard/[eventId]/vendors/_components/booked-stand-ins';
import { labPaySheet } from './pay-fixtures';
import type { MoneyStage } from './money-pair';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const standIns = (payFail: boolean, paySlow: boolean, money: MoneyStage): BookedStandIns => ({
  askRoom: async () => {
    await wait(200);
  },
  loadPay: async (vendorId) => {
    await wait(paySlow ? 2500 : 200);
    return payFail ? { status: 'error' } : labPaySheet(vendorId, money);
  },
  nudge: async () => {
    await wait(200);
    return { ok: true };
  },
  loadRecord: async (vendorId) => {
    await wait(200);
    const seda = vendorId === 'v-seda';
    return {
      vendorId,
      category: seda ? 'venue' : 'cake_maker',
      name: seda ? 'Seda Vertis North' : 'Asukal Cakes',
      contactPerson: '',
      contactNumber: '',
      address: '',
      pin: null,
      covers: [],
      inclusions: '',
      price: '',
      planRows: [],
    };
  },
});

export function LabBookedStandIns({
  payFail = false,
  paySlow = false,
  money = 'due',
  children,
}: {
  payFail?: boolean;
  paySlow?: boolean;
  /** Bituin's reservation at a stage of the money loop (`money-pair.ts`). */
  money?: MoneyStage;
  children: ReactNode;
}) {
  const value = useMemo(() => standIns(payFail, paySlow, money), [payFail, paySlow, money]);
  return <BookedStandInCtx.Provider value={value}>{children}</BookedStandInCtx.Provider>;
}
