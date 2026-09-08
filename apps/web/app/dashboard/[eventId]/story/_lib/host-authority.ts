import { createClient } from '@/lib/supabase/server';

/**
 * WHO MAY WORK ON THIS STORY — the couple, or an ACCEPTED co-host.
 *
 * Lifted verbatim out of this route's `actions.ts`, where it was a private
 * function, so the DESK can prove the same authority the editor already does.
 * It could not simply be imported: `actions.ts` carries `'use server'`, and such
 * a module may only export async server actions — exporting a shared predicate
 * from it turns an internal helper into a callable endpoint.
 *
 * 🔑 ONE AUTHORITY, THREE ENFORCEMENTS, NO THIRD OPINION. This predicate, the
 * two `*_host_decides` RLS policies added in migration 20271214724787, and
 * `event_editorial`'s own couple+moderator policy pair all describe the same
 * set of people. A fourth, slightly different copy is how a rule ends up with
 * one lax version deciding a disclosure — the shape that shipped a supplier a
 * "you are booked here" they had not earned.
 *
 * Reads through the CALLER'S OWN session, never the admin client: the question
 * is "who is this?", and answering it with the service role is how a gate stops
 * being a gate.
 */
export async function hostUserId(eventId: string): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: moderator } = await supabase
    .from('event_moderators')
    .select('moderator_id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .is('removed_at', null)
    .maybeSingle();
  if (moderator) return user.id;

  const { data: legacy } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  return legacy?.member_type === 'couple' ? user.id : null;
}
