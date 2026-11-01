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
import { LAB_CHAPTERS, LAB_CHAPTER_MOMENTS, LAB_CLASH_TASK, LAB_EVENT_DAY, LAB_MARCHES, LAB_MOMENT_ROW, LAB_SCHEDULE_CHAPTERS, LAB_TASKS, LAB_VENUES, LAB_WHO } from './lab-chapters';

export function LabScheduleChapters({
  empty,
  fail,
  viewOnly,
  clash = false,
  tasksFail = false,
  marchFail = false,
  openMoment = false,
}: {
  empty: boolean;
  fail: boolean;
  viewOnly: boolean;
  clash?: boolean;
  tasksFail?: boolean;
  /** `?marchfail=1`: the marches read failed (said on the row, never "no marches"). */
  marchFail?: boolean;
  /** `?moment=1`: open on the run-of-show moment's sheet (a phone shown it by a link). */
  openMoment?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const input: ChaptersInput = fail
    ? { measured: false }
    : {
        measured: true,
        chapters: empty ? [] : LAB_SCHEDULE_CHAPTERS,
        moments: empty ? [] : [...LAB_CHAPTER_MOMENTS, LAB_MOMENT_ROW],
        // 📖 Step 3b: the run-of-show moment holds three tasks at once in two places; `?clash=1` puts Coord A in the
        // lobby too, at the same time; `?tasksfail=1` is the tasks read failing (said, never "no tasks").
        tasks: tasksFail ? null : empty ? [] : clash ? [...LAB_TASKS, LAB_CLASH_TASK] : LAB_TASKS,
        who: LAB_WHO,
        marches: marchFail ? { ok: false } : { ok: true, marches: LAB_MARCHES },
        wholeMarch: 'Wedding March',
        venues: LAB_VENUES,
        eventDay: LAB_EVENT_DAY,
        lastDay: LAB_EVENT_DAY,
        canEdit: !viewOnly,
        mayInvite: !viewOnly,
      };
  if (!mounted) return null;
  return (
    <ChaptersHost eventId="00000000-0000-4000-8000-00000000e001" input={input} dateLine="Friday 18 December 2026 · 47 days to go"
      lab
      labOpen={openMoment ? { chapter: LAB_CHAPTERS[0]!.block_id, moment: LAB_MOMENT_ROW.block_id } : null}
    >
      <BookedScheduleFrame
        initial="event-day"
        views={[
          { key: 'event-day', label: 'Event Day', count: empty ? 0 : 7 },
          { key: 'preparation', label: 'Planning Stage', count: empty ? 0 : 1 },
        ]}
        dateLine="Friday 18 December 2026 · 47 days to go"
        info={<span className="block">A sample wedding — fake chapters, nothing is saved.</span>}
        notes={{}}
        announce={null}
        panels={{
          'event-day': <ScheduleLabClient bare frame="booked" toolsSlot={BOOKED_SCHEDULE_TOOLS_SLOT} />,
          preparation: <PlanningChapters />,
        }}
      />
    </ChaptersHost>
  );
}
