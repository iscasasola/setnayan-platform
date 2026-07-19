// lib/vendor-autoreply/inbox-decision.ts
//
// PURE decision layer for the Phase-3b live inbox hook: should a just-landed
// chat message trigger the Auto-Reply engine at all? Split out of the
// orchestrator (inbox-hook.ts) so the gate semantics are unit-testable without
// a DB — same pattern as engine.ts/adapter.ts.
//
// The gate encodes the What's-Next §3b rules in order:
//   1. flag off                      -> never (NEXT_PUBLIC_VENDOR_AUTOREPLY_V1
//                                      default OFF = zero behavior change)
//   2. sender is not the couple      -> never (LOOP-GUARD: the bot's own posts
//                                      land as sender_role='vendor', so they —
//                                      and real vendor/system/coordinator
//                                      messages — can never re-trigger it)
//   3. vendor has no bot config row  -> never (bot is strictly opt-in)
//   4. config.enabled = false        -> never
//   5. daily reply cap reached       -> never (cap 0 = bot never replies)

export type AutoReplySkipReason =
  | 'flag_off'
  | 'not_couple'
  | 'no_config'
  | 'bot_disabled'
  | 'cap_reached';

export type AutoReplyGate = { run: true } | { run: false; reason: AutoReplySkipReason };

export type AutoReplyGateInput = {
  /** vendorAutoReplyEnabled() at evaluation time. */
  flagEnabled: boolean;
  /** Role of the message that just landed ('couple' | 'vendor' | 'system' | …). */
  senderRole: string;
  /** The vendor's vendor_bot_config row, or null when none exists. */
  config: { enabled: boolean; dailyReplyCap: number } | null;
  /** vendor_bot_replies rows logged for this vendor since start of (Manila) day. */
  repliesToday: number;
};

export function evaluateAutoReplyGate(input: AutoReplyGateInput): AutoReplyGate {
  if (!input.flagEnabled) return { run: false, reason: 'flag_off' };
  if (input.senderRole !== 'couple') return { run: false, reason: 'not_couple' };
  if (!input.config) return { run: false, reason: 'no_config' };
  if (!input.config.enabled) return { run: false, reason: 'bot_disabled' };
  if (input.repliesToday >= input.config.dailyReplyCap) {
    return { run: false, reason: 'cap_reached' };
  }
  return { run: true };
}

/**
 * Start of the CURRENT day in Asia/Manila (UTC+8, no DST), as an ISO string —
 * the `created_at >=` bound for the daily-cap count. Setnayan is a PH-first
 * product, so "daily" means the vendor's business day, not the UTC day: a cap
 * of 30 resets at midnight Manila, which is what a vendor reading "30 replies
 * per day" in the config UI will expect.
 */
export function startOfManilaDayIso(now: Date = new Date()): string {
  const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const shifted = now.getTime() + MANILA_OFFSET_MS;
  const dayStartShifted = Math.floor(shifted / DAY_MS) * DAY_MS;
  return new Date(dayStartShifted - MANILA_OFFSET_MS).toISOString();
}
