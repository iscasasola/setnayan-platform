// lib/vendor-autoreply/auto-accept.ts
//
// Phase 4A orchestrator — compatibility auto-accept with token HOLD (What's-Next
// doc §7 / recon VFD-7). Runs at the tail of the Phase-3b inbox hook (after the
// front-desk engine has answered/handed off), entirely behind
// NEXT_PUBLIC_VENDOR_AUTOREPLY_V1 (default OFF) and entirely FAIL-CLOSED: any
// read/RPC/trust-check error → no auto-accept, the normal manual accept flow is
// byte-for-byte unchanged.
//
// What a successful auto-accept does, in order:
//   1. snapshot compat_score_at_inquiry + compat_reasons on the thread (§4A
//      audit contract — written once, at inquiry time, reused after)
//   2. place the token HOLD via the token-settlement stream's OWN RPC,
//      unlock_vendor_event_hold — consumed AS-IS, never re-implemented (the
//      RPC owns every gate: tier, weekly limit, balance-minus-held, idempotent
//      per (vendor,event))
//   3. flip chat_threads pending → accepted (guarded: only if still pending)
//   4. post the AI-labelled welcome citing explainCompatScore() reasons
//   5. log vendor_bot_replies action='auto_accept' (the daily-cap counter)
//
// The NO-TOKEN path (§4A hard rule): the bot keeps answering (Phase 3b already
// did, upstream), NO hold is placed — never silently burn or borrow — and the
// lead is flagged for the vendor by stamping compat_reasons with
// auto_accept_skipped='no_token' (the thread's compat % is already snapshotted,
// so "waiting high-compat leads" is a straight query for the Phase-4/5 UI).
//
// ⚠ KNOWN ACTIVATION BLOCKER (deliberate, documented): unlock_vendor_event_hold
// is SECURITY DEFINER but gates on auth.uid() being an answering member of the
// vendor. This orchestrator runs from `after()` under the service-role client,
// where auth.uid() is NULL → the RPC raises FORBIDDEN → we fail closed to the
// manual flow. That is the correct as-is consumption: the RPCs belong to the
// token-settlement/fake-inquiry streams and the OWNER has an OPEN ruling on bot
// actions vs token-settlement semantics (see the is_bot /
// stamp_vendor_first_reply question). When that ruling lands, the settlement
// stream can expose a service-role hold seam (precedent:
// claim_unlock_vendor_event is service-role-only with app-side validation) and
// THIS file needs zero structural change — the seam is placeHoldViaRpc().
//
// Trust check (§4A "not flagged"): the blocking signal is an OPEN
// integrity_flags row of kind='inquiry_concentration' against this vendor —
// the output of detect_inquiry_concentration() (fake-inquiry stream, shadow
// mode). While such a flag is open (a suspected linked-account cluster is
// spraying this vendor) we never AUTO-hold tokens; the inquiry itself is never
// withheld and manual accept stays available, honoring the shadow-mode "never
// quarantine" rule. get_lead_trust_flags is NOT consulted as a gate: its only
// signal (active_planner) is contractually "purely positive · never gates
// anything" (migration 20270727940889) — and it, too, is auth.uid()-gated. A
// per-cluster (rather than per-vendor) match is a tracked follow-up.

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  computeCompatScore,
  explainCompatScore,
  type CompatInputs,
} from '../compat-score';
import { haversineKm } from '../geo';
import { vendorAutoReplyEnabled } from '../vendor-autoreply-flag';
import {
  buildAutoAcceptWelcome,
  evaluateAutoAccept,
  type AutoAcceptDecision,
} from './auto-accept-decision';
import { startOfManilaDayIso } from './inbox-decision';

/** Tiers that can accept in-app inquiries at all — mirrors the RPC's
 *  TIER_FREE_NO_INAPP gate (the RPC re-enforces; this only pre-probes). */
const PAID_TIERS = new Set(['verified', 'solo', 'pro', 'enterprise']);

/** chat_messages CHECK caps body at 4000 chars (same guard as inbox-hook). */
const MAX_BODY = 4000;

export type AutoAcceptConfig = {
  autoAcceptEnabled: boolean;
  autoAcceptThreshold: number;
  dailyAutoAcceptCap: number;
};

