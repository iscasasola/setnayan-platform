/**
 * Card 33b · All-set readiness gate · Phase 6 · Final month tier.
 *
 * Owner directive 2026-05-24 (flow diagram) · final readiness checkpoint
 * BEFORE Card 34 Event (which auto-flips the app to day-of mode per
 * iteration 0031). Surfaces a confidence-building summary of what's
 * locked, what's in flight, and what's still pending — gives the host
 * one last "yes, we're ready" affirmation before the wizard hands off
 * to the live-event surface.
 *
 * Pattern · external_process · PaperworkCard primitive · settles via
 * markTaskDone when the host confirms everything is in order. The host
 * can re-open this card if something needs a last-minute fix.
 */

import { PaperworkCard } from './paperwork-card';

type Props = { eventId: string };

export function AllSetReadinessCard({ eventId }: Props) {
  return (
    <PaperworkCard
      eventId={eventId}
      taskId="all_set_readiness"
      intro={
        <>
          <p>
            Walk through every section one more time — your guest list,
            seatplan, vendors, paperwork, schedule, paprint pickups.
            Anything that needs a last-minute fix, do it now while you
            still have breathing room.
          </p>
          <p className="mt-2 text-ink/65">
            Once you mark all-set, your dashboard switches into day-of
            mode T-1h before the ceremony · vendor chat opens to
            coordinators · the guest landing page surfaces live RSVPs
            + arrival check-ins. You can still edit anything, but the
            wizard&apos;s job is done — you graduate to live.
          </p>
        </>
      }
      metaFields={[]}
      inFlightLabel="Final pass in progress"
      doneLabel="Everything is set"
    />
  );
}
