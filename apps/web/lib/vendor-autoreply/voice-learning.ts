// lib/vendor-autoreply/voice-learning.ts
//
// Reads the vendor's OWN outgoing replies and hands them to the pure derivation
// (`lib/vendor-voice-derive.ts`). Build plan § 6 / § 7B.
//
// ── THE HARD DATA-ISOLATION LOCK (§ 2A) LIVES IN THIS QUERY ─────────────────
// Exactly three predicates, all mandatory:
//   • `vendor_profile_id = <this vendor>` — never another vendor's messages;
//   • `sender_role = 'vendor'`            — never a COUPLE's message text. The
//     couple's words are input to the engine, never training material;
//   • `is_bot = false`                    — never the assistant's own output,
//     which would make the voice converge on itself over successive runs.
// It is run with the CALLER'S authenticated client, not the service-role client,
// so `chat_messages_member_read` RLS independently re-asserts the same scope: a
// coding slip here still cannot read another vendor's threads.
//
// ── CONSENT ─────────────────────────────────────────────────────────────────
// `vendor_bot_config.learn_from_past_messages` is the § 7B "Don't learn from my
// messages" opt-out and is checked by the caller before this runs; the derived
// profile is a PROPOSAL the vendor reviews and approves (propose-don't-commit),
// never an auto-applied change.

import type { SupabaseClient } from '@supabase/supabase-js';

import { deriveVoiceProfile, VOICE_SAMPLE_LIMIT, type VoiceDerivation } from '../vendor-voice-derive';

/**
 * Derive a voice proposal from this vendor's own sent replies.
 *
 * Returns a HOUSE-voice derivation with `sampleCount:0` when there is nothing to
 * learn from (or the read fails) — never throws, and never guesses.
 */
export async function deriveVoiceFromOwnReplies(
  client: SupabaseClient,
  vendorProfileId: string,
): Promise<VoiceDerivation> {
  try {
    const { data } = await client
      .from('chat_messages')
      .select('body')
      .eq('vendor_profile_id', vendorProfileId)
      .eq('sender_role', 'vendor')
      .eq('is_bot', false)
      .order('created_at', { ascending: false })
      .limit(VOICE_SAMPLE_LIMIT);

    const bodies = ((data as { body?: string | null }[] | null) ?? [])
      .map((r) => (typeof r.body === 'string' ? r.body : ''))
      .filter((b) => b.trim().length > 0);

    return deriveVoiceProfile(bodies);
  } catch (err) {
    console.error('[vendor-autoreply] voice derivation read failed:', err);
    return deriveVoiceProfile([]);
  }
}
