'use server';

/**
 * finalize-actions.ts: the host's Finalize — ONE WAY.
 *
 * ⚖ Owner, 2026-09-30: *"i must click a finalize to finalize it."* The guest
 * list is never finalized by a date, only by the host pressing Finalize (after
 * a confirm). The rule and the write live in lib/pax.ts (`finalizeGuestList`),
 * which refuses anyone who is not a host of this event before anything is
 * written.
 *
 * 🔒 Owner, 2026-10-07 (DECISION_LOG "FINALIZING THE HEADCOUNT IS ONE-WAY"):
 * *"when this is pressed say it cannot be unfinalized"*. There is no Reopen —
 * not on Guests › Setup, not on the roster, not in the Maker — and this action
 * refuses an unlock outright, so no client (an old tab, a crafted POST) can
 * reach one. Held by `finalize-is-one-way.test.ts`.
 *
 * Every exported server action is a Vercel route under a hard ceiling
 * (scripts/lint-server-action-budget.mjs) — this stays the one.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { finalizeGuestList } from '@/lib/pax';
import { FINALIZE_IS_ONE_WAY } from '@/lib/headcount-row';

export async function setGuestListFinalized(
  eventId: string,
  finalized: boolean,
): Promise<{ ok: true; locked: boolean } | { ok: false; error: string }> {
  if (!eventId) return { ok: false, error: 'Missing event.' };
  if (finalized !== true) return { ok: false, error: FINALIZE_IS_ONE_WAY };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Your session expired — sign in again.' };
  const res = await finalizeGuestList(supabase, eventId, user.id);
  if (!res.ok) return res;
  revalidatePath(`/dashboard/${eventId}/guests`);
  return { ok: true, locked: res.state.locked };
}
