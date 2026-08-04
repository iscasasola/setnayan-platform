import type { SupabaseClient } from '@supabase/supabase-js';
import { appendLedger } from '@/lib/ledger';
import {
  orderMayProvisionVendorTarget,
  vendorTargetRefusalMessage,
} from '@/lib/vendor-target-ownership';
import { activateConcierge } from '@/app/dashboard/(account)/profile/concierge/actions';
import { branchIdFromServiceKey } from '@/lib/vendor-branches';
import { chargeIdFromBookingFeeLockServiceKey } from '@/lib/booking-fee-lock';
import { settleBookingFeeCharge } from '@/lib/booking-fee-charge';
import {
  seatServiceKey,
  vendorProfileIdFromSeatServiceKey,
  extraSeatsFromPaidCount,
} from '@/lib/vendor-seats';
import {
  vendorProfileIdFromCustomPlanServiceKey,
  selectActivatableCustomPlan,
} from '@/lib/vendor-custom-catalog';
import { BUNDLE_CHILD_SKUS, eventSkuActive } from '@/lib/entitlements';
import { provisionPapicSeatsAdmin } from '@/lib/papic-seats';
import { papicPassPointsForSku } from '@/lib/papic-pass-tiers';
import { PAPIC_ONE_50_SKU, PAPIC_ONE_100_SKU } from '@/lib/papic-one';
import {
  provisionPanoodCamerasAdmin,
  panoodCameraCapForSku,
} from '@/lib/panood-camera-seats';
import {
  VENDOR_AI_ADDON_SKU_CODE,
  isVendorAiAddonActive,
  nextVendorAiAddonExpiry,
} from '@/lib/vendor-addon-pricing';
import {
  VENDOR_3D_BOOTH_SKU_CODE,
  nextVendor3dBoothExpiry,
} from '@/lib/vendor-3d-booth-pricing';
import { VENDOR_PHOTO_CHALLENGE_SKU_CODE } from '@/lib/vendor-photo-challenge';
import { VENDOR_DEEP_SEARCH_SKU_CODE } from '@/lib/vendor-deep-search-addon';
import { resolveAddonDeactivationExpiry } from '@/lib/vendor-addon-deactivation';
import { type VendorTier } from '@/lib/vendor-tier-caps';
import { isVendorAddonTieredPricingEnabled } from '@/lib/vendor-addon-tiered-pricing-flag';
import { isVendorAiLadderEnabled } from '@/lib/vendor-ai-ladder-flag';
import {
  VENDOR_AI_ADVANCED_SKU_CODE,
  nextVendorAiLevel,
  vendorAiLevelForServiceKey,
} from '@/lib/vendor-ai-level';
import {
  vendorAddonActivationAllowed,
  vendorAddonActivationBlockedReason,
} from '@/lib/vendor-addon-activation-gate';
import * as Sentry from '@sentry/nextjs';
import {
  runAndRecordVendorDeepSearch,
  buildVendorDeepSearchInputs,
} from '@/lib/vendor-deep-search-run';

/**
 * apps/web/lib/sku-activation.ts
 *
 * Per-SKU activation dispatcher. After admin approvePayment flips an order to
 * 'paid', SOME SKUs need a side effect to actually unlock the capability
 * (Setnayan AI boolean, concierge state machine, vendor branch flag, Papic seat
 * provisioning, and — PR4 — Custom-QR seat-pass QR publication). MOST SKUs need
 * nothing: ownership is read straight off orders.status by checkOrderOwnership(),
 * so their entry is a no-op.
 *
 * CONTRACT (do not break):
 *   • Every hook is NON-FATAL. activateOrderSku NEVER throws. The order is
 *     already 'paid' + payment 'matched' before this runs; a failed activation
 *     leaves a recoverable state (admin re-runs / flips the row manually) but
 *     MUST NOT roll back the approval.
 *   • Hooks are idempotent (re-running on a re-approved order is safe).
 *   • The dispatcher map is Object.frozen — new hooks (e.g. PR4's CUSTOM_QR_GUEST
 *     seat-pass gating SKU) are added by editing THIS file's map, never approvePayment.
 *   • Default (unmatched service_key) = no-op. New couple SKUs activate purely
 *     via orders.status with no entry here.
 */

export type ActivationContext = {
  admin: SupabaseClient;
  orderId: string;
  eventId: string | null;
  serviceKey: string;
  actorUserId: string;
};

type ActivationHook = (ctx: ActivationContext) => Promise<void>;

/**
 * S2 defence-in-depth — re-assert a vendor add-on's tier + verification gate AT
 * ACTIVATION TIME, on the paying vendor. The buy actions gate this before an
 * order is created, but a comp / self-comp / directly-inserted order can reach
 * activation WITHOUT that gate. Re-checking here means a paid-but-ineligible
 * order (sub-tier or unverified — e.g. a self-comp bypass, or a vendor who
 * downgraded between buy and approval) never provisions the feature. Throws so
 * the dispatcher's outer catch logs + Sentry-reports it and the order stays
 * recoverable (admin can refund). Reads tier_state + verification_state with the
 * admin client (RLS-bypassed).
 *
 * ⚠ `allTiersAllowed` — pass TRUE for an add-on whose BUY path is open to every
 * tier, and the TIER half of this assertion is skipped (verification still
 * required, always). Under the 2026-07-25 tiered add-on model the Papic Challenge
 * (#3692/#3697) and 3D Plan Ads (#3699) buy actions sell to Free/Solo at the entry
 * price; without this, that vendor pays and then activation THROWS here on admin
 * approval — money taken, entitlement never granted. The tier floor must move in
 * lock-step with the buy gate, so both read the same
 * `isVendorAddonTieredPricingEnabled()` switch.
 *
 * This is also why tier is the RIGHT half to relax and verification is not: the
 * price band was fixed when the order was created, so a tier that changes during
 * the 24-hr approval window must not retroactively void a paid entitlement —
 * whereas losing verification genuinely should block provisioning.
 */
async function assertVendorAddonActivationEligible(
  ctx: ActivationContext,
  vendorProfileId: string,
  minTier: VendorTier,
  allTiersAllowed = false,
): Promise<void> {
  const { data: gate } = await ctx.admin
    .from('vendor_profiles')
    .select('tier_state, verification_state')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  const tier = (gate as { tier_state?: string | null } | null)?.tier_state ?? null;
  const verification =
    (gate as { verification_state?: string | null } | null)?.verification_state ?? null;
  const verdict = { tier, verification, minTier, allTiersAllowed };
  if (!vendorAddonActivationAllowed(verdict)) {
    throw new Error(
      `vendor add-on activation blocked: ${ctx.serviceKey} ` +
        vendorAddonActivationBlockedReason(verdict),
    );
  }
}

/**
 * Stamp a 365-day access window on the order (owner 2026-07-10 · the ₱999/yr
 * Custom Subdomain SKUs). Mirrors the vendor-branch add-on hook: `orders.expires_at`
 * is the billing window read by the resolver RPC (resolve_event_subdomain) and the
 * renewal-reminder cron. Billed as a manual prepaid annual block — no auto-charge;
 * the gateway webhook will later call this same seam on `payment.succeeded`.
 * Idempotent: a re-approval re-stamps the same now+365d window; a genuine renewal
 * extends access from the new approval. (Function declaration → hoisted, so the
 * frozen EXACT_HOOKS map below can reference it.)
 */
async function stampAnnualSubscriptionWindow(ctx: ActivationContext): Promise<void> {
  const now = Date.now();
  const expiresAt = new Date(now + 365 * 24 * 60 * 60 * 1000).toISOString();
  await ctx.admin
    .from('orders')
    .update({ expires_at: expiresAt, updated_at: new Date(now).toISOString() })
    .eq('order_id', ctx.orderId);
  await appendLedger(ctx.admin, {
    order_id: ctx.orderId,
    event_type: 'service_activated',
    actor_user_id: ctx.actorUserId,
    actor_role: 'admin',
    metadata: { service_key: ctx.serviceKey, expires_at: expiresAt },
  });
}

/**
 * Papic POOL — grant a purchased top-up into the SHARED event capture pool.
 *
 * The couple bought N shots; this is where N becomes real. ONE row into
 * papic_event_point_grants (source 'topup_order', order_id set, seat_id LEFT
 * NULL — that is what makes it shared), which lib/papic-event-pool.ts sums into
 * the pool total. Papic ONE is the other half of the two-type model and takes
 * the seat-scoped path in grantPapicCameraPoints below.
 *
 * IDEMPOTENT BY order_id — a re-approved order must never double-grant, and the
 * grants ledger is additive with no unique constraint to lean on, so the guard
 * is an explicit pre-read. (Function declaration → hoisted, so the frozen
 * EXACT_HOOKS map below can reference it.)
 *
 * NON-FATAL per the dispatcher contract: a failure here leaves a paid order with
 * no points, which an admin can re-run — it must never roll back the approval.
 */
async function grantPapicPassPoints(ctx: ActivationContext): Promise<void> {
  if (!ctx.eventId) return;
  const eventId = ctx.eventId;
  try {
    const points = await papicPassPointsForSku(ctx.admin, ctx.serviceKey);
    if (points === null || points <= 0) return;

    const { data: existing } = await ctx.admin
      .from('papic_event_point_grants')
      .select('grant_id')
      .eq('order_id', ctx.orderId)
      .limit(1);
    if (Array.isArray(existing) && existing.length > 0) return;

    const { error } = await ctx.admin.from('papic_event_point_grants').insert({
      event_id: eventId,
      points,
      source: 'topup_order',
      order_id: ctx.orderId,
      note: `Papic Pool · ${ctx.serviceKey}`,
    });
    if (error) {
      console.error('[sku-activation] Papic One grant insert failed (non-fatal):', {
        order_id: ctx.orderId,
        service_key: ctx.serviceKey,
        error: error.message,
      });
      reportActivationFault('activate:papic_points_insert', ctx, error);
      return;
    }

    await appendLedger(ctx.admin, {
      order_id: ctx.orderId,
      event_type: 'service_activated',
      actor_user_id: ctx.actorUserId,
      actor_role: 'admin',
      metadata: { service_key: ctx.serviceKey, event_id: eventId, points_granted: points },
    });
  } catch (e) {
    console.error('[sku-activation] Papic One grant threw (non-fatal):', e);
    reportActivationFault('activate:papic_points', ctx, e);
  }
}

