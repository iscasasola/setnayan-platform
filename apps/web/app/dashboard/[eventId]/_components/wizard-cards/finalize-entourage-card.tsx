/**
 * Card 20b · Finalize Entourage · Phase 3 · Programming tier.
 *
 * Owner directive 2026-05-24 (flow diagram) · separates entourage
 * finalization from principal sponsors (Card 20). Entourage = maids of
 * honor · best men · bridesmaids · groomsmen · bearers · flower girls.
 * Distinct cohort, distinct measurements, distinct lock cadence — the
 * principal sponsors lock first (Card 20) because they witness the
 * union; the entourage gets named after that and feeds the attire +
 * paprint + seatplan cards downstream.
 *
 * PaperworkCard primitive · external_process kind · settles via
 * markTaskDone once the host has named every entourage role on their
 * guest list and the count is right.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { PaperworkCard } from './paperwork-card';

type Props = { eventId: string };

export async function FinalizeEntourageCard({ eventId }: Props) {
  const admin = createAdminClient();

  const { data: rows } = await admin
    .from('guests')
    .select('role')
    .eq('event_id', eventId)
    .in('role', [
      'maid_of_honor',
      'matron_of_honor',
      'best_man',
      'bridesmaid',
      'groomsman',
      'ring_bearer',
      'coin_bearer',
      'bible_bearer',
      'flower_girl',
    ]);

  const count = rows?.length ?? 0;

  return (
    <PaperworkCard
      eventId={eventId}
      taskId="finalize_entourage"
      intro={
        <>
          <p>
            With your principal sponsors locked, your entourage is the
            next cohort to finalize — maids of honor · best men ·
            bridesmaids · groomsmen · bearers · flower girls. Their
            attire is sized from this list, their seats are reserved at
            family-head tables, and their names appear on every print
            card you order.
          </p>
          <p className="mt-2 text-ink/65">
            You&apos;ve named <strong>{count}</strong>{' '}
            {count === 1 ? 'entourage member' : 'entourage members'} on
            your guest list. Add the rest via the Guests tab — once the
            count is right, mark this done.
          </p>
        </>
      }
      metaFields={[]}
      inFlightLabel="Still confirming names"
      doneLabel="Entourage is final"
    />
  );
}
