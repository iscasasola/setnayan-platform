/**
 * /dev/swipe-rows-lab/sponsors — the REAL sponsor card (`sponsors/_components/sponsor-card.tsx`) on fixture sponsors,
 * for the swipe-to-delete screenshots (owner 2026-11-03). Dev only — 404s in production (first statement). The swipe's
 * Remove would call the shipped `removeSponsor`, which refuses with no session; nothing is written.
 */
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { SponsorCard, type EventMini, type SponsorRow } from '@/app/dashboard/[eventId]/sponsors/_components/sponsor-card';

const EVENT: EventMini = { display_name: 'Ana & Ben', event_date: '2026-12-12', ceremony_type: 'catholic', venue_name: 'San Agustin Church' };

const row = (id: string, full_name: string, side: SponsorRow['side'], invitation_status: SponsorRow['invitation_status'], relationship_note: string | null): SponsorRow => ({
  id,
  event_id: 'S89E-LABSPONSOR',
  pair_index: 1,
  sponsor_tier: 'principal',
  side,
  full_name,
  relationship_note,
  email: null,
  phone: null,
  invitation_status,
  invitation_sent_at: null,
  responded_at: null,
  decline_note: null,
  linked_guest_id: null,
});

const SPONSORS: SponsorRow[] = [
  row('lab-s1', 'Ramon Aquino', 'groom', 'accepted', "Ben's godfather"),
  row('lab-s2', 'Lourdes Bautista', 'bride', 'invited', "Ana's aunt"),
  row('lab-s3', 'Teresa Lim', 'bride', 'pending', null),
];

export default function SwipeRowsSponsorsLab() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <main className="mx-auto min-h-screen w-full max-w-xl space-y-2 bg-cream px-4 pb-32 pt-6 text-ink" data-lab-sponsors="">
      <h1 className="sn-eye">Principal sponsors</h1>
      <Suspense>
        {SPONSORS.map((s) => (
          <SponsorCard key={s.id} sponsor={s} eventId="S89E-LABSPONSOR" event={EVENT} coupleNames="Ana & Ben" />
        ))}
      </Suspense>
    </main>
  );
}
