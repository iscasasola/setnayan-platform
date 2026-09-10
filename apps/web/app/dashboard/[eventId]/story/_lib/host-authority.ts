import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';

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

  /*
    ⚠ BOTH READS BIND THEIR ERROR. A refusal resolves as `data: null`, which is
    byte-identical to "you hold no such row" — so an unbound error here answers
    "you are not a host" to somebody who is, and the desk simply does not render.
    That direction is SAFE (it withholds), but it is silent, so it is logged.
  */
  const { data: moderator, error: modError } = await supabase
    .from('event_moderators')
    .select('moderator_id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .is('removed_at', null)
    .maybeSingle();
  if (modError) {
    logQueryError('storyHostAuthority.moderator', modError, { event_id: eventId }, 'graceful_degrade');
  }
  if (moderator) return user.id;

  const { data: legacy, error: memberError } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (memberError) {
    logQueryError('storyHostAuthority.member', memberError, { event_id: eventId }, 'graceful_degrade');
  }
  return legacy?.member_type === 'couple' ? user.id : null;
}
