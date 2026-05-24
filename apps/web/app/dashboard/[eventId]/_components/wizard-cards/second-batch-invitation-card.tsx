/**
 * Card 21b · Second Batch Invitation · Phase 3 · Programming tier.
 *
 * Owner directive 2026-05-24 (flow diagram) · adds the follow-up wave
 * card that fires after the initial invitation deploy (Card 21) so
 * non-responders + late-additions get a second pass without the host
 * dropping out of the wizard. Distinct from finalize_rsvp (Card 29)
 * which closes the loop — this is the SENDING side of the second wave.
 *
 * Pattern · external_process · PaperworkCard primitive · captures the
 * batch-send date + an optional note about who got the second wave.
 * Settles via markTaskDone when the second batch is out.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { PaperworkCard } from './paperwork-card';

type Props = { eventId: string };

export async function SecondBatchInvitationCard({ eventId }: Props) {
  const admin = createAdminClient();

  const { data: rows } = await admin
    .from('guests')
    .select('rsvp_status')
    .eq('event_id', eventId);

  const total = rows?.length ?? 0;
  const pending = rows?.filter(
    (g) => !g.rsvp_status || g.rsvp_status === 'pending',
  ).length ?? 0;

  return (
    <PaperworkCard
      eventId={eventId}
      taskId="second_batch_invitation"
      intro={
        <>
          <p>
            About 3 weeks after the first wave, send a second invitation
            to anyone who hasn&apos;t responded — plus any late-additions
            you missed in the first batch. Filipino guests often wait
            for the second nudge before locking their RSVP.
          </p>
          <p className="mt-2 text-ink/65">
            <strong>{pending}</strong> of {total} guests haven&apos;t
            responded yet. Send the second batch via the Guests tab,
            then mark this done so the wizard advances to your RSVP
            finalization.
          </p>
        </>
      }
      metaFields={[
        {
          name: 'send_date',
          label: 'Second batch send date',
          placeholder: 'e.g. 2026-10-15',
          maxLength: 32,
        },
      ]}
      inFlightLabel="Sending second wave"
      doneLabel="Second batch is out"
    />
  );
}
