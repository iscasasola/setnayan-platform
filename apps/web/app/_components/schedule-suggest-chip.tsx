'use client';

// One-tap "set up this meeting" suggestion (negotiation auto-reader Phase 1).
// Renders under the SENDER's own message when the deterministic reader flags a
// schedule topic (lib/chat-negotiation-detect.ts). Tapping opens a tiny form —
// kind + a datetime prefilled from the detected date/time — that calls
// createScheduleRequestFromChat, which posts the in-thread appointment card the
// other side then accepts / revises / declines. Suggestion-grade: a false read
// is just an ignorable chip, never anything created automatically.

import { useState } from 'react';
import { detectNegotiation } from '@/lib/chat-negotiation-detect';
import { createScheduleRequestFromChat } from './negotiation-actions';
import { APPOINTMENT_KINDS, APPOINTMENT_KIND_LABEL, type AppointmentKind } from '@/lib/appointments';

/** Best-effort: turn a detected "2026-09-17 14:30" / "Feb 14" excerpt into a
 *  datetime-local default. Unparseable ("Friday") → empty, user picks. */
function toLocalInput(excerpt?: string): string {
  if (!excerpt) return '';
  const d = new Date(excerpt);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ScheduleSuggestChip({
  threadId,
  returnPath,
  body,
}: {
  threadId: string;
  returnPath: string;
  body: string;
}) {
  const signal = detectNegotiation(body).signals.find((s) => s.type === 'schedule');
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<AppointmentKind>('video');

  if (!signal) return null;

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
      <input
        type="datetime-local"
        name="scheduled_at"
        required
        defaultValue={toLocalInput(signal.excerpt)}
        className="input-field h-9 text-sm"
      />

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
