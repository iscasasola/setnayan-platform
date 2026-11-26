/**
 * /dev/busy-and-back-lab — final check B18 · B19 (drawing `final-check-area-5_2026-11-25.html` § B18 · B19, approved
 * 25 Nov). No sign-in, no database. DEV-ONLY: production builds 404 this route first thing.
 *
 *   ?s=pins   the one pinned row (`ToolPin`) as the supplier pages now draw it — Your details · Settings · Team ·
 *             Their work · Spaces · Deep Search · Packages · Albums by event · Partnerships · Your requests · a request
 *   ?s=busy   the three busy frames: Shop › Analytics loading (the skeleton), the QR code maker’s proof photo uploading and
 *             failed (the real `UploadSlotControl`), and a form button working (the real `SubmitButton`) beside a
 *             working `ActionButton`
 */
import { notFound } from 'next/navigation';
import { ToolPage, ToolPin } from '@/app/vendor-dashboard/_components/tool-page';
import { BusyFrames } from './busy-frames';

const PINS: ReadonlyArray<readonly [route: string, title: string, sub?: string]> = [
  ['/vendor-dashboard/profile', 'Your details'],
  ['/vendor-dashboard/settings', 'Settings'],
  ['/vendor-dashboard/team', 'Team'],
  ['/vendor-dashboard/services/their-work', 'Their work', 'Photos from every event your cards were booked for'],
  ['/vendor-dashboard/spaces', 'Spaces', 'Set once for the shop. Your cards pick from here.'],
  ['/vendor-dashboard/deep-search', 'Deep Search'],
  ['/vendor-dashboard/packages', 'Packages'],
  ['/vendor-dashboard/collections/albums', 'Albums by event'],
  ['/vendor-dashboard/partnerships', 'Partnerships'],
  ['/vendor-dashboard/services/requests', 'Your requests'],
  ['/vendor-dashboard/services/requests/[requestId]', 'Mobile coffee bar'],
];

export default async function BusyAndBackLabPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { s } = await searchParams;
  if (s === 'busy') return <BusyFrames />;
  return (
    <ToolPage name="busy-and-back-lab">
      {PINS.map(([route, title, sub]) => (
        <div key={route} className="mb-3" data-lab-pin={route}>
          <ToolPin route={route} params={{ requestId: 'S89R-LAB' }} title={title} sub={sub} />
        </div>
      ))}
    </ToolPage>
  );
}
