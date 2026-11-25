import { permanentRedirect } from 'next/navigation';
import { guestsViewHref } from '@/lib/guests-views';

/**
 * 🗑 RETIRED (final check 25 Nov, lane R · R5; LAUNCH-GATE L6): the "3D seating lab (prototype)" ADDRESS. The 3D room
 * lives in Guests › Seats › 3D; its room is the component `./_components/seating-room.tsx`, which the Seats page mounts
 * (this file used to be both the page and that component). An old link forwards there permanently, as `/plan3d` does.
 * Held by `lib/retired-pages-are-gone.test.ts`.
 */
export default async function RetiredSeatingLabPage({ params }: { params: Promise<{ eventId: string }> }): Promise<never> {
  const { eventId } = await params;
  permanentRedirect(guestsViewHref(eventId, 'seats', { seat: '3d' }));
}
