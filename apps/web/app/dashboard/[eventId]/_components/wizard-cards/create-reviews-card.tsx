/**
 * Card 36 Create Reviews · Phase 5 · Post-event tier.
 *
 * Post-wedding vendor reviews. Closes the loop on the vendor relationship
 * + helps future couples through the Setnayan marketplace (vendor
 * reviews surface on /vendors and /v/[slug] per iteration 0006).
 *
 * Simple [Mark done] shape — host writes reviews in the vendor workspace
 * surface separately; this card just tracks the wizard-side completion.
 * No in_flight state needed (the host either has or hasn't written
 * reviews — no mid-state).
 */

import { PaperworkCard } from './paperwork-card';

type Props = { eventId: string };

export function CreateReviewsCard({ eventId }: Props) {
  return (
    <PaperworkCard
      eventId={eventId}
      taskId="create_reviews"
      intro={
        <>
          <p>
            Write reviews for the vendors who made your day happen. Future
            couples planning their own weddings rely on honest reviews to
            choose — your team has earned the recognition.
          </p>
          <p className="mt-2 text-ink/65">
            Visit each vendor&apos;s profile to leave your review. Setnayan
            verifies that you actually booked them, so your review carries
            extra weight on the marketplace.
          </p>
        </>
      }
      hideInFlight
      doneLabel="Reviews submitted"
    />
  );
}
