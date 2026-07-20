// lib/vendor-autoreply/inbox-hook.ts
//
// Phase 3b — the live inbox hook. When a COUPLE message lands on a thread
// whose vendor enabled the Auto-Reply Assistant, this orchestrator (scheduled
// via Next.js `after()` from sendChatMessageCore, so it never blocks the human
// send) builds the vendor's store snapshot + the couple's Event Brief, runs the
// deterministic engine, and either posts an AI-labelled bot reply or logs a
// handoff. What's-Next doc §3b; build plan §3/§4.
//
// Contracts this file enforces:
//   • FLAG-DARK — everything behind NEXT_PUBLIC_VENDOR_AUTOREPLY_V1 (default
//     OFF). Flag off = this function returns before touching the DB.
//   • FAIL-CLOSED — the entire pipeline runs inside try/catch and NEVER
//     throws: a bot failure must never block, delay, or error the couple's
//     message (which was already inserted before `after()` even scheduled us).
//   • LOOP-GUARD — only senderRole==='couple' proceeds. The bot's own posts
//     are sender_role='vendor' / is_bot=true, so they can never re-trigger it.
//   • SINGLE-TENANT ISOLATION (§2A hard lock) — every read below is scoped to
//     THIS thread's vendor_profile_id / event_id. The service-role client
//     bypasses RLS, so the scoping here is the isolation boundary: the bot
//     reads ONLY its own vendor's store + ONLY the inquiring couple's event.
//   • DAILY CAP — counts vendor_bot_replies since start of Manila day against
//     vendor_bot_config.daily_reply_cap (handoff log rows count too: the cap
//     bounds engine RUNS per day, a straightforward reading a vendor can audit
//     in the log).
//
// Service-role write path (§3b.2): sendChatMessageCore derives sender_role
// from the live user and can't set is_bot, so the bot posts via the admin
// client directly — precedent: lib/pending-inquiries.ts.

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '../supabase/admin';
import { vendorAutoReplyEnabled } from '../vendor-autoreply-flag';
import { buildEventBrief, type EventBriefSource } from '../event-brief';
import {
  fetchVendorServices,
  fetchDiscountsByService,
  fetchInclusionsByService,
} from '../vendor-services';
import { fetchAddonsByService } from '../vendor-service-addons';
import { fetchLatestReviewsByVendor } from '../vendor-reviews-preview';
import type { VendorCoverageRow } from '../vendor-coverages';
import type { VendorPackageWithItems } from '../vendor-packages';
import { toEventBriefLite, toStoreSnapshot } from './adapter';
import { maybeAutoAccept } from './auto-accept';
import { decideReply } from './engine';
import { evaluateAutoReplyGate, startOfManilaDayIso } from './inbox-decision';

/** chat_messages CHECK caps body at 4000 chars — never let a long templated
 *  answer violate it (fail the CHECK → fail-closed → no reply at all). */
const MAX_BODY = 4000;

export type RunVendorAutoReplyInput = {
  threadId: string;
  /** Role of the message that triggered us — the loop-guard re-checks it here
   *  (defense in depth; the chat-send call site already gates on 'couple'). */
  senderRole: string;
};

/**
 * Run the Auto-Reply pipeline for one just-landed couple message.
 *
 * `adminOverride` exists for unit tests only — production callers omit it and
 * get the real service-role client (created lazily INSIDE the try, so a
 * missing env var is also fail-closed).
 */
