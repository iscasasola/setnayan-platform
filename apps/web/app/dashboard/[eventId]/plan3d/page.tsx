import { redirect } from 'next/navigation';
import { guestsViewHref } from '@/lib/guests-views';

export const metadata = { title: '3D Plan' };

type Props = { params: Promise<{ eventId: string }> };

/**
 * /dashboard/[eventId]/plan3d — 🗂 R4: THE 3D PLAN LIVES INSIDE SEATS (owner 2026-10-28, Q7/Q8 *"3D plan: yes, inside
 * Seats"*, confirming 2026-09-24 "3D PLAN LEAVES THE EVENT MENU — THE SEAT PLAN ROW HOLDS IT"; *"all mapping will be
 * kept"*). This address — the 3D Plan control centre of 2026-09-05 — lands on Guests › Seats in its 3D room, decided
 * by the address alone, before any read. Nothing that wrote was lost: the control centre's one switch ("Show guests
 * their seats early", `publishSeating` / `unpublishSeating`) is the seat plan's own row; its walk, its decor and its
 * signs are the 3D room's and the seat plan's menus. The room's rules (who may open it) stay the seat plan's own.
 * 🔒 lib/r4-seats-march-forwards.test.ts
 */
export default async function Plan3dPage({ params }: Props) {
  const { eventId } = await params;
  redirect(guestsViewHref(eventId, 'seats', { seat: '3d' }));
}
