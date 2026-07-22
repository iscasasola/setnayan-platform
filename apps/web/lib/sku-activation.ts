import type { SupabaseClient } from '@supabase/supabase-js';
import { appendLedger } from '@/lib/ledger';
import { activateConcierge } from '@/app/dashboard/(account)/profile/concierge/actions';
import { branchIdFromServiceKey } from '@/lib/vendor-branches';
import {
  seatServiceKey,
  vendorProfileIdFromSeatServiceKey,
} from '@/lib/vendor-seats';
import { vendorProfileIdFromCustomPlanServiceKey } from '@/lib/vendor-custom-catalog';
import { BUNDLE_CHILD_SKUS, eventSkuActive } from '@/lib/entitlements';
import { provisionPapicSeatsAdmin } from '@/lib/papic-seats';
import { papicPassPointsForSku } from '@/lib/papic-pass-tiers';
import {
  provisionPanoodCamerasAdmin,
  panoodCameraCapForSku,
} from '@/lib/panood-camera-seats';
import {
  AI_SUB_SKU,
  cyclesFromAmount,
  extendUserAiSubscription,
} from '@/lib/setnayan-ai-subscription';
import { resolveSetnayanAiPerEventPricingEnabled } from '@/lib/integration-config';
import {
  VENDOR_AI_ADDON_SKU_CODE,
  nextVendorAiAddonExpiry,
} from '@/lib/vendor-addon-pricing';
import {
  VENDOR_3D_BOOTH_SKU_CODE,
  nextVendor3dBoothExpiry,
} from '@/lib/vendor-3d-booth-pricing';
import { VENDOR_PHOTO_CHALLENGE_SKU_CODE } from '@/lib/vendor-photo-challenge';

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
 * Papic One — grant a purchased point bucket into the event capture pool.
 *
 * The couple bought N shots; this is where N becomes real. ONE row into
 * papic_event_point_grants (source 'topup_order', order_id set), which
 * lib/papic-event-pool.ts sums into the pool total.
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
      note: `Papic One · ${ctx.serviceKey}`,
    });
    if (error) {
      console.error('[sku-activation] Papic One grant insert failed (non-fatal):', {
        order_id: ctx.orderId,
        service_key: ctx.serviceKey,
        error: error.message,
      });
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
  }
}