/**
 * Papic ONE — grant a purchased bucket DEDICATED to one camera (owner-locked
 * 2026-07-29: 50 pts ₱50 · 100 pts ₱100, per camera, reloadable, no cap).
 *
 * Delegates to the SQL engine papic_grant_camera_points, which resolves the
 * order shape itself so this hook stays the single conversion point for all
 * three One service_keys:
 *   • a papic_one_orders row → grant its snapshotted points to ITS camera. Same
 *     path for a NEW camera and for a RELOAD of one that already exists, which
 *     is what lets a couple add shots mid-event without reissuing a QR.
 *   • no such row → a legacy multi-camera PAPIC_CAMERAS order: the ₱50 rung's
 *     points to each mini seat of that order.
 * Every shape writes seat-scoped grants, and papic_event_pool_status counts only
 * seat_id IS NULL rows — so a One camera's shots stay unshared.
 *
 * Idempotent by order_id (a re-approval never double-grants) and repeatable
 * across DISTINCT orders. Reversal is symmetric via reversePapicPassPoints
 * (deletes every grant by order_id, regardless of source).
 *
 * NON-FATAL per the dispatcher contract: a failure leaves a paid order with no
 * points, which an admin can re-run — it must never roll back the approval.
 * (Function declaration → hoisted, so the frozen EXACT_HOOKS map can reference it.)
 */
async function grantPapicCameraPoints(ctx: ActivationContext): Promise<void> {
  if (!ctx.eventId) return;
  try {
    const { error } = await ctx.admin.rpc('papic_grant_camera_points', {
      p_event_id: ctx.eventId,
      p_order_id: ctx.orderId,
    });
    if (error) {
      console.error('[sku-activation] Papic One camera grant failed (non-fatal):', {
        order_id: ctx.orderId,
        error: error.message,
      });
      reportActivationFault('activate:papic_camera_grant_rpc', ctx, error);
      return;
    }
    await appendLedger(ctx.admin, {
      order_id: ctx.orderId,
      event_type: 'service_activated',
      actor_user_id: ctx.actorUserId,
      actor_role: 'admin',
      metadata: {
        service_key: ctx.serviceKey,
        event_id: ctx.eventId,
        kind: 'papic_camera_grant',
      },
    });
  } catch (e) {
    console.error('[sku-activation] Papic One camera grant threw (non-fatal):', e);
    reportActivationFault('activate:papic_camera_grant', ctx, e);
  }
}

/**
 * Papic One — reverse a purchased point grant when an order is un-approved.
 *
 * Symmetric to grantPapicPassPoints. Deletes by order_id (idempotent, and a
 * no-op for every non-Papic SKU because no grant carries that order_id).
 * Non-fatal: a failure leaves points a refunded couple should not have, which an
 * admin can clear — it must never block the reversal itself.
 */
async function reversePapicPassPoints(ctx: ActivationContext): Promise<void> {
  try {
    const { data, error } = await ctx.admin
      .from('papic_event_point_grants')
      .delete()
      .eq('order_id', ctx.orderId)
      .select('grant_id, points');
    if (error) {
      console.error('[sku-activation] Papic One grant reversal failed (non-fatal):', {
        order_id: ctx.orderId,
        error: error.message,
      });
      return;
    }
    if (!Array.isArray(data) || data.length === 0) return;

    const revoked = data.reduce(
      (sum, r) => sum + (typeof r.points === 'number' ? r.points : 0),
      0,
    );
    await appendLedger(ctx.admin, {
      order_id: ctx.orderId,
      event_type: 'order_refunded',
      actor_user_id: ctx.actorUserId,
      actor_role: 'admin',
      metadata: {
        service_key: ctx.serviceKey,
        event_id: ctx.eventId,
        points_revoked: revoked,
      },
    });
  } catch (e) {
    console.error('[sku-activation] Papic One grant reversal threw (non-fatal):', e);
  }
}

/**
 * Vendor AI ("the AI Chatbot") add-on — activate a paid 28-day cycle on
 * approval (owner 2026-07-22). The FREE first cycle activates DIRECTLY in the
 * buy action (an atomic trial claim); this hook is the PAID-renewal path.
 *
 * Reads the paying vendor off the order (orders.vendor_profile_id), stamps a
 * fresh 28-day entitlement window on vendor_profiles.ai_addon_expires_at
 * (stacking from the later of now / current expiry so an early re-up keeps the
 * remaining time), and — defensively — marks the one-time trial used if a paid
 * order somehow lands with it still NULL.
 *
 * IDEMPOTENT via a prior 'service_activated' ledger row for this order, so a
 * re-approval never double-extends the window.
 * Throws only on the write so activateOrderSku's outer catch logs + the order
 * stays 'paid' (recoverable). (Function declaration → hoisted so the frozen
 * EXACT_HOOKS map below can reference it.)
 */
async function activateVendorAiAddonOrder(ctx: ActivationContext): Promise<void> {
  // (1) Idempotency — already activated this order?
  const { data: prior } = await ctx.admin
    .from('order_ledger')
    .select('order_id')
    .eq('order_id', ctx.orderId)
    .eq('event_type', 'service_activated')
    .limit(1)
    .maybeSingle();
  if (prior) return;

  // (2) The paying vendor is on the order.
  const { data: order } = await ctx.admin
    .from('orders')
    .select('vendor_profile_id')
    .eq('order_id', ctx.orderId)
    .maybeSingle();
  const vendorProfileId =
    (order as { vendor_profile_id?: string | null } | null)?.vendor_profile_id ?? null;
  if (!vendorProfileId) return;

  // (2b) S2 — re-assert Solo+ & verified on the paying vendor (defence in depth).
  await assertVendorAddonActivationEligible(ctx, vendorProfileId, 'solo');

  // (3) Current window + trial marker → the new (stacked) expiry.
  // ⚠ `ai_addon_level` is named ONLY when the ladder flag is on. PostgREST
  // answers a select naming an unknown column with 42703 and nulls the WHOLE
  // row, so an environment that has not yet received migration 20271003111715
  // must never see the column in a query — that would blank the profile and
  // silently skip the activation below.
  const ladder = isVendorAiLadderEnabled();
  const { data: vp } = await ctx.admin
    .from('vendor_profiles')
    .select(
      ladder
        ? 'ai_addon_expires_at, ai_addon_trial_used_at, ai_addon_level'
        : 'ai_addon_expires_at, ai_addon_trial_used_at',
    )
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  const currentExpiry =
    (vp as { ai_addon_expires_at?: string | null } | null)?.ai_addon_expires_at ?? null;
  const trialUsedAt =
    (vp as { ai_addon_trial_used_at?: string | null } | null)?.ai_addon_trial_used_at ?? null;
  const newExpiry = nextVendorAiAddonExpiry(currentExpiry, Date.now());

  const update: Record<string, unknown> = { ai_addon_expires_at: newExpiry };
  // A paid order always means the trial already ran, but never leave it NULL
  // (that would hand a paid vendor a second "free" cycle).
  if (!trialUsedAt) update.ai_addon_trial_used_at = new Date().toISOString();

  // Ladder: stamp which LEVEL this window now grants. Derived from the ORDER'S
  // service_key (server-side, never client input) and merged with the current
  // level via nextVendorAiLevel, which takes the HIGHER rung — buying Advanced
  // mid-cycle promotes, and buying Basic while already Advanced must not demote
  // a vendor who paid more. Only ever written here and in the free-cycle claim,
  // both service-role; vendor self-writes are blocked by
  // trg_guard_vendor_profiles_entitlement.
  if (ladder) {
    // ⚠ Carry the existing rung forward ONLY while the window is still LIVE.
    //
    // nextVendorAiLevel takes the HIGHER rung so a Basic re-up mid-cycle cannot
    // strip Advanced time the vendor already paid for. That is right INSIDE a
    // live window and WRONG across a lapse: the marker is never cleared on lapse
    // (expiry is evaluated at read time, there is no cron), so a stale
    // 'advanced' would otherwise re-arm on the next BASIC purchase — buy
    // Advanced once, then renew on Basic forever (~₱1,000/cycle × 13/yr).
    // A lapsed rung is SPENT: pass null and let this purchase decide the level.
    const windowLive = isVendorAiAddonActive(currentExpiry);
    const currentLevel = windowLive
      ? ((vp as { ai_addon_level?: string | null } | null)?.ai_addon_level ?? null)
      : null;
    update.ai_addon_level = nextVendorAiLevel(
      currentLevel,
      vendorAiLevelForServiceKey(ctx.serviceKey),
    );
  }

  const { error } = await ctx.admin
    .from('vendor_profiles')
    .update(update)
    .eq('vendor_profile_id', vendorProfileId);
  if (error) throw new Error(`vendor_ai_addon activation write failed: ${error.message}`);

  // Stamp the order's own billing window so the renewal-reminder job
  // (subscriptions_due_for_renewal_reminder reads orders.expires_at) mails this
  // vendor before the add-on lapses — mirrors the branch/subdomain add-on hooks.
  // Best-effort (the entitlement window on vendor_profiles is the load-bearing
  // one); a missed stamp only skips a reminder, never the feature.
  await ctx.admin
    .from('orders')
    .update({ expires_at: newExpiry, updated_at: new Date().toISOString() })
    .eq('order_id', ctx.orderId);

  await appendLedger(ctx.admin, {
    order_id: ctx.orderId,
    event_type: 'service_activated',
    actor_user_id: ctx.actorUserId,
    actor_role: 'admin',
    metadata: {
      service_key: ctx.serviceKey,
      vendor_profile_id: vendorProfileId,
      ai_addon_expires_at: newExpiry,
    },
  });
}

