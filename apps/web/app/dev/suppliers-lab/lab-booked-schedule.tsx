'use client';

/**
 * Booked › Schedule in the Suppliers lab — the REAL frame (`BookedScheduleFrame`: one line, the date line, the views)
 * over the REAL Event Day rail (`ScheduleDay`) on the Schedule lab's own day, re-tagged with this lab's booked
 * suppliers (`LAB_SCHEDULE_TAGS`), so the Team rows' call times and this rail read the same moments; Preparation and
 * Journey are the REAL views on `schedule-fixtures.ts`, drawn by the server page and handed in. Drawn after mount: the
 * rail reads the clock (the Schedule lab's own reason).
 *
 *   &view=preparation|journey   open on that view (Event Day by default, as the page does under Booked)
 *   &announce=0                 a viewer who cannot announce (no 🔊)
 */
import { useEffect, useState, type ReactNode } from 'react';
import ScheduleLabClient from '../schedule-lab/schedule-lab-client';
import { scheduleSuppliersFrom } from '@/lib/schedule-suppliers';
import { BookedScheduleFrame, type BookedScheduleView } from '@/app/dashboard/[eventId]/schedule/_components/booked-schedule-frame';
import { BOOKED_SCHEDULE_TOOLS_SLOT } from '@/app/dashboard/[eventId]/schedule/_components/booked-schedule-slot';
import { AnnounceButton } from '@/app/dashboard/[eventId]/schedule/_components/announce-button';

const SUPPLIERS = scheduleSuppliersFrom(
  [
    { vendor_id: 'v-seda', vendor_name: 'Seda Vertis North', status: 'contracted', marketplace_vendor_id: null, manual_vendor_id: 'c-seda' },
    { vendor_id: 'v-santuario', vendor_name: 'Santuario de San Vicente de Paul', status: 'contracted', marketplace_vendor_id: 'p-santuario', manual_vendor_id: null },
    { vendor_id: 'v-lumina', vendor_name: 'Lumina Studio', status: 'deposit_paid', marketplace_vendor_id: 'p-lumina', manual_vendor_id: null },
    { vendor_id: 'v-asukal', vendor_name: 'Asukal Cakes', status: 'contracted', marketplace_vendor_id: null, manual_vendor_id: 'c-asukal' },
    { vendor_id: 'v-bituin', vendor_name: 'Bituin Catering', status: 'contracted', marketplace_vendor_id: 'p-bituin', manual_vendor_id: null },
  ],
  new Map([
    ['p-santuario', 'Santuario de San Vicente de Paul'],
    ['p-lumina', 'Lumina Studio'],
    ['p-bituin', 'Bituin Catering'],
  ]),
);

export function LabBookedSchedule({
  tags,
  moments,
  initial = 'event-day',
  prepCount,
  journeyCount,
  prepNote,
  canAnnounce = true,
  preparation,
  journey,
}: {
  tags: Readonly<Record<string, readonly string[]>>;
  moments: number;
  initial?: BookedScheduleView;
  prepCount: number;
  journeyCount: number;
  prepNote: string;
  canAnnounce?: boolean;
  preparation: ReactNode;
  journey: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <BookedScheduleFrame
      initial={initial}
      views={[
        { key: 'event-day', label: 'Event Day', count: moments },
        { key: 'preparation', label: 'Preparation', count: prepCount },
        { key: 'journey', label: 'Journey', count: journeyCount },
      ]}
      dateLine="Friday 18 December 2026 · 48 days to go"
      info={
        <>
          <b className="block font-semibold">Ana &amp; Paolo</b>
          <span className="block">
            <b className="font-semibold">You can edit.</b> Hosts build the schedule. A coordinator edits only after a host
            approves them — the host invite plus your consent under the Data Privacy Act (RA 10173). Everyone else reads.
          </span>
        </>
      }
      notes={{
        'event-day':
          'Moments shown to guests appear on the Event Hub, with a live “happening now” on the day. Hidden moments stay between you, your coordinator and the suppliers you tag.',
        preparation: prepNote,
      }}
      announce={canAnnounce ? <AnnounceButton eventId="lab" isEventDay={false} recent={[]} round /> : null}
      panels={{
        'event-day': mounted ? (
          <ScheduleLabClient bare suppliers={SUPPLIERS} tags={tags} frame="booked" toolsSlot={BOOKED_SCHEDULE_TOOLS_SLOT} />
        ) : null,
        preparation,
        journey,
      }}
    />
  );
}
