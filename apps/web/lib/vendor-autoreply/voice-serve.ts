// lib/vendor-autoreply/voice-serve.ts
//
// THE serving gate for Advanced voice-match. One pure function decides whether
// a reply is rendered in the vendor's own voice or in the neutral house voice.
//
// PURE — no I/O, no clock, no env. `voice-runtime.ts` does the reads and calls
// this; the flag value is passed IN so the decision is testable in isolation.
//
// ── FOUR GATES, ALL REQUIRED, IN THIS ORDER ─────────────────────────────────
//  1. `flagEnabled`     — NEXT_PUBLIC_VENDOR_AI_VOICE_MATCH. Off ⇒ the neutral
//                         text is returned UNTOUCHED (byte-identical to today).
//  2. `advancedActive`  — `vendorAiAdvancedActive({ level, windowActive })`:
//                         the ADVANCED level marker AND a live entitlement
//                         window. This is THE entitlement.
//  3. `mode === 'smart'`— the vendor's PREFERENCE. ⚠ `vendor_bot_config.mode` is
//                         VENDOR-WRITABLE under policy `vendor_bot_config_write`,
//                         so it can NEVER be the entitlement: a vendor could set
//                         it themselves. It is checked AFTER (2) and only ever
//                         narrows — a vendor may decline voice-match, never
//                         grant it.
//  4. a usable phrasing — a fact-free envelope that renders. Anything else
//                         degrades to the neutral answer.
//
// Degrading is always to the NEUTRAL text, never to silence: the couple gets the
// same factual answer they get today, just without the vendor's voice on it.

import { pickPhrasingIndex, renderPhrasing } from './phrasings';

/** `chat_messages.body` has a 4000-char CHECK; the voiced text must fit it. */
export const VOICED_BODY_MAX = 4000;

export type VoiceServeReason =
  | 'voiced'
  | 'flag_off'
  | 'not_advanced'
  | 'mode_not_smart'
  | 'no_phrasings'
  | 'render_failed'
  | 'too_long';

export type VoiceServeInput = {
  /** NEXT_PUBLIC_VENDOR_AI_VOICE_MATCH, resolved by the caller. */
  flagEnabled: boolean;
  /** vendorAiAdvancedActive({ level, windowActive }) — level AND live window. */
  advancedActive: boolean;
  /** vendor_bot_config.mode — a PREFERENCE, never the entitlement. */
  mode: string | null | undefined;
  /** The deterministic answer from buildAnswer() — every number a live row. */
  neutralText: string;
  /** Precomputed envelopes for THIS vendor + THIS intent. */
  phrasings: readonly string[];
  /** Stable per-reply rotation input (e.g. `${threadId}:${repliesToday}`). */
  rotationKey: string;
  /** Body ceiling; exposed for tests. */
  maxLength?: number;
};

export type VoiceServeResult = {
  text: string;
  voiced: boolean;
  reason: VoiceServeReason;
};

function neutral(text: string, reason: VoiceServeReason): VoiceServeResult {
  return { text, voiced: false, reason };
}

/**
 * Decide the outgoing reply text. PURE.
 *
 * INVARIANT pinned by the unit tests: with `flagEnabled:false` the returned
 * `text` is `===` the input `neutralText` for every other combination of inputs.
 */
export function serveVoicedReply(input: VoiceServeInput): VoiceServeResult {
  const { neutralText } = input;
  if (!input.flagEnabled) return neutral(neutralText, 'flag_off');
  if (!input.advancedActive) return neutral(neutralText, 'not_advanced');
  if (input.mode !== 'smart') return neutral(neutralText, 'mode_not_smart');

  // Trim-check, not length-check: a whitespace-only envelope is not a phrasing.
  const usable = input.phrasings.filter((p) => typeof p === 'string' && p.trim().length > 0);
  if (usable.length === 0) return neutral(neutralText, 'no_phrasings');

  const idx = pickPhrasingIndex(usable.length, input.rotationKey);
  // `idx < 0` and a missing element are the same failure to the caller: there
  // was no envelope to render, so answer neutrally. Checked rather than
  // asserted because `usable[idx]` is `string | undefined` under
  // `noUncheckedIndexedAccess`, and a non-null assertion here would trade a
  // compile-time guarantee for a runtime crash on the reply hot path.
  const chosen = idx >= 0 ? usable[idx] : undefined;
  if (chosen === undefined) return neutral(neutralText, 'no_phrasings');

  const rendered = renderPhrasing(chosen, neutralText);
  if (!rendered) return neutral(neutralText, 'render_failed');

  const max = input.maxLength ?? VOICED_BODY_MAX;
  // Never TRUNCATE a voiced reply: the cut could land mid-number and turn a
  // correct quote into a wrong one. Fall back to the neutral answer instead.
  if (rendered.length > max) return neutral(neutralText, 'too_long');

  return { text: rendered, voiced: true, reason: 'voiced' };
}
