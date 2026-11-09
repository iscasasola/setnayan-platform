'use client';

import { useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { DateRow } from '@/app/_components/form-row-date';
import { FORM_PILL_CLASS, FormRow, FormRows } from '@/app/_components/form-row';
import { LazyDateSheet } from '@/app/_components/date-sheet-lazy';
import { CALENDAR_BLOCKED_WORD, type CalendarDay, type CalendarDayState } from '@/lib/calendar-grid';
import {
  addDays,
  busyWords,
  meetingChoices,
  missingScheduleWords,
  paymentAskChoices,
  shortDay,
  timeWords,
  validUntilChoices,
  type DateSheetBusy,
  type DateSheetSlots,
} from '@/lib/date-sheet';
import { TIME_SLOTS } from '@/lib/appointment-slots';

/* The prototype's own fixtures (v3.1): today Nov 9, the event Nov 28, the supplier "Lumina". */
const TODAY = '2026-11-09';
const EVENT = '2026-11-28';

/** The supplier's month, as its Dates calendar holds it (kind 31). */
const STATES = new Map<CalendarDay, CalendarDayState>([
  ['2026-11-14', { dots: ['booked'] }],
  ['2026-11-15', { dots: ['asking'] }],
  ['2026-11-20', { blocked: true }],
  ['2026-11-21', { dots: ['booked', 'booked'] }],
  ['2026-11-28', { dots: ['booked'] }],
  ['2026-12-05', { dots: ['asking'] }],
  ['2026-12-12', { blocked: true }],
  ['2027-01-09', { dots: ['booked'] }],
]);

/** Both sides' busy days for the meeting: the supplier's blocks / bookings, the hosts' own schedule. */
const BUSY_DAYS: Readonly<Record<CalendarDay, DateSheetBusy>> = {
  '2026-11-10': { who: 'Lumina' },
  '2026-11-14': { who: 'Lumina' },
  '2026-11-15': { who: 'Maria' },
  '2026-11-19': { who: 'You', what: 'the venue ocular' },
  '2026-11-20': { who: 'Lumina' },
  '2026-11-21': { who: 'Lumina' },
};
const BUSY_TIMES: Readonly<Record<string, DateSheetBusy>> = {
  '10:00': { who: 'Lumina' },
  '10:30': { who: 'Lumina' },
  '14:00': { who: 'Maria' },
  '15:00': { who: 'You', what: 'the florist meeting' },
  '17:30': { who: 'Lumina' },
};
const SLOTS: DateSheetSlots = {
  times: TIME_SLOTS.map((t) => t.value).filter((t) => t >= '09:00' && t <= '18:00'),
  busy: (_day, t) => BUSY_TIMES[t] ?? null,
  free: ['Lumina', 'Maria', 'You'],
};

const ok = () => ({ ok: true as const });

export function DateSheetLabClient() {
  const [due, setDue] = useState<CalendarDay | null>(null);
  const [valid, setValid] = useState<CalendarDay | null>(null);
  const [avail, setAvail] = useState<CalendarDay | null>(null);
  return (
    <div data-date-sheet-lab="">
      <p className="text-[11px] font-bold uppercase tracking-[.12em] text-ink/55">Lab · Build 3 · Lane D part 1</p>
      <h1 className="mt-1 text-[22px] font-bold text-ink">The one date sheet</h1>
      <p className="mt-1 text-[14px] text-ink/70">Today is Nov 9, 2026; the sample event is Nov 28. Tap any field.</p>
      <FormRows className="mt-4" data="lab">
        <DateRow
          name="By when"
          data="due"
          value={due}
          today={TODAY}
          min={TODAY}
          onKeep={(d) => (setDue(d), ok())}
          sheet={{ choices: paymentAskChoices(TODAY), about: 'Days before today are grey: a payment cannot fall due in the past.' }}
        />
        <DateRow
          name="Valid until"
          data="valid"
          value={valid}
          today={TODAY}
          min={addDays(TODAY, 1)}
          max={EVENT}
          onKeep={(d) => (setValid(d), ok())}
          note={valid ? `The quotation reads Valid until ${shortDay(valid)}` : undefined}
          sheet={{ choices: validUntilChoices(TODAY, EVENT), about: `Days after the event (${shortDay(EVENT)}) are grey: a quotation cannot outlive the event.` }}
        />
        <MeetingRow />
        <DateRow
          name="Check a date"
          data="avail"
          value={avail}
          today={TODAY}
          onKeep={(d) => (setAvail(d), ok())}
          sheet={{
            states: STATES,
            refuse: (d) => (STATES.get(d)?.blocked ? `Lumina is ${CALENDAR_BLOCKED_WORD.toLowerCase()}` : null),
            about: 'A green dot is booked, amber is holding. A hatched day is not available and cannot be chosen.',
          }}
        />
      </FormRows>
    </div>
  );
}

/** The meeting: a day both sides are free on, then a time free for everyone. */
function MeetingRow() {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<{ day: CalendarDay; time: string | null } | null>(null);
  const pill = useRef<HTMLButtonElement>(null);
  const last = addDays(EVENT, -1);
  const words = pick ? `${shortDay(pick.day)} · ${timeWords(pick.time)}` : '';
  return (
    <FormRow name="Meeting" data="meet" note={pick ? `Meeting with Lumina ${shortDay(pick.day)} · ${timeWords(pick.time)} — free for everyone` : undefined}>
      <button
        ref={pill}
        type="button"
        data-form-row-pill="date"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Meeting: ${words || 'not set yet'}. Tap to change`}
        onClick={() => setOpen(true)}
        className={`${FORM_PILL_CLASS} w-[200px] border-ink/15 aria-expanded:border-sn-accent`}
      >
        <span className={`min-w-0 flex-1 truncate ${words ? '' : 'font-normal text-ink/45'}`}>{words || 'Pick day and time'}</span>
        <Clock aria-hidden className="h-4 w-4 flex-none text-sn-accent" strokeWidth={2} />
      </button>
      {open ? (
        <LazyDateSheet
          data="meet"
          title="Meeting"
          about={`From today to the day before the event (${shortDay(last)}). ${missingScheduleWords(['Tita Lu'])}.`}
          value={pick?.day ?? null}
          time={pick?.time ?? null}
          today={TODAY}
          min={TODAY}
          max={last}
          choices={meetingChoices(TODAY, last)}
          refuse={(d) => (BUSY_DAYS[d] ? busyWords(BUSY_DAYS[d]) : null)}
          slots={SLOTS}
          onSet={(p) => {
            setPick(p);
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        />
      ) : null}
    </FormRow>
  );
}
