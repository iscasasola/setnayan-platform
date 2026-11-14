import { notFound } from 'next/navigation';
import { FreeBookingMatchNote } from '@/app/admin/verify/_components/free-booking-match-note';
import type { FreeBookingMatch } from '@/lib/business-free-booking-match';

/**
 * 🛡 THE VERIFY-DESK LAB — the shipped `FreeBookingMatchNote` (owner 2026-11-06,
 * "ONE FREE FIRST BOOKING PER BUSINESS") on fixture matches, no database. Each
 * state sits in the card frame `/admin/verify` draws it in (`sn-row`, under the
 * header). Only the note is the delta; the rest of the real card is unchanged.
 * Dark: add `dark` to <html>.
 */
const STATES: Array<{ key: string; title: string; match: FreeBookingMatch | null }> = [
  {
    key: 'used',
    title: 'Second account — the business already used its free first booking',
    match: {
      shops: [
        { vendorProfileId: 'lab-a', businessName: 'Bulgogi Catering', matchedOn: ['phone', 'registration_number'], tookFree: true },
        { vendorProfileId: 'lab-b', businessName: 'Bulgogi Events Manila', matchedOn: ['payout_account'], tookFree: false },
      ],
      withheld: { alreadyUsed: 1, checkUnreadable: 0, selfTookFree: false },
    },
  },
  {
    key: 'unused',
    title: 'Same business, free first booking not used yet',
    match: {
      shops: [{ vendorProfileId: 'lab-c', businessName: 'Lumen Photo Co.', matchedOn: ['registration_number'], tookFree: false }],
      withheld: { alreadyUsed: 0, checkUnreadable: 0, selfTookFree: false },
    },
  },
  {
    key: 'unchecked',
    title: 'The match could not be read',
    match: { shops: null, withheld: null },
  },
  {
    key: 'held',
    title: 'No match — but a booking was billed because the check could not run',
    match: { shops: [], withheld: { alreadyUsed: 0, checkUnreadable: 1, selfTookFree: false } },
  },
];

export default function VerifyDeskLabPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <main className="mx-auto max-w-3xl space-y-4 bg-cream px-4 py-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">Verification queue · same business</p>
      {STATES.map((s) => (
        <article key={s.key} data-lab-state={s.key} className="sn-row space-y-4 p-5">
          <header className="min-w-0">
            <p className="truncate text-base font-semibold text-ink">Bulgogi Catering 2</p>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">{s.title}</p>
          </header>
          <FreeBookingMatchNote match={s.match} />
        </article>
      ))}
    </main>
  );
}
