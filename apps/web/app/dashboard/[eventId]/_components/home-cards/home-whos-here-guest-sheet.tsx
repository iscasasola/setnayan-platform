'use client';

/**
 * The tapped guest's card, opened over Home from Who's here (owner 2026-10-29) — the SHIPPED sheet and the one reader
 * (`SHIPPED_GUEST_CARD.home` → `openGuestCard(…, 'home')`). Its own file so Home's card loads it only on the first tap
 * (`next/dynamic` in `home-whos-here-card.tsx`): the sheet and the card never ride Home's first load.
 */
import { useRouter } from 'next/navigation';
import { GuestCardSheet, SHIPPED_GUEST_CARD, type GuestCardPerson } from '../../guests/_components/guest-card-sheet';
import type { GuestCardResult } from '../../guests/_components/guest-card';

export default function HomeWhosHereGuestSheet({
  eventId,
  person,
  onClose,
  openGuest = SHIPPED_GUEST_CARD.home,
}: {
  eventId: string;
  person: GuestCardPerson;
  onClose: () => void;
  /** How the card is read — the shipped action, or a dev lab's stand-in. */
  openGuest?: (eventId: string, guestId: string) => Promise<GuestCardResult>;
}) {
  const router = useRouter();
  return (
    <GuestCardSheet
      eventId={eventId}
      person={person}
      open={openGuest}
      onClose={onClose}
      // one-render: keep (other-frame) — the guest card's own form saved inside the sheet; Home re-reads once so a renamed guest's face shows the new name.
      onSaved={() => router.refresh()}
    />
  );
}
