import { redirect } from 'next/navigation';
import { guestsViewHref } from '@/lib/guests-views';
import { resolveProfileByEvent, surfaceEnabled } from '@/lib/event-type-profile';

export const metadata = { title: 'Indoor Blueprint' };

type Props = { params: Promise<{ eventId: string }> };

/**
 * /dashboard/[eventId]/studio/indoor-blueprint — 🗂 R4: THE GUESTS' WAY TO THEIR TABLE LIVES INSIDE SEATS (owner
 * 2026-10-28, Q7/Q8 *"3D plan: yes, inside Seats"* — "the 3D plan and wayfinding", confirming 2026-09-29 "it's the same
 * room"; *"all mapping will be kept"*). The Indoor Blueprint (place the entrance, preview each guest's "find your
 * table" map — free) is the seat plan's Guests' map part (`BlueprintStudio`, drawn by `seating-editor.tsx`). This
 * address lands there — Guests › Seats on its map — for every type with a seat plan; a type with none (its wayfinding
 * would have no table to lead to) lands on the event's Home. 🔒 lib/r4-seats-march-forwards.test.ts
 */
export default async function IndoorBlueprintPage({ params }: Props) {
  const { eventId } = await params;
  if (!surfaceEnabled(await resolveProfileByEvent(eventId), 'seating')) redirect(`/dashboard/${eventId}`);
  redirect(guestsViewHref(eventId, 'seats', { seat: 'map' }));
}
