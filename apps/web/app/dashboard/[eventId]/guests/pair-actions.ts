'use server';

/**
 * pair-actions.ts — somebody steps out of the walk they are in.
 *
 * Filipino entourages walk in pairs: groomsman↔bridesmaid, ninong↔ninang.
 *
 * 🚶 OWNER 2026-10-01 — "THE WEDDING MARCH IS ITS OWN ENTITY": who walks with
 * whom is `march_walks` (one row per person; a walk = the rows sharing a
 * walk_no), no longer `guests.pair_with_guest_id`. And "A WALK AND A COUPLE ARE
 * INDEPENDENT": the march never sets or shows whether two people are a couple,
 * so the "They're a couple" tick (`setWalkingPairCouple`) is RETIRED — one
 * exported action fewer toward the `lint-server-action-budget.mjs` ceiling.
 *
 * ⚖ OWNER 2026-09-29/30 — "walks with" LIVES ONLY IN THE MAKER'S WEDDING MARCH.
 * The Guest list keeps people; its rows and the guest card neither show nor
 * edit a pairing (DECISION_LOG "WALKING TOGETHER IS NOT BEING A COUPLE"). The
 * Guest list's "Pair these 2" writer that lived here is gone for that reason —
 * pairs are made in the march (`march-actions.ts` join / swap).
 *
 * The write is the `unpair_guest` SQL function, under the caller's own RLS
 * on `march_walks` (SECURITY INVOKER), in one call.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { refuseLimitedHelper } from '@/lib/host-gate';

/**
 * Take a guest out of their walk — they walk alone, right behind it; whoever
 * they walked with keeps the walk and its place (`unpair_guest`, which writes
 * `march_walks` only).
 *
 * 🧩 IN PLACE, ALWAYS (owner 2026-09-29 — no link-outs; 2026-10-26, DECISION_LOG "A SAVE NEVER RESETS THE SCREEN —
 * APP-WIDE"). Its one caller is the Maker's Wedding March (`march-step.ts`, at ✓ Apply): the same RPC, the same RLS,
 * then no navigation — a refusal is THROWN for the caller to say in place, and success simply returns for the Maker
 * to refresh. The Guest list's row form that once bound it (and kept a `?unpaired=1` redirect for it) left with
 * "walks with" on 2026-09-30, so the redirect had no caller and is gone.
 */
export async function unpairGuestAction(eventId: string, guestId: string): Promise<void> {
  await refuseLimitedHelper(eventId, 'guest_list');
  const supabase = await createClient();
  const { error } = await supabase.rpc('unpair_guest', {
    p_event_id: eventId,
    p_guest_id: guestId,
  });
  if (error) throw new Error('That did not go through — nothing was changed.');

  revalidatePath(`/dashboard/${eventId}/guests`);
  // The invitation prints the pair as one line — it must redraw as two.
  revalidatePath('/[slug]', 'layout');
}