/**
 * 3D Booth add-on — activate a paid 28-day cycle on approval (owner 2026-07-22).
 * The FREE first cycle activates DIRECTLY in the buy action (an atomic trial
 * claim); this hook is the PAID-renewal path. Mirrors activateVendorAiAddonOrder
 * exactly — same window shape, on vendor_profiles.booth_addon_expires_at.
 *
 * Reads the paying vendor off the order (orders.vendor_profile_id), stamps a
 * fresh 28-day entitlement window (stacking from the later of now / current
 * expiry so an early re-up keeps the remaining time), and — defensively — marks
 * the one-time trial used if a paid order somehow lands with it still NULL.
 *
 * IDEMPOTENT via a prior 'service_activated' ledger row for this order (same
 * guard as the AI add-on), so a re-approval never double-extends the window.
 * Throws only on the write so activateOrderSku's outer catch logs + the order
 * stays 'paid' (recoverable). (Function declaration → hoisted so the frozen
 * EXACT_HOOKS map below can reference it.)
 */
async function activateVendor3dBoothOrder(ctx: ActivationContext): Promise<void> {
  // (1) Idempotency — already activated this order?
  const { data: prior } = await ctx.admin
    .from('order_ledger')
    .select('order_id')
    .eq('order_id', ctx.orderId)
    .eq('event_type', 'service_activated')
    .limit(1)
    .maybeSingle();
  if (prior) return;

  // (2) The paying vendor is on the order.
  const { data: order } = await ctx.admin
    .from('orders')
    .select('vendor_profile_id')
    .eq('order_id', ctx.orderId)
    .maybeSingle();
  const vendorProfileId =
    (order as { vendor_profile_id?: string | null } | null)?.vendor_profile_id ?? null;
  if (!vendorProfileId) return;

  // (2b) S2 — re-assert Pro+ & verified on the paying vendor (booth branding is a
  // Pro perk; defence in depth against a comp/self-comp bypass). The tier floor
  // LIFTS in lock-step with the buy gate (#3699 sells 3D Plan Ads to every tier
  // when the tiered add-on model is on) — otherwise a Free/Solo vendor pays and
  // this throws on approval. Verified is still required either way.
  await assertVendorAddonActivationEligible(
    ctx,
    vendorProfileId,
    'pro',
    isVendorAddonTieredPricingEnabled(),
  );

  // (3) Current window + trial marker → the new (stacked) expiry.
  const { data: vp } = await ctx.admin
    .from('vendor_profiles')
    .select('booth_addon_expires_at, booth_addon_trial_used_at')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  const currentExpiry =
    (vp as { booth_addon_expires_at?: string | null } | null)?.booth_addon_expires_at ?? null;
  const trialUsedAt =
    (vp as { booth_addon_trial_used_at?: string | null } | null)?.booth_addon_trial_used_at ?? null;
  const newExpiry = nextVendor3dBoothExpiry(currentExpiry, Date.now());

  const update: Record<string, unknown> = { booth_addon_expires_at: newExpiry };
  // A paid order always means the trial already ran, but never leave it NULL
  // (that would hand a paid vendor a second "free" cycle).
  if (!trialUsedAt) update.booth_addon_trial_used_at = new Date().toISOString();

  const { error } = await ctx.admin
    .from('vendor_profiles')
    .update(update)
    .eq('vendor_profile_id', vendorProfileId);
  if (error) throw new Error(`vendor_3d_booth activation write failed: ${error.message}`);

  // Stamp the order's own billing window so the renewal-reminder job
  // (subscriptions_due_for_renewal_reminder reads orders.expires_at) mails this
  // vendor before the add-on lapses — mirrors the branch/subdomain add-on hooks.
  await ctx.admin
    .from('orders')
    .update({ expires_at: newExpiry, updated_at: new Date().toISOString() })
    .eq('order_id', ctx.orderId);

  await appendLedger(ctx.admin, {
    order_id: ctx.orderId,
    event_type: 'service_activated',
    actor_user_id: ctx.actorUserId,
    actor_role: 'admin',
    metadata: {
      service_key: ctx.serviceKey,
      vendor_profile_id: vendorProfileId,
      booth_addon_expires_at: newExpiry,
    },
  });
}

/**
 * Photo Challenge add-on — write the per-(vendor,event) sponsorship entitlement
 * on approval (owner 2026-07-22). ₱400 / event, no free cycle (unlike the AI
 * add-on): every approved order is a paid sponsorship. The row is what the
 * papic_create_vendor_challenge RPC requires before a booked Pro/Enterprise
 * vendor may author a challenge for the event.
 *
 * Reads the paying vendor + event off the order and upserts one
 * papic_photo_challenge_sponsorships row. IDEMPOTENT two ways: a prior
 * 'service_activated' ledger row for this order short-circuits, and the
 * (event_id, vendor_profile_id) UNIQUE + ignoreDuplicates upsert means a
 * re-approval (or a second order that slipped past the buy-action guard) never
 * duplicates or errors. Throws only on the write so activateOrderSku's outer
 * catch logs it + the order stays 'paid' (recoverable). (Function declaration →
 * hoisted, so the frozen EXACT_HOOKS map below can reference it.)
 */
async function activatePhotoChallengeSponsorship(ctx: ActivationContext): Promise<void> {
  if (!ctx.eventId) return; // a sponsorship is per-event; no event → nothing to grant
  const eventId = ctx.eventId;

  // (1) Idempotency — already activated this order?
  const { data: prior } = await ctx.admin
    .from('order_ledger')
    .select('order_id')
    .eq('order_id', ctx.orderId)
    .eq('event_type', 'service_activated')
    .limit(1)
    .maybeSingle();
  if (prior) return;

  // (2) The paying vendor is on the order.
  const { data: order } = await ctx.admin
    .from('orders')
    .select('vendor_profile_id')
    .eq('order_id', ctx.orderId)
    .maybeSingle();
  const vendorProfileId =
    (order as { vendor_profile_id?: string | null } | null)?.vendor_profile_id ?? null;
  if (!vendorProfileId) return;

  // (2b) S2 — re-assert Pro+ & verified on the paying vendor (defence in depth).
  // The tier floor LIFTS in lock-step with the buy gate (#3692/#3697 sell Papic
  // Challenges to every tier when the tiered add-on model is on) — otherwise a
  // Free/Solo vendor pays ₱500 and this throws on approval, taking their money
  // without granting the sponsorship. Verified is still required either way.
  await assertVendorAddonActivationEligible(
    ctx,
    vendorProfileId,
    'pro',
    isVendorAddonTieredPricingEnabled(),
  );

  // (3) Upsert the entitlement. ignoreDuplicates → INSERT … ON CONFLICT
  //     (event_id, vendor_profile_id) DO NOTHING: a vendor holds at most one
  //     sponsorship per event, so a re-approval / duplicate order is a no-op.
  const { error } = await ctx.admin.from('papic_photo_challenge_sponsorships').upsert(
    {
      event_id: eventId,
      vendor_profile_id: vendorProfileId,
      order_id: ctx.orderId,
    },
    { onConflict: 'event_id,vendor_profile_id', ignoreDuplicates: true },
  );
  if (error) {
    throw new Error(`vendor_photo_challenge activation write failed: ${error.message}`);
  }

  await appendLedger(ctx.admin, {
    order_id: ctx.orderId,
    event_type: 'service_activated',
    actor_user_id: ctx.actorUserId,
    actor_role: 'admin',
    metadata: {
      service_key: ctx.serviceKey,
      vendor_profile_id: vendorProfileId,
      event_id: eventId,
    },
  });
}

/**
 * Deep Search (vendor-facing) — on approval of a ₱500 apply-then-pay order, RUN
 * the web-research deep search on the paying vendor's OWN business and record it
 * (owner 2026-07-22). Pay-then-run: there is no pre-paid credit ledger to draw
 * from, so the paid run happens HERE, at approval, reusing the same engine +
 * store as the free-search run action (runAndRecordVendorDeepSearch, was_free=
 * false). The resulting dossier is what the vendor's Deep Search surface renders.
 *
 * Reads the paying vendor + user off the order, snapshots their current profile
 * facts, and runs. IDEMPOTENT two ways: a prior 'service_activated' ledger row
 * for this order short-circuits, and a UNIQUE(order_id) partial index on
 * vendor_deep_search_uses stops a rare re-run from double-counting the paid run.
 * Throws only when the run FAILS so activateOrderSku's outer catch logs it and
 * the order stays 'paid' (recoverable — a re-approval, seeing no ledger row,
 * re-runs). (Function declaration → hoisted, so the frozen EXACT_HOOKS map below
 * can reference it.)
 */
