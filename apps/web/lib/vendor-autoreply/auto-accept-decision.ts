// lib/vendor-autoreply/auto-accept-decision.ts
//
// PURE decision layer for Phase 4A — compatibility auto-accept with token hold
// (What's-Next doc §7 / recon item VFD-7). Split out of the orchestrator
// (auto-accept.ts) so the accept predicate is unit-testable without a DB —
// the same pattern as engine.ts / inbox-decision.ts.
//
// The §4A contract, encoded in check order:
//   Auto-accept fires IFF (every check passes):
//     1. flag on (NEXT_PUBLIC_VENDOR_AUTOREPLY_V1 — default OFF, flag-dark)
//     2. the vendor opted in (vendor_bot_config.auto_accept_enabled)
//     3. the thread is still a PENDING inquiry (never re-accept / never touch
//        an accepted or declined thread)
//     4. a compat score exists (snapshot or freshly computed) — no score means
//        we have nothing to judge on → never guess an accept
//     5. compat_score >= the vendor-configured threshold
//     6. the lead is NOT trust-flagged — and an ERRORED trust check counts as
//        flagged (fail-closed), never as a pass
//     7. (retired 2026-10-23 — there was a per-day auto-accept cap here; the
//        owner asked "why do we limit the auto reply?" and it is gone. An
//        auto-accept only opens the chat; it never books. The supplier's OWN
//        "bookings per day" is checked when a booking is made
//        (vendor_agree_to_lock → daily_limit_reached), and the per-date couple
//        ceiling refuses an accept past it (enforce_vendor_whitelist_per_date)
//        — both in the database, for a hand accept and this one alike.)
//     8. the vendor's tier can accept in-app inquiries at all (paid tiers only
//        — mirrors unlock_vendor_event_hold's TIER_FREE_NO_INAPP gate)
//     9. a token is AVAILABLE for the hold. No token → NO hold, ever — the bot
//        keeps answering (Phase 3b) and the lead is flagged for the vendor as
//        a waiting high-compat lead. An ERRORED availability probe is treated
//        as unknown → no accept AND no flag (we can't honestly claim "you're
//        out of tokens" when we simply failed to look).
//
// `flagWaitingLead` is true ONLY for the no-token skip: every other bar was
// cleared and tokens were the single blocker — exactly the lead the vendor
// should see ("this couple matched at N%, top up to auto-accept").

export type AutoAcceptSkipReason =
  | 'flag_off'
  | 'not_configured'
  | 'not_pending'
  | 'no_compat_score'
  | 'below_threshold'
  | 'trust_unknown'
  | 'trust_flagged'
  | 'tier_ineligible'
  | 'token_unknown'
  | 'no_token';

export type AutoAcceptDecision =
  | { accept: true }
  | { accept: false; reason: AutoAcceptSkipReason; flagWaitingLead: boolean };

export type AutoAcceptGateInput = {
  /** vendorAutoReplyEnabled() at evaluation time. */
  flagEnabled: boolean;
  /** The vendor's auto-accept config, or null when no row / not opted in. */
  config: {
    autoAcceptEnabled: boolean;
    /** vendor_bot_config.auto_accept_threshold (0–100). */
    threshold: number;
  } | null;
  /** chat_threads.inquiry_status — only 'pending' can auto-accept. */
  inquiryStatus: string | null;
  /** The 0–100 compat score (thread snapshot or freshly computed). Null =
   *  unknown → never accept on a score we don't have. */
  compatScore: number | null;
  /** True = an open integrity flag covers this lead/vendor. Null = the trust
   *  check ERRORED → fail-closed (treated as "cannot clear the lead"). */
  trustFlagged: boolean | null;
  /** The vendor's tier can accept in-app inquiries (paid tiers only). */
  tierEligible: boolean;
  /** True = wallet minus outstanding holds covers the hold. Null = the probe
   *  ERRORED → no accept, no "out of tokens" flag. */
  tokenAvailable: boolean | null;
};

const skip = (reason: AutoAcceptSkipReason, flagWaitingLead = false): AutoAcceptDecision => ({
  accept: false,
  reason,
  flagWaitingLead,
});

export function evaluateAutoAccept(input: AutoAcceptGateInput): AutoAcceptDecision {
  if (!input.flagEnabled) return skip('flag_off');
  if (!input.config || !input.config.autoAcceptEnabled) return skip('not_configured');
  if (input.inquiryStatus !== 'pending') return skip('not_pending');
  if (input.compatScore == null) return skip('no_compat_score');
  if (input.compatScore < input.config.threshold) return skip('below_threshold');
  if (input.trustFlagged == null) return skip('trust_unknown');
  if (input.trustFlagged) return skip('trust_flagged');
  if (!input.tierEligible) return skip('tier_ineligible');
  if (input.tokenAvailable == null) return skip('token_unknown');
  if (!input.tokenAvailable) return skip('no_token', true);
  return { accept: true };
}

/**
 * The couple-facing welcome posted after a successful auto-accept — cites the
 * explainCompatScore() drivers (§4A: "post a voice welcome citing
 * explainCompatScore() reasons"). Voice-profile phrasing is Phase 5; this is
 * the deterministic V1 template. The message is inserted with is_bot=true, so
 * the §2B AI label does the disclosure — the copy still says "automatically"
 * so the acceptance is never disguised as a hand-typed reply.
 */
export function buildAutoAcceptWelcome(businessName: string, reasons: string[]): string {
  const name = businessName.trim() || 'This supplier';
  const why =
    reasons.length > 0
      ? ` Why you match: ${reasons.slice(0, 3).join(' · ')}.`
      : '';
  return (
    `Good news — ${name} accepted your inquiry automatically because your event is a strong match.` +
    `${why} You can keep chatting right here, and the team will follow up personally.`
  );
}
