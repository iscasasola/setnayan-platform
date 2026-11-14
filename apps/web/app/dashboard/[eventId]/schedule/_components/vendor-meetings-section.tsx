// Vendor meetings on the couple's Schedule (negotiation Phase 1 → schedule
// integration). Owner 2026-07-24: an approved meeting should show on the
// schedule, and a schedule change should move it. This is a READ-ONLY surface of
// event_appointments — no data duplication, so a confirm / propose-new-time /
// decline in chat reflects here on the next load automatically. Server
// component; each row deep-links back to the chat thread to manage it.

import Link from 'next/link';
import { CalendarClock } from 'lucide-react';
import { APPOINTMENT_KIND_LABEL, type AppointmentKind } from '@/lib/appointments';
import { Badge, type BadgeTone } from '@/app/_components/badge';

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

const STATUS: Record<ScheduleMeeting['status'], { label: string; tone: BadgeTone }> = {
  confirmed: { label: 'Confirmed', tone: 'ok' },
  proposed: { label: 'Awaiting', tone: 'wait' },
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
    // 📐 DESIGN TEMPLATE (14 Nov 2026, rules 2 · 5): no card — the section's grey capitals, plain hairline rows (a
    // row with a chat opens it, terracotta ›), the state a soft chip.
    <section className="mb-6">
      <div className="mb-1 mt-[18px] flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-ink/70" strokeWidth={1.75} aria-hidden />
        <h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70">Meetings with suppliers</h2>
      </div>
      <ul className="divide-y divide-ink/10">
        {meetings.map((m) => {
          const s = STATUS[m.status];
          const row = (
            <div className="flex min-h-14 items-center gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-ink">{m.label}</p>
                <p className="truncate text-[13px] text-ink/65">
                  {m.vendorName} · {APPOINTMENT_KIND_LABEL[m.kind]} · {formatWhen(m.scheduled_at)}
                </p>
              </div>
              <span className="ml-auto shrink-0">
                <Badge tone={s.tone}>{s.label}</Badge>
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
      <p className="mt-3 text-xs text-ink/70">
        Confirmed in your chat with each supplier — changes there update this list.
      </p>
    </section>
  );
}
