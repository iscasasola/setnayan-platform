'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/**
 * archive-actions.ts — putting a celebration away, and taking it back out.
 *
 * ─── THE SIXTH GATE WITH NO HANDLE ─────────────────────────────────────────
 * `events.archived` has been a real column since the first migration. A dozen
 * screens already behave correctly when it is true: the one-wedding-at-a-time
 * rule releases, the event leaves the switcher, it moves to the Finished shelf
 * of the events board, and the anniversary reminder stops. The database has
 * always permitted an organiser to set it — verified against prod, not read
 * from a migration: `authenticated` holds UPDATE on the column and
 * `couple_can_update_event` admits `current_couple_event_ids()`.
 *
 * **Nothing in the app has ever written it.** Zero writers, traced by hand
 * across the whole repo; the only writes anywhere were two test files. So in
 * two years no event has ever been put away, and no event ever could be.
 *
 * 🔴 MEANWHILE FIVE SCREENS INSTRUCT PEOPLE TO DO IT. "Finish or archive it
 * first" is what a couple is told when they try to plan a second wedding, and
 * the admin console's delete warning literally recommends "archiving instead if
 * you might restore later". Every one of those sentences named a control that
 * did not exist. The owner is behind that instruction himself: he holds two
 * upcoming weddings, so a third is refused with nothing to press.
 *
 * ─── THE INVERSE SHIPS IN THE SAME COMMIT, DELIBERATELY ────────────────────
 * 🔑 A FORWARD PRIMITIVE WITH NO INVERSE is a defect this codebase has already
 * paid for (the auto-block that closed a booked date and had nothing to reopen
 * it, 2026-08-09). "Put away" is reversible BY DEFINITION — it is the gentle
 * option that delete is measured against — so `restore` is written here beside
 * it rather than promised later.
 *
 * ─── WHAT PUTTING AWAY DOES *NOT* DO (owner 2026-08-15) ────────────────────
 * Asked directly what a guest with the link should see, the owner chose: **the
 * page stays up exactly as it was.** Putting away is a tidy-up for the couple's
 * own list, not a privacy control — and a working four-option privacy setting
 * already ships on the event's website privacy screen for the couple who wants
 * the page down. Three of the five production events already sit on private.
 * **Do not fold "the wedding is off" into this.**
 *
 * Nothing is deleted, ever. The photo-quality clock is untouched: putting an
 * event away must never become a way to lose photographs.
 */

export type ArchiveResult =
  | { ok: true; archived: boolean }
  | { ok: false; code: 'unauthorized' | 'not_found' | 'failed'; message: string };

/**
 * Set or clear the put-away flag on one event.
 *
 * AUTHORISATION mirrors the house pattern used by every other governed field on
 * this event (`setEventCeremonyType`, `updateVenueSetting`): the caller must be
 * a host — `event_members` couple/coordinator, or an accepted `event_moderators`
 * row. RLS would already refuse a stranger's UPDATE, but an explicit check is
 * what lets this return a real reason instead of a silent zero-row success.
 *
 * ⚠ RLS IS A FLOOR, NOT A SCOPE. `couple_can_update_event` reads
 * `(event_id IN current_couple_event_ids()) OR is_admin()` — the second
 * disjunct is deliberately wide so the admin console can share the policy, and
 * production already has a vendor who is also an admin. Leaning on RLS alone
 * here would let an admin's ordinary session archive somebody else's wedding
 * through this couple-facing action.
 */
export async function setEventArchived(formData: FormData): Promise<ArchiveResult> {
  const eventId = String(formData.get('event_id') ?? '').trim();
  // The desired STATE is posted, never a toggle. A toggle computed from a stale
  // page archives an event the moment two tabs disagree.
  const archived = String(formData.get('archived') ?? '') === '1';
  if (!eventId) {
    return { ok: false, code: 'not_found', message: 'Which celebration?' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, code: 'unauthorized', message: 'Sign in required' };
  }

  const { data: memberRow } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .in('member_type', ['couple', 'coordinator'])
    .maybeSingle();
  let isHost = !!memberRow;
  if (!isHost) {
    const { data: modRow } = await supabase
      .from('event_moderators')
      .select('moderator_id')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .is('removed_at', null)
      .not('accepted_at', 'is', null)
      .maybeSingle();
    isHost = !!modRow;
  }
  if (!isHost) {
    return {
      ok: false,
      code: 'unauthorized',
      message: 'Only a host of this celebration can put it away.',
    };
  }

  /*
    🪤 `.select()` ON THE UPDATE, AND THE ROW COUNT IS CHECKED. Supabase does not
    throw — it resolves with `{ error }` — and an RLS refusal and a successful
    no-op are the SAME shape: zero rows, no error. Without reading back the row
    this would report success while changing nothing, which is exactly the
    silence this whole feature is a cure for.
  */
  const { data, error } = await supabase
    .from('events')
    .update({ archived, updated_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .select('event_id, archived');

  if (error) {
    console.error('[archive] update failed', error);
    return {
      ok: false,
      code: 'failed',
      message: 'We couldn’t save that just now. Please try again.',
    };
  }
  if (!data || data.length === 0) {
    return {
      ok: false,
      code: 'unauthorized',
      message: 'Only a host of this celebration can put it away.',
    };
  }

  // The board, the switcher and the event itself all read this flag.
  revalidatePath('/dashboard');
  revalidatePath(`/dashboard/${eventId}`);
  revalidatePath(`/dashboard/${eventId}/details`);
  return { ok: true, archived };
}
