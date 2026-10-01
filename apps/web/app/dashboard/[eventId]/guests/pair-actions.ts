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

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

function backToList(eventId: string, params: Record<string, string>): string {
  const q = new URLSearchParams(params);
  return `/dashboard/${eventId}/guests?${q.toString()}`;
}

/**
 * Take a guest out of their walk — they walk alone, right behind it; whoever
 * they walked with keeps the walk and its place (`unpair_guest`, which writes
 * `march_walks` only).
 *
 * 🧩 IN PLACE, TOO (owner 2026-09-29 — no link-outs; DECISION_LOG "A TOOL MOVED
 * INTO THE MAKER IS REBUILT INTO THE THREE PARTS"). The Maker's Wedding March
 * ("Leave the other side blank", `launch/_components/details-march.tsx`) calls
 * this SAME action with `mode = 'in-place'`: the same RPC, the same RLS, and
 * then no navigation — a refusal is THROWN for the caller to say in place,
 * and success simply returns for the Maker to refresh. The Guest list's row
 * form binds only the first two arguments, so its third is the form's
 * FormData, never the literal — it keeps its redirect exactly as before.
 * One writer, two doors; +0 exported actions.
 */
export async function unpairGuestAction(
  eventId: string,
  guestId: string,
  mode?: unknown,
): Promise<void> {
  const inPlace = mode === 'in-place';
  const supabase = await createClient();
  const { error } = await supabase.rpc('unpair_guest', {
    p_event_id: eventId,
    p_guest_id: guestId,
  });

  if (error) {
    if (inPlace) throw new Error('That did not go through — nothing was changed.');
    redirect(backToList(eventId, { error: encodeURIComponent(error.message) }));
  }

  revalidatePath(`/dashboard/${eventId}/guests`);
  if (inPlace) {
    // The invitation prints the pair as one line — it must redraw as two.
    revalidatePath('/[slug]', 'layout');
    return;
  }
  redirect(backToList(eventId, { unpaired: '1' }));
}