async function activateVendorDeepSearchOrder(ctx: ActivationContext): Promise<void> {
  // (1) Idempotency — already activated this order?
  const { data: prior } = await ctx.admin
    .from('order_ledger')
    .select('order_id')
    .eq('order_id', ctx.orderId)
    .eq('event_type', 'service_activated')
    .limit(1)
    .maybeSingle();
  if (prior) return;

  // (2) The paying vendor + user are on the order.
  const { data: order } = await ctx.admin
    .from('orders')
    .select('vendor_profile_id, user_id')
    .eq('order_id', ctx.orderId)
    .maybeSingle();
  const vendorProfileId =
    (order as { vendor_profile_id?: string | null } | null)?.vendor_profile_id ?? null;
  const requestedByUserId = (order as { user_id?: string | null } | null)?.user_id ?? null;
  if (!vendorProfileId) return;

  // (2b) S2 — re-assert Solo+ & verified on the paying vendor BEFORE the costly
  // web+AI run (defence in depth against a comp/self-comp bypass).
  await assertVendorAddonActivationEligible(ctx, vendorProfileId, 'solo');

  // (3) Snapshot the vendor's current business facts → inputs.
  const { data: vp } = await ctx.admin
    .from('vendor_profiles')
    .select('business_name, website, location_city, services, gallery_video_links')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  if (!vp) return;
  const inputs = buildVendorDeepSearchInputs({
    business_name: (vp as { business_name?: string | null }).business_name ?? '',
    website: (vp as { website?: string | null }).website ?? null,
    location_city: (vp as { location_city?: string | null }).location_city ?? null,
    services: (vp as { services?: string[] | null }).services ?? [],
    gallery_video_links: (vp as { gallery_video_links?: string[] | null }).gallery_video_links ?? [],
  });

  // (4) Run + record the paid search (was_free=false, linked to this order).
  const result = await runAndRecordVendorDeepSearch({
    admin: ctx.admin,
    vendorProfileId,
    requestedByUserId,
    inputs,
    wasFree: false,
    orderId: ctx.orderId,
  });
  if (result.status === 'failed') {
    // Throw so the order stays recoverable (no ledger row → a re-approval re-runs).
    throw new Error(`vendor_deep_search run failed: ${result.error}`);
  }

  await appendLedger(ctx.admin, {
    order_id: ctx.orderId,
    event_type: 'service_activated',
    actor_user_id: ctx.actorUserId,
    actor_role: 'admin',
    metadata: {
      service_key: ctx.serviceKey,
      vendor_profile_id: vendorProfileId,
      dossier_id: result.dossierId,
    },
  });
}

// Exact-match hooks keyed by literal service_key.
const EXACT_HOOKS: Readonly<Record<string, ActivationHook>> = Object.freeze({
  // 'vendor_photo_challenge' → Photo Challenge per-event sponsorship (owner
  // 2026-07-22). Writes the papic_photo_challenge_sponsorships entitlement for
  // the paying (vendor, event). See activatePhotoChallengeSponsorship.
  [VENDOR_PHOTO_CHALLENGE_SKU_CODE]: activatePhotoChallengeSponsorship,

  // 'vendor_deep_search' → paid (₱500) vendor Deep Search. Runs the research on
  // approval + records was_free=false (pay-then-run). See
  // activateVendorDeepSearchOrder.
  [VENDOR_DEEP_SEARCH_SKU_CODE]: activateVendorDeepSearchOrder,

  // 'vendor_ai_addon' → paid Vendor AI ("AI Chatbot") 28-day renewal. Stamps
  // the entitlement window on the paying vendor (the free first cycle is
  // direct-activated in the buy action). See activateVendorAiAddonOrder.
  [VENDOR_AI_ADDON_SKU_CODE]: activateVendorAiAddonOrder,
  // Ladder: Advanced shares the SAME hook and the SAME entitlement window — the
  // hook derives which level to stamp from the order's own service_key. A second
  // map entry (rather than a renamed key) keeps every historical order valid.
  [VENDOR_AI_ADVANCED_SKU_CODE]: activateVendorAiAddonOrder,

  // 'vendor_3d_booth' → paid 3D Booth 28-day renewal. Stamps
  // vendor_profiles.booth_addon_expires_at on the paying vendor (the free first
  // cycle is direct-activated in the buy action). See activateVendor3dBoothOrder.
  [VENDOR_3D_BOOTH_SKU_CODE]: activateVendor3dBoothOrder,

  // 'concierge_complete' (TODAYS_FOCUS) → wedding-anchored concierge state machine.
  concierge_complete: async (ctx) => {
    if (!ctx.eventId) return;
    const result = await activateConcierge({
      eventId: ctx.eventId,
      orderId: ctx.orderId,
    });
    if (result.status === 'activated') {
      await appendLedger(ctx.admin, {
        order_id: ctx.orderId,
        event_type: 'service_activated',
        actor_user_id: ctx.actorUserId,
        actor_role: 'admin',
        metadata: {
          service_key: ctx.serviceKey,
          event_id: ctx.eventId,
          concierge_expires_at: result.expiresAt ?? null,
        },
      });
    } else {
      console.warn('[sku-activation] concierge activation blocked by enforcement:', {
        order_id: ctx.orderId,
        event_id: ctx.eventId,
      });
    }
  },

  // 'EVENT_SUBDOMAIN' → the ₱999/yr Custom Subdomain (owner 2026-07-10 · EVENT-only;
  // vendors get no *.setnayan.com host). Stamp a 365-day window on the order; the
  // resolver RPC + renewal cron read `orders.expires_at`. Ownership itself gates the
  // feature (an active paid order) — no separate flag. The subdomain label is the
  // event's existing slug; provisioning ships with the middleware branch.
  EVENT_SUBDOMAIN: async (ctx) => {
    await stampAnnualSubscriptionWindow(ctx);
  },

  // 'SETNAYAN_AI' → flat per-event boolean, idempotent.
  //
  // SETNAYAN_AI is now a ₱499 / 28-day subscription (owner 2026-06-29; was a
  // ₱3,999 one-time unlock). For V1 the entitlement model is UNCHANGED: one
  // approved order flips this per-event flag and the planner is on for the
  // wedding. Pricing.md / migration 20270322883953 only changed the price +
  // the recurrence UNIT; the activation contract is the same boolean.
  //
  // V1.5: a recurring per-28-day charge (until the wedding day, then auto-end)
  // hooks in HERE. On approval, stamp the per-user window
  // `user_ai_subscription.active_until` anchored to events.event_date (the
  // wedding-anchor rule — recorded on that column's comment), gated by
  // platform_settings.setnayan_ai_per_user_enabled (default OFF, foundation in
  // PR #2407), then schedule the next-cycle charge via the provider-run
  // subscription (PayMongo / GCash). Until then the couple pays one term up
  // front via the manual apply-then-pay rails and this boolean is the gate.
  SETNAYAN_AI: async (ctx) => {
    if (!ctx.eventId) return;
    // ── ONE-TIME PER EVENT. NO WINDOW. (owner-locked 2026-07-26) ─────────────
    // "this is per event. no time duration. just one time payment per event."
    //
    // A paid Setnayan AI is a PERMANENT unlock on the event: `setnayan_ai_active`
    // and nothing else. Price varies by event TYPE (₱1,499 wedding · ₱899 debut /
    // corporate / gala · ₱499 standard · ₱99 light · free simple_event) and is
    // resolved server-side at checkout by resolveSetnayanAiTypeChargeCentavos;
    // WHAT they pay is a tier question, HOW LONG they keep it is not.
    //
    // ⚠ WHAT WAS REMOVED, AND WHY IT MATTERED. Behind
    // `setnayan_ai_per_event_pricing_enabled` this hook used to also set
    // `setnayan_ai_intro_used = true` and stamp a 28-day
    // `setnayan_ai_active_until` via extendUserAiSubscription(…, 1, …), so "this
    // event's NEXT purchase is a ₱799 renewal". That belonged to a RETIRED
    // intro/renewal model: `SETNAYAN_AI_RENEW` is is_active=false and its
    // resolver (resolveSetnayanAiEventChargeCentavos) has NO callers — the live
    // charge path is the event-TYPE ladder. So the stamp bought nothing and cost
    // everything: eventOwnsSetnayanAi treats a non-NULL window as AUTHORITATIVE,
    // so a couple paid once and lost AI 28 days later with no way to renew.
    //
    // That is why PR #3035 (mig 20270714262264) turned the flag OFF rather than
    // fixing it — which left the per-event PRICE ladder switched off too, since
    // one flag gated both. Removing the stamp decouples them: the flag now means
    // only "price by event type", and can be turned on safely.
    //
    // Nothing to migrate: 0 events carry a window and 0 have intro_used (verified
    // in prod 2026-07-26). Rows with a NULL window already read as permanent.
    const { error } = await ctx.admin
      .from('events')
      .update({ setnayan_ai_active: true })
      .eq('event_id', ctx.eventId);
    // Surface a write failure so activateOrderSku's outer catch logs it —
    // otherwise the paid AI silently never provisions with no retry signal.
    // Throwing is safe: the order is already 'paid', the dispatcher swallows +
    // logs and never rolls back the approval.
    if (error) throw new Error(`SETNAYAN_AI activation write failed: ${error.message}`);
    // No ledger row and no idempotency probe are needed any more: the write is a
    // plain idempotent boolean set, so a re-approval is a no-op. (The probe only
    // ever existed to stop a second approval adding another 28 days.)
  },

  // 🔒 'SETNAYAN_AI_SUB' HANDLER REMOVED 2026-08-01 — Setnayan AI is PER EVENT.
  //
  // It extended the BUYER's `user_ai_subscription` window by (paid amount ÷ unit
  // price) cycles × 28 days, fanning AI out to every event that user hosted.
  // Owner decision: "it is per event." The table, the flag and this writer are
  // all gone.
  //
  // Nothing is stranded: prod held 0 orders of ANY kind, 0 user_ai_subscription
  // rows and no SETNAYAN_AI_SUB catalog row, so the SKU was never purchasable —
  // the charge path refused it for having no server-resolvable unit price
  // (SEC-7). Its refund counterpart (reverseUserAiSubscriptionOrder) is removed
  // in the same change, so activate/reverse stay symmetric and no order can
  // activate without a matching rollback.

  // 'PAPIC_SEATS' → paid Papic upgrade. Ownership reads off orders.status (no
  // stored unlock flag). On approval the hook PROVISIONS the 5 paparazzi seats
  // so the feature is READY with no manual "Set up your seats" step (owner-locked:
  // the approval IS the activation). provisionPapicSeatsAdmin is idempotent
  // (top-up of missing indexes only) so re-approval / a couple who already
  // self-served via /crew is safe. Best-effort (never throws). Also fires for
  // bundle buyers via activateBundleChildren (Papic is a MEDIA_PACK child).
  PAPIC_SEATS: async (ctx) => {
    if (!ctx.eventId) return;
    const eventId = ctx.eventId;
    // Materialize the seats — the no-manual-step half of the feature.
    try {
      await provisionPapicSeatsAdmin(ctx.admin, eventId);
    } catch (e) {
      console.error('[sku-activation] PAPIC_SEATS seat provisioning threw (non-fatal):', e);
      reportActivationFault('activate:PAPIC_SEATS', ctx, e);
    }
  },

  // Papic POOL — the SHARED, additive top-up rungs (owner-locked 2026-07-29:
  // +3,000 ₱1,000 · +6,000 ₱2,000 · +10,000 ₱3,000). A paid rung grants its
  // points into papic_event_point_grants with seat_id NULL, and the pool sums
  // exactly those rows — so "additive and repeatable" needs no extra machinery,
  // it is just another row. Every rung is repeatable now; the old is_topup gate
  // (only unlockable at 10,000 points held) is cleared by 20271019231590.
  //
  // These are SELF-BOUNDING buckets, deliberately NOT listed in
  // papic_event_pool_config.pass_service_codes (the guest-derived fence for the
  // PAPIC_UNLOCK* bundles). Migration 20270828140000 asserts they stay out of it.
  PAPIC_GUEST: grantPapicPassPoints,
  PAPIC_GUEST_6K: grantPapicPassPoints,
  PAPIC_GUEST_10K: grantPapicPassPoints,
  // Retired 2026-07-29 (catalog + papic_pass_tiers row both deactivated) because
  // every rung is additive now, so a separate "+10,000 top-up" was a duplicate of
  // PAPIC_GUEST_10K. The hook stays wired: an order minted before the retirement
  // must still convert on approval, and the deactivated tier row makes that
  // conversion resolve to ZERO points rather than the retired value.
  PAPIC_GUEST_TOPUP: grantPapicPassPoints,

  // Papic ONE — a DEDICATED camera with its own unshared balance (owner-locked
  // 2026-07-29: 50 pts ₱50 · 100 pts ₱100, per camera, reloadable, no cap).
  //
  // THREE service_keys, ONE hook, on purpose. papic_grant_camera_points resolves
  // the order shape itself — a papic_one_orders row (a single-camera buy OR a
  // reload of a camera that already exists) or a legacy multi-camera
  // PAPIC_CAMERAS order — so the order->points conversion stays single-sourced
  // instead of forking per SKU. Every shape writes seat-scoped grants, which is
  // what keeps a One camera's shots out of the shared pool.
  PAPIC_CAMERAS: grantPapicCameraPoints,
  [PAPIC_ONE_50_SKU]: grantPapicCameraPoints,
  [PAPIC_ONE_100_SKU]: grantPapicCameraPoints,

  // 'PANOOD_SYSTEM' (Desktop) / 'PANOOD_SYSTEM_MOBILE' (Mobile) → paid Live Studio
  // controller. On approval, PROVISION the tier's camera-operator seats so the
  // couple's control room is READY with no manual step (mirrors PAPIC_SEATS · the
  // approval IS the activation). The provisioned count is the HARD camera cap:
  // Desktop = 8, Mobile = 3 (panoodCameraCapForSku · owner-locked 2026-07-08), and
  // the panood_claim_camera() RPC only binds operators to EXISTING cameras, so no
  // more than `cap` can go live. provisionPanoodCamerasAdmin is a top-up
  // (idempotent) + best-effort (never throws). The FREE single-cam livestream
  // provisions nothing (couple's own device → YouTube).
  PANOOD_SYSTEM: async (ctx) => {
    if (!ctx.eventId) return;
    try {
      await provisionPanoodCamerasAdmin(
        ctx.admin,
        ctx.eventId,
        panoodCameraCapForSku('PANOOD_SYSTEM'),
      );
    } catch (e) {
      console.error('[sku-activation] PANOOD_SYSTEM camera provisioning threw (non-fatal):', e);
      reportActivationFault('activate:PANOOD_SYSTEM', ctx, e);
    }
  },

  PANOOD_SYSTEM_MOBILE: async (ctx) => {
    if (!ctx.eventId) return;
    try {
      await provisionPanoodCamerasAdmin(
        ctx.admin,
        ctx.eventId,
        panoodCameraCapForSku('PANOOD_SYSTEM_MOBILE'),
      );
    } catch (e) {
      console.error(
        '[sku-activation] PANOOD_SYSTEM_MOBILE camera provisioning threw (non-fatal):',
        e,
      );
      reportActivationFault('activate:PANOOD_SYSTEM_MOBILE', ctx, e);
    }
  },

  // Seat-pass activation (seat-finding PR4). The seat pass (/[slug]/seat)
  // resolves + gates on CUSTOM_QR_GUEST — the SKU whose branded per-guest /
  // per-table QR codes point at the pass — so the hook binds to CUSTOM_QR_GUEST
  // (distinct from PAPIC_SEATS above, the already-'live' photo-crew SKU). When a
  // CUSTOM_QR_GUEST order is approved, ensure every table for the event has its
  // QR sheet marked published so the printed Custom-QR sheet + the table-QR
  // resolver work immediately. Idempotent + defensive: event_tables.qr_token
  // already default-exists from row creation (migration 20261101000000), so this
  // is a published-at STAMP, not a destructive reset — it touches only rows still
  // NULL. NEVER throws (dispatcher contract).
  CUSTOM_QR_GUEST: async (ctx) => {
    if (!ctx.eventId) return;
    // event_tables.qr_token already has a NOT NULL DEFAULT token; this only
    // stamps qr_published_at so the table-QR resolver knows the sheet is live.
    // No row mutation if already set.
    await ctx.admin
      .from('event_tables')
      .update({ qr_published_at: new Date().toISOString() })
      .eq('event_id', ctx.eventId)
      .is('qr_published_at', null);
    await appendLedger(ctx.admin, {
      order_id: ctx.orderId,
      event_type: 'service_activated',
      actor_user_id: ctx.actorUserId,
      actor_role: 'admin',
      metadata: { service_key: ctx.serviceKey, event_id: ctx.eventId },
    });
  },

  // Bundle activation (bundle-buyer dead-flag repair) — fan the bundle's
  // children through their own hooks. See activateBundleChildren below.
  GUIDED_PACK: (ctx) => activateBundleChildren(ctx),
  MEDIA_PACK: (ctx) => activateBundleChildren(ctx),
});

