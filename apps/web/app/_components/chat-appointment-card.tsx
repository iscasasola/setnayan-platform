'use client';

// In-thread appointment card (negotiation Phase 1) — now rendered as a
// structured information card (NegotiationCardShell) rather than a bubble. The
// COUNTERPARTY gets accept / propose-new-time / decline (backed by the existing
// respondAppointment single-winner machine); the proposer sees the status.

import { useState } from 'react';
import { respondAppointment } from './appointments-actions';
import { APPOINTMENT_KIND_LABEL, type AppointmentKind } from '@/lib/appointments';
import { NegotiationCardShell, type NegRow, type NegStatusTone } from './negotiation-card-shell';

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

const STATUS: Record<ChatAppointmentData['status'], { tone: NegStatusTone; label: string }> = {
  proposed: { tone: 'awaiting', label: 'Awaiting' },
  confirmed: { tone: 'agreed', label: 'Confirmed' },
  done: { tone: 'agreed', label: 'Done' },
  cancelled: { tone: 'declined', label: 'Declined' },
};

export function ChatAppointmentCard({ data, viewerRole, eventId, vendorProfileId, returnPath }: Props) {
  const [reviseOpen, setReviseOpen] = useState(false);
  const isProposer = data.initiated_by === viewerRole;
  const canAct = data.status === 'proposed' && !isProposer;
  const st = STATUS[data.status];

  const rows: NegRow[] = [
    { label: 'When', value: formatWhen(data.scheduled_at) },
    { label: 'Format', value: APPOINTMENT_KIND_LABEL[data.kind] },
    {
      label: 'Requested by',
      value: isProposer ? 'You' : viewerRole === 'couple' ? 'The vendor' : 'The couple',
    },
  ];

  const hidden = (
    <>
      <input type="hidden" name="appointment_id" value={data.appointment_id} />
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="vendor_profile_id" value={vendorProfileId} />
      <input type="hidden" name="return_path" value={returnPath} />
      <input type="hidden" name="label" value={data.label} />
    </>
  );

  const footer = canAct ? (
    <>
      <form action={respondAppointment}>
        {hidden}
        <input type="hidden" name="decision" value="confirm" />
        <button className="inline-flex h-9 items-center rounded-lg bg-mulberry px-3.5 text-sm font-medium text-cream hover:bg-mulberry-600">
          Accept
        </button>
      </form>
      <button
        type="button"
        onClick={() => setReviseOpen((v) => !v)}
        className="inline-flex h-9 items-center rounded-lg border border-ink/20 px-3.5 text-sm font-medium text-ink/75 hover:bg-ink/[0.04]"
      >
        Propose new time
      </button>
      <form action={respondAppointment}>
        {hidden}
        <input type="hidden" name="decision" value="decline" />
        <button className="inline-flex h-9 items-center rounded-lg border border-ink/15 px-3.5 text-sm font-medium text-terracotta hover:bg-terracotta/5">
          Decline
        </button>
      </form>
      {reviseOpen ? (
        <form action={respondAppointment} className="mt-1 flex w-full flex-wrap items-end gap-2">
          {hidden}
          <input type="hidden" name="decision" value="propose_new" />
          <label className="flex flex-col gap-1 text-[11px] font-medium text-ink/60">
            New time
            <input type="datetime-local" name="scheduled_at" required className="input-field h-9 text-sm" />
          </label>
          <button className="inline-flex h-9 items-center rounded-lg bg-mulberry px-3.5 text-sm font-medium text-cream hover:bg-mulberry-600">
            Send new time
          </button>
        </form>
      ) : null}
    </>
  ) : null;

  return (
    <NegotiationCardShell
      type="schedule"
      title={data.label}
      statusTone={st.tone}
      statusLabel={st.label}
      rows={rows}
      footer={footer}
    />
  );
}
