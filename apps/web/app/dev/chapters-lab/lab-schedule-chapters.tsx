'use client';

/**
 * 🧪 THE SCHEDULE PAGE'S CHAPTERS on fake data (Step 3a, owner 2026-11-01 "CHAPTERS LIVE ON THE SCHEDULE PAGE"): the REAL
 * `ChaptersHost` around the REAL Booked frame (`BookedScheduleFrame`) and the REAL Event Day rail (`ScheduleDay`, through
 * the Schedule lab's client), with the chapter sheets' lab doors — they only answer "saved"; nothing is written.
 *
 *   ?empty=1   no chapters yet        ?fail=1   the chapters read failed (said, never "none")
 *   ?view=1    a viewer who cannot edit
 * Drawn after mount: the rail reads the clock (the Schedule lab's own reason).
 */
import { useEffect, useState } from 'react';
import ScheduleLabClient from '../schedule-lab/schedule-lab-client';
import { BookedScheduleFrame } from '@/app/dashboard/[eventId]/schedule/_components/booked-schedule-frame';
import { BOOKED_SCHEDULE_TOOLS_SLOT } from '@/app/dashboard/[eventId]/schedule/_components/booked-schedule-slot';
import { ChaptersHost, PlanningChapters, type ChaptersInput } from '@/app/dashboard/[eventId]/schedule/_components/chapters-host';
import { LAB_CHAPTER_MOMENTS, LAB_EVENT_DAY, LAB_SCHEDULE_CHAPTERS, LAB_VENUES } from './lab-chapters';

export function LabScheduleChapters({ empty, fail, viewOnly }: { empty: boolean; fail: boolean; viewOnly: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const input: ChaptersInput = fail
    ? { measured: false }
    : {
        measured: true,
        chapters: empty ? [] : LAB_SCHEDULE_CHAPTERS,
        moments: empty ? [] : LAB_CHAPTER_MOMENTS,
        venues: LAB_VENUES,
        eventDay: LAB_EVENT_DAY,
        lastDay: LAB_EVENT_DAY,
        canEdit: !viewOnly,
        mayInvite: !viewOnly,
      };
  if (!mounted) return null;
  return (
    <ChaptersHost eventId="00000000-0000-4000-8000-00000000e001" input={input} dateLine="Friday 18 December 2026 · 47 days to go" lab>
      <BookedScheduleFrame
        initial="event-day"
        views={[
          { key: 'event-day', label: 'Event Day', count: empty ? 0 : 7 },
          { key: 'preparation', label: 'Planning Stage', count: empty ? 0 : 1 },
          { key: 'journey', label: 'Journey', count: 0 },
        ]}
        dateLine="Friday 18 December 2026 · 47 days to go"
        info={<span className="block">A sample wedding — fake chapters, nothing is saved.</span>}
        notes={{}}
        announce={null}
        panels={{
          'event-day': <ScheduleLabClient bare frame="booked" toolsSlot={BOOKED_SCHEDULE_TOOLS_SLOT} />,
          preparation: <PlanningChapters />,
          journey: null,
        }}
      />
    </ChaptersHost>
  );
}