/**
 * Fan a freshly-approved BUNDLE order (GUIDED_PACK / MEDIA_PACK) through each of
 * its child SKUs' activation hooks. WHY: a bundle purchase lands as a SINGLE
 * orders row keyed by the bundle code — it never decomposes into per-child
 * orders (app/dashboard/[eventId]/studio/bundle/page.tsx). activateOrderSku
 * dispatches on the literal service_key, so a child whose capability depends on
 * a STORED side-effect flag (today only SETNAYAN_AI → events.setnayan_ai_active)
 * would never activate for a bundle buyer. Children whose ownership is read
 * straight off orders.status (monogram, custom-QR, papic, …) need no hook here —
 * their gates already read the bundle order via eventOwnsSku(). Membership comes
 * from BUNDLE_CHILD_SKUS (the read-side mirror) so this can't drift from the
 * gate. Idempotent (child hooks are idempotent); a child with no hook is
 * skipped; bundle codes are never children, so there is no recursion.
 */
async function activateBundleChildren(ctx: ActivationContext): Promise<void> {
  const children =
    BUNDLE_CHILD_SKUS[ctx.serviceKey as keyof typeof BUNDLE_CHILD_SKUS];
  if (!children) return;
  for (const child of children) {
    const childHook = EXACT_HOOKS[child];
    if (!childHook) continue;
    try {
      await childHook({ ...ctx, serviceKey: child });
    } catch (e) {
      // Fault-isolate each child: one failing hook must not starve its siblings
      // (e.g. a SETNAYAN_AI write error must not stop PAPIC_SEATS seat
      // provisioning from running). Honors the file's "every hook is non-fatal"
      // contract; the dispatcher's outer catch would otherwise abort the rest.
      console.error(
        `[sku-activation] bundle child ${child} of ${ctx.serviceKey} threw (non-fatal):`,
        e,
      );
      reportActivationFault('activate:bundle_child', { ...ctx, serviceKey: child }, e);
    }
  }
}

/**
 * Recompute vendor_profiles.extra_agent_seats = the number of PAID
 * vendor_extra_seat orders for this vendor, and write it. RECOMPUTE (not an
 * increment/decrement) so it is self-healing + idempotent: on ACTIVATION the
 * just-paid order is counted in; on REVERSAL the refunded/cancelled order has
 * already left the 'paid' set (deactivate runs AFTER the status flip), so the
 * same recompute LOWERS the seat count. Shared by the activation prefix hook and
 * the deactivation path so the two can never drift. Throws on the write so the
 * caller's outer catch logs + reports it (recoverable).
 */
async function recomputeVendorExtraSeats(
  admin: SupabaseClient,
  vendorProfileId: string,
): Promise<number> {
  const { count } = await admin
    .from('orders')
    .select('order_id', { count: 'exact', head: true })
    .eq('service_key', seatServiceKey(vendorProfileId))
    .eq('status', 'paid');
  const paidSeats = extraSeatsFromPaidCount(count);
  const { error } = await admin
    .from('vendor_profiles')
    .update({ extra_agent_seats: paidSeats })
    .eq('vendor_profile_id', vendorProfileId);
  if (error) {
    throw new Error(`vendor_extra_seat seat recompute write failed: ${error.message}`);
  }
  return paidSeats;
}

