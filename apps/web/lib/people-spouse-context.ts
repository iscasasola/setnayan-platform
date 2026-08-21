import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { manilaToday } from '@/lib/std-views';
import { isCivilStatus } from '@/lib/profile-personalization';
import type { SpouseContext } from '@/lib/people-add';

/**
 * people-spouse-context.ts — the two facts the spouse rule turns on, read once
 * and handed to BOTH the screen and the server action.
 *
 * Owner rule (2026-08-21): no spouse chip for somebody who is single; a person
 * becomes married by their wedding on Setnayan, or by saying so on their
 * profile. `spouseIsOfferable()` in `people-add.ts` is the rule; this file is
 * only its inputs.
 *
 * ⚠ THE UI GATE IS NOT THE GATE. A chip the browser never rendered is still a
 * value a hand-made request can post, so `addPersonConnection` recomputes this
 * server-side and refuses. Hiding the chip is courtesy; the action is the
 * control.
 *
 * ⚠ A DATE IS NOT AN INSTANT. `events.event_date` is a DATE column holding the
 * venue's calendar day. It is compared as an ISO STRING against `manilaToday()`
 * — never parsed into a Date, which would read a 12 Dec wedding as the 11th on
 * any clock west of Greenwich (2026-08-04).
 *
 * ⚠ A FAILED READ IS NOT A FALSE. Both reads degrade to "we don't know", which
 * lands on NOT offering spouse — the same place a single person lands. A denial
 * can therefore hide the chip; it can never invent one.
 */
export async function getSpouseContext(userId: string): Promise<SpouseContext> {
  const supabase = await createClient();

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('civil_status')
    .eq('user_id', userId)
    .maybeSingle();
  if (profileError) {
    logQueryError('getSpouseContext.profile', profileError, {}, 'graceful_degrade');
  }
  const civilStatus =
    profile && isCivilStatus((profile as { civil_status: unknown }).civil_status)
      ? ((profile as { civil_status: string }).civil_status as SpouseContext['civilStatus'])
      : null;

  // Weddings this person is a PARTNER in ('couple' — never a guest, never a
  // moderator). RLS on event_members returns their own rows; the events read is
  // then scoped explicitly by those ids rather than leaning on a policy that
  // also admits is_admin() (RLS IS A FLOOR, NOT A SCOPE — and prod's admin is
  // the owner's own account).
  let weddingHasHappened = false;
  const { data: memberships, error: membershipError } = await supabase
    .from('event_members')
    .select('event_id')
    .eq('user_id', userId)
    .eq('member_type', 'couple');
  if (membershipError) {
    logQueryError('getSpouseContext.memberships', membershipError, {}, 'graceful_degrade');
  }
  const eventIds = [
    ...new Set(((memberships ?? []) as Array<{ event_id: string }>).map((m) => m.event_id)),
  ];
  if (eventIds.length > 0) {
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('event_date, event_end_date, event_type')
      .in('event_id', eventIds)
      .eq('event_type', 'wedding');
    if (eventsError) {
      logQueryError('getSpouseContext.events', eventsError, {}, 'graceful_degrade');
    }
    const today = manilaToday();
    weddingHasHappened = ((events ?? []) as Array<{
      event_date: string | null;
      event_end_date: string | null;
    }>).some((e) => {
      // A celebration that runs several days is over on its LAST day.
      const last = e.event_end_date ?? e.event_date;
      return typeof last === 'string' && last.length >= 10 && last < today;
    });
  }

  return { civilStatus, weddingHasHappened };
}
