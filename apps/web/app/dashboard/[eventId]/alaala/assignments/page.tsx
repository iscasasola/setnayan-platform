import Link from 'next/link';

import { createAdminClient } from '@/lib/supabase/admin';
import { KWENTO_MOMENTS, type KwentoMomentKey } from '@/lib/kwento-moments';
import { GuestPicker, AssignmentRow } from './_components/assignment-controls';

export const metadata = { title: 'Story Assignments' };
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ eventId: string }> };

export default async function KwentoAssignmentsPage({ params }: Props) {
  const { eventId } = await params;
  const admin = createAdminClient();

  const [{ data: assignments }, { data: guests }] = await Promise.all([
    admin
      .from('kwento_assignments')
      .select('assignment_id, moment_key, assigned_guest_id, nudge_count')
      .eq('event_id', eventId),
    admin
      .from('guests')
      .select('guest_id, first_name, display_name')
      .eq('event_id', eventId)
      .eq('rsvp_status', 'confirmed')
      .order('first_name', { ascending: true }),
  ]);

  // Build a lookup: moment_key → assignment rows
  type AssignmentRow = {
    assignment_id: string;
    moment_key: string;
    assigned_guest_id: string;
    nudge_count: number;
  };

  const byMoment = new Map<string, AssignmentRow[]>();
  for (const a of (assignments ?? []) as AssignmentRow[]) {
    const existing = byMoment.get(a.moment_key) ?? [];
    existing.push(a);
    byMoment.set(a.moment_key, existing);
  }

  // Build guest name lookup
  type GuestRow = { guest_id: string; first_name: string | null; display_name: string | null };
  const guestMap = new Map<string, string>();
  for (const g of (guests ?? []) as GuestRow[]) {
    guestMap.set(g.guest_id, g.display_name ?? g.first_name ?? 'Guest');
  }

  // For the picker: guests not already assigned to a given moment
  const allGuests = (guests ?? []) as GuestRow[];

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <Link
          href={`/dashboard/${eventId}/alaala`}
          className="inline-flex items-center gap-1 text-[12px]"
          style={{ color: 'var(--m-slate-2)' }}
        >
          ← Alaala
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--m-ink)' }}>
          Story Assignments
        </h1>
        <p className="max-w-prose text-[14px] leading-relaxed" style={{ color: 'var(--m-slate)' }}>
          Assign a guest to each locked editorial moment. They&rsquo;ll get an email asking
          them to share what they witnessed — in their own words.
        </p>
      </header>

      <ol className="space-y-3">
        {KWENTO_MOMENTS.map((moment, i) => {
          const momentAssignments = byMoment.get(moment.key) ?? [];
          const assignedGuestIds = new Set(momentAssignments.map((a) => a.assigned_guest_id));
          const availableGuests = allGuests
            .filter((g) => !assignedGuestIds.has(g.guest_id))
            .map((g) => ({
              guestId: g.guest_id,
              name: g.display_name ?? g.first_name ?? 'Guest',
            }));

          return (
            <li
              key={moment.key}
              className="rounded-2xl border p-5"
              style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper-2)' }}
            >
              <div className="flex items-baseline gap-3">
                <span
                  className="font-mono text-[11px] tabular-nums"
                  style={{ color: 'var(--m-orange-3)' }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span
                  className="font-mono text-[11px] uppercase tracking-[0.2em]"
                  style={{ color: 'var(--m-orange-2)' }}
                >
                  {moment.eyebrow}
                </span>
              </div>

              <h2
                className="mt-1.5 text-base font-semibold"
                style={{ color: 'var(--m-ink)' }}
              >
                {moment.label}
              </h2>

              {/* Current assignments */}
              {momentAssignments.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {momentAssignments.map((a) => (
                    <AssignmentRow
                      key={a.assignment_id}
                      eventId={eventId}
                      momentKey={moment.key as KwentoMomentKey}
                      assignment={{
                        assignmentId: a.assignment_id,
                        guestId: a.assigned_guest_id,
                        guestName: guestMap.get(a.assigned_guest_id) ?? 'Guest',
                        nudgeCount: a.nudge_count,
                      }}
                    />
                  ))}
                </div>
              ) : null}

              {/* Assign a new guest */}
              <div className="mt-3">
                <GuestPicker
                  eventId={eventId}
                  momentKey={moment.key as KwentoMomentKey}
                  guests={availableGuests}
                />
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
