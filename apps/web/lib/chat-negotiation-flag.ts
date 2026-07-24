/**
 * Chat negotiation auto-reader — feature flag (Phase 1: schedules).
 *
 * Gates the "auto-read negotiations" layer: the deterministic reader
 * (lib/chat-negotiation-detect.ts) that spots a schedule / discount / inclusion /
 * quote topic in a chat message, the one-tap "set up this meeting" suggestion
 * chip, and the in-chat appointment request card (accept / propose-new-time /
 * decline, backed by event_appointments). When OFF (default) the chat stream is
 * byte-identical to before — no reader runs, no chip, no card.
 *
 * NEXT_PUBLIC_ so the client (the chip + card in the message stream) and the
 * server (the create-request action) read one value. Only the exact truthy
 * strings enable it; anything else (incl. missing) is OFF, so it ships dark and
 * the owner flips it on after testing on a dummy thread.
 */
export function chatNegotiationEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_CHAT_NEGOTIATION_V1;
  return v === 'true' || v === '1' || v === 'TRUE';
}
