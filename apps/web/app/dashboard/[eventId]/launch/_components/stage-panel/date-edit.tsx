'use client';

import { useCallback, useContext, useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { SP_ROWS, SP_ROWS_ROW } from '@/lib/maker-stage-room';
import { requestMakerRefresh } from '@/lib/maker-refresh';
import { todayInManila } from '@/lib/schedule-shift-notice';
import type { DateSheetData, FactSheetData } from '@/lib/suppliers-fact-sheets';
import { DATE_EDIT_SHARED, dateEditLines } from '@/lib/maker-date-edit';
import { FactSheet, FactSheetStandInCtx } from '../../../vendors/_components/fact-sheets';
import { openFactSheet } from '../../../vendors/_actions/fact-sheet';

/**
 * 📅 EDIT ON A DATE PART — THE EVENT DATE, AND ONE BUTTON INTO THE SHIPPED DATE SHEET (Maker Edit shell v3,
 * owner-approved 2026-11-13; prototype `maker-toolbar-fable.html` frame 4; DECISION_LOG 2026-11-13 "MAKER › COUNTDOWN
 * EDIT = THE EVENT DATE, NOT 'OPEN INFO'": *"it should show the date of the event there. and they can finalize it if
 * not yet. so this is like the date picker"*). The Countdown and the cover's Date both carry it; it replaces their
 * doors out of the Maker ("Open Info", "Change it in Suppliers").
 *
 *   rows 1–2  "Event date" — the day (Sat, 12 December 2026) and "Final · N days to go"; or "Not final yet" and the
 *             options the couple is weighing (A few dates).
 *   row 3     ONE button: "Change date" / "Pick your final date" — the SAME sheet as Suppliers' date edit (#7583,
 *             `FactSheet which="date"`), so there is ONE writer (`updateEventDate`): suppliers and Home follow.
 *   row 4     "Suppliers and Home use this date too."
 *
 * The date is read when the part is picked (the sheet's own read — `openFactSheet`, or the lab's stand-in), never in
 * the Maker's first load. A read that fails says so in row 1 — never a blank that looks like "no date".
 */
type Read = { kind: 'loading' } | { kind: 'failed'; error: string } | { kind: 'ready'; data: DateSheetData };

export function DateEdit({ eventId }: { eventId: string }) {
  const lab = useContext(FactSheetStandInCtx);
  const [read, setRead] = useState<Read>({ kind: 'loading' });
  const [sheet, setSheet] = useState(false);
  const load = useCallback(() => {
    const ask: Promise<FactSheetData> = lab ? lab.open('date', null) : openFactSheet(eventId, { which: 'date' });
    ask
      .then((r) => setRead(r.ok && r.which === 'date' ? { kind: 'ready', data: r.date } : { kind: 'failed', error: r.ok ? 'This could not be read just now.' : r.error }))
      .catch(() => setRead({ kind: 'failed', error: 'The date could not be read just now.' }));
  }, [eventId, lab]);
  useEffect(() => load(), [load]);
  const lines = read.kind === 'ready' ? dateEditLines(read.data, todayInManila()) : null;
  return (
    <div className={SP_ROWS} data-stage-edit="" data-stage-date-edit="">
      <div className="row-span-2 row-start-1 flex min-w-0 flex-col justify-center gap-1 px-1" data-stage-date-value="">
        <span className="text-[11px] font-semibold uppercase tracking-[.1em] text-[var(--sp-ink2)]">Event date</span>
        {read.kind === 'loading' ? (
          <span className="text-[13px] text-[var(--sp-ink2)]">Reading your date…</span>
        ) : read.kind === 'failed' ? (
          <span role="alert" className="text-[13px] text-[var(--sp-ink)]">
            {read.error}
          </span>
        ) : lines ? (
          <>
            <b className="truncate text-[16px] font-semibold text-[var(--sp-ink)]">{lines.value}</b>
            {lines.chips.length > 0 ? (
              <span className="flex min-w-0 flex-wrap gap-1.5" data-stage-date-options="">
                {lines.chips.map((c) => (
                  <span key={c} className="rounded-full border border-[var(--sp-line)] px-2.5 py-0.5 text-[12.5px] text-[var(--sp-ink)]">
                    {c}
                  </span>
                ))}
              </span>
            ) : null}
            {lines.sub ? <span className="text-[12.5px] text-[var(--sp-ink2)]">{lines.sub}</span> : null}
          </>
        ) : null}
      </div>
      <div className={`${SP_ROWS_ROW} row-start-3`}>
        <ActionButton
          tone="brand"
          main={!lines?.final}
          icon={CalendarDays}
          label={read.kind === 'failed' ? 'Try again' : lines?.final ? 'Change date' : 'Pick your final date'}
          onClick={() => (read.kind === 'failed' ? (setRead({ kind: 'loading' }), load()) : setSheet(true))}
          className="!h-11"
          data-stage-date-button=""
        />
      </div>
      <p className="row-start-4 m-0 flex min-w-0 items-center px-1 text-[12.5px] text-[var(--sp-ink2)]">{DATE_EDIT_SHARED}</p>
      {sheet ? (
        <FactSheet
          eventId={eventId}
          which="date"
          helpFirst={false}
          priced={[]}
          onWrote={() => {
            load();
            requestMakerRefresh();
          }}
          onClose={() => setSheet(false)}
        />
      ) : null}
    </div>
  );
}
