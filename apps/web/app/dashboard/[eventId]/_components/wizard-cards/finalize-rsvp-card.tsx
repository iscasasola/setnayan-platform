/**
 * Card 29 Finalize RSVP · async server component that reads RSVP counts
 * and surfaces them inside the wizard card with a [Mark RSVP finalized]
 * CTA. Per the prereq chain · deploy_invitation gates this card so by
 * the time it surfaces the host has already sent invitations.
 *
 * NO LINK out · the full guest list management lives at /guests but
 * this card uses the inline summary + mark-done shape.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { FinalizeRsvpCardBody } from './finalize-rsvp-card-body';

type Props = { eventId: string };

export async function FinalizeRsvpCard({ eventId }: Props) {
  const admin = createAdminClient();

  // Read RSVP counts via a single query · group on client side since
  // PostgREST doesn't expose group_by directly without a view.
  const { data: guests } = await admin
    .from('guests')
    .select('rsvp_status')
    .eq('event_id', eventId);

  const rows = guests ?? [];
  const total = rows.length;
  const attending = rows.filter((g) => g.rsvp_status === 'attending').length;
  const declined = rows.filter((g) => g.rsvp_status === 'declined').length;
  const maybe = rows.filter((g) => g.rsvp_status === 'maybe').length;
  const pending = rows.filter(
    (g) => !g.rsvp_status || g.rsvp_status === 'pending',
  ).length;

  return (
    <FinalizeRsvpCardBody
      eventId={eventId}
      total={total}
      attending={attending}
      declined={declined}
      maybe={maybe}
      pending={pending}
    />
  );
}
