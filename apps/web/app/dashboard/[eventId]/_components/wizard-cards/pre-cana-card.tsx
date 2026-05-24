/**
 * Card 27 Pre-Cana · Phase 5 · Legal + Paperwork tier.
 *
 * Pre-Cana is the marriage-preparation seminar required by Catholic
 * parishes for couples to marry in the Catholic Church. Typically a
 * weekend retreat or a series of evening sessions. Attendance certificate
 * required to lock the church wedding date. Non-Catholic ceremonies skip
 * Pre-Cana but may have analogous "marriage prep" sessions (INC has its
 * own counseling; some Christian churches have premarital counseling).
 *
 * The host either:
 *   - schedules Pre-Cana with their parish → [Submitted · in flight]
 *   - completes the seminar + has the cert → [Mark done]
 */

import { PaperworkCard } from './paperwork-card';

type Props = { eventId: string };

export function PreCanaCard({ eventId }: Props) {
  return (
    <PaperworkCard
      eventId={eventId}
      taskId="pre_cana"
      intro={
        <>
          <p>
            Pre-Cana is the marriage-preparation seminar Catholic parishes
            require — usually a weekend retreat or 4–6 evening sessions. Your
            attendance certificate is part of the church-wedding paperwork.
          </p>
          <p className="mt-2 text-ink/65">
            Non-Catholic ceremonies skip this card — INC has its own
            counseling track; Christian + civil weddings have analogous
            premarital sessions. Click <em>Mark done</em> once your
            certificate is in hand.
          </p>
        </>
      }
      metaFields={[
        {
          name: 'scheduled_for',
          label: 'Scheduled session date (optional)',
          type: 'text',
          placeholder: 'e.g. June 2026 weekend',
          maxLength: 64,
        },
      ]}
      inFlightLabel="Scheduled · waiting for session"
      doneLabel="Pre-Cana certificate received"
    />
  );
}
