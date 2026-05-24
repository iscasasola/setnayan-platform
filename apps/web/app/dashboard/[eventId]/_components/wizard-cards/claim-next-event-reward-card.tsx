/**
 * Card 38b · Claim Next Event Reward · Phase 7 · Post-event tier.
 *
 * Owner directive 2026-05-24 (flow diagram) · final post-event card
 * that surfaces a thank-you reward for the host after the editorial
 * publishes (Card 38). Sets up the next-event flywheel — Setnayan is
 * a life-events platform, not a wedding-only app, so once the wedding
 * editorial is live the host gets a credit toward their next event
 * (anniversary · christening · birthday · or a friend's wedding
 * referred via personal link).
 *
 * Pattern · external_process · PaperworkCard primitive · settles via
 * markTaskDone when the host claims (or declines) the reward. Reward
 * mechanics live in V1.1 — for V1 this is a visible CTA pointing at
 * the next-event creation flow with a thank-you note.
 */

import { PaperworkCard } from './paperwork-card';

type Props = { eventId: string };

export function ClaimNextEventRewardCard({ eventId }: Props) {
  return (
    <PaperworkCard
      eventId={eventId}
      taskId="claim_next_event_reward"
      intro={
        <>
          <p>
            Your editorial is live. Setnayan is built for every life
            event, not just weddings — anniversaries · christenings ·
            birthdays · debuts. As a thank-you for shipping a full
            wedding with us, your next event starts with a head-start
            credit.
          </p>
          <p className="mt-2 text-ink/65">
            Tap claim · we&apos;ll add the credit to your account and
            walk you into the next-event creation flow whenever
            you&apos;re ready. Skip if you&apos;d rather come back later;
            the credit holds for 12 months.
          </p>
        </>
      }
      metaFields={[]}
      inFlightLabel="Thinking about it"
      doneLabel="Claim my reward"
    />
  );
}
