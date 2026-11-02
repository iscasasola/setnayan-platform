'use client';

import { useCallback } from 'react';
import { GuestSeatPreview } from '@/app/dashboard/[eventId]/guests/_components/guest-seat-preview';
import type { GuestSeatPreview as Preview } from '@/app/dashboard/[eventId]/guests/seat-view-actions';
import type { EventTableRow } from '@/lib/seating';
import type { GuestSeatView } from '@/lib/guest-seat-view';
import type { Lab3DBooth } from '@/lib/seating-3d';

/**
 * 🧪 `?part=seatview` — Seats S1d on fake data: the host's guest-card preview ("As Ana will see it") for each Seats ⚙
 * choice, read by a stand-in (no database). The guest's own page for the same choices is drawn beside it by the page
 * (server) — `YourSeat` with the lab's booth.
 */
export const LAB_SEAT_TABLES: EventTableRow[] = [
  ['Sponsors', 'round_10', 30, 30],
  ['Family', 'round_10', 70, 30],
  ['Barkada', 'round_8', 30, 62],
  ['Choir', 'round_8', 70, 62],
].map(([label, type, x, y], i) => ({
  table_id: `lab-t-${i}`,
  public_id: `S89T-LAB000000${i}`,
  event_id: 'lab',
  table_label: label as string,
  table_type: type as EventTableRow['table_type'],
  capacity: type === 'round_10' ? 10 : 8,
  sort_order: i,
  x_pos: x as number,
  y_pos: y as number,
}));

export const LAB_SEAT_BOOTHS: Lab3DBooth[] = [
  {
    id: 'lab-booth-0',
    kind: 'live_cooking',
    label: 'Lechon station',
    xPct: 6,
    yPct: 62,
    offerings: 'Lechon de leche, carved at the station',
    cardItems: null,
    vendor: { name: 'Lab Lechon House', category: 'catering', logoUrl: null, tier: 'pro', slug: null, bookable: false, boothAddonActive: false },
  } as Lab3DBooth,
];

function One({ view, fail = false }: { view: GuestSeatView; fail?: boolean }) {
  const read = useCallback(
    async (): Promise<Preview> =>
      fail
        ? { ok: false }
        : { ok: true, view, tables: LAB_SEAT_TABLES, entrance: { x: 50, y: 96 }, tableId: 'lab-t-1', seatNumber: 3, booths: LAB_SEAT_BOOTHS },
    [view, fail],
  );
  return (
    <section className="rounded-2xl border border-ink/10 bg-cream p-3" data-lab-seat-view={fail ? 'failed' : view}>
      <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink/50">Guest card · Seat Plan · {fail ? 'read refused' : view}</p>
      <GuestSeatPreview eventId="lab" guestId="lab-ana" firstName="Ana" read={read} />
    </section>
  );
}

export function LabSeatViewCards() {
  return (
    <div className="flex flex-col gap-3">
      <One view="both" />
      <One view="2d" />
      <One view="3d" />
      <One view="both" fail />
    </div>
  );
}