// Prefix/predicate hooks for dynamic-suffix service_keys (e.g. branch ids).
/**
 * SEC-4b · THE ORDER MUST OWN WHAT IT PROVISIONS.
 *
 * The four `vendor_*__<id>` hooks below read their TARGET out of the service_key
 * string and act on it. Nothing downstream ever asked whether the ORDER belongs
 * to the vendor that owns that target — so an order minted from any other
 * surface (couple checkout, a comp grant, a hand-inserted row) could settle a
 * stranger's booking fee, activate a stranger's branch, or promote a stranger's
 * Custom plan.
 *
 * This resolves the OWNING vendor of the target and compares it with the order's
 * own `vendor_profile_id`. Couple-side checkout pins that column to NULL, so a
 * couple-minted row can never match and is refused here regardless of how it was
 * created.
 *
 * ⚠ THIS IS THE ORIGIN-INDEPENDENT GATE, and the load-bearing one of the pair.
 * Its sibling — `isVendorSurfaceServiceKey` in couple checkout (landed
 * separately) — only guards ONE door, and what actually blocks that door today
 * is SEC-7's pricing refusal rather than the guard itself. This check holds for
 * every origin, including ones with no pricing step at all: a comp grant, an
 * admin-minted bespoke order from /admin/custom-plans, or any future minter.
 *
 * THROWS rather than returning false. The dispatcher's catch logs it and leaves
 * the order recoverable (an admin can refund) — which is the right outcome:
 * money may have moved, but the wrong tenant is not provisioned. Failing OPEN
 * here would defeat the whole check.
 */
async function assertOrderOwnsVendorTarget(
  ctx: ActivationContext,
  targetVendorProfileId: string | null,
): Promise<void> {
  const { data: order } = await ctx.admin
    .from('orders')
    .select('vendor_profile_id')
    .eq('order_id', ctx.orderId)
    .maybeSingle();
  const orderVendorId =
    (order as { vendor_profile_id?: string | null } | null)?.vendor_profile_id ?? null;

  // The RULE lives in lib/vendor-target-ownership.ts — pure, and unit-tested
  // there. This module cannot be imported by a test (it reaches `server-only`
  // transitively via the concierge actions), so keeping the decision here would
  // leave it provable only by reading it.
  if (!orderMayProvisionVendorTarget(orderVendorId, targetVendorProfileId)) {
    throw new Error(
      vendorTargetRefusalMessage({
        orderId: ctx.orderId,
        serviceKey: ctx.serviceKey,
        orderVendorProfileId: orderVendorId,
        targetVendorProfileId,
      }),
    );
  }
}

/** The vendor that owns a branch, or null when the branch is unknown. */
async function branchOwnerVendorId(
  ctx: ActivationContext,
  branchId: string,
): Promise<string | null> {
  const { data } = await ctx.admin
    .from('vendor_branches')
    .select('parent_vendor_profile_id')
    .eq('branch_id', branchId)
    .maybeSingle();
  return (
    (data as { parent_vendor_profile_id?: string | null } | null)?.parent_vendor_profile_id ?? null
  );
}

/** The vendor that owns a booking-fee charge, or null when unknown. */
async function chargeOwnerVendorId(
  ctx: ActivationContext,
  chargeId: string,
): Promise<string | null> {
  const { data } = await ctx.admin
    .from('booking_fee_charges')
    .select('vendor_profile_id')
    .eq('charge_id', chargeId)
    .maybeSingle();
  return (data as { vendor_profile_id?: string | null } | null)?.vendor_profile_id ?? null;
}

const PREFIX_HOOKS: ReadonlyArray<{
  match: (serviceKey: string) => boolean;
  run: ActivationHook;
}> = Object.freeze([
  {
    // 'vendor_booking_fee__{charge_id}' → SETTLE the booking-fee ledger charge.
    // This is the missing connection: the booking_fee_charges ledger opens
    // 'pending' at LOCK and was never settled. When the admin approves the
    // vendor's fee payment (order → 'paid' → activateOrderSku), settle the exact
    // charge. Idempotent (booking_fee_settle_charge no-ops a non-pending charge),
    // so a re-approval is safe. Fires only on a fully-reconciled 'paid' order
    // (shouldProvisionOnApproval), never on a partial/short transfer.
    match: (serviceKey) => chargeIdFromBookingFeeLockServiceKey(serviceKey) !== null,
    run: async (ctx) => {
      const chargeId = chargeIdFromBookingFeeLockServiceKey(ctx.serviceKey);
      if (!chargeId) return;
      // SEC-4b: the paying order must belong to the charge's own vendor.
      await assertOrderOwnsVendorTarget(ctx, await chargeOwnerVendorId(ctx, chargeId));
      const settled = await settleBookingFeeCharge(ctx.admin, chargeId, 'manual', ctx.orderId);
      await appendLedger(ctx.admin, {
        order_id: ctx.orderId,
        event_type: 'service_activated',
        actor_user_id: ctx.actorUserId,
        actor_role: 'admin',
        metadata: { service_key: ctx.serviceKey, booking_fee_charge_id: chargeId, settled },
      });
    },
  },
  {
    // 'vendor_additional_branch__{branch_id}' → flip branch active + stamp 28d period.
    match: (serviceKey) => branchIdFromServiceKey(serviceKey) !== null,
    run: async (ctx) => {
      const branchId = branchIdFromServiceKey(ctx.serviceKey);
      if (!branchId) return;
      // SEC-4b: the paying order must belong to the branch's parent vendor.
      await assertOrderOwnsVendorTarget(ctx, await branchOwnerVendorId(ctx, branchId));
      const expiresAt = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString();
      await ctx.admin
        .from('vendor_branches')
        .update({ branch_subscription_active: true, cancelled_at: null })
        .eq('branch_id', branchId);
      await ctx.admin
        .from('orders')
        .update({ expires_at: expiresAt, updated_at: new Date().toISOString() })
        .eq('order_id', ctx.orderId);
      await appendLedger(ctx.admin, {
        order_id: ctx.orderId,
        event_type: 'service_activated',
        actor_user_id: ctx.actorUserId,
        actor_role: 'admin',
        metadata: { service_key: ctx.serviceKey, branch_id: branchId },
      });
    },
  },
  {
    // 'vendor_extra_seat__{vendor_profile_id}' → recompute the vendor's paid
    // extra-seat count (Enterprise ₱250/28d add-on, owner 2026-07-02). Unlike
    // the branch flag, seats are a COUNT — so rather than a non-idempotent
    // increment, RECOMPUTE extra_agent_seats = the number of PAID
    // vendor_extra_seat orders for this vendor (the current order is already
    // 'paid' before this runs). Idempotent + self-healing on re-approval and
    // safe against a mid-hook crash (no double-count). The count folds into the
    // Enterprise renewal amount in PR-B; here it just makes the seat usable.
    match: (serviceKey) => vendorProfileIdFromSeatServiceKey(serviceKey) !== null,
    run: async (ctx) => {
      const vendorProfileId = vendorProfileIdFromSeatServiceKey(ctx.serviceKey);
      if (!vendorProfileId) return;
      // SEC-4b: the key names the vendor directly — the order must be theirs.
      await assertOrderOwnsVendorTarget(ctx, vendorProfileId);
      const paidSeats = await recomputeVendorExtraSeats(ctx.admin, vendorProfileId);
      await appendLedger(ctx.admin, {
        order_id: ctx.orderId,
        event_type: 'service_activated',
        actor_user_id: ctx.actorUserId,
        actor_role: 'admin',
        metadata: {
          service_key: ctx.serviceKey,
          vendor_profile_id: vendorProfileId,
          extra_agent_seats: paidSeats,
        },
      });
    },
  },
  {
    // 'vendor_custom_plan__{vendor_profile_id}' → PROVISION the negotiated
    // Custom tier (owner-signed §11). When the admin approves the quote payment,
    // flip the vendor to tier_state='custom' + promote THE PLAN THIS ORDER PAID
    // FOR to 'active' so the effective-caps overlay (lib/vendor-effective-caps.ts)
    // reads the composed ceilings. The one-active-plan unique index (WHERE
    // status='active') means a stale prior active row must be demoted first — so
    // this idempotently retires every OTHER active plan for the org to 'lapsed',
    // then activates this order's plan.
    //
    // BINDING (security): the order has no custom_plan_id FK and the plan's
    // composition is mutated in place, so the OLD "most-recently-updated
    // non-terminal row" selection let a vendor pay a CHEAP quote and receive the
    // row's latest (expensive) composition, or bind to a stale already-active
    // plan. selectActivatableCustomPlan binds on the price the order was quoted
    // at (a plan is activatable only when its CURRENT quoted_28d_php matches the
    // paid amount AND it is in a payable, not-yet-live state), and we REFUSE
    // (throw → order stays recoverable) rather than provision the wrong plan.
    // Idempotent: a prior 'service_activated' ledger row for this order
    // short-circuits, so a re-approval (whose plan is now 'active', not a
    // payable candidate) is a safe no-op instead of a spurious refusal.
    match: (serviceKey) => vendorProfileIdFromCustomPlanServiceKey(serviceKey) !== null,
    run: async (ctx) => {
      const vendorProfileId = vendorProfileIdFromCustomPlanServiceKey(ctx.serviceKey);
      if (!vendorProfileId) return;
      // SEC-4b: the key names the vendor directly — the order must be theirs.
      await assertOrderOwnsVendorTarget(ctx, vendorProfileId);

      // (0) Idempotency — already activated this order? (Lets us exclude 'active'
      //     from the candidate set below without turning a re-approval into a
      //     spurious "no matching plan" refusal.)
      const { data: prior } = await ctx.admin
        .from('order_ledger')
        .select('order_id')
        .eq('order_id', ctx.orderId)
        .eq('event_type', 'service_activated')
        .limit(1)
        .maybeSingle();
      if (prior) return;

      // (1) The amount THIS order paid — the invariant the order pins.
      const { data: order } = await ctx.admin
        .from('orders')
        .select('confirmed_total_php, requested_total_php')
        .eq('order_id', ctx.orderId)
        .maybeSingle();
      const amountPhp = Number(
        (order as { confirmed_total_php?: number | string | null } | null)?.confirmed_total_php ??
          (order as { requested_total_php?: number | string | null } | null)?.requested_total_php ??
          0,
      );

      // (2) Candidate plans — payable OR already-active rows for the org. Bind by
      //     price (selectActivatableCustomPlan) among the PAYABLE ones; the
      //     'active' rows are read only to recognise an already-provisioned order
      //     (crash-recovery below), never to (re)activate.
      const { data: candidates } = await ctx.admin
        .from('vendor_custom_plans')
        .select('custom_plan_id, status, quoted_28d_php, updated_at')
        .eq('vendor_profile_id', vendorProfileId)
        .in('status', ['quoted', 'pending_payment', 'active'])
        .order('updated_at', { ascending: false });
      const candidateRows = Array.isArray(candidates) ? candidates : [];
      const targetId = selectActivatableCustomPlan(candidateRows, amountPhp);
      if (!targetId) {
        // Crash-recovery no-op: if the org already holds an ACTIVE plan priced at
        // this order's amount, a prior run provisioned it but its final ledger
        // write did not land (so the idempotency guard above didn't fire). The
        // entitlement is already correct → treat as done rather than throwing a
        // false "no matching plan" alarm. (This RECOGNISES an already-active plan
        // by price; it never activates one — selectActivatableCustomPlan still
        // refuses 'active' rows.)
        const alreadyActive = candidateRows.some(
          (c) =>
            c.status === 'active' &&
            Number.isFinite(Number(c.quoted_28d_php)) &&
            Math.abs(Number(c.quoted_28d_php) - amountPhp) < 0.5,
        );
        if (alreadyActive) return;
        // No plan matches this order's paid amount → do NOT provision a wrong
        // plan. Throw so the order stays 'paid' + recoverable (Sentry-alerted by
        // the dispatcher's outer catch); an admin reconciles the mismatch.
        throw new Error(
          `vendor_custom_plan: no payable plan for vendor ${vendorProfileId} matches the paid amount ${amountPhp}`,
        );
      }

      // Stamp the Custom tier + lapse anchor FIRST — before touching the plan
      // rows. tier_expires_at = the 28-day window end (also written to the order
      // below). ORDERING IS A RACE GUARD: the lapse sweep (sweep_vendor_tier_expiry,
      // fired post-response on dashboard load) and this hook are NOT in one
      // transaction. Writing the fresh FUTURE expiry first means a concurrently-
      // firing sweep sees a not-past-due tier and no-ops, instead of demoting the
      // plan we are about to promote. The gate (lib/enterprise-vendor-gate.ts) +
      // the sweep both read tier_expires_at, so a paid Custom tier now auto-lapses
      // on non-renewal like Pro/Enterprise. (The comp lever activateCustomPlan
      // intentionally leaves this NULL = never lapses — white-glove deals; do NOT
      // copy this stamp there.)
      const expiresAt = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString();
      const { error: tierErr } = await ctx.admin
        .from('vendor_profiles')
        .update({ tier_state: 'custom', tier_expires_at: expiresAt })
        .eq('vendor_profile_id', vendorProfileId);
      if (tierErr) {
        throw new Error(`vendor_custom_plan tier write failed: ${tierErr.message}`);
      }

      // Demote any OTHER active plan for the org so the one-active unique index
      // never conflicts (only touches rows that are NOT our target).
      await ctx.admin
        .from('vendor_custom_plans')
        .update({ status: 'lapsed', updated_at: new Date().toISOString() })
        .eq('vendor_profile_id', vendorProfileId)
        .eq('status', 'active')
        .neq('custom_plan_id', targetId);

      // Promote the target to active LAST — after the future expiry is committed,
      // so a racing sweep (now disarmed by that future expiry) can never strand
      // this freshly-activated plan.
      const { error: planErr } = await ctx.admin
        .from('vendor_custom_plans')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('custom_plan_id', targetId);
      if (planErr) {
        throw new Error(`vendor_custom_plan activation write failed: ${planErr.message}`);
      }

      await ctx.admin
        .from('orders')
        .update({ expires_at: expiresAt, updated_at: new Date().toISOString() })
        .eq('order_id', ctx.orderId);

      await appendLedger(ctx.admin, {
        order_id: ctx.orderId,
        event_type: 'service_activated',
        actor_user_id: ctx.actorUserId,
        actor_role: 'admin',
        metadata: {
          service_key: ctx.serviceKey,
          vendor_profile_id: vendorProfileId,
          custom_plan_id: targetId,
          tier_state: 'custom',
        },
      });
    },
  },
]);

