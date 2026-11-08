import type { SupabaseClient } from '@supabase/supabase-js';
import { isChatLiveEnabled } from '@/lib/chat-live-flag';
import { STAMP_CEILING_MS, type StampOutcome } from '@/lib/booking-fee-minting-stamp';

/**
 * THE PRODUCTION APP TELLS THE DATABASE WHETHER CHAT IS LIVE — so the kill switch is ONE switch at both ends.
 *
 * `NEXT_PUBLIC_CHAT_LIVE_ENABLED` (lib/chat-live-flag.ts) decides whether a browser joins its `user:<uid>` channel.
 * The database half — the chat_messages trigger that sends the pings (migration 20271328682743) — cannot read an env
 * flag, so it reads `platform_settings.chat_live_pings_live`, and this stamps it with what production runs with.
 * Flag off → the stamp is FALSE → the trigger does one primary-key read and sends nothing: no browser is listening,
 * and no database row is written for nobody.
 *
 * Same bridge, same rules, same scheduler as `booking_fee_minting_live` (lib/booking-fee-minting-stamp.ts): after a
 * response, once per instance, PRODUCTION ONLY (a preview shares the production database), one tiny write and none
 * when nothing changed. Never throws.
 */
export async function stampChatLive(
  admin: SupabaseClient,
  ceilingMs: number = STAMP_CEILING_MS,
  live: boolean = isChatLiveEnabled(),
): Promise<StampOutcome> {
  const ceiling = new AbortController();
  const timer = setTimeout(() => ceiling.abort(), ceilingMs);
  try {
    const { data, error } = await admin
      .from('platform_settings')
      .update({ chat_live_pings_live: live })
      .eq('id', 1)
      // Only when it differs — a cold start that changes nothing writes nothing.
      .or(`chat_live_pings_live.is.null,chat_live_pings_live.neq.${live}`)
      .select('id')
      .abortSignal(ceiling.signal);
    if (error) {
      console.error('[chat-live-stamp] stamp failed:', error.message);
      return 'failed';
    }
    return (data ?? []).length > 0 ? 'stamped' : 'already_right';
  } catch (e) {
    console.error('[chat-live-stamp] stamp threw:', e);
    return 'failed';
  } finally {
    clearTimeout(timer);
  }
}

/** Two stamps, one scheduler: the worse outcome wins, so either one that did not land is retried on a later request. */
export function worseOutcome(a: StampOutcome, b: StampOutcome): StampOutcome {
  if (a === 'failed' || b === 'failed') return 'failed';
  return a === 'stamped' || b === 'stamped' ? 'stamped' : 'already_right';
}
