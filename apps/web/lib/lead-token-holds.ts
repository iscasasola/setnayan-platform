import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Phase B of fake-inquiry protection — token HOLD-and-release.
 *
 * A vendor accepting an inquiry normally BURNS a token (`unlock_vendor_event`),
 * so a fake lead that never replies still costs money. The hold model reserves
 * the token at accept and only truly consumes it when the couple genuinely
 * replies; a ghost auto-releases it. This module is the thin app seam over the
 * SQL primitives (`unlock_vendor_event_hold` / `consume_lead_token_hold_for` /
 * `sweep_ghosted_lead_holds`) added in migration 20270726988829.
 *
 * Flag-gated (`NEXT_PUBLIC_LEAD_TOKEN_HOLD_ENABLED`, default OFF). While OFF the
 * accept path calls the live burn RPC exactly as before — the hold RPC exists in
 * the DB but nothing routes to it. Merging changes NOTHING until the owner flips
 * the flag (and applies the migration).
 *
 * New RPCs aren't in the generated Supabase types yet, so calls use the repo's
 * `as never` escape hatch (see `refresh_bottleneck_signals` precedent).
 */
export function leadTokenHoldEnabled(): boolean {
  return process.env.NEXT_PUBLIC_LEAD_TOKEN_HOLD_ENABLED === 'true';
}

/**
 * Accept an inquiry by HOLDING a token instead of burning it. Mirrors the live
 * `unlock_vendor_event`'s gates + error codes (TIER_FREE_NO_INAPP /
 * VERIFIED_WEEKLY_LIMIT / INSUFFICIENT_WALLET_BALANCES) so the caller's existing
 * error handling is unchanged. Runs on the caller's RLS-scoped client (the RPC
 * is SECURITY DEFINER + ownership-gated, like the burn RPC).
 */
export async function acceptInquiryViaHold(
  supabase: SupabaseClient,
  args: { vendorProfileId: string; eventId: string; threadId: string },
): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.rpc('unlock_vendor_event_hold' as never, {
    p_vendor_profile_id: args.vendorProfileId,
    p_event_id: args.eventId,
    p_thread_id: args.threadId,
  } as never);
  return { error: error ? { message: error.message } : null };
}

/**
 * A genuine couple reply landed on an accepted thread → consume the outstanding
 * hold (charge for real, via the same consume_* the burn would have used).
 * Idempotent + best-effort: no-op if there's no held hold, never throws, runs off
 * the request path so a consume hiccup never blocks the couple's message. Uses
 * the admin client (the consume RPC is service-role only).
 */
export async function consumeLeadHoldOnCoupleReply(
  vendorProfileId: string,
  eventId: string,
): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.rpc('consume_lead_token_hold_for' as never, {
      p_vendor_profile_id: vendorProfileId,
      p_event_id: eventId,
      p_reason: 'couple_reply',
    } as never);
  } catch (e) {
    // Best-effort — the message already sent; the nightly sweep is the backstop.
    console.warn('[lead-token-holds] consume-on-reply failed:', e);
  }
}

/**
 * Settle-on-VIEW (Vendor_Token_Settlement_and_Lifecycle §2.1). The couple OPENING
 * a delivered quotation is value consumed — reply or not, off-app comparison or
 * not — so it settles the vendor's held token, just like a genuine reply. This
 * closes the free-quote-extraction hole (take the price, ghost, cost the vendor
 * nothing).
 *
 * Two steps, both on the admin client so they run cleanly from `after()` off the
 * request path: (1) `mark_proposal_viewed` transitions the proposal sent→viewed
 * IFF the passed viewer is a customer-side member of the event (couple/coordinator,
 * never the vendor); (2) if it actually transitioned AND the hold feature is live,
 * consume the outstanding hold with reason 'proposal_viewed'. Idempotent + best
 * effort — a re-open no-ops (already 'viewed'), and a missing hold no-ops. The
 * marking always runs (a legit proposal status); only the CONSUME is flag-gated,
 * mirroring settle-on-reply's app-side gate.
 */
