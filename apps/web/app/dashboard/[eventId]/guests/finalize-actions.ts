'use server';

/**
 * finalize-actions.ts: the host's Finalize and Reopen.
 *
 * ⚖ Owner, 2026-09-30: *"i must click a finalize to finalize it."* The guest
 * list is never finalized by a date, only by the host pressing Finalize (after
 * a confirm). The rule and the write live in lib/pax.ts (`finalizeGuestList`),
 * which refuses anyone who is not a host of this event before anything is
 * written.
 *
 * ⚖ Owner, 2026-10-07: *"finalize means the guestlist is finalized and guests
 * cannot answer anymore. but the host of the event not the supplier and
 * coordinator always have the power to unfinalize it as needed"*. Reopen is
 * the HOSTS' only — `reopenGuestList` refuses anyone who is not a `couple`
 * member of this event, on the server (a hidden button is not a fence). Held by
 * `finalize-closes-replies-and-only-hosts-reopen.test.ts`.
 *
 * Every exported server action is a Vercel route under a hard ceiling
 * (scripts/lint-server-action-budget.mjs) — this stays the one.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { finalizeGuestList, reopenGuestList } from '@/lib/pax';

export async function setGuestListFinalized(
  eventId: string,
  finalized: boolean,
): Promise<{ ok: true; locked: boolean } | { ok: false; error: string }> {
  if (!eventId) return { ok: false, error: 'Missing event.' };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Your session expired — sign in again.' };
  const res = finalized
    ? await finalizeGuestList(supabase, eventId, user.id)
    : await reopenGuestList(supabase, eventId, user.id);
  if (!res.ok) return res;
  revalidatePath(`/dashboard/${eventId}/guests`);
  return { ok: true, locked: res.state.locked };
}
