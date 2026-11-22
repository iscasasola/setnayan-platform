'use client';

/** The REAL Guests desk on fixture guests, with an in-memory stand-in queue (a lab has no database to send to). */
import { useMemo } from 'react';
import { CheckinDesk, type DeskGuest } from '@/app/dashboard/[eventId]/guests/checkin/_components/checkin-desk';

const GUESTS: DeskGuest[] = [
  ['g1', 'Ana Reyes', 'Table 3', 'c0ffee00000000000000000000000001'],
  ['g2', 'Lito Santos', 'Table 6', 'c0ffee00000000000000000000000002'],
  ['g3', 'Carmela Tan', 'Table 2', 'c0ffee00000000000000000000000003'],
  ['g4', 'Gabriela Silang', null, 'c0ffee00000000000000000000000004'],
].map(([id, name, table, token]) => ({
  guestId: id as string,
  name: name as string,
  side: 'bride',
  role: 'guest',
  rsvpStatus: 'attending',
  photoUrl: null,
  plusOneNames: [],
  qrToken: token as string,
  tableLabel: (table as string | null) ?? null,
}));

export function LabGuestsDesk({ eventId, viewer }: { eventId: string; viewer: string }) {
  const queue = useMemo(() => {
    const items = new Map<string, { itemId: string; guestId: string; scannedAt: string }>();
    let n = 0;
    const q = {
      queueCheckin: async (i: { guestId: string }) => {
        const row = { itemId: `i${++n}`, guestId: i.guestId, scannedAt: new Date().toISOString() };
        items.set(i.guestId, row);
        return row;
      },
      queuedCheckins: async () => [...items.values()],
      unqueueCheckin: async () => {},
      sendQueuedCheckins: async () => 0,
      readCheckinNotes: () => [],
      dismissCheckinNote: () => {},
    };
    return () => Promise.resolve(q as never);
  }, []);
  const at = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
  return (
    <CheckinDesk
      eventId={eventId}
      viewer={viewer}
      guests={GUESTS}
      initialCheckins={[
        { guestId: 'g2', checkedInAt: at(4) },
        { guestId: 'g3', checkedInAt: at(6) },
      ]}
      expected={4}
      queue={queue}
    />
  );
}
