'use client';

import { useCallback } from 'react';
import { GuestSeatPreview } from '@/app/dashboard/[eventId]/guests/_components/guest-seat-preview';
import type { GuestSeatPreview as Preview } from '@/app/dashboard/[eventId]/guests/seat-view-actions';
import type { GuestSeatView } from '@/lib/guest-seat-view';
import { LAB_SEAT_BOOTHS, LAB_SEAT_TABLES } from './lab-seat-view-data';

/**
 * 🧪 `?part=seatview` — Seats S1d on fake data: the host's guest-card preview ("As Ana will see it") for each Seats ⚙
 * choice, read by a stand-in (no database). The guest's own page for the same choices is drawn beside it by the page
 * (server) — `YourSeat` with the lab's booth.
 */
function One({ view, fail = false }: { view: GuestSeatView; fail?: boolean }) {
  const read = useCallback(
    async (): Promise<Preview> =>
      fail
        ? { ok: false }
        : { ok: true, view, tables: LAB_SEAT_TABLES, entrance: { x: 50, y: 96 }, tableId: 'lab-t-1', seatNumber: 3, booths: LAB_SEAT_BOOTHS },
    [view, fail],
  );
  return (
    <section className="pt-2" data-lab-seat-view={fail ? 'failed' : view}>
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