export async function markProposalViewedAndSettle(
  publicId: string,
  viewerUserId: string,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.rpc('mark_proposal_viewed' as never, {
      p_public_id: publicId,
      p_viewer_user_id: viewerUserId,
    } as never);
    const result = data as {
      transitioned?: boolean;
      vendor_profile_id?: string;
      event_id?: string;
    } | null;
    if (
      result?.transitioned &&
      result.vendor_profile_id &&
      result.event_id &&
      leadTokenHoldEnabled()
    ) {
      await admin.rpc('consume_lead_token_hold_for' as never, {
        p_vendor_profile_id: result.vendor_profile_id,
        p_event_id: result.event_id,
        p_reason: 'proposal_viewed',
      } as never);
    }
  } catch (e) {
    // Best-effort — the couple already saw the quote; the sweep is the backstop.
    console.warn('[lead-token-holds] settle-on-view failed:', e);
  }
}

/**
 * Phase C — a VENDOR reported a couple. Wire that report into the token economy:
 * refund the reporting vendor's held token if the lead never replied (a dead /
 * fake lead), and if ≥ threshold distinct users have reported this couple, refund
 * the whole blast radius (a competitor's sock-puppet spray costs every victim
 * vendor nothing). The generic report row + admin review are unchanged; this only
 * adds the money-return. Best-effort, off the request path, never throws. No-op
 * unless the hold feature is live (there's nothing to refund otherwise).
 */
export async function runVendorLeadReportBackstop(args: {
  vendorProfileId: string;
  eventId: string;
  reportedUserId: string;
  reason: string;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.rpc('handle_vendor_lead_report' as never, {
      p_vendor_profile_id: args.vendorProfileId,
      p_event_id: args.eventId,
      p_reported_user_id: args.reportedUserId,
      p_reason: args.reason,
    } as never);
  } catch (e) {
    // Best-effort — the report itself already landed in the admin queue.
    console.warn('[lead-token-holds] vendor report backstop failed:', e);
  }
}

/**
 * Release every hold still 'held' past the ghost window (default 7 days) — the
 * couple never replied. Called by the lead-hold-sweep cron. Returns the count
 * released. Service-role only.
 */
export async function sweepGhostedLeadHolds(olderThan = '7 days'): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('sweep_ghosted_lead_holds' as never, {
    p_older_than: olderThan,
  } as never);
  if (error) {
    console.error('[lead-token-holds] ghost sweep failed:', error.message);
    return 0;
  }
  return Array.isArray(data) ? data.length : 0;
}

/** In-memory pre-throttle per instance — makes the after() hook ~free. */
const HOLD_SWEEP_CHECK_THROTTLE_MS = 30 * 60 * 1000;
/** Target cadence — run the ghost sweep at most ~once per this window. */
const HOLD_SWEEP_MIN_GAP_MS = 20 * 60 * 60 * 1000;
let lastHoldSweepCheckMs = 0;

/**
 * CRON-FREE ghost sweep — replaces the deleted /api/cron/lead-hold-sweep. Fired
 * from vendor/couple layout `after()` traffic; a durable single-row compare-and-
 * swap on platform_settings.lead_hold_sweep_last_run_at guarantees the RPC runs
 * ~once/day across the whole lambda fleet AND survives deploys (mirrors
 * lib/admin/digest-flush.ts — the deploy-surviving alternative to an in-memory
 * throttle). Cheap in-memory pre-throttle so most requests never touch the DB.
 * Best-effort, never throws. sweep_ghosted_lead_holds is idempotent + a no-op
 * when the hold feature is off (no held rows), so a double-fire is harmless.
 */
export async function maybeSweepGhostedLeadHolds(): Promise<void> {
  const nowMs = Date.now();
  if (nowMs - lastHoldSweepCheckMs < HOLD_SWEEP_CHECK_THROTTLE_MS) return;
  lastHoldSweepCheckMs = nowMs;
  try {
    const admin = createAdminClient();
    const nowIso = new Date(nowMs).toISOString();
    const cutoffIso = new Date(nowMs - HOLD_SWEEP_MIN_GAP_MS).toISOString();
    // Atomic daily claim — only one concurrent caller wins (the row-level lock
    // re-checks the condition); the rest bail. Targets the platform_settings
    // singleton (id=1) only when its watermark is stale.
    const { data: claim } = await admin
      .from('platform_settings')
      .update({ lead_hold_sweep_last_run_at: nowIso })
      .eq('id', 1)
      .or(`lead_hold_sweep_last_run_at.is.null,lead_hold_sweep_last_run_at.lt.${cutoffIso}`)
      .select('id');
    if (!claim || claim.length === 0) return; // throttled, lost the race, or no row
    await sweepGhostedLeadHolds('7 days');
  } catch {
    // Best-effort — a missed run just retries on the next eligible request.
  }
}