/**
 * Report an activation/deactivation-hook failure to Sentry so a PAID-but-
 * unentitled order (or an un-reversed refund) is ALERTABLE, not silent.
 *
 * WHY: the hooks are non-fatal by contract — a throw is swallowed to
 * console.error so the admin's approval/refund never rolls back. But Sentry is
 * NOT wired to capture console output, so a paid order whose activation silently
 * failed left the customer charged with no feature and no alert. Tagged with the
 * order_id + service_key so on-call can find + re-run the stuck order. Best-effort
 * (never throws): a telemetry failure must never break the money path.
 */
function reportActivationFault(
  where: string,
  ctx: Pick<ActivationContext, 'orderId' | 'serviceKey' | 'eventId'>,
  e: unknown,
): void {
  try {
    Sentry.captureException(e, {
      tags: { feature: 'sku-activation', where },
      extra: {
        order_id: ctx.orderId,
        service_key: ctx.serviceKey,
        event_id: ctx.eventId ?? null,
      },
    });
  } catch {
    /* telemetry must never break the money path */
  }
}

/**
 * Run the activation hook (if any) for a freshly-paid order. NEVER throws —
 * each hook is wrapped; failures are logged, Sentry-reported, and swallowed so
 * the parent approval flow completes. No-op for any service_key without a
 * registered hook.
 */
export async function activateOrderSku(ctx: ActivationContext): Promise<void> {
  const exact = EXACT_HOOKS[ctx.serviceKey];
  const hook = exact ?? PREFIX_HOOKS.find((h) => h.match(ctx.serviceKey))?.run;
  if (!hook) return; // default no-op
  try {
    await hook(ctx);
  } catch (e) {
    // Paid-but-unentitled: the order is already 'paid' but the capability never
    // provisioned. Log AND alert (Sentry) so it's recoverable, not silent.
    console.error(`[sku-activation] hook for ${ctx.serviceKey} threw (non-fatal):`, e);
    reportActivationFault('activate', ctx, e);
  }
}

// ===========================================================================
// Deactivation (revoke-on-reversal) — the inverse of activation.
// ===========================================================================
//
// WHY: SETNAYAN_AI's capability is read from a STORED flag
// (events.setnayan_ai_active) rather than live off orders.status, so unlike the
// orders-backed gates (monogram / custom-QR / papic / website — which re-lock
// for free when their order flips to cancelled/refunded), the flag is a one-way
// latch: activation stamps it true and nothing ever cleared it. A full refund
// (or reject) of the SETNAYAN_AI order — direct OR the bundle that granted it —
// left the paid AI capability live forever ("refund the money, keep the AI").
// This closes that on the reversal side, symmetric to activateOrderSku.

/**
 * Re-derive events.setnayan_ai_active from the CURRENT order state and clear it
 * if the event no longer owns SETNAYAN_AI by ANY live order. Re-derive (not
 * blind-clear) because the couple may still own it via another order — a second
 * à-la-carte buy, or another bundle that also grants it. eventOwnsSku() is
 * bundle-aware + refund-aware and reads the post-flip state (the reversed order
 * is already out of the owned set), so it returns false only when truly unowned.
 * Uses the admin client (RLS-bypassed) so it sees every order for the event.
 */
async function deactivateSetnayanAiIfUnowned(ctx: ActivationContext): Promise<void> {
  if (!ctx.eventId) return;
  if (await eventSkuActive(ctx.admin, ctx.eventId, 'SETNAYAN_AI')) return; // still owned → keep
  const { error } = await ctx.admin
    .from('events')
    .update({ setnayan_ai_active: false })
    .eq('event_id', ctx.eventId);
  if (error) throw new Error(`SETNAYAN_AI deactivation write failed: ${error.message}`);
}

/**
 * Reverse a paid vendor ADD-ON window (Vendor AI / 3D Booth) when its funding
 * order is rejected/refunded. Like SETNAYAN_AI's stored flag, the
 * vendor_profiles.{ai,booth}_addon_expires_at window is a one-way latch —
 * activation stamps it, nothing cleared it — so a refund otherwise left the paid
 * add-on live ("refund the money, keep the feature"). Reads THIS order's own
 * 'service_activated' ledger row to learn which window it stamped, then expires
 * that window ONLY when it is still the CURRENT one (resolveAddonDeactivationExpiry
 * never clobbers a later-stacked renewal cycle). Throws only on the write so the
 * outer catch in deactivateOrderSku logs + reports it (recoverable).
 */
async function deactivateVendorAddonWindow(
  ctx: ActivationContext,
  opts: {
    expiryColumn: 'ai_addon_expires_at' | 'booth_addon_expires_at';
    ledgerExpiryKey: string;
  },
): Promise<void> {
  // The paying vendor is on the order.
  const { data: order } = await ctx.admin
    .from('orders')
    .select('vendor_profile_id')
    .eq('order_id', ctx.orderId)
    .maybeSingle();
  const vendorProfileId =
    (order as { vendor_profile_id?: string | null } | null)?.vendor_profile_id ?? null;
  if (!vendorProfileId) return;

  // What window did THIS order stamp? (its own 'service_activated' ledger row —
  // paid renewal carries {ai,booth}_addon_expires_at; the free-first-cycle order
  // carries expires_at.)
  const { data: ledgerRow } = await ctx.admin
    .from('order_ledger')
    .select('metadata')
    .eq('order_id', ctx.orderId)
    .eq('event_type', 'service_activated')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const meta =
    (ledgerRow as { metadata?: Record<string, unknown> | null } | null)?.metadata ?? null;
  const stampedExpiry =
    (meta?.[opts.ledgerExpiryKey] as string | undefined) ??
    (meta?.expires_at as string | undefined) ??
    null;

  // The vendor's CURRENT window.
  const { data: vp } = await ctx.admin
    .from('vendor_profiles')
    .select(opts.expiryColumn)
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  const currentExpiry =
    (vp as Record<string, string | null> | null)?.[opts.expiryColumn] ?? null;

  const newExpiry = resolveAddonDeactivationExpiry(currentExpiry, stampedExpiry, Date.now());
  if (newExpiry === currentExpiry) return; // a later cycle owns it (or nothing active) → no-op

  const { error } = await ctx.admin
    .from('vendor_profiles')
    .update({ [opts.expiryColumn]: newExpiry })
    .eq('vendor_profile_id', vendorProfileId);
  if (error) {
    throw new Error(`${opts.expiryColumn} deactivation write failed: ${error.message}`);
  }
}