export async function runVendorAutoReply(
  input: RunVendorAutoReplyInput,
  adminOverride?: SupabaseClient,
): Promise<void> {
  // Cheap pure pre-checks (no client construction, no DB) — flag off or a
  // non-couple sender exits before anything else happens. The same two rules
  // are re-encoded in evaluateAutoReplyGate below as the single tested
  // authority; this early exit just keeps the OFF path at literally zero work.
  if (!vendorAutoReplyEnabled() || input.senderRole !== 'couple') return;

  try {
    const admin = adminOverride ?? createAdminClient();

    // 1. Thread → vendor + event scope. Everything after this is keyed to
    //    these two ids (single-tenant isolation).
    const { data: thread } = await admin
      .from('chat_threads')
      .select('thread_id,event_id,vendor_profile_id,inquiry_status,compat_score_at_inquiry')
      .eq('thread_id', input.threadId)
      .maybeSingle();
    if (!thread) return;
    const vendorId = thread.vendor_profile_id as string;
    const eventId = thread.event_id as string;

    // 2. Bot config (opt-in) + 3. daily-cap count → the tested gate decides.
    //    The auto_accept_* trio rides along for the Phase-4A step at the tail.
    const { data: config } = await admin
      .from('vendor_bot_config')
      .select('enabled,daily_reply_cap,auto_accept_enabled,auto_accept_threshold,daily_auto_accept_cap')
      .eq('vendor_profile_id', vendorId)
      .maybeSingle();

    const { count: repliesToday } = await admin
      .from('vendor_bot_replies')
      .select('*', { count: 'exact', head: true })
      .eq('vendor_profile_id', vendorId)
      .gte('created_at', startOfManilaDayIso());

    const gate = evaluateAutoReplyGate({
      flagEnabled: vendorAutoReplyEnabled(),
      senderRole: input.senderRole,
      config: config
        ? {
            enabled: config.enabled === true,
            dailyReplyCap: Number(config.daily_reply_cap ?? 0),
          }
        : null,
      repliesToday: repliesToday ?? 0,
    });
    if (!gate.run) return;

    // 4. The couple's latest message = the inquiry the engine answers.
    //    Attachment-only messages have an empty body — nothing to classify.
    const { data: lastCouple } = await admin
      .from('chat_messages')
      .select('body')
      .eq('thread_id', input.threadId)
      .eq('sender_role', 'couple')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const inquiryText = ((lastCouple?.body as string | undefined) ?? '').trim();
    if (!inquiryText) return;

    // 5. Vendor identity — also the "vendor still exists" check.
    const { data: profile } = await admin
      .from('vendor_profiles')
      .select('business_name')
      .eq('vendor_profile_id', vendorId)
      .maybeSingle();
    if (!profile) return;

    // 6. Store snapshot — the vendor's OWN rows only (§2A). The per-service
    //    loaders fail soft (empty maps); packages/coverages/reviews/stats are
    //    inlined here with the same fail-soft posture so a missing side table
    //    degrades the answer rather than killing the reply.
    const services = await fetchVendorServices(admin, vendorId);
    const serviceIds = services.map((s) => s.vendor_service_id);
    const [inclusionsByService, discountsByService, addonsByService] = await Promise.all([
      fetchInclusionsByService(admin, serviceIds),
      fetchDiscountsByService(admin, serviceIds),
      fetchAddonsByService(admin, serviceIds),
    ]);

    const { data: pkgRows } = await admin
      .from('vendor_packages')
      .select(
        'package_id,vendor_profile_id,package_name,description,total_price_centavos,consumable_budget_centavos,is_consumable_flexible,primary_canonical_service,is_active,created_at,updated_at,items:vendor_package_items(item_id,package_id,canonical_service,service_description,is_default_included,replacement_value_centavos,display_order,created_at)',
      )
      .eq('vendor_profile_id', vendorId);
    const packages = (pkgRows ?? []) as unknown as VendorPackageWithItems[];

    const { data: covRows } = await admin
      .from('vendor_coverages')
      .select('id,public_id,canonical_service,event_types,faiths,created_at')
      .eq('vendor_profile_id', vendorId);
    const coverages = (covRows ?? []) as VendorCoverageRow[];

    const reviewsByVendor = await fetchLatestReviewsByVendor(admin, [vendorId]);
    const reviews = reviewsByVendor.get(vendorId) ?? [];

    const { data: stats } = await admin
      .from('vendor_review_stats')
      .select('avg_rating_overall,total_count')
      .eq('vendor_profile_id', vendorId)
      .maybeSingle();
    const reviewCount = stats ? Number(stats.total_count ?? 0) : null;
    const avgRating =
      stats && Number(stats.total_count ?? 0) > 0 ? Number(stats.avg_rating_overall ?? 0) : null;

    const store = toStoreSnapshot({
      businessName: ((profile.business_name as string | null) ?? '').trim(),
      services,
      inclusionsByService,
      discountsByService,
      addonsByService,
      packages,
      coverages,
      reviews,
      avgRating,
      reviewCount,
    });

    // 7. The inquiring couple's OWN event → Event Brief → lite contract.
    //    select('*') on purpose: EventBriefSource is admit-unknown over a loose
    //    subset of `events` columns, and a narrow column list would fail the
    //    whole reply whenever a listed column hasn't been migrated yet.
    const { data: eventRow } = await admin
      .from('events')
      .select('*')
      .eq('event_id', eventId)
      .maybeSingle();
    const event = eventRow ? toEventBriefLite(buildEventBrief(eventRow as EventBriefSource)) : null;

    // 8. Availability signal — NOT computed in this phase. Per the adapter
    //    contract (types.ts), dateAvailable must be keyed to event.primaryDate;
    //    passing undefined makes the engine give the soft "let me confirm the
    //    date" availability answer instead of a fabricated yes/no.
    const decision = decideReply({ inquiryText, store, event, signals: undefined });

    // 9. Act on the decision. Handoff = log only (the vendor replies as a
    //    human); reply/clarify = post the AI-labelled message, then log it.
    if (decision.action === 'handoff' || !decision.replyText) {
      await admin.from('vendor_bot_replies').insert({
        vendor_profile_id: vendorId,
        thread_id: thread.thread_id,
        message_id: null,
        intent: decision.intent,
        confidence: decision.confidence,
        action: 'handoff',
        was_llm: false,
      });
    } else {
      const { data: botMessage, error: insertError } = await admin
        .from('chat_messages')
        .insert({
          thread_id: thread.thread_id,
          event_id: eventId,
          vendor_profile_id: vendorId,
          sender_user_id: null,
          sender_role: 'vendor',
          is_bot: true,
          body: decision.replyText.slice(0, MAX_BODY),
        })
        .select('message_id')
        .single();
      if (insertError || !botMessage) {
        throw new Error(`bot message insert failed: ${insertError?.message ?? 'no row returned'}`);
      }

      const { error: logError } = await admin.from('vendor_bot_replies').insert({
        vendor_profile_id: vendorId,
        thread_id: thread.thread_id,
        message_id: botMessage.message_id as string,
        intent: decision.intent,
        confidence: decision.confidence,
        action: decision.action,
        was_llm: false,
      });
      if (logError) {
        // The reply already posted; a missing log row only under-counts the cap.
        // Surface it loudly so it can't rot silently.
        console.error('[vendor-autoreply] reply log insert failed:', logError.message);
      }
    }

    // 10. Phase 4A — compatibility auto-accept (What's-Next §7 / VFD-7). Runs
    //     AFTER the front-desk answer in BOTH branches (auto-accept is about
    //     the INQUIRY, not the question the engine could or couldn't answer).
    //     Fail-closed inside; the no-token path never places a hold; only a
    //     'pending' thread with the vendor opted in does any extra work.
    await maybeAutoAccept(
      {
        threadId: thread.thread_id,
        eventId,
        vendorProfileId: vendorId,
        inquiryStatus: (thread.inquiry_status as string | null) ?? null,
        existingCompatScore:
          typeof thread.compat_score_at_inquiry === 'number'
            ? thread.compat_score_at_inquiry
            : null,
        businessName: ((profile.business_name as string | null) ?? '').trim(),
        config: config
          ? {
              autoAcceptEnabled: config.auto_accept_enabled === true,
              autoAcceptThreshold: Number(config.auto_accept_threshold ?? 78),
              dailyAutoAcceptCap: Number(config.daily_auto_accept_cap ?? 0),
            }
          : null,
        avgRating,
        reviewCount,
        eventRow: (eventRow as Record<string, unknown> | null) ?? null,
      },
      admin,
    );
  } catch (err) {
    // FAIL-CLOSED: never propagate — the couple's message must be unaffected.
    console.error('[vendor-autoreply] runVendorAutoReply failed (non-fatal):', err);
  }
}
