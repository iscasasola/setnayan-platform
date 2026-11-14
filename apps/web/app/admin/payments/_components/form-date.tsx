'use client';

/**
 * FormDate — the app's ONE date row (`DateRow`, T21) carrying one posted field, for a server form that posts on
 * submit rather than saving in place: the picked day rides a hidden input. Same shape as `FormPick` (the house
 * dropdown carrying one field) and `ValidUntilPicker` (a DateRow feeding a hidden input).
 */
import { useState } from 'react';
import { DateRow } from '@/app/_components/form-row-date';
import type { CalendarDay } from '@/lib/calendar-grid';

export function FormDate({
  name,
  label,
  today,
  max,
  data,
}: {
  name: string;
  label: string;
  /** Today in Manila, from the server. */
  today: CalendarDay;
  /** The last day that can be picked. */
  max?: CalendarDay;
  data: string;
}) {
  const [day, setDay] = useState<CalendarDay | null>(null);
  return (
    <>
      <DateRow name={label} value={day} today={today} max={max ?? null} empty="Pick a day" onKeep={(d) => setDay(d)} data={data} />
      <input type="hidden" name={name} value={day ?? ''} />
    </>
  );
}
