'use client';

import { DateRow } from '@/app/_components/form-row-date';
import { FormRow } from '@/app/_components/form-row';
import type { KeepAnswer } from '@/lib/form-row';
import { addManualBlock } from '../calendar/actions';

/**
 * 🧰 STEP 6 · "Days you can't take" — one day marked IN PLACE (the shared `DateRow`: the pill, the calendar, the tick
 * or the failure line on the row itself). The keep is the shipped `addManualBlock` — the whole shop, all day, once —
 * asked to answer in place (`return_to=inplace`) instead of redirecting, so Today never leaves; the re-read rail then
 * ticks the step. In the dev lab (`lab`) nothing is written: the row says so instead of pretending.
 */
export function SetupDaysOffRow({ marked, today, lab = false }: { marked: string | null; today: string; lab?: boolean }) {
  if (lab) {
    return <FormRow name="Days you can’t take" note="The lab saves nothing — on Today this marks the day off." data="setup-days-off" />;
  }
  const keep = async (day: string): Promise<KeepAnswer> => {
    const fd = new FormData();
    fd.set('label', 'Unavailable');
    fd.set('scope', 'org');
    fd.set('start_date', day);
    fd.set('end_date', day);
    fd.set('repeat_rule', 'once');
    fd.set('day_part', 'all_day');
    fd.set('return_to', 'inplace');
    // A refusal throws — the row then says it did not save. The action revalidates Today, so the ✓ arrives with it.
    await addManualBlock(fd);
    return { ok: true };
  };
  return (
    <DateRow
      name="Days you can’t take"
      value={null}
      empty="Mark a day"
      today={today}
      min={today}
      onKeep={keep}
      note={marked ?? 'Off = couples can’t ask for that day'}
      data="setup-days-off"
    />
  );
}
