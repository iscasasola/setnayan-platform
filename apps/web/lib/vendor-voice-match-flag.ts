/**
 * vendor-voice-match-flag.ts — the switch for Vendor AI **ADVANCED voice-match**
 * (precompute path). Owner-locked model: `Vendor_Monetization_Model_LOCKED_2026-07-25.md`;
 * capability line: `Vendor_Front_Desk_Chatbot_Build_Plan_2026-07-18.md` §§ 6/7/8.
 *
 * Its OWN flag, deliberately separate from the three it sits beside:
 *   • `NEXT_PUBLIC_VENDOR_AUTOREPLY_V1`  — does the assistant run at all;
 *   • `NEXT_PUBLIC_VENDOR_AI_LADDER`     — does the add-on have two rungs;
 *   • `NEXT_PUBLIC_VENDOR_ADDON_TIERED_PRICING` — add-on price bands.
 * This one decides only whether the ADVANCED rung actually *does* anything —
 * i.e. whether a reply is rendered through the vendor's own voice.
 *
 * ⚠ IT ALSO GATES WHETHER APP CODE NAMES `vendor_bot_config.mode` /
 * `voice_profile` / `learn_from_past_messages`, and `vendor_reply_templates`, in
 * any query. That is not cosmetic: PostgREST answers a `select` naming an
 * unknown column with `42703` and returns `{ data: null }` for the WHOLE row,
 * not `undefined` for one field. In an environment whose database has not
 * received `20270822679405`, a voice-aware read would blank the entire bot
 * config — silencing the assistant for every vendor at once. Flag off ⇒ no query
 * mentions those columns ⇒ a schema/deploy skew is harmless.
 *
 * NEXT_PUBLIC so the My Shop card and the server-side inbox hook agree on one
 * value. Default OFF → every reply is the neutral house voice, byte-identical to
 * today, and nothing reads or writes a voice profile.
 */
export function vendorVoiceMatchEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_VENDOR_AI_VOICE_MATCH;
  return v === '1' || v === 'true' || v === 'TRUE';
}
