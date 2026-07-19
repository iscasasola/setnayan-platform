import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildAppointmentIcs } from '@/lib/calendar-links';
import {
  APPOINTMENT_KIND_LABEL,
  humanizeAppointmentType,
  type AppointmentKind,
} from '@/lib/appointments';

/**
 * Per-appointment .ics download — Relationship Workspace + Appointments · PR 12
 * ("On confirm: .ics"). Returns a single timed VEVENT for a CONFIRMED
 * appointment (title from the type / custom label, DTSTART = scheduled_at,
 * DTEND from duration_min, LOCATION for in-person, DESCRIPTION with a note).
 *
 * RLS IS THE GATE — the row is read under the caller's own session, so the
 * event_appointments SELECT policies return it only to the two parties (the
 * event's couple/host/coordinator via current_event_ids, OR the booked vendor
 * org via current_vendor_profile_ids). Anyone else gets an empty set → 404.
 * No admin client, no second data path.
 */

type Params = { params: Promise<{ appointmentId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { appointmentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  // RLS-scoped read — a non-party gets null here, not a leak.
  const { data } = await supabase
    .from('event_appointments')
    .select('appointment_id, kind, type, custom_label, location, scheduled_at, duration_min, status, note')
    .eq('appointment_id', appointmentId)
    .maybeSingle();

  const appt = data as
    | {
        appointment_id: string;
        kind: AppointmentKind;
        type: string;
        custom_label: string | null;
        location: string | null;
        scheduled_at: string | null;
        duration_min: number | null;
        status: string;
        note: string | null;
      }
    | null;

  // Only a confirmed appointment with a real time is calendarable.
  if (!appt || appt.status !== 'confirmed' || !appt.scheduled_at) {
    return new NextResponse('Not found', { status: 404 });
  }

  // Resolve a human title: the free-text name for a custom meeting, else the
  // catalog label for the preset type, else a humanized type key. The catalog
  // is a cheap reference lookup (readable to every authenticated user).
  let title: string;
  if (appt.type === 'custom') {
    title = appt.custom_label?.trim() || 'Appointment';
  } else {
    const { data: catRow } = await supabase
      .from('appointment_type_catalog')
      .select('label')
      .eq('type', appt.type)
      .eq('is_active', true)
      .maybeSingle();
    title = (catRow as { label?: string } | null)?.label ?? humanizeAppointmentType(appt.type);
  }

  const kindLabel = APPOINTMENT_KIND_LABEL[appt.kind] ?? 'Meeting';
  const descriptionParts = [`${kindLabel} appointment (Setnayan).`];
  if (appt.note) descriptionParts.push(appt.note);

  const ics = buildAppointmentIcs({
    uid: `appointment-${appt.appointment_id}@setnayan.com`,
    title: `Setnayan · ${title}`,
    startIso: appt.scheduled_at,
    durationMin: appt.duration_min,
    location: appt.kind === 'in_person' ? appt.location : null,
    description: descriptionParts.join(' — '),
  });

  if (!ics) return new NextResponse('Not found', { status: 404 });

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="setnayan-appointment.ics"',
      'Cache-Control': 'private, no-store',
    },
  });
}
