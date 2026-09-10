'use client';

import { useState, type ReactNode } from 'react';
import { respondAppointment } from './appointments-actions';
import { TIME_SLOTS, todayIsoLocal, dayBeforeEventIso } from '@/lib/appointment-slots';

/**
 * propose-new-time-form.tsx — ONE form for "that time doesn't work, how about…".
 *
 * Lifted verbatim out of `chat-appointment-card.tsx` (2026-09-10) when the
 * conversation's Decisions view needed the same answer. Two doors to one
 * request must be ONE form, not two that agree today: the date bounds, the
 * time slots and — above all — the wall-clock rule below live here once.
 *
 * 🔑 `scheduled_at` IS THE BARE WALL CLOCK THE PERSON PICKED. The offset is
 * deliberately NOT appended; `respondAppointment` reads it at the venue on the
 * receiving side, so the time-zone rule lives in one place instead of being
 * re-typed by every form that proposes a time.
 *
 * The caller supplies the hidden identity fields (which appointment, which
 * event, where to land) and its own submit control, because the chat card and
 * Decisions draw buttons at different sizes; everything the ACTION reads for a
 * new time is owned here.
 */
export function ProposeNewTimeForm({
  hidden,
  eventDate,
  fieldClassName,
  submit,
}: {
  /** The appointment's identity fields, exactly as the caller's other forms post them. */
  hidden: ReactNode;
  /** yyyy-mm-dd or null — a new time must fall before the event. */
  eventDate: string | null;
  /** Input sizing — the chat card is 36px, Decisions is the phone's 44px. */
  fieldClassName: string;
  submit: ReactNode;
}) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const when = date && time ? `${date}T${time}:00` : '';

  return (
    <form action={respondAppointment} className="mt-1 flex w-full flex-col gap-2">
      {hidden}
      <input type="hidden" name="decision" value="propose_new" />
      <input type="hidden" name="scheduled_at" value={when} />
      <div className="flex flex-wrap gap-2">
        <label className="flex flex-1 flex-col gap-1 text-[11px] font-medium text-ink/60">
          New date
          <input
            type="date"
            required
            min={todayIsoLocal()}
            max={dayBeforeEventIso(eventDate) ?? undefined}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={fieldClassName}
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-[11px] font-medium text-ink/60">
          Time
          <select
            required
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className={fieldClassName}
          >
            <option value="" disabled>
              Pick a time
            </option>
            {TIME_SLOTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {submit}
    </form>
  );
}
