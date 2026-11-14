/**
 * /dev/swipe-rows-lab/on-the-day — the REAL day-of rows on fixtures, for the swipe-to-delete screenshots (owner
 * 2026-11-03): the shot list (`on-the-day/_components/shot-list.tsx`, its default list — the saved read refuses with no
 * session), the issues log (device-local; the shoot seeds it), and the song desk's sets (`song-desk/sets-panel.tsx`).
 * Dev only — 404s in production (first statement); nothing here can write.
 */
import { notFound } from 'next/navigation';
import { ShotList } from '@/app/vendor-dashboard/on-the-day/_components/shot-list';
import { IssuesLog } from '@/app/vendor-dashboard/on-the-day/_components/issues-log';
import { ConsolePlate } from '@/app/vendor-dashboard/on-the-day/_components/pahina-console';
import { SetsPanel } from '@/app/vendor-dashboard/on-the-day/live/[eventId]/_components/song-desk/sets-panel';
import type { VendorSet } from '@/lib/vendor-sets';

const SETS: VendorSet[] = [
  {
    setId: 'lab-s1',
    position: 1,
    name: 'Slow burn',
    slot: 'dinner',
    slotLabel: 'Dinner',
    songs: [
      { setSongId: 'lab-ss1', songId: 1, title: 'Forevermore', artist: 'Side A', position: 1 },
      { setSongId: 'lab-ss2', songId: 2, title: 'Ikaw', artist: 'Yeng Constantino', position: 2 },
      { setSongId: 'lab-ss3', songId: 3, title: 'Perfect', artist: 'Ed Sheeran', position: 3 },
    ],
    missingFromHost: [],
  },
];

export default function SwipeRowsOnTheDayLab() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div className="mx-auto min-h-screen w-full max-w-xl space-y-4 bg-cream px-4 pb-32 pt-6 text-ink">
      <ShotList eventId="lab-event" eventName="Ana & Ben" />
      <IssuesLog eventId="lab-event" />
      <ConsolePlate className="space-y-4">
        <SetsPanel eventId="lab-event" sets={SETS} repertoire={[]} />
      </ConsolePlate>
    </div>
  );
}
