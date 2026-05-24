/**
 * Card 26 Church Paperwork · Phase 5 · Legal + Paperwork tier.
 *
 * Catholic parish requirements typically include: baptismal + confirmation
 * certificates (both partners · re-issued within 6 months of wedding) ·
 * parish marriage banns · pre-Cana attendance · canonical interview with
 * parish priest. Non-Catholic ceremonies have their own paperwork chain
 * (INC: registration with local · Christian: pastor's interview · Muslim:
 * mosque requirements).
 *
 * Surfaced as a generic checklist + free-form "Submitted" / "Done" actions.
 * V1.x will expand into per-faith branched flows.
 */

import { PaperworkCard } from './paperwork-card';

type Props = { eventId: string };

export function ChurchPaperworkCard({ eventId }: Props) {
  return (
    <PaperworkCard
      eventId={eventId}
      taskId="church_paperwork"
      intro={
        <>
          <p>
            Every faith has its own paperwork chain — baptismal + confirmation
            certificates re-issued within 6 months, parish marriage banns,
            canonical interview, local registration, mosque requirements.
            Catholic parishes are typically strictest; INC + Christian +
            Muslim each have their own checklist.
          </p>
          <p className="mt-2 text-ink/65">
            Start the chain with your officiant&apos;s parish or local. Click
            <em> Submitted · in flight</em> once you&apos;ve handed in the first
            batch — mark done when everything&apos;s back.
          </p>
        </>
      }
      inFlightLabel="Paperwork submitted"
      doneLabel="All paperwork in"
    />
  );
}
