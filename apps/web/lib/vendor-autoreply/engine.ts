// lib/vendor-autoreply/engine.ts
//
// The deterministic Auto-Reply engine (Phase 2). Pure: classify the couple's
// inquiry -> confidence gate -> assemble an answer from the vendor's own store.
// Handoff intents (customization / booking / unknown) and anything below the
// confidence floor route to the vendor instead of guessing (build plan §3, §4).
//
// This module ships nothing on its own — the Phase-3 inbox hook (behind
// NEXT_PUBLIC_VENDOR_AUTOREPLY_V1) is what builds the snapshot, calls
// decideReply(), and posts a labelled bot message (§2B) or flags a handoff.

import { buildAnswer } from './answer';
import { classifyIntent } from './intents';
import type { EngineDecision, EngineInput, Intent } from './types';

const HANDOFF_INTENTS: ReadonlySet<Intent> = new Set(['customization', 'booking', 'unknown']);
// Only a STRONG intent match (classifier confidence 0.9) auto-answers. A weak,
// ambiguous match (0.6) — a bare mention of "budget" / "slot" / "services" —
// routes to the vendor instead of guessing (this is also the backstop for any
// booking/customization phrasing that slips past the handoff patterns).
const MIN_CONFIDENCE = 0.8;

function handoffReason(intent: Intent): string {
  switch (intent) {
    case 'customization':
      return 'customization_request';
    case 'booking':
      return 'booking_intent';
    default:
      return 'unrecognized';
  }
}

export function decideReply(input: EngineInput): EngineDecision {
  const { intent, confidence } = classifyIntent(input.inquiryText);

  // Customization / booking / unrecognized -> always the vendor's call.
  if (HANDOFF_INTENTS.has(intent)) {
    return { action: 'handoff', intent, confidence, replyText: null, handoffReason: handoffReason(intent) };
  }

  // Recognized a factual intent but not confidently -> don't guess.
  if (confidence < MIN_CONFIDENCE) {
    return { action: 'handoff', intent, confidence, replyText: null, handoffReason: 'low_confidence' };
  }

  const text = buildAnswer(intent, input);
  if (!text) {
    // Factual intent understood, but the store has no data to answer it.
    return { action: 'handoff', intent, confidence, replyText: null, handoffReason: 'no_store_data' };
  }

  // Availability with no known date is really a clarifying question, not an answer.
  const action = intent === 'availability' && !input.event?.primaryDate ? 'clarify' : 'reply';
  return { action, intent, confidence, replyText: text };
}

export type { EngineDecision, EngineInput } from './types';
