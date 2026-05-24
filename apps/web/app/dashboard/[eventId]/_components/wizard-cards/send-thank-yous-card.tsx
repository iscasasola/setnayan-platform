/**
 * Card 35 Send Thank-yous · Phase 5 · Post-event tier.
 *
 * Post-wedding thank-you cards to guests + vendors. Filipino tradition
 * is a printed or digital card sent within ~30 days of the wedding.
 * Surfaces as a simple "we wrote and sent them" mark-done card · no
 * in_flight middle state because the host either has or hasn't sent
 * them — there's no "submitted to external process" mid-state worth
 * tracking.
 */

import { PaperworkCard } from './paperwork-card';

type Props = { eventId: string };

export function SendThankYousCard({ eventId }: Props) {
  return (
    <PaperworkCard
      eventId={eventId}
      taskId="send_thank_yous"
      intro={
        <>
          <p>
            Send thank-you notes to your guests and your vendor team within
            about a month of the wedding. A handwritten card is the warmest;
            a thoughtful printed or digital card is perfectly fine too.
          </p>
          <p className="mt-2 text-ink/65">
            Personalize where you can — the godparents, the principal sponsors,
            the vendor leads who made the day flow.
          </p>
        </>
      }
      hideInFlight
      doneLabel="Thank-yous sent"
    />
  );
}
