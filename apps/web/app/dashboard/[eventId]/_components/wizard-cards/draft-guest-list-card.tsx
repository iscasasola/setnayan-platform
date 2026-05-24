/**
 * Card 4b · First Draft Guest List · Phase 1 · Foundation tier.
 *
 * Owner directive 2026-05-24 (flow diagram) · adds the missing card that
 * makes the headcount real BEFORE Caterer (Card 07) so the caterer
 * picker can recommend by guest-count bucket. Lives between Officiant
 * (4) and Photography (5) so it fires early enough to influence every
 * downstream count-sensitive lock (catering · cake · seatplan · paprint).
 *
 * NO LINK out · the inline body surfaces current guest count + a
 * progress chip + a [Mark draft complete] CTA. Settles via markTaskDone
 * once the host reaches a threshold OR explicitly marks it done.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { PaperworkCard } from './paperwork-card';

type Props = { eventId: string };

export async function DraftGuestListCard({ eventId }: Props) {
  const admin = createAdminClient();

  const { count } = await admin
    .from('guests')
    .select('guest_id', { count: 'exact', head: true })
    .eq('event_id', eventId);

  const total = count ?? 0;

  return (
    <PaperworkCard
      eventId={eventId}
      taskId="draft_guest_list"
      intro={
        <>
          <p>
            A rough headcount unlocks every count-sensitive vendor pick —
            catering, cake, seatplan, paprint. You don&apos;t need final
            names yet, just enough to know what scale you&apos;re working
            with.
          </p>
          <p className="mt-2 text-ink/65">
            You&apos;re at <strong>{total}</strong>{' '}
            {total === 1 ? 'guest' : 'guests'} so far. Add the rest via
            the Guests tab — once your headcount feels right, mark this
            done and we&apos;ll surface the caterer card next.
          </p>
        </>
      }
      metaFields={[]}
      inFlightLabel="Still adding guests"
      doneLabel="My draft list is ready"
    />
  );
}
