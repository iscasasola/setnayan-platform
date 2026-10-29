'use client';

import { openGuestCard } from '../open-guest-card';
import { GuestCard, type GuestCardResult } from './guest-card';

/**
 * 🪪 THE GUEST CARD, DRAWN IN THE BROWSER WHERE IT OPENS IN PLACE — the Wedding March, the parents, Studio › Prints, and
 * Home's Event settings (2026-10-29).
 *
 * The one read (`openGuestCard`) answers the card's DATA; this draws it with THE card (`GuestCard`, the Guest list's own),
 * so every surface still shows the one card. Why not the server: an action's answer is rendered through the CALLING
 * route's client manifest, built from that route's SERVER imports only, and none of the routes this opens on (the Maker,
 * the Event Hub editor, a Details field, Home) import the card's client pieces from a server file — the Maker keeps them
 * out of its first load on purpose. A drawn answer could not be sent there, and the tap fell to "Something on our end
 * didn't work".
 *
 * Loaded by `guest-card-sheet.tsx` at the first tap (`import()`) and warmed by the Maker's preload line
 * (`maker-tools.tsx`), so the card's code rides no route's first load.
 * 🔒 `app/dashboard/[eventId]/_components/the-settings-sheet-is-in-homes-graph.test.ts`
 */
export async function openGuestCardInPlace(eventId: string, guestId: string, at: 'march' | 'seats' | 'invitation'): Promise<GuestCardResult> {
  const r = await openGuestCard(eventId, guestId, at);
  if (!r.ok) return r;
  return {
    ok: true,
    card: <GuestCard frame="panel" eventId={eventId} {...r.read} returnTo={r.returnTo} errorMessage={null} inviteFlash={null} />,
  };
}
