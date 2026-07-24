// Vendor meetings on the couple's Schedule (negotiation Phase 1 → schedule
// integration). Owner 2026-07-24: an approved meeting should show on the
// schedule, and a schedule change should move it. This is a READ-ONLY surface of
// event_appointments — no data duplication, so a confirm / propose-new-time /
// decline in chat reflects here on the next load automatically. Server
// component; each row deep-links back to the chat thread to manage it.

import Link from 'next/link';
import { CalendarClock } from 'lucide-react';
import { APPOINTMENT_KIND_LABEL, type AppointmentKind } from '@/lib/appointments';

export type ScheduleMeeting = {
  appointment_id: string;
  kind: AppointmentKind;
  label: string;
  scheduled_at: string | null;
  status: 'proposed' | 'confirmed';
  vendorName: string;
  threadId: string | null;
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

const STATUS: Record<ScheduleMeeting['status'], { label: string; cls: string }> = {
  confirmed: { label: 'Confirmed', cls: 'bg-success-100 text-success-900' },
  proposed: { label: 'Awaiting', cls: 'bg-warn-100 text-warn-900' },
};

export function VendorMeetingsSection({
  eventId,
  meetings,
}: {
  eventId: string;
  meetings: ScheduleMeeting[];
}) {
  if (meetings.length === 0) return null;

  return (
    <section className="mb-6 rounded-2xl border border-ink/10 bg-surface p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-mulberry" strokeWidth={1.75} aria-hidden />
        <h2 className="text-base font-semibold text-ink">Meetings with vendors</h2>
      </div>
      <ul className="space-y-2">
        {meetings.map((m) => {
          const s = STATUS[m.status];
          const row = (
            <div className="flex items-center gap-3 rounded-xl border border-ink/10 border-l-[3px] border-l-mulberry bg-cream px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{m.label}</p>
                <p className="truncate text-[13px] text-ink/65">
                  {m.vendorName} · {APPOINTMENT_KIND_LABEL[m.kind]} · {formatWhen(m.scheduled_at)}
                </p>
              </div>
              <span
                className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${s.cls}`}
              >
                {s.label}
              </span>
            </div>
          );
          return (
            <li key={m.appointment_id}>
              {m.threadId ? (
                <Link
                  href={`/dashboard/${eventId}/messages/${m.threadId}`}
                  className="block hover:opacity-90"
                >
                  {row}
                </Link>
              ) : (
                row
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[11px] text-ink/45">
        Confirmed in your chat with each vendor — changes there update this list.
      </p>
    </section>
  );
}