export type AutoAcceptContext = {
  threadId: string;
  eventId: string;
  vendorProfileId: string;
  /** chat_threads.inquiry_status as loaded by the inbox hook. */
  inquiryStatus: string | null;
  /** chat_threads.compat_score_at_inquiry — reused when already snapshotted. */
  existingCompatScore: number | null;
  businessName: string;
  config: AutoAcceptConfig | null;
  /** vendor_review_stats — already loaded by the inbox hook. */
  avgRating: number | null;
  reviewCount: number | null;
  /** The raw `events` row (select('*') in the hook) — venue coords live here. */
  eventRow: Record<string, unknown> | null;
};

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

/**
 * Evaluate + (maybe) execute a compatibility auto-accept for one just-landed
 * couple inquiry. Never throws; every failure path degrades to the unchanged
 * manual flow. Called from runVendorAutoReply (inbox-hook.ts) — which already
 * verified the flag, the couple sender, and the vendor's bot being enabled.
 */
export async function maybeAutoAccept(
  ctx: AutoAcceptContext,
  admin: SupabaseClient,
): Promise<void> {
  // Cheap pure pre-exits — the common cases (vendor never opted in / thread
  // already accepted) cost zero additional DB reads. evaluateAutoAccept below
  // re-encodes the same rules as the single tested authority.
  if (!vendorAutoReplyEnabled()) return;
  if (!ctx.config?.autoAcceptEnabled) return;
  if (ctx.inquiryStatus !== 'pending') return;

  try {
    // ── Vendor identity for the score + the token probe ──────────────────
    const { data: vp } = await admin
      .from('vendor_profiles')
      .select('user_id,tier_state,verification_state,hq_latitude,hq_longitude')
      .eq('vendor_profile_id', ctx.vendorProfileId)
      .maybeSingle();
    if (!vp) return;
    const founderUserId = (vp.user_id as string | null) ?? null;
    const tier = ((vp.tier_state as string | null) ?? 'free').toLowerCase();
    const tierEligible = PAID_TIERS.has(tier);

    // ── Compat score: reuse the at-inquiry snapshot, else compute it now ──
    // Inputs follow compat-score.ts's admit-unknown contract: whatever the
    // hook context can't resolve (refinement / budget / date headroom) sits at
    // the neutral baseline rather than being guessed. Full CompatInputs parity
    // with the wizard matcher is a tracked follow-up.
    const vendorLat = num(vp.hq_latitude);
    const vendorLng = num(vp.hq_longitude);
    const eventLat = num(ctx.eventRow?.venue_latitude);
    const eventLng = num(ctx.eventRow?.venue_longitude);
    const compatInputs: CompatInputs = {
      distanceKm:
        vendorLat != null && vendorLng != null && eventLat != null && eventLng != null
          ? haversineKm(eventLat, eventLng, vendorLat, vendorLng)
          : null,
      avgRating: ctx.avgRating,
      reviewCount: ctx.reviewCount,
      verified: (vp.verification_state as string | null) === 'verified',
    };
    const computed = computeCompatScore(compatInputs);
    const score = ctx.existingCompatScore ?? computed.score;
    const reasons = explainCompatScore(compatInputs);

    // §4A snapshot — written ONCE at inquiry time (the `.is null` guard keeps
    // a follow-up message from rewriting the audit record).
    if (ctx.existingCompatScore == null) {
      await admin
        .from('chat_threads')
        .update({
          compat_score_at_inquiry: score,
          compat_reasons: { reasons, evaluated_at: new Date().toISOString() },
        })
        .eq('thread_id', ctx.threadId)
        .is('compat_score_at_inquiry', null);
    }

    // ── Trust check (fail-closed: an errored read = cannot clear the lead) ─
    let trustFlagged: boolean | null = null;
    try {
      const { count, error } = await admin
        .from('integrity_flags')
        .select('*', { count: 'exact', head: true })
        .eq('kind', 'inquiry_concentration')
        .eq('subject_vendor_id', ctx.vendorProfileId)
        .eq('status', 'open');
      trustFlagged = error ? null : (count ?? 0) > 0;
    } catch {
      trustFlagged = null;
    }

    // ── Daily auto-accept cap (separate counter from the reply cap) ───────
    const { count: acceptsToday } = await admin
      .from('vendor_bot_replies')
      .select('*', { count: 'exact', head: true })
      .eq('vendor_profile_id', ctx.vendorProfileId)
      .eq('action', 'auto_accept')
      .gte('created_at', startOfManilaDayIso());

    // ── Token availability probe (read-only — the RPC stays the enforcer) ─
    // Reads the SAME sources unlock_vendor_event_hold reserves against for the
    // founder draw (the bot acts for the shop, so the store wallet pays):
    // earned+purchased MINUS the founder's outstanding held tokens, vs the
    // region burn band. A probe that over-estimates is harmless — the RPC
    // re-checks and raises, which fails closed to manual.
    const tokenAvailable = tierEligible
      ? await probeTokenAvailability(admin, {
          vendorProfileId: ctx.vendorProfileId,
          founderUserId,
          region: typeof ctx.eventRow?.region === 'string' ? (ctx.eventRow.region as string) : null,
        })
      : false;

    const decision: AutoAcceptDecision = evaluateAutoAccept({
      flagEnabled: vendorAutoReplyEnabled(),
      config: ctx.config
        ? {
            autoAcceptEnabled: ctx.config.autoAcceptEnabled,
            threshold: ctx.config.autoAcceptThreshold,
            dailyCap: ctx.config.dailyAutoAcceptCap,
          }
        : null,
      inquiryStatus: ctx.inquiryStatus,
      compatScore: score,
      trustFlagged,
      tierEligible,
      tokenAvailable,
      autoAcceptsToday: acceptsToday ?? 0,
    });

    if (!decision.accept) {
      // NO-TOKEN path: no hold — never silently burn or borrow — but flag the
      // waiting high-compat lead for the vendor (audit stamp on the thread;
      // the % itself is already snapshotted above).
      if (decision.flagWaitingLead) {
        await admin
          .from('chat_threads')
          .update({
            compat_reasons: {
              reasons,
              auto_accept_skipped: 'no_token',
              evaluated_at: new Date().toISOString(),
            },
          })
          .eq('thread_id', ctx.threadId);
      }
      return;
    }

    // ── Place the hold — the settlement stream's RPC, consumed AS-IS ──────
    const held = await placeHoldViaRpc(admin, ctx);
    if (!held) return; // fail-closed: manual flow unchanged

    // ── Flip pending → accepted (guarded — a racing human accept wins) ────
    const { data: flipped, error: flipError } = await admin
      .from('chat_threads')
      .update({ inquiry_status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('thread_id', ctx.threadId)
      .eq('inquiry_status', 'pending')
      .select('thread_id');
    if (flipError || !flipped || flipped.length === 0) return;

    // ── Welcome message (AI-labelled) + the auto_accept log row ───────────
    const { data: welcome, error: welcomeError } = await admin
      .from('chat_messages')
      .insert({
        thread_id: ctx.threadId,
        event_id: ctx.eventId,
        vendor_profile_id: ctx.vendorProfileId,
        sender_user_id: null,
        sender_role: 'vendor',
        is_bot: true,
        body: buildAutoAcceptWelcome(ctx.businessName, reasons).slice(0, MAX_BODY),
      })
      .select('message_id')
      .single();
    if (welcomeError) {
      console.error('[vendor-autoreply] auto-accept welcome insert failed:', welcomeError.message);
    }

    const { error: logError } = await admin.from('vendor_bot_replies').insert({
      vendor_profile_id: ctx.vendorProfileId,
      thread_id: ctx.threadId,
      message_id: (welcome?.message_id as string | undefined) ?? null,
      intent: null,
      confidence: null,
      action: 'auto_accept',
      was_llm: false,
      compat_score: score,
    });
    if (logError) {
      // The accept already happened; a missing log row only under-counts the
      // cap. Surface it loudly so it can't rot silently.
      console.error('[vendor-autoreply] auto_accept log insert failed:', logError.message);
    }
  } catch (err) {
    // FAIL-CLOSED — auto-accept is best-effort; the manual flow is untouched.
    console.error('[vendor-autoreply] maybeAutoAccept failed (non-fatal):', err);
  }
}

/**
 * unlock_vendor_event_hold, consumed as-is via the admin client. Returns true
 * when a hold was placed OR the (vendor,event) was already unlocked (the RPC's
 * idempotent `already:true` — nothing more to reserve). Any error → false
 * (fail-closed). See the header note: under today's auth.uid()-gated RPC body
 * a service-role call raises FORBIDDEN, so this seam is where the settlement
 * stream's future bot-callable variant plugs in.
 */
async function placeHoldViaRpc(admin: SupabaseClient, ctx: AutoAcceptContext): Promise<boolean> {
  try {
    const { data, error } = await admin.rpc('unlock_vendor_event_hold' as never, {
      p_vendor_profile_id: ctx.vendorProfileId,
      p_event_id: ctx.eventId,
      p_thread_id: ctx.threadId,
    } as never);
    if (error) {
      console.warn('[vendor-autoreply] auto-accept hold RPC refused:', error.message);
      return false;
    }
    const result = data as { held?: boolean; already?: boolean } | null;
    return result?.held === true || result?.already === true;
  } catch (e) {
    console.warn('[vendor-autoreply] auto-accept hold RPC failed:', e);
    return false;
  }
}

/**
 * Read-only availability probe over the same balance sources the hold RPC
 * reserves against (founder draw): vendor_wallets.earned+purchased MINUS the
 * founder's outstanding 'held' tokens, compared to the event-region burn band.
 * Returns null on any read error (→ token_unknown, fail-closed upstream).
 * Deliberately NOT re-implementing enforcement — a stale/optimistic probe just
 * means the RPC raises INSUFFICIENT_WALLET_BALANCES and we fall back to manual.
 */
async function probeTokenAvailability(
  admin: SupabaseClient,
  args: { vendorProfileId: string; founderUserId: string | null; region: string | null },
): Promise<boolean | null> {
  try {
    if (!args.founderUserId) return null;

    const needed = await resolveBurnBand(admin, args.region);

    const { data: wallet, error: walletError } = await admin
      .from('vendor_wallets')
      .select('earned_tokens,purchased_tokens')
      .eq('vendor_id', args.vendorProfileId)
      .maybeSingle();
    if (walletError) return null;
    const available =
      Number(wallet?.earned_tokens ?? 0) + Number(wallet?.purchased_tokens ?? 0);

    const { data: holds, error: holdsError } = await admin
      .from('lead_token_holds')
      .select('tokens')
      .eq('vendor_profile_id', args.vendorProfileId)
      .eq('holder_user_id', args.founderUserId)
      .eq('status', 'held');
    if (holdsError) return null;
    const heldSum = (holds ?? []).reduce(
      (sum: number, h: { tokens?: number | null }) => sum + Number(h.tokens ?? 0),
      0,
    );

    return available - heldSum >= needed;
  } catch {
    return null;
  }
}

/**
 * events.region → regions.burn_band, mirroring the RPC's slug/psgc/alias
 * resolution (default band 1, like the RPC). Probe-only: a mis-resolved band
 * can only make the probe optimistic, which the RPC then corrects.
 */
async function resolveBurnBand(admin: SupabaseClient, region: string | null): Promise<number> {
  const norm = (region ?? '').trim().toLowerCase();
  // PostgREST or() filters are comma/paren-delimited — skip the lookup for
  // values that could break the filter syntax and take the default band.
  if (!norm || !/^[a-z0-9 _-]+$/.test(norm)) return 1;
  try {
    const { data: direct } = await admin
      .from('regions')
      .select('burn_band')
      .or(`slug.ilike.${norm},psgc_code.ilike.${norm}`)
      .limit(1)
      .maybeSingle();
    if (direct?.burn_band != null) return Number(direct.burn_band) || 1;
    const { data: aliased } = await admin
      .from('regions')
      .select('burn_band')
      .contains('aliases', [norm])
      .limit(1)
      .maybeSingle();
    if (aliased?.burn_band != null) return Number(aliased.burn_band) || 1;
  } catch {
    // fall through to the default
  }
  return 1;
}
