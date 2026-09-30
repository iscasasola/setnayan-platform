'use server';

/**
 * pair-actions.ts — who walks beside whom, and whether those two are a couple.
 *
 * Filipino entourages walk in pairs: groomsman↔bridesmaid, ninong↔ninang. The
 * column for it (`guests.pair_with_guest_id`) has existed since the first
 * guests migration in May 2026.
 *
 * ⚖ OWNER 2026-09-29/30 — "walks with" LIVES ONLY IN THE MAKER'S WEDDING MARCH.
 * The Guest list keeps people; its rows and the guest card neither show nor
 * edit a pairing (DECISION_LOG "WALKING TOGETHER IS NOT BEING A COUPLE"). The
 * Guest list's "Pair these 2" writer that lived here is gone for that reason —
 * pairs are made in the march (`march-actions.ts` join / swap).
 *
 * Every pair write goes through the `pair_guests` / `unpair_guest` SQL
 * functions rather than two UPDATEs from here. That is not ceremony: a pair is
 * MUTUAL, so two round-trips leave a window where A points at B and B points
 * at nobody. The functions write both halves in one statement, under the
 * caller's own RLS (SECURITY INVOKER), so a partial pair cannot be persisted.
 */

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { MARCH_READ_FAILED, MARCH_STALE, MARCH_WRITE_FAILED, revalidateMarch } from '@/lib/entourage-write';
import type { MarchResult } from '@/lib/march-result';

function backToList(eventId: string, params: Record<string, string>): string {
  const q = new URLSearchParams(params);
  return `/dashboard/${eventId}/guests?${q.toString()}`;
}

/**
 * "They're a couple" — the Wedding March's tick on ONE walking pair.
 *
 * ⚖ OWNER 2026-09-30: *"sometimes the principal sponsor are not couples. Or the
 * entourage are also not couples."* Walking together prints both full names
 * ("Dr. Eduardo Bautista & Ms. Carmen Reyes"); only a real couple prints the
 * short form ("Hon. Ricardo & Mrs. Jessica Villahermosa"). This is how the
 * hosts say two walkers ARE a couple. (A +1 is a couple already — see
 * `isCouple` in lib/entourage.ts — and needs no tick.)
 *
 * 🔑 +0 EXPORTED ACTIONS: this took the export slot of the Guest list's retired
 * "Pair these 2" writer (`lint-server-action-budget.mjs`).
 *
 * WRITE SHAPE. `couple_with_guest_id` is read as MUTUAL, so the order of the
 * two writes below cannot make a false couple: until BOTH halves point at each
 * other the line prints full names — the safe reading. Clearing is one
 * statement. Every write asks for the rows it touched, because a zero-row
 * UPDATE (RLS refused, the guest removed meanwhile) is otherwise success-shaped.
 */
export async function setWalkingPairCouple(
  eventId: string,
  aId: string,
  bId: string,
  couple: boolean,
): Promise<MarchResult> {
  if (!aId || !bId || aId === bId) return { ok: false, reason: 'Pick the two people who walk together.' };
  const supabase = await createClient();

  // READ fresh — they must still walk together, or the tick means nothing.
  const { data, error: readErr } = await supabase
    .from('guests')
    .select('guest_id, pair_with_guest_id')
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .in('guest_id', [aId, bId]);
  if (readErr) return { ok: false, reason: MARCH_READ_FAILED };
  const rows = (data ?? []) as Array<{ guest_id: string; pair_with_guest_id: string | null }>;
  const a = rows.find((r) => r.guest_id === aId);
  const b = rows.find((r) => r.guest_id === bId);
  if (!a || !b || a.pair_with_guest_id !== bId || b.pair_with_guest_id !== aId) {
    return { ok: false, reason: MARCH_STALE };
  }

  if (!couple) {
    const { data: cleared, error } = await supabase
      .from('guests')
      .update({ couple_with_guest_id: null })
      .eq('event_id', eventId)
      .in('guest_id', [aId, bId])
      .select('guest_id');
    if (error || (cleared ?? []).length !== 2) return { ok: false, reason: MARCH_WRITE_FAILED };
  } else {
    for (const [self, other] of [
      [aId, bId],
      [bId, aId],
    ] as const) {
      const { data: set, error } = await supabase
        .from('guests')
        .update({ couple_with_guest_id: other })
        .eq('event_id', eventId)
        .eq('guest_id', self)
        .select('guest_id');
      if (error || (set ?? []).length !== 1) return { ok: false, reason: MARCH_WRITE_FAILED };
    }
  }

  await revalidateMarch(eventId);
  return { ok: true, written: 2 };
}

/**
 * Break a guest's pair — clearing BOTH halves, never just the row clicked.
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
