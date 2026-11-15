import 'server-only';

import type { createClient } from '@/lib/supabase/server';
import type { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * The accounts this person has an ACCEPTED connection with — so a group co-member already offered as "Your people" is
 * not offered twice (F-W3-20). The same two reads as the People page's samahan section (`fetchKnownConnectionUserIds`),
 * narrowed to `status = 'confirmed'`. A refused read is an empty set: the person is then listed under both, which is
 * the old behaviour, never a hidden guest.
 *
 * Its own module so the guest picker (`people-you-can-invite.ts`) never names a `person_id` — it receives only account
 * ids for a membership test, and returns nothing from here to the client.
 */
export async function confirmedConnectionUserIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<Set<string>> {
  const out = new Set<string>();
  const { data: me, error: meError } = await supabase
    .from('people')
    .select('person_id')
    .eq('claimed_by_user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();
  if (meError) logQueryError('peopleYouCanInvite.me', meError, {}, 'graceful_degrade');
  const myPerson = (me as { person_id: string } | null)?.person_id;
  if (!myPerson) return out;
  const { data: edges, error: edgesError } = await supabase
    .from('person_connections')
    .select('from_person_id, to_person_id')
    .or(`from_person_id.eq.${myPerson},to_person_id.eq.${myPerson}`)
    .is('deleted_at', null)
    .eq('status', 'confirmed');
  if (edgesError) logQueryError('peopleYouCanInvite.edges', edgesError, {}, 'graceful_degrade');
  const others = [
    ...new Set(
      ((edges ?? []) as Array<{ from_person_id: string; to_person_id: string }>).map((e) =>
        e.from_person_id === myPerson ? e.to_person_id : e.from_person_id,
      ),
    ),
  ];
  if (others.length === 0) return out;
  const { data: rows, error } = await admin
    .from('people')
    .select('claimed_by_user_id')
    .in('person_id', others)
    .not('claimed_by_user_id', 'is', null);
  if (error) logQueryError('peopleYouCanInvite.people', error, {}, 'graceful_degrade');
  for (const r of (rows ?? []) as Array<{ claimed_by_user_id: string | null }>) {
    if (r.claimed_by_user_id) out.add(r.claimed_by_user_id);
  }
  return out;
}
