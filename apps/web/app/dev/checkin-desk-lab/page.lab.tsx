import { notFound } from 'next/navigation';
import { DeskParts } from '@/app/dashboard/[eventId]/guests/checkin/_components/desk-parts';
import { SuppliersPart, TeamPart } from '@/app/dashboard/[eventId]/guests/checkin/_components/desk-parts-board';
import { DEFAULT_DESK_ACCESS, arrivalsBoard, partsForRole, teamOnDesk, type DeskRole } from '@/lib/checkin-desk';
import { LabGuestsDesk } from './lab-guests-desk';

/**
 * /dev/checkin-desk-lab — 🛂 the Check-in desk's three parts on fixture data, no sign-in and no database (owner 16 Nov
 * 2026, "Yes, as drawn"). DEV-ONLY: production builds 404 it. The REAL DeskParts, SuppliersPart, TeamPart and Guests
 * desk; the board and team rows come from the REAL pure rules (lib/checkin-desk.ts).
 *   `?as=host` (default) · `?as=coordinator` · `?as=helper` (Guests only, no picker, no ⚙).
 */
const E = '00000000-0000-4000-8000-000000000001';
const ME = '00000000-0000-4000-8000-00000000000a';
const LIZA = '00000000-0000-4000-8000-00000000000b';
const BEN = '00000000-0000-4000-8000-00000000000c';

export default async function CheckinDeskLab({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { as } = await searchParams;
  const role: DeskRole = as === 'coordinator' ? 'coordinator' : as === 'helper' ? 'helper' : 'host';
  const now = Date.now();
  const min = (m: number) => new Date(now - m * 60_000).toISOString();
  const hhmm = (msAgo: number) => {
    const d = new Date(now - msAgo);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const own = (t: string) => {
    const [h = 0, m = 0] = t.split(':').map(Number);
    return new Date(2000, 0, 1, h, m).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };
  const board = arrivalsBoard({
    suppliers: [
      { vendorProfileId: 'a', name: 'Lumière Studio' },
      { vendorProfileId: 'b', name: 'Casa Verde Catering' },
      { vendorProfileId: 'c', name: 'Taal Vista Hotel' },
      { vendorProfileId: 'd', name: 'Makati Florals' },
    ],
    rows: [
      { vendorProfileId: 'a', presetKey: 'on_site', at: min(170) },
      { vendorProfileId: 'a', presetKey: 'setup_done', at: min(130) },
    ],
    times: new Map([
      ['a', { arrive: hhmm(162 * 60_000), done: null }],
      ['b', { arrive: hhmm(20 * 60_000), done: null }],
      ['c', { arrive: hhmm(-100 * 60_000), done: null }],
    ]),
    nowMs: now,
    wallToMs: (t) => {
      const [h = 0, m = 0] = t.split(':').map(Number);
      const d = new Date(now);
      d.setHours(h, m, 0, 0);
      return d.getTime();
    },
    clockOf: clock,
    ownClock: own,
  });
  const team = teamOnDesk({
    viewerId: ME,
    viewerRole: role,
    activity: [
      ...Array.from({ length: 41 }, (_, i) => ({ userId: LIZA, at: min(1 + i), kind: 'scan' as const })),
      { userId: BEN, at: min(5.5), kind: 'souvenir' as const },
    ],
    people: new Map([
      [ME, { name: 'Maria', role }],
      [LIZA, { name: 'Liza Ramos', role: 'coordinator' as const }],
      [BEN, { name: 'Tito Ben', role: 'helper' as const }],
    ]),
    nowMs: now,
  });
  const parts = partsForRole(role, DEFAULT_DESK_ACCESS, ME);
  return (
    <div className="mx-auto w-full max-w-2xl tab:max-w-3xl px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Check-in desk</h1>
      <p className="text-sm text-ink/60">
        Scan a guest&rsquo;s QR (or search their name) as they arrive — you&rsquo;ll see their table and party at a glance,
        and the headcount keeps itself.
      </p>
      <DeskParts
        eventId={E}
        parts={parts}
        isHost={role === 'host'}
        access={DEFAULT_DESK_ACCESS}
        doorCandidates={[{ userId: '00000000-0000-4000-8000-00000000000d', name: 'Lumière Studio · Paolo' }]}
        guests={<LabGuestsDesk eventId={E} viewer={ME} />}
        suppliers={<SuppliersPart lines={board.lines} here={board.here} unread={false} />}
        team={<TeamPart lines={team} unread={false} />}
      />
    </div>
  );
}
