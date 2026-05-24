/**
 * Card 4b · First Draft Guest List · Phase 1 · Foundation tier.
 *
 * 2026-05-24 owner directive (CLAUDE.md decision-log row) · seeds the
 * VIP scaffold (bride · groom · best man · maid of honor) + a Quick-
 * Add chain in one inline pass. Lives between Officiant (Card 4) and
 * Photography (Card 5) so the headcount lands EARLY enough to drive
 * every count-sensitive downstream lock — caterer recommendations by
 * guest-count bucket · cake sizing · seatplan capacity · paprint
 * quantities.
 *
 * Inline-completion · NO link out · the form is the card. Settles via
 * completeDraftGuestListTask once bride + groom + ≥1 entourage land;
 * stays in_flight while the host iterates so they can re-open and add
 * more without losing progress.
 *
 * Reads existing VIP roles + total guest count at server-render time
 * so the form can (a) skip already-saved roles per the spec ("only if
 * not yet added") and (b) show a real-time total counter that adds
 * the in-flight typing on top of the canonical persisted count.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { DraftGuestListForm } from './draft-guest-list-form';

type Props = { eventId: string };

type VipRole = 'bride' | 'groom' | 'best_man' | 'maid_of_honor';
const VIP_ROLES: ReadonlySet<string> = new Set([
  'bride',
  'groom',
  'best_man',
  'maid_of_honor',
]);

export async function DraftGuestListCard({ eventId }: Props) {
  const admin = createAdminClient();

  // Two queries in parallel · total head count + which VIP roles
  // already have at least one row on file (used to hide already-
  // filled scaffold inputs).
  const [{ count: totalCount }, { data: vipRows }] = await Promise.all([
    admin
      .from('guests')
      .select('guest_id', { count: 'exact', head: true })
      .eq('event_id', eventId),
    admin
      .from('guests')
      .select('role')
      .eq('event_id', eventId)
      .in('role', ['bride', 'groom', 'best_man', 'maid_of_honor']),
  ]);

  const filledRoles = Array.from(
    new Set(
      (vipRows ?? [])
        .map((r) => (r as { role: string }).role)
        .filter((r): r is VipRole => VIP_ROLES.has(r)),
    ),
  ) as VipRole[];

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink/75">
        Seed your guest list with the four anchor names — bride, groom,
        best man, maid of honor. Then keep typing whoever else needs to
        be on the list. A rough headcount unlocks every count-sensitive
        vendor pick coming up · catering · cake · seatplan · paprint.
      </p>
      <DraftGuestListForm
        eventId={eventId}
        filledRoles={filledRoles}
        initialTotal={totalCount ?? 0}
      />
    </div>
  );
}
