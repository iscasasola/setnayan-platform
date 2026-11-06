'use client';

/**
 * lab-seat-list-rows.tsx — `/dev/swipe-rows-lab/seating`: the REAL Guests › Seats › List (`SeatList`) on two fixture
 * tables with SEATED guests and edit held (`canEdit`), so each seated row is its swipe (owner 2026-11-03, "SWIPE LEFT TO
 * DELETE ON EVERY LIST ROW"). The seat plan's own editor needs its edit lock, which needs the database — this draws the
 * list without it. Remove sends the guest back to "To seat" here, in memory only; nothing is written.
 */

import { useState } from 'react';
import { SeatList, type SeatListGuest, type SeatListUnit } from '@/app/dashboard/[eventId]/seating/_components/seat-list';
import { UndoToastHost } from '@/app/dashboard/[eventId]/guests/_components/undo-toast';

const g = (id: string, name: string, side: SeatListGuest['side']): SeatListGuest => ({
  id,
  name,
  initials: name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
  photo: null,
  side,
  placed: 'placed by you',
});

const TABLES: { key: string; label: string; capacity: number; guests: SeatListGuest[] }[] = [
  { key: 't-family', label: 'Family', capacity: 4, guests: [g('g1', 'Ana Reyes', 'bride'), g('g2', 'Ramon Aquino', 'groom'), g('g3', 'Lourdes Bautista', 'bride')] },
  { key: 't-barkada', label: 'Barkada', capacity: 4, guests: [g('g4', 'Bianca Lim', 'both'), g('g5', 'Gabriel Castillo', 'groom')] },
];

export function LabSeatListRows() {
  const [off, setOff] = useState<ReadonlySet<string>>(() => new Set());
  const units: SeatListUnit[] = TABLES.map((t) => {
    const seats = Array.from({ length: t.capacity }, (_, seat) => {
      const guest = t.guests[seat] && !off.has(t.guests[seat]!.id) ? t.guests[seat]! : null;
      return { tableId: t.key, seat, guest };
    });
    return { key: t.key, label: t.label, capacity: t.capacity, seated: seats.filter((s) => s.guest).length, seats };
  });
  const unseated = TABLES.flatMap((t) => t.guests).filter((x) => off.has(x.id));
  return (
    <main className="mx-auto min-h-screen max-w-md bg-cream" data-lab-seatlist="">
      <SeatList
        units={units}
        unseated={unseated}
        pickedId={null}
        canEdit
        open={new Set(TABLES.map((t) => t.key))}
        onToggle={() => {}}
        onOpenGuest={() => {}}
        onPick={() => {}}
        onRemove={(id) => setOff((s) => new Set(s).add(id))}
        onSeatHere={() => {}}
        addMenu={() => null}
        headTools={() => null}
        renaming={() => null}
        tableTools={() => null}
        onDrop={() => {}}
      />
      <UndoToastHost />
    </main>
  );
}