/**
 * Re-derive `vendor_profiles.ai_addon_level` when a Vendor AI order is reversed
 * (rejected / refunded), and demote to 'basic' when the vendor no longer owns
 * ADVANCED by any live order.
 *
 * ⚠ WHY THIS IS SEPARATE FROM deactivateVendorAddonWindow: that helper returns
 * EARLY (`if (newExpiry === currentExpiry) return`) whenever a later cycle still
 * owns the window — which is exactly the case where a refunded Advanced order
 * leaves a live Basic window behind. A level reset written inside it would be
 * skipped in the one scenario that matters, leaving "refund the Advanced money,
 * keep the Advanced capability".
 *
 * RE-DERIVE, never blind-clear (same reasoning as the SETNAYAN_AI reversal): the
 * vendor may still hold Advanced through a SECOND live order, and demoting them
 * for a refund of a different one would revoke something they paid for. Only when
 * no live Advanced order remains does the level drop.
 *
 * The window itself is handled separately, so a vendor who bought Basic and then
 * Advanced keeps their Basic cycle intact — they lose the rung, not the time.
 */
async function rederiveVendorAiLevelOnReversal(ctx: ActivationContext): Promise<void> {
  if (!isVendorAiLadderEnabled()) return; // never name the column while dark

  const { data: order } = await ctx.admin
    .from('orders')
    .select('vendor_profile_id')
    .eq('order_id', ctx.orderId)
    .maybeSingle();
  const vendorProfileId =
    (order as { vendor_profile_id?: string | null } | null)?.vendor_profile_id ?? null;
  if (!vendorProfileId) return;

  // Does ANOTHER live Advanced order still entitle them? (This order has already
  // been flipped out of the live set by the time reversal runs.)
  const { data: liveAdvanced } = await ctx.admin
    .from('orders')
    .select('order_id')
    .eq('vendor_profile_id', vendorProfileId)
    .eq('service_key', VENDOR_AI_ADVANCED_SKU_CODE)
    .in('status', ['paid', 'fulfilled'])
    .neq('order_id', ctx.orderId)
    .limit(1);
  if (liveAdvanced && liveAdvanced.length > 0) return; // still legitimately Advanced

  const { error } = await ctx.admin
    .from('vendor_profiles')
    .update({ ai_addon_level: 'basic' })
    .eq('vendor_profile_id', vendorProfileId);
  if (error) throw new Error(`ai_addon_level demotion failed: ${error.message}`);
}

/**
 * Reverse a Photo Challenge sponsorship when its ₱400 order is rejected/refunded
 * — delete the papic_photo_challenge_sponsorships row for THIS (event, vendor) so
 * a refunded vendor can no longer author a sponsored challenge. Scoped to the
 * order's own vendor + event (never another sponsor's row). Deleting by
 * (event_id, vendor_profile_id) is naturally idempotent (a second reversal is a
 * no-op). Throws only on the write so the outer catch logs + reports it.
 */
async function deactivatePhotoChallengeSponsorship(ctx: ActivationContext): Promise<void> {
  if (!ctx.eventId) return;
  const { data: order } = await ctx.admin
    .from('orders')
    .select('vendor_profile_id')
    .eq('order_id', ctx.orderId)
    .maybeSingle();
  const vendorProfileId =
    (order as { vendor_profile_id?: string | null } | null)?.vendor_profile_id ?? null;
  if (!vendorProfileId) return;

  const { error } = await ctx.admin
    .from('papic_photo_challenge_sponsorships')
    .delete()
    .eq('event_id', ctx.eventId)
    .eq('vendor_profile_id', vendorProfileId);
  if (error) {
    throw new Error(`vendor_photo_challenge deactivation delete failed: ${error.message}`);
  }
}

// 🔒 reverseUserAiSubscriptionOrder() REMOVED 2026-08-01 together with the
// SETNAYAN_AI_SUB activation handler it mirrored. It rolled back
// user_ai_subscription.active_until on a refund/reject. With per-USER retired
// there is no window to reverse. The per-EVENT reversal below is untouched.

/**
 * Reverse the flag-backed side effects of an order that was just REVERSED
 * (rejectPayment → cancelled · refundOrder → refunded). NEVER throws (wrapped +
 * logged + Sentry-reported), symmetric to activateOrderSku. MUST be called AFTER
 * the order's status flip is committed so the re-derivation sees the new state.
 *
 * Entitlements with a STORED window/row need reversing: SETNAYAN_AI (per-event
 * flag), the vendor extra-seat
 * COUNT, Vendor AI + 3D Booth (28-day window), and the Photo Challenge
 * sponsorship row. `vendor_deep_search` is already-consumed (a completed web/AI
 * run) → nothing to reverse. PAPIC_SEATS' seat provisioning + all other
 * orders-backed gates re-lock for free off orders.status, so they need nothing
 * here. Fires for a direct reversal OR a bundle reversal (the bundle that granted
 * the child).
 */
export async function deactivateOrderSku(ctx: ActivationContext): Promise<void> {
  // Papic One — reverse the purchased point grant.
  //
  // There is no DOWNGRADE path by design (owner 2026-07-20: upgrades yes,
  // downgrades no). Tiers are additive grants in an append-only ledger, so a
  // couple can only ever add points — there is no operation that swaps a bucket
  // for a smaller one. The ONLY reversal is a refunded / un-approved order, and
  // this is it: without it, buy → granted → refund → keep the points.
  //
  // Deleting by order_id is naturally idempotent. If the couple already SPENT
  // more than the remaining grants cover, the pool's remaining goes non-positive
  // and the fail-closed gate stops capture — which is the correct outcome for a
  // reversed order, not a bug to paper over.
  await reversePapicPassPoints(ctx);

  // Vendor add-on windows (paid renewal OR free first cycle) — expire the window
  // this order stamped, if it's still the current one. Non-fatal + idempotent.
  if (
    ctx.serviceKey === VENDOR_AI_ADDON_SKU_CODE ||
    ctx.serviceKey === VENDOR_AI_ADVANCED_SKU_CODE
  ) {
    try {
      await deactivateVendorAddonWindow(ctx, {
        expiryColumn: 'ai_addon_expires_at',
        ledgerExpiryKey: 'ai_addon_expires_at',
      });
    } catch (e) {
      reportActivationFault('deactivate:vendor_ai_addon', ctx, e);
    }
    // Independent of the window rollback ON PURPOSE — deactivateVendorAddonWindow
    // returns early when a later cycle owns the window, which is precisely the
    // refunded-Advanced-over-live-Basic case. Own try/catch so neither step can
    // swallow the other.
    try {
      await rederiveVendorAiLevelOnReversal(ctx);
    } catch (e) {
      reportActivationFault('deactivate:vendor_ai_level', ctx, e);
    }
  } else if (ctx.serviceKey === VENDOR_3D_BOOTH_SKU_CODE) {
    try {
      await deactivateVendorAddonWindow(ctx, {
        expiryColumn: 'booth_addon_expires_at',
        ledgerExpiryKey: 'booth_addon_expires_at',
      });
    } catch (e) {
      reportActivationFault('deactivate:vendor_3d_booth', ctx, e);
    }
  } else if (ctx.serviceKey === VENDOR_PHOTO_CHALLENGE_SKU_CODE) {
    try {
      await deactivatePhotoChallengeSponsorship(ctx);
    } catch (e) {
      reportActivationFault('deactivate:vendor_photo_challenge', ctx, e);
    }
  }
  // 🔒 The `SETNAYAN_AI_SUB` branch that stood here was removed 2026-08-01 with
  // the rest of the per-USER path. Its activation handler went in the same
  // change, so there is no grant left for it to reverse.

  // Vendor extra seat — a refunded/cancelled seat order must LOWER the paid seat
  // count. Recompute from the live paid-order set (the reversed order already
  // left 'paid' before this runs), symmetric to the activation prefix hook.
  // Non-fatal + idempotent (recompute, not decrement). Independent of the
  // if/else chain above (a seat service_key matches none of those branches).
  const seatVendorId = vendorProfileIdFromSeatServiceKey(ctx.serviceKey);
  if (seatVendorId) {
    try {
      await recomputeVendorExtraSeats(ctx.admin, seatVendorId);
    } catch (e) {
      reportActivationFault('deactivate:vendor_extra_seat', ctx, e);
    }
  }

  const grantsAi =
    ctx.serviceKey === 'SETNAYAN_AI' ||
    (BUNDLE_CHILD_SKUS[ctx.serviceKey as keyof typeof BUNDLE_CHILD_SKUS]?.includes(
      'SETNAYAN_AI',
    ) ??
      false);
  if (!grantsAi) return;
  try {
    await deactivateSetnayanAiIfUnowned(ctx);
  } catch (e) {
    console.error(`[sku-activation] deactivation for ${ctx.serviceKey} threw (non-fatal):`, e);
    reportActivationFault('deactivate:SETNAYAN_AI', ctx, e);
  }
}
