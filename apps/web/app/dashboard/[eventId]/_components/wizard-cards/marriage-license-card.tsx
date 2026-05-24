/**
 * Card 28 Marriage License · Phase 5 · Legal + Paperwork tier.
 *
 * Marriage license is issued by the Local Civil Registrar of the city
 * where one of the partners resides. Required documents: Cenomar (Card
 * 25) · birth certificates (both) · pre-marriage counseling certificate
 * (separate from Pre-Cana for Catholic) · barangay clearance · CTC.
 *
 * Hard 120-day validity window: license must be USED for the wedding
 * within 120 days of issuance. So timing matters — too early and it
 * expires; too late and it's a panic. The Concierge nudge schedule
 * surfaces this at T-4 months per CLAUDE.md 2026-05-20 "Home is the
 * guide" latest-by floors.
 */

import { PaperworkCard } from './paperwork-card';

type Props = { eventId: string };

export function MarriageLicenseCard({ eventId }: Props) {
  return (
    <PaperworkCard
      eventId={eventId}
      taskId="marriage_license"
      intro={
        <>
          <p>
            Apply for your marriage license at the <strong>Local Civil
            Registrar</strong> of the city where one of you lives. Bring your
            Cenomars, birth certificates, barangay clearance, and any pre-
            marriage counseling cert your LGU requires.
          </p>
          <p className="mt-2 text-ink/65">
            <strong>Hard 120-day rule:</strong> the license is valid for 120 days from
            issuance. Time your application so it&apos;s issued ~3-4 months
            before the wedding — too early and it expires; too late and
            you&apos;ll be cutting it close.
          </p>
        </>
      }
      metaFields={[
        {
          name: 'application_filed_at',
          label: 'Filed on (optional)',
          type: 'text',
          placeholder: 'e.g. June 1, 2026',
          maxLength: 64,
        },
        {
          name: 'license_number',
          label: 'License number (when issued)',
          type: 'text',
          placeholder: 'Issued by your LGU',
          maxLength: 64,
        },
      ]}
      inFlightLabel="Application filed · waiting"
      doneLabel="License in hand"
    />
  );
}
