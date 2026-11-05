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

const standIns = (payFail: boolean, paySlow: boolean, money: MoneyStage, whereFail: boolean): BookedStandIns => ({
  // 📍 A tick in Where: the lab's rows are all booked, so a change "tells" the supplier.
  setWhere: async () => {
    await wait(300);
    return whereFail ? { ok: false, message: 'That didn’t save. Nothing changed — try again.' } : { ok: true, picked: [], told: true };
  },
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
  saveRule: async () => {
    await wait(200);
    return { ok: true as const };
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
  whereFail = false,
  money = 'due',
  today,
  children,
}: {
  payFail?: boolean;
  paySlow?: boolean;
  /** 📍 `&wherefail=1` — a Where tick is refused. */
  whereFail?: boolean;
  /** Bituin's reservation at a stage of the money loop (`money-pair.ts`). */
  money?: MoneyStage;
  /** The lab's day — the Pay sheet reads the same day as the Booked rows (one clock). */
  today: string;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ ...standIns(payFail, paySlow, money, whereFail), today }), [payFail, paySlow, money, whereFail, today]);
  return <BookedStandInCtx.Provider value={value}>{children}</BookedStandInCtx.Provider>;
}
