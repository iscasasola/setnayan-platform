'use client';

// One-tap "set up this meeting" suggestion (negotiation Phase 1). Renders under
// the sender's own message when the reader flags a schedule topic. The form
// offers a bounded DATE (today → day before the event) + a TIME SLOT option, and
// calls createScheduleRequestFromChat (which re-validates the window server-side).

import { useState } from 'react';
import { detectNegotiation } from '@/lib/chat-negotiation-detect';
import { createScheduleRequestFromChat } from './negotiation-actions';
import { APPOINTMENT_KINDS, APPOINTMENT_KIND_LABEL, type AppointmentKind } from '@/lib/appointments';
import {
  TIME_SLOTS,
  todayIsoLocal,
  dayBeforeEventIso,
  isoDate,
} from '@/lib/appointment-slots';

/** Best-effort prefill from the detected excerpt, clamped to the window + the
 *  nearest available slot. Unparseable → empty (the user picks). */
function prefill(excerpt: string | undefined, minDate: string, maxDate: string | null) {
  if (!excerpt) return { date: '', time: '' };
  const d = new Date(excerpt);
  if (Number.isNaN(d.getTime())) return { date: '', time: '' };
  let date = isoDate(d);
  if (date < minDate) date = minDate;
  if (maxDate && date > maxDate) date = maxDate;
  let h = d.getHours();
  let m = d.getMinutes() < 30 ? 0 : 30;
  if (h < 8) {
    h = 8;
    m = 0;
  }
  if (h > 20 || (h === 20 && m === 30)) {
    h = 20;
    m = 0;
  }
  const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return { date, time: TIME_SLOTS.some((s) => s.value === time) ? time : '' };
}

export function ScheduleSuggestChip({
  threadId,
  returnPath,
  body,
  eventDate,
}: {
  threadId: string;
  returnPath: string;
  body: string;
  eventDate: string | null;
}) {
  const signal = detectNegotiation(body).signals.find((s) => s.type === 'schedule');
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<AppointmentKind>('video');

  if (!signal) return null;

  const minDate = todayIsoLocal();
  const maxDate = dayBeforeEventIso(eventDate);
  const pre = prefill(signal.excerpt, minDate, maxDate);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-mulberry/30 bg-mulberry/[0.06] px-3 py-1 text-xs font-medium text-mulberry hover:bg-mulberry/10"
      >
        📅 Set up this meeting
      </button>
    );
  }

  return (
    <form
      action={createScheduleRequestFromChat}
      className="mt-1.5 flex flex-col gap-2 rounded-xl border border-mulberry/20 bg-mulberry/[0.04] p-2.5"
    >
      <input type="hidden" name="thread_id" value={threadId} />
      <input type="hidden" name="return_to" value={returnPath} />
      <input type="hidden" name="kind" value={kind} />

      <div className="flex flex-wrap gap-1.5">
        {APPOINTMENT_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              kind === k
                ? 'bg-mulberry text-cream'
                : 'border border-ink/15 text-ink/70 hover:bg-ink/[0.04]'
            }`}
          >
            {APPOINTMENT_KIND_LABEL[k]}
          </button>
        ))}
      </div>

      <input
        type="text"
        name="title"
        maxLength={120}
        placeholder="Title (e.g. Ocular, Pre-shoot call)"
        className="input-field h-9 text-sm"
      />

      <div className="flex flex-wrap gap-2">
        <label className="flex flex-1 flex-col gap-1 text-[11px] font-medium text-ink/60">
          Date
          <input
            type="date"
            name="date"
            required
            min={minDate}
            max={maxDate ?? undefined}
            defaultValue={pre.date}
            className="input-field h-9 text-sm"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-[11px] font-medium text-ink/60">
          Time
          <select name="time" required defaultValue={pre.time} className="input-field h-9 text-sm">
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
      {maxDate ? (
        <p className="text-[11px] text-ink/45">Any day up to {maxDate} (before the event).</p>
      ) : null}

      <div className="flex gap-2">
        <button className="inline-flex h-9 items-center rounded-lg bg-mulberry px-3.5 text-sm font-medium text-cream hover:bg-mulberry-600">
          Send request
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="inline-flex h-9 items-center rounded-lg border border-ink/15 px-3.5 text-sm text-ink/60 hover:bg-ink/[0.04]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
