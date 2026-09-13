'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

/**
 * ✅ RECORD THAT THIS PERSON SAYS THEIR YOUTUBE CHANNEL IS ALREADY LIVE-READY.
 *
 * Owner ruling 2026-09-02: asked once, ever. Live Studio's BYO path streams to the
 * couple's OWN channel, and YouTube's first-time live activation takes about 24
 * hours — a wait nothing on our side can shorten and which, discovered on the
 * wedding morning, cannot be recovered from. So the buy sheet asks before it takes
 * money. Having answered once, they are not asked again: not for this purchase, not
 * for the next one, and not for their next celebration.
 *
 * ── WHY `users` AND NOT THE EVENT OR THE ORDER ─────────────────────────────
 * A YouTube channel belongs to the PERSON. Stamping the event would re-ask the same
 * human at their second wedding-adjacent celebration; stamping the order would
 * re-ask them at their second purchase. Both are the behaviour that was ruled out.
 * The write is covered by the pre-existing `user_owns_row` policy on `public.users`
 * (USING/WITH CHECK `user_id = auth.uid()`, FOR ALL), so this uses the ordinary
 * authenticated client — no service-role escalation is introduced for a checkbox.
 *
 * ── SYMMETRIC ON PURPOSE ───────────────────────────────────────────────────
 * `accepted: false` CLEARS the stamp. Unticking has to mean something: a person who
 * ticks by accident, reads the sentence properly and unticks would otherwise be
 * silently recorded as having confirmed, and would never be asked again. The box is
 * a claim they are making, so they must be able to withdraw it in the same gesture
 * they made it.
 *
 * ── FAILS QUIET, BY DESIGN ─────────────────────────────────────────────────
 * Returns void and throws nothing the caller must handle. The gate has already
 * opened client-side when this is called; a failed write costs the buyer one extra
 * tick next time and costs the purchase nothing. Blocking a paid checkout on a
 * bookkeeping row would be the worse failure by a wide margin.
 *
 * ⚠ THIS RECORDS A CLAIM, NOT A VERIFICATION. We hold no OAuth grant on their
 * channel — that is the sensitive scope, and its 100-user cap is precisely what the
 * BYO path exists to avoid — so we cannot check that the channel is live-enabled.
 * Never surface this timestamp as "YouTube verified". It is "they said yes, on this
 * date". What actually proves readiness is a dry run: make a broadcast, push to it,
 * paste the link back.
 */
export async function setYoutubeLiveReadyAck(accepted: boolean): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('users')
    .update({ youtube_live_ready_ack_at: accepted ? new Date().toISOString() : null })
    .eq('user_id', user.id);

  // Logged, never thrown — see "FAILS QUIET" above. Silence here would make a
  // permanently-failing write indistinguishable from a working one.
  if (error) console.error('[live-studio] youtube live-ready ack write refused', error);

  revalidatePath('/dashboard/[eventId]/studio/live-studio-control', 'page');
}