/**
 * Papic One — grant a purchased point bucket PER PAID CAMERA into the shared
 * event pool (owner 2026-07-22 · Papic_One_Pool_Model_Spec §0: ₱100/camera →
 * 250 pts each). The buy order's service_key is PAPIC_CAMERAS (the per-camera
 * buy order — NOT the mini seat's own sku_code PAPIC_CAMERA_MINI_DAY). Delegates
 * to the SQL engine papic_grant_camera_points, which counts THIS order's mini
 * seats (250 × N in one grant) and is idempotent by order_id — a re-approval
 * never double-grants. Repeatable: each new per-camera order is a distinct
 * order_id and grants again. Reversal is symmetric via reversePapicPassPoints
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
 * IDEMPOTENT via a prior 'service_activated' ledger row for this order (same
 * guard as SETNAYAN_AI_SUB), so a re-approval never double-extends the window.
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

  // (3) Current window + trial marker → the new (stacked) expiry.
  const { data: vp } = await ctx.admin
    .from('vendor_profiles')
    .select('ai_addon_expires_at, ai_addon_trial_used_at')
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

  const { error } = await ctx.admin
    .from('vendor_profiles')
    .update(update)
    .eq('vendor_profile_id', vendorProfileId);
  if (error) throw new Error(`vendor_ai_addon activation write failed: ${error.message}`);

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

// Exact-match hooks keyed by literal service_key.
const EXACT_HOOKS: Readonly<Record<string, ActivationHook>> = Object.freeze({
  // 'vendor_photo_challenge' → Photo Challenge per-event sponsorship (owner
  // 2026-07-22). Writes the papic_photo_challenge_sponsorships entitlement for
  // the paying (vendor, event). See activatePhotoChallengeSponsorship.
  [VENDOR_PHOTO_CHALLENGE_SKU_CODE]: activatePhotoChallengeSponsorship,

  // 'vendor_ai_addon' → paid Vendor AI ("AI Chatbot") 28-day renewal. Stamps
  // the entitlement window on the paying vendor (the free first cycle is
  // direct-activated in the buy action). See activateVendorAiAddonOrder.
  [VENDOR_AI_ADDON_SKU_CODE]: activateVendorAiAddonOrder,

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
    const update: Record<string, unknown> = { setnayan_ai_active: true };
    // Per-EVENT pricing (owner 2026-07-02): mark the ₱499 intro consumed + stamp
    // the 28-day access window, so this event's NEXT purchase is a ₱799 renewal.
    // Flag-gated → inert (just the setnayan_ai_active boolean, exactly as today)
    // while per-event pricing is off.
    let stampedUntil: string | null = null;
    if (await resolveSetnayanAiPerEventPricingEnabled()) {
      update.setnayan_ai_intro_used = true;
      // Idempotency: extend the window only ONCE per order (a re-approval must not
      // add another 28 days). A prior 'service_activated' ledger row for this order
      // means the window was already stamped — keep intro_used true (a no-op) but
      // skip the extension. Mirrors the SETNAYAN_AI_SUB guard.
      const { data: prior } = await ctx.admin
        .from('order_ledger')
        .select('order_id')
        .eq('order_id', ctx.orderId)
        .eq('event_type', 'service_activated')
        .limit(1)
        .maybeSingle();
      if (!prior) {
        const { data: ev } = await ctx.admin
          .from('events')
          .select('setnayan_ai_active_until')
          .eq('event_id', ctx.eventId)
          .maybeSingle();
        // Stacks from the later of now / current expiry (early re-up keeps the
        // remaining time). One 28-day cycle per SETNAYAN_AI order.
        stampedUntil = extendUserAiSubscription(
          (ev as { setnayan_ai_active_until?: string | null } | null)?.setnayan_ai_active_until ?? null,
          1,
          new Date(),
        ).toISOString();
        update.setnayan_ai_active_until = stampedUntil;
      }
    }
    const { error } = await ctx.admin
      .from('events')
      .update(update)
      .eq('event_id', ctx.eventId);
    // Surface a write failure so activateOrderSku's outer catch logs it —
    // otherwise the paid AI silently never provisions with no retry signal.
    // Throwing is safe: the order is already 'paid', the dispatcher swallows +
    // logs and never rolls back the approval.
    if (error) throw new Error(`SETNAYAN_AI activation write failed: ${error.message}`);
    // Record the activation so a re-approval doesn't re-extend the window (mirrors
    // the SETNAYAN_AI_SUB idempotency guard). Best-effort — the window is already
    // written; a missed ledger row only risks a re-extend on a rare re-approval,
    // never a lost grant. Only when per-event pricing stamped a fresh window.
    if (stampedUntil) {
      await appendLedger(ctx.admin, {
        order_id: ctx.orderId,
        event_type: 'service_activated',
        actor_user_id: ctx.actorUserId,
        actor_role: 'admin',
        metadata: { service_key: ctx.serviceKey, event_id: ctx.eventId, active_until: stampedUntil },
      });
    }
  },

  // 'SETNAYAN_AI_SUB' → per-USER subscription term pass (₱499 / 28-day cycle,
  // owner 2026-06-29). Extends the BUYER's user_ai_subscription window by
  // (paid amount ÷ admin unit price) cycles × 28 days, fanning AI out to all
  // their events. Idempotent two ways: a prior 'service_activated' ledger row
  // for this order, OR the window already carrying this order as last_order_id —
  // either short-circuits so a re-approval never double-grants. INERT while the
  // per-user flag is off (the gate ignores the window), but the grant records
  // safely regardless. Throws only on the write so the dispatcher logs + retries.
  [AI_SUB_SKU]: async (ctx) => {
    // (1) Idempotency — already activated this order?
    const { data: priorLedger } = await ctx.admin
      .from('order_ledger')
      .select('order_id')
      .eq('order_id', ctx.orderId)
      .eq('event_type', 'service_activated')
      .limit(1)
      .maybeSingle();
    if (priorLedger) return;

    // (2) Buyer + paid amount off the order.
    const { data: order } = await ctx.admin
      .from('orders')
      .select('user_id, confirmed_total_php, requested_total_php')
      .eq('order_id', ctx.orderId)
      .maybeSingle();
    if (!order?.user_id) return;
    const amountPhp = Number(order.confirmed_total_php ?? order.requested_total_php ?? 0);

    // (3) Admin-managed unit price (single source = the catalog).
    const { data: sku } = await ctx.admin
      .from('platform_retail_catalog_v2')
      .select('retail_price_php')
      .eq('service_code', AI_SUB_SKU)
      .maybeSingle();
    const cycles = cyclesFromAmount(amountPhp, sku?.retail_price_php ?? null);
    if (cycles <= 0) return;

    // (4) Current window (one row per user) → extend, with a second idempotency
    // guard for the upsert-succeeded-but-ledger-failed retry case.
    const { data: existing } = await ctx.admin
      .from('user_ai_subscription')
      .select('active_until, last_order_id')
      .eq('user_id', order.user_id)
      .maybeSingle();
    if (existing?.last_order_id === ctx.orderId) return;
    const newUntil = extendUserAiSubscription(
      existing?.active_until ?? null,
      cycles,
      new Date(),
    );

    const { error } = await ctx.admin.from('user_ai_subscription').upsert(
      {
        user_id: order.user_id,
        active_until: newUntil.toISOString(),
        source: 'paid',
        last_order_id: ctx.orderId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
    if (error) {
      throw new Error(`SETNAYAN_AI_SUB activation write failed: ${error.message}`);
    }

    await appendLedger(ctx.admin, {
      order_id: ctx.orderId,
      event_type: 'service_activated',
      actor_user_id: ctx.actorUserId,
      actor_role: 'admin',
      metadata: { service_key: ctx.serviceKey, cycles, active_until: newUntil.toISOString() },
    });
  },

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
    }
  },

  // Papic One — the PURCHASED point buckets (owner session 2026-07-20; corpus
  // Papic_Pricing_Lock_2026-07-20.md § 2.3 + § 11). A paid tier grants its points
  // into papic_event_point_grants; the pool sums grants into its total, so the
  // repeatable top-up needs no extra machinery — it is just another row.
  //
  // These are SELF-BOUNDING buckets, deliberately NOT listed in
  // papic_event_pool_config.pass_service_codes (the guest-derived fence for the
  // PAPIC_UNLOCK* bundles). Migration 20270828140000 asserts they stay out of it.
  PAPIC_GUEST: grantPapicPassPoints,
  PAPIC_GUEST_6K: grantPapicPassPoints,
  PAPIC_GUEST_10K: grantPapicPassPoints,
  PAPIC_GUEST_TOPUP: grantPapicPassPoints,

  // Papic One — the per-camera buy order (owner 2026-07-22). service_key is
  // PAPIC_CAMERAS (the buy order), NOT the mini seat's sku_code
  // PAPIC_CAMERA_MINI_DAY. 250 pts per paid camera into the SAME shared event
  // pool, repeatable (each buy is its own order_id) + idempotent per order.
  PAPIC_CAMERAS: grantPapicCameraPoints,

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
    }
  }
}

// Prefix/predicate hooks for dynamic-suffix service_keys (e.g. branch ids).
const PREFIX_HOOKS: ReadonlyArray<{
  match: (serviceKey: string) => boolean;
  run: ActivationHook;
}> = Object.freeze([
  {
    // 'vendor_additional_branch__{branch_id}' → flip branch active + stamp 28d period.
    match: (serviceKey) => branchIdFromServiceKey(serviceKey) !== null,
    run: async (ctx) => {
      const branchId = branchIdFromServiceKey(ctx.serviceKey);
      if (!branchId) return;
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
      const { count } = await ctx.admin
        .from('orders')
        .select('order_id', { count: 'exact', head: true })
        .eq('service_key', seatServiceKey(vendorProfileId))
        .eq('status', 'paid');
      const paidSeats = Math.max(count ?? 0, 0);
      const { error } = await ctx.admin
        .from('vendor_profiles')
        .update({ extra_agent_seats: paidSeats })
        .eq('vendor_profile_id', vendorProfileId);
      if (error) {
        throw new Error(`vendor_extra_seat activation write failed: ${error.message}`);
      }
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
    // flip the vendor to tier_state='custom' + promote the org's newest quoted /
    // pending plan to 'active' so the effective-caps overlay
    // (lib/vendor-effective-caps.ts) reads the composed ceilings. The one-active-
    // plan unique index (WHERE status='active') means a stale prior active row
    // must be demoted first — so this idempotently retires every OTHER active
    // plan for the org to 'lapsed', then activates this order's plan. Re-approval
    // is safe (the target is already active → the UPDATEs are no-ops).
    match: (serviceKey) => vendorProfileIdFromCustomPlanServiceKey(serviceKey) !== null,
    run: async (ctx) => {
      const vendorProfileId = vendorProfileIdFromCustomPlanServiceKey(ctx.serviceKey);
      if (!vendorProfileId) return;

      // The plan this order quoted — the most-recently-updated non-terminal row
      // for the org (quoted / pending_payment / active). We activate exactly one.
      const { data: target } = await ctx.admin
        .from('vendor_custom_plans')
        .select('custom_plan_id, status')
        .eq('vendor_profile_id', vendorProfileId)
        .in('status', ['quoted', 'pending_payment', 'active'])
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const targetId = (target as { custom_plan_id?: string } | null)?.custom_plan_id ?? null;
      if (!targetId) return; // nothing to provision (defensive)

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
 * Run the activation hook (if any) for a freshly-paid order. NEVER throws —
 * each hook is wrapped; failures are logged and swallowed so the parent
 * approval flow completes. No-op for any service_key without a registered hook.
 */
export async function activateOrderSku(ctx: ActivationContext): Promise<void> {
  const exact = EXACT_HOOKS[ctx.serviceKey];
  const hook = exact ?? PREFIX_HOOKS.find((h) => h.match(ctx.serviceKey))?.run;
  if (!hook) return; // default no-op
  try {
    await hook(ctx);
  } catch (e) {
    console.error(`[sku-activation] hook for ${ctx.serviceKey} threw (non-fatal):`, e);
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
 * Reverse the flag-backed side effects of an order that was just REVERSED
 * (rejectPayment → cancelled · refundOrder → refunded). NEVER throws (wrapped +
 * logged), symmetric to activateOrderSku. MUST be called AFTER the order's
 * status flip is committed so the re-derivation sees the new state.
 *
 * Only entitlements with a STORED flag need reversing — today just SETNAYAN_AI.
 * PAPIC_SEATS' activation (seat provisioning) is orders-backed and needs no
 * reversal. Orders-backed gates need
 * nothing here. Fires for a direct SETNAYAN_AI reversal OR a bundle reversal
 * (the bundle that granted it).
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
  }
}
