'use client';

// In-thread appointment card (negotiation auto-reader Phase 1). Renders a
// schedule/meeting request that landed in the chat stream (a chat_messages row
// with appointment_id set) and gives the COUNTERPARTY the accept / propose-new-
// time / decline actions — all backed by the EXISTING respondAppointment server
// action + event_appointments single-winner machine. The proposer just sees the
// status. Purely presentational over that action; no new state machine.

import { useState } from 'react';
import { respondAppointment } from './appointments-actions';
import { APPOINTMENT_KIND_LABEL, type AppointmentKind } from '@/lib/appointments';

export type ChatAppointmentData = {
  appointment_id: string;
  kind: AppointmentKind;
  label: string;
  scheduled_at: string | null;
  status: 'proposed' | 'confirmed' | 'done' | 'cancelled';
  initiated_by: 'couple' | 'vendor' | null;
};

type Props = {
  data: ChatAppointmentData;
  viewerRole: 'couple' | 'vendor';
  eventId: string;
  vendorProfileId: string;
  returnPath: string;
};

function formatWhen(iso: string | null): string {
  if (!iso) return 'time to be set';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'time to be set';
  return new Intl.DateTimeFormat('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Manila',
  }).format(d);
}

const STATUS_META: Record<ChatAppointmentData['status'], { label: string; cls: string }> = {
  proposed: { label: 'Awaiting response', cls: 'bg-warn-100 text-warn-900' },
  confirmed: { label: 'Confirmed', cls: 'bg-success-100 text-success-900' },
  done: { label: 'Done', cls: 'bg-ink/10 text-ink/60' },
  cancelled: { label: 'Declined', cls: 'bg-ink/5 text-ink/50' },
};

export function ChatAppointmentCard({ data, viewerRole, eventId, vendorProfileId, returnPath }: Props) {
  const [reviseOpen, setReviseOpen] = useState(false);
  const isProposer = data.initiated_by === viewerRole;
  const canAct = data.status === 'proposed' && !isProposer;
  const meta = STATUS_META[data.status];

  const hidden = (
    <>
      <input type="hidden" name="appointment_id" value={data.appointment_id} />
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="vendor_profile_id" value={vendorProfileId} />
      <input type="hidden" name="return_path" value={returnPath} />
      <input type="hidden" name="label" value={data.label} />
    </>
  );

  return (
    <div className="w-full max-w-[92%] rounded-xl border border-terracotta/40 bg-terracotta/[0.06] p-3">
      <div className="flex items-center gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
          📅 Meeting request
        </p>
        <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.cls}`}>
          {meta.label}
        </span>
      </div>
      <p className="mt-1 text-sm font-semibold text-ink">{data.label}</p>
      <p className="text-sm text-ink/70">
        {APPOINTMENT_KIND_LABEL[data.kind]} · {formatWhen(data.scheduled_at)}
      </p>

      {canAct ? (
        <div className="mt-2.5 flex flex-wrap gap-2">
          <form action={respondAppointment}>
            {hidden}
            <input type="hidden" name="decision" value="confirm" />
            <button className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-mulberry px-3.5 text-sm font-medium text-cream hover:bg-mulberry-600">
              Accept
            </button>
          </form>
          <button
            type="button"
            onClick={() => setReviseOpen((v) => !v)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-ink/20 px-3.5 text-sm font-medium text-ink/75 hover:bg-ink/[0.04]"
          >
            Propose new time
          </button>
          <form action={respondAppointment}>
            {hidden}
            <input type="hidden" name="decision" value="decline" />
            <button className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-ink/15 px-3.5 text-sm font-medium text-terracotta hover:bg-terracotta/5">
              Decline
            </button>
          </form>
        </div>
      ) : null}

      {canAct && reviseOpen ? (
        <form action={respondAppointment} className="mt-2.5 flex flex-wrap items-end gap-2 rounded-lg border border-ink/10 bg-cream p-2.5">
          {hidden}
          <input type="hidden" name="decision" value="propose_new" />
          <label className="flex flex-col gap-1 text-[11px] font-medium text-ink/60">
            New time
            <input
              type="datetime-local"
              name="scheduled_at"
              required
              className="input-field h-9 text-sm"
            />
          </label>
          <button className="inline-flex h-9 items-center rounded-lg bg-mulberry px-3.5 text-sm font-medium text-cream hover:bg-mulberry-600">
            Send new time
          </button>
        </form>
      ) : null}

      {data.status === 'proposed' && isProposer ? (
        <p className="mt-2 text-xs text-ink/55">
          Waiting for {viewerRole === 'couple' ? 'the vendor' : 'the couple'} to respond.
        </p>
      ) : null}
    </div>
  );
}
