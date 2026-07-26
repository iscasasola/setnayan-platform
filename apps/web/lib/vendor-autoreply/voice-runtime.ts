// lib/vendor-autoreply/voice-runtime.ts
//
// The reply-time SERVING path for Advanced voice-match. Reads the three things
// `serveVoicedReply()` needs (level marker · vendor preference · precomputed
// envelopes) and returns the final body.
//
// ── PER-REPLY COST: ₱0, STRUCTURALLY ────────────────────────────────────────
// Three indexed single-row/short reads and a string substitution. NO MODEL CALL
// HAPPENS HERE, and none may ever be added — the whole point of the precompute
// design is that the expensive step already ran, once, at voice-edit time
// (`precompute.ts`). Owner-locked: "Setnayan AI is deterministic and free."
//
// ── FLAG-OFF IS ZERO WORK ───────────────────────────────────────────────────
// With NEXT_PUBLIC_VENDOR_AI_VOICE_MATCH off this function returns the neutral
// text before constructing a query, so the inbox hook's behaviour and its query
// plan are byte-identical to today.
//
// ── SCHEMA-SKEW SAFETY ──────────────────────────────────────────────────────
// `ai_addon_level` is named ONLY when the ladder flag is on (a `select` naming
// an unknown column returns 42703 and nulls the whole row — see
// `vendor-ai-ladder-flag.ts`). Every read is its own statement, so even a
// 42703 on one of them degrades that input alone, and the gate falls back to
// the neutral answer rather than losing the reply.

import type { SupabaseClient } from '@supabase/supabase-js';

import { isVendorAiLadderEnabled } from '../vendor-ai-ladder-flag';
import { vendorAiAdvancedActive } from '../vendor-ai-level';
import { vendorVoiceMatchEnabled } from '../vendor-voice-match-flag';
import { coercePhrasings } from './phrasings';
import { serveVoicedReply, type VoiceServeResult } from './voice-serve';

export type VoicedReplyInput = {
  /** Service-role client, already scoped by the caller to THIS vendor (§ 2A). */
  admin: SupabaseClient;
  vendorProfileId: string;
  /** `isVendorAiAddonActive(ai_addon_expires_at)` — the hook already read it. */
  addonActive: boolean;
  intent: string;
  /** The deterministic answer. Returned unchanged whenever voice-match is off. */
  neutralText: string;
  rotationKey: string;
};

/**
 * Resolve the outgoing reply body. NEVER throws — a voice failure must never
 * cost the couple their answer, so every error path returns `neutralText`.
 */
export async function voicedReplyText(input: VoicedReplyInput): Promise<VoiceServeResult> {
  const off = (reason: 'flag_off' | 'not_advanced') => ({
    text: input.neutralText,
    voiced: false,
    reason,
  } as const);

  // Gate 1 — the flag. Zero queries, zero column names, byte-identical output.
  //
  // Read ONCE and threaded into `serveVoicedReply` below, rather than passing a
  // `true` literal. A hardcoded literal made the pure gate's `flagEnabled:false`
  // branch UNREACHABLE from production — its 36 assertions were pinning a value
  // no call site could produce, so deleting this line changed nothing red.
  // `voice-runtime.test.ts` now asserts flag-off issues ZERO queries, which is
  // what actually pins this early return.
  const flagEnabled = vendorVoiceMatchEnabled();
  if (!flagEnabled) return off('flag_off');
  // The ADVANCED rung only exists when the ladder is on; without it every vendor
  // reads Basic anyway, and naming `ai_addon_level` under schema skew would be
  // the 42703 footgun for nothing.
  if (!isVendorAiLadderEnabled()) return off('not_advanced');

  try {
    // The three reads are independent, so they go out together: this runs on
    // the reply hot path and three sequential round trips would add latency to
    // every auto-reply for no reason. Each still fails independently (see the
    // schema-skew note above) because `Promise.all` here resolves PostgREST
    // result objects, not rejections.
    const [{ data: levelRow }, { data: configRow }, { data: templateRows }] = await Promise.all([
      input.admin
        .from('vendor_profiles')
        .select('ai_addon_level')
        .eq('vendor_profile_id', input.vendorProfileId)
        .maybeSingle(),
      input.admin
        .from('vendor_bot_config')
        .select('mode')
        .eq('vendor_profile_id', input.vendorProfileId)
        .maybeSingle(),
      input.admin
        .from('vendor_reply_templates')
        .select('phrasings,generated_at')
        .eq('vendor_profile_id', input.vendorProfileId)
        .eq('intent', input.intent)
        .order('generated_at', { ascending: false })
        .limit(1),
    ]);

    const phrasings = coercePhrasings(
      (templateRows as { phrasings?: unknown }[] | null)?.[0]?.phrasings,
    );

    return serveVoicedReply({
      flagEnabled,
      advancedActive: vendorAiAdvancedActive({
        level: (levelRow as { ai_addon_level?: string | null } | null)?.ai_addon_level ?? null,
        windowActive: input.addonActive,
      }),
      mode: (configRow as { mode?: string | null } | null)?.mode ?? null,
      neutralText: input.neutralText,
      phrasings,
      rotationKey: input.rotationKey,
    });
  } catch (err) {
    console.error('[vendor-autoreply] voice-match degraded to house voice:', err);
    return off('not_advanced');
  }
}
