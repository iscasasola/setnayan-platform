'use client';

/**
 * The lab's date and place sheets: the REAL sheets (`fact-sheets.tsx`), with their one read and their writes answered
 * from `fact-sheet-fixtures.ts` — the lab has no session and no database. `?sheet=date|help|place` opens one on load.
 */
import { useEffect, useMemo, type ReactNode } from 'react';
import { FactSheetStandInCtx, type FactSheetStandIns } from '@/app/dashboard/[eventId]/vendors/_components/fact-sheets';
import { openSuppliersFactSheet } from '@/lib/suppliers-fact-sheets';
import type { HubDraftActionResult } from '@/lib/hub-draft';
import { LAB_CLASH_DAY, labDateSheet, labPlaceSheet, type LabFactOptions } from './fact-sheet-fixtures';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ok: HubDraftActionResult = { ok: true, intent: 'save', applied: 0, held: [] };

export function LabFactSheets({
  options,
  open,
  writeFail = false,
  readFail = false,
  children,
}: {
  options: LabFactOptions;
  open: 'date' | 'help' | 'place' | null;
  writeFail?: boolean;
  readFail?: boolean;
  children: ReactNode;
}) {
  const value = useMemo<FactSheetStandIns>(
    () => ({
      open: async (which, month) => {
        await wait(350);
        if (readFail) return { ok: false, error: 'This could not be opened just now. Nothing was changed — close it and try again in a moment.' };
        return which === 'date' ? { ok: true, which, date: labDateSheet(options, month) } : { ok: true, which, place: labPlaceSheet(options) };
      },
      draft: async (patch) => {
        await wait(300);
        if (writeFail) return { ok: false, intent: 'save', error: 'That did not save. Nothing changed — please try again.' };
        const ev = (patch as { events?: Record<string, unknown> }).events;
        if (ev?.event_date === LAB_CLASH_DAY && options.venues === 'booked') {
          return {
            ok: false,
            intent: 'save',
            error: 'Seda Vertis North is booked elsewhere that day.',
            clash: [{ vendorId: 'v-seda', name: 'Seda Vertis North', service: 'Reception venue', href: '/dev/suppliers-lab?mode=booked' }],
          };
        }
        return ok;
      },
      withdraw: async () => {
        await wait(300);
        return { ...ok, intent: 'date_change', message: 'Withdrawn. Your date stays as it is.' };
      },
    }),
    [options, writeFail, readFail],
  );
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => openSuppliersFactSheet(open === 'help' ? 'date' : open, open === 'help'), 400);
    return () => window.clearTimeout(t);
  }, [open]);
  return <FactSheetStandInCtx.Provider value={value}>{children}</FactSheetStandInCtx.Provider>;
}
