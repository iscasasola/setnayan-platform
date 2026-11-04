/**
 * lab-story-moments.tsx — `/dev/memories-lab?story=1`: the REAL Story Maker step (`MakeItYours`) on fixture moments,
 * so its moment rows' swipe-to-delete (owner 2026-11-03, "SWIPE LEFT TO DELETE ON EVERY LIST ROW") can be seen at
 * 390 px with no sign-in and no database. "I choose", three moments the host added, no photos. A change here reaches
 * the real save and is REFUSED (no sign-in) — the editor says so. DEV-ONLY (the page 404s in production).
 */
import { MakeItYours } from '@/app/dashboard/[eventId]/story/_components/make-it-yours';
import type { MakeItYoursInput } from '@/app/dashboard/[eventId]/story/_lib/load-make-it-yours';

const moment = (id: string, name: string) => ({ id, source: 'host' as const, name, startMs: null, mode: 'hand' as const, objects: [] });

const INPUT: MakeItYoursInput = {
  version: 1,
  initial: {
    mode: 'hand',
    handTouched: true,
    hasRunOfShow: false,
    moments: [moment('lab-1', 'Getting ready'), moment('lab-2', 'The ceremony'), moment('lab-3', 'First dance')],
    unplaced: [],
    sets: [],
    withheld: false,
  },
  runOfShow: [],
  pool: [],
  media: {},
  momentTimes: {},
  unreadable: [],
  poolTruncated: false,
  poolCap: 500,
};

export function LabStoryMoments() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl bg-cream px-4 pb-24 pt-4" data-lab="story-moments">
      <MakeItYours eventId="lab" input={INPUT} />
    </main>
  );
}
