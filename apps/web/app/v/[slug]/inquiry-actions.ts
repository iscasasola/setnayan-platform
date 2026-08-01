'use server';

/**
 * startServiceInquiry — couple opens an inquiry from a vendor's public profile
 * (/v/[slug]) with structured per-service interest context (owner-locked
 * 2026-06-12 "Link-gated build cascade + multi-service inquiry mapping").
 *
 * Converges on the ONE chat_threads UNIQUE(event_id, vendor_profile_id) thread:
 *   1. Pick the couple's primary event (single active event; multi-event hosts
 *      use the dashboard flow).
 *   2. follow the vendor (satisfies the iteration 0019 follow-gate RLS).
 *   3. Upsert the thread by (event_id, vendor_profile_id) — an EXISTING thread
 *      resolves to UPDATE, so re-inquiring just appends interests instead of
 *      failing the UNIQUE constraint or spawning a second thread.
 *   4. Post the first couple message (only when the thread is brand-new / has no
 *      messages yet — never double-posts the inquiry note on a resumed thread).
 *   5. Record thread_service_interests: the clicked service (source='initial'),
 *      its price-included vendor_service_links (source='linked'), and any extra
 *      standalone services the couple opted into (source='couple_added').
 *
 * Does NOT touch the token/accept flow — interests are metadata on the single
 * thread + the single burn-on-answer unlock (a re-accept is free + un-gated, so
 * cross-sell can never double-charge the vendor).
 */

import { revalidatePath } from 'next/cache';
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchUserEvents } from '@/lib/events';
import { followVendor } from '@/lib/follow-actions';
import { recordThreadInterests, type InterestSeed } from '@/lib/thread-interests';
import { resolveLivePax } from '@/lib/pax';
import { setEventPreference } from '@/lib/event-preferences';
import {
  buildRequirementsBlock,
  isPersistableCanonicalService,
} from '@/lib/requirements-capture';
import { sendChatMessageCore } from '@/lib/chat-send';
import {
  buildNotSentReasonFor,
  formatPackagePicksBlock,
  sanitizePackagePicks,
  type BuildNotSentReason,
} from '@/lib/package-picks-summary';
import { inquiryGateEnabled, evaluateInquiryVelocity } from '@/lib/inquiry-gate';
import { isInquirySource, type InquirySource } from '@/lib/inquiry-source';
import {
  resolveReferringChapter,
  resolveIsReturning,
  stampThreadProvenance,
} from '@/lib/inquiry-attribution';

const INQUIRY_BODY =
  "Hi! We're planning our wedding and would love to hear about your " +
  'availability and packages for our date. Could you share your rates and ' +
  "what's included?";

/**
 * Lead-in for a package build appended to a thread that ALREADY has messages.
 * A brand-new thread opens with INQUIRY_BODY and carries the build inside that
 * first message; a resumed one gets this instead, because "Hi! We're planning
 * our wedding" reads as a stranger on a conversation already in progress.
 */
const PACKAGE_ASK_BODY =
  'We put together a version of your package — could you take a look and let ' +
  'us know if this works?';

export type StartServiceInquiryResult =
  | { status: 'ok'; threadId: string; eventId: string; isExisting: boolean }
  /**
   * The thread opened (or resumed) and the interests were recorded, but the
   * message carrying the couple's PACKAGE BUILD did not post.
   *
   * 🚨 THE BUILD IS THE DELIVERABLE on that path — nothing else in the thread
   * carries it — so "the thread exists" is NOT success, and this must never be
   * collapsed into `'ok'`. `reason` says why (`followup_used` = the pre-accept
   * one-follow-up gate, which is deliberate and is NOT bypassed here;
   * `declined` = closed conversation; `contact_blocked` = the off-platform
   * contact filter; `failed` = anything else) and `message` is the couple-
   * facing explanation, already the server's own teaching copy for a block.
   *
   * ONLY reachable when `requirements.packagePicks` was supplied, i.e. from the
   * lock modal's "ask instead" action. Every other caller passes no build, so
   * no shipped call site can observe this status.
   */
  | {
      status: 'ok_build_not_sent';
      threadId: string;
      eventId: string;
      isExisting: boolean;
      reason: BuildNotSentReason;
      message: string;
    }
  | { status: 'not_signed_in' }
  | { status: 'not_secured' }
  | { status: 'no_event' }
  | { status: 'error'; message: string };

/** Outcome of posting one message into an already-resolved thread. */
type MessageDelivery =
  | { ok: true }
  | { ok: false; reason: BuildNotSentReason; message: string };

/**
 * Post one couple-authored message into a thread and REPORT WHAT HAPPENED.
 *
 * Calls `sendChatMessageCore` — the shared gating+insert+notify core — directly
 * rather than the `sendChatMessage` server action, because the action maps its
 * result onto a FORM surface: it throws for `followup_used` / `declined` /
 * `insert_failed` and returns silently for `contact_blocked`. Both shapes are
 * unusable to a caller that needs to know whether the message landed, and the
 * throw-and-swallow is exactly how this action came to claim a delivery that
 * never happened. `chat-send.ts` documents this as its intended reuse: "Returns
 * a discriminated result instead of throwing/redirecting, so each caller maps
 * it to its own surface."
 *
 * Behaviour is otherwise identical to the old call — the action only added
 * `revalidatePath`/`redirect`, and only when a `return_to` was set, which this
 * path never sets.
 */
async function postThreadMessage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  threadId: string,
  body: string,
): Promise<MessageDelivery> {
  try {
    const result = await sendChatMessageCore(supabase, { threadId, body });
    if (result.ok) return { ok: true };
    return {
      ok: false,
      reason: buildNotSentReasonFor(result.code),
      message: result.message,
    };
  } catch (caught) {
    // The core is written to return rather than throw; a throw here is a
    // genuine surprise (transient network / a bug), so it is reported as a
    // failure instead of being swallowed into a false success.
    return {
      ok: false,
      reason: 'failed',
      message: caught instanceof Error ? caught.message : 'Could not send the message.',
    };
  }
}

export async function startServiceInquiry(input: {
  vendorProfileId: string;
  /**
   * Event-scoped callers (the couple's shortlist / build workspace, which is
   * bound to ONE event) pass the explicit event this inquiry belongs to. It is
   * VALIDATED against the caller's own couple events — a non-owned / unknown id
   * resolves to `no_event`, never a cross-event write. Omitted → the couple's
   * primary event (events[0]), the public-profile composer default.
   * (owner 2026-07-17 — shortlist inquiry-source wiring.)
   */
  eventId?: string | null;
  /**
   * Who initiated this call. 'manual' (default) = the couple pressed Inquire in
   * the composer → subject to the Phase-A velocity gate. 'system' = a legitimate
   * batch fan-out (the pending-pick dispatcher flushing saved picks) → exempt, so
   * securing an account and flushing a shortlist never trips the anti-spam cap.
   */
  source?: 'manual' | 'system';
  /** vendor_service the couple clicked Inquire on → source='initial'. */
  initialServiceId: string;
  /** Canonical category for the initial service (display/scoping). */
  initialCategoryKey: string | null;
  /** Extra standalone services the couple opted into → source='couple_added'. */
  alsoServiceIds: string[];
  /**
   * Bundle nudge (2026-06-20): the couple opted into "ask for ONE bundle price"
   * for the initial + also-added services. When set (and they added ≥1 extra),
   * the first inquiry message explicitly asks the vendor for a combined bundle
   * quote, so the vendor knows to price the services as one deal.
   */
  requestBundleQuote?: boolean;
  /**
   * Phase 1b PR-3 — per-category requirements capture. The couple's checked
   * facets keyed by the canonical_service_schemas field key (multi_select →
   * string[]), plus a freeform note and the carry-forward flag. All optional;
   * a couple that captures nothing sends a plain inquiry exactly as before.
   */
  requirements?: {
    /** Checked facet picks: field key → selected option values. */
    payload?: Record<string, string[]>;
    /** Freeform "anything specific?" note. */
    specialRequest?: string | null;
    /** "Auto-send to my next inquiries" → event_vendor_preferences.auto_send. */
    autoSend?: boolean;
    /**
     * "Ask the vendor about this build instead" (flag:
     * NEXT_PUBLIC_SERVICE_DETAILS_ENABLED) — the package the couple configured
     * in the lock modal but is not ready to pay for, serialized DISPLAY-ONLY by
     * `buildPackagePicksSummary`.
     *
     * 🚨 STRINGS, NOT MONEY. Every peso figure inside is the string the
     * couple's own screen printed (the modal's `choiceTotals` footer and each
     * option row's `+₱X`). This action does NOT re-price it, does not store it
     * as a quote, and nothing on this path charges anything — it is appended to
     * a chat message and nowhere else. It is sanitized (`sanitizePackagePicks`)
     * exactly like the freeform special-request note, because it arrives from a
     * browser; the rendered block always says the total is an estimate the
     * vendor confirms.
     *
     * Typed `unknown` on purpose: the shape crosses the client→server boundary,
     * so it is validated at the door rather than trusted by its declaration.
     */
    packagePicks?: unknown;
  };
  /**
   * Creator Economy PR-C — CTA-click attribution. The chapter public_id
   * (S89C-…) carried by the Book CTA (`/v/[slug]?ref_chapter=…`). Validated
   * server-side (published chapter · public profile · substrate credits THIS
   * vendor) before anything is stamped; a forged/stale value degrades to an
   * ordinary website inquiry. Stamped only on a BRAND-NEW thread — the chapter
   * whose CTA STARTED the thread keeps the credit (owner paper-lock).
   */
  referringChapterPublicId?: string | null;
  /**
   * Inquiry-source taxonomy (owner 2026-07-17). Caller-declared origin for
   * NON-chapter sources whose trigger surface is live (e.g. 'editorial' from a
   * /realstories credit chip). Validated against the enum; 'influencer' is
   * derived from a VALIDATED referral only, never trusted from this field.
   * Omitted/null = website default (stored NULL).
   */
  inquirySource?: InquirySource | string | null;
}): Promise<StartServiceInquiryResult> {
  const vendorProfileId = String(input.vendorProfileId ?? '').trim();
  const initialServiceId = String(input.initialServiceId ?? '').trim();
  if (!vendorProfileId || !initialServiceId) {
    return { status: 'error', message: 'Missing vendor or service' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'not_signed_in' };
  // Anon-draft guard: an anonymous user is technically "signed in" (real uid),
  // but sending an inquiry opens a two-way vendor thread the vendor may burn a
  // token to answer — and the reply would email the placeholder address and
  // bounce. Require securing the account first (convert-in-place keeps the same
  // uid + event, so nothing is lost). Dormant unless anon-draft is live.
  if (user.is_anonymous) return { status: 'not_secured' };

  // Event resolution. An event-scoped caller (shortlist / build workspace) may
  // pass an explicit event — HONORED only after validating the couple actually
  // hosts it (a forged / non-owned id resolves to no_event, never a cross-event
  // write). No explicit event → the public-profile composer default: the
  // couple's primary / single active event. Multi-event hosts pick the event
  // explicitly on the dashboard.
  const events = await fetchUserEvents(supabase, user.id, 'couple');
  const requestedEventId = String(input.eventId ?? '').trim();
  const eventId = requestedEventId
    ? (events.find((e) => e.event_id === requestedEventId)?.event_id ?? null)
    : (events[0]?.event_id ?? null);
  if (!eventId) return { status: 'no_event' };

  const admin = createAdminClient();

  // Check for an existing non-declined thread BEFORE touching follow/upsert.
  // The composer uses this to surface "You already have an inquiry" + "View thread".
  const { data: existingThread } = await supabase
    .from('chat_threads')
    .select('thread_id, inquiry_status')
    .eq('event_id', eventId)
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  const isExisting =
    existingThread?.thread_id != null &&
    (existingThread as { inquiry_status?: string | null }).inquiry_status !== 'declined';

  // ── Phase A · inquiry velocity gate (fake-inquiry protection) ──────────────
  // Only a brand-NEW, MANUAL inquiry can be spam. Resuming an existing thread
  // (isExisting) is never gated — that's a couple continuing a conversation they
  // already started. System fan-outs pass source:'system' and are exempt. The
  // whole gate is dormant until NEXT_PUBLIC_INQUIRY_GATE_ENABLED is flipped on.
  const source = input.source ?? 'manual';
  if (!isExisting && source === 'manual' && inquiryGateEnabled()) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    // Rolling-24h count of threads this couple opened across all their events.
    const { count: dailyCount } = await supabase
      .from('chat_threads')
      .select('thread_id', { count: 'exact', head: true })
      .eq('created_by_user_id', user.id)
      .gte('created_at', since);
    // Non-declined threads already open on THIS event.
    const { count: concurrentOpenCount } = await supabase
      .from('chat_threads')
      .select('thread_id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .neq('inquiry_status', 'declined');
    const verdict = evaluateInquiryVelocity({
      dailyCount: dailyCount ?? 0,
      concurrentOpenCount: concurrentOpenCount ?? 0,
    });
    if (!verdict.ok) {
      // Friendly, non-accusatory — surfaced via the composer's message channel.
      return { status: 'error', message: verdict.message };
    }
  }

  // Validate the submitted service ids belong to THIS vendor + are active —
  // host-supplied form data, so a stale/forged id should be dropped, not
  // recorded. adminClient bypasses vendor_services RLS (same pattern as the
  // dashboard add actions).
  const requestedIds = Array.from(
    new Set([initialServiceId, ...input.alsoServiceIds.map((s) => String(s).trim())].filter(Boolean)),
  );
  const { data: ownedServices } = await admin
    .from('vendor_services')
    .select('vendor_service_id, category')
    .eq('vendor_profile_id', vendorProfileId)
    .eq('is_active', true)
    .in('vendor_service_id', requestedIds);
  const ownedById = new Map(
    (ownedServices ?? []).map((s) => [
      s.vendor_service_id as string,
      (s.category as string | null) ?? null,
    ]),
  );
  if (!ownedById.has(initialServiceId)) {
    return { status: 'error', message: 'That service is no longer available.' };
  }

  // ── Phase 1b PR-3 · per-category requirements ──────────────────────────────
  // The leaf the couple inquired on. This is the FK target for
  // event_vendor_preferences.canonical_service: it equals vendor_services.category
  // (~1:1 with canonical_service_schemas), preferring the explicit categoryKey the
  // composer sent, else the validated owned service's category. A handful of legacy
  // categories have no schema row → the persist below FK-checks + gracefully skips.
  const requirementCanonicalService =
    input.initialCategoryKey?.trim() || ownedById.get(initialServiceId) || null;

  // Sanitize the checkbox payload: keep only string keys → arrays of non-empty
  // strings. Forged/odd shapes degrade to {} rather than poisoning the JSONB.
  const requirementPayload: Record<string, string[]> = {};
  const rawPayload = input.requirements?.payload;
  if (rawPayload && typeof rawPayload === 'object') {
    for (const [key, values] of Object.entries(rawPayload)) {
      if (!key || !Array.isArray(values)) continue;
      const picks = Array.from(
        new Set(values.map((v) => String(v).trim()).filter((v) => v.length > 0)),
      );
      if (picks.length > 0) requirementPayload[key] = picks;
    }
  }
  const requirementSpecialRequest =
    typeof input.requirements?.specialRequest === 'string'
      ? input.requirements.specialRequest.trim()
      : '';
  const requirementAutoSend = input.requirements?.autoSend === true;
  const requirementsBlock = buildRequirementsBlock(
    requirementPayload,
    requirementSpecialRequest || null,
  );
  // The configured package, if the couple came from the lock modal's "ask
  // instead" action. '' when absent or unusable, so every concatenation below
  // is unconditional.
  const packagePicksBlock = formatPackagePicksBlock(
    sanitizePackagePicks(input.requirements?.packagePicks),
  );

  // follow → upsert thread → first message (best-effort message). Mirrors the
  // canonical inquiry pattern in unlock-category.ts.
  try {
    await followVendor(vendorProfileId);
  } catch {
    /* follow is the gate; the upsert below also passes for an existing thread */
  }

  // Live pax to snapshot onto this inquiry (Adaptive Pax Pricing Phase 3).
  const livePax = await resolveLivePax(supabase, eventId);

  const { data: thread, error: threadErr } = await supabase
    .from('chat_threads')
    .upsert(
      {
        event_id: eventId,
        vendor_profile_id: vendorProfileId,
        created_by_user_id: user.id,
        // Re-inquiring RESUMES a previously-removed thread: un-archive it so the
        // preserved conversation returns to the active list (migration
        // 20270926679942). No-op on a fresh INSERT (defaults NULL).
        archived_at: null,
        ...(livePax != null ? { pax_current: livePax } : {}),
      },
      { onConflict: 'event_id,vendor_profile_id' },
    )
    .select('thread_id, pax_at_inquiry')
    .single();
  if (threadErr || !thread?.thread_id) {
    return {
      status: 'error',
      message: threadErr?.message ?? 'Could not open the conversation.',
    };
  }
  const threadId = thread.thread_id as string;
  // Snapshot the count the vendor first quoted against, exactly once.
  if (livePax != null && thread.pax_at_inquiry == null) {
    await supabase
      .from('chat_threads')
      .update({ pax_at_inquiry: livePax })
      .eq('thread_id', threadId);
  }

  // ── Creator Economy PR-C · provenance stamp (brand-NEW threads only) ───────
  // CTA-click attribution lock: the chapter whose Book CTA STARTED the thread
  // gets the credit — a resumed thread keeps its original provenance untouched.
  // A validated chapter referral wins ('influencer'); otherwise an enum-valid
  // caller-declared source (e.g. 'editorial') is stored; otherwise NULL =
  // Website Inquiry. is_returning is a companion flag computed from the same
  // returning=1-token signal the token bands used. All best-effort.
  if (!isExisting) {
    const [resolvedReferral, returning] = await Promise.all([
      resolveReferringChapter(input.referringChapterPublicId, vendorProfileId),
      resolveIsReturning(vendorProfileId, eventId),
    ]);
    // Self-referral guard (G2, PR-C money-path review): a creator must not tick
    // their OWN "inquiries driven" count by inquiring through their own chapter's
    // Book CTA. When the credited chapter belongs to the inquirer, DROP the
    // referral (treat as a normal Website inquiry) — never error the inquiry.
    const referral =
      resolvedReferral && resolvedReferral.creatorUserId === user.id
        ? null
        : resolvedReferral;
    // Caller-declared source is only honored for enum values whose trigger
    // surface the SERVER doesn't own: 'influencer' is derived from a validated
    // referral, and 'degree' is unwired (server-set only) — reject both if a
    // client supplies them.
    const declaredSource =
      isInquirySource(input.inquirySource) &&
      input.inquirySource !== 'influencer' &&
      input.inquirySource !== 'degree'
        ? input.inquirySource
        : null;
    await stampThreadProvenance(threadId, {
      referringChapterId: referral?.chapterId ?? null,
      inquirySource: referral ? 'influencer' : declaredSource,
      isReturning: returning,
    });
  }

  // Only post the inquiry note when the thread has no messages yet — a resumed
  // thread (couple re-inquiring about more services) just gets the new
  // interests, not a duplicate inquiry message.
  const { count: msgCount } = await admin
    .from('chat_messages')
    .select('message_id', { count: 'exact', head: true })
    .eq('thread_id', threadId);
  //
  // 🚨 DELIVERY IS OBSERVED, NOT ASSUMED, whenever a package build rides along.
  // The canned inquiry note stays best-effort (the thread + interests are the
  // point, and the couple is taken to the conversation either way), but a build
  // is the ONLY carrier of what the couple just configured — so its outcome is
  // captured and returned. `null` = no build was sent, nothing to report.
  let buildDelivery: MessageDelivery | null = null;
  if ((msgCount ?? 0) === 0) {
    // Append the couple's captured requirements so the vendor sees what
    // they're looking for on first contact (a dedicated vendor "Their
    // requirements" panel is a later slice — body-append suffices here).
    // Bundle nudge: when the couple opted into a single bundle price AND
    // added ≥1 extra service, say so explicitly so the vendor prices the set
    // as one deal (the thread interests already list which services).
    const bundleAsk =
      input.requestBundleQuote && input.alsoServiceIds.length > 0
        ? '\n\nWe’d love to book a few of your services together — could you send us one bundle price?'
        : '';
    const delivery = await postThreadMessage(
      supabase,
      threadId,
      `${INQUIRY_BODY}${requirementsBlock}${packagePicksBlock}${bundleAsk}`,
    );
    // Reported only when the build was inside that message; otherwise the note
    // stays best-effort exactly as it has always been.
    if (packagePicksBlock) buildDelivery = delivery;
  } else if (packagePicksBlock) {
    // ── The build, on a thread that already has messages ──────────────────
    // The rule above ("only post the inquiry note on a brand-new thread") is
    // what stops a couple re-inquiring from double-posting the SAME canned
    // note, and it stays. But a package build is not that note: it is new
    // information the couple just authored, and dropping it silently would
    // leave them believing they had sent their picks. So it appends to the
    // SAME deduped thread — the one this action already upserted — through the
    // same core the first message uses. No second thread, no second threading
    // model, and nothing is posted when there is no build.
    //
    // This is also where the pre-accept ONE-FOLLOW-UP gate bites: a couple who
    // already nudged a vendor that has not accepted cannot post again, and that
    // gate is NOT bypassed here. It is REPORTED — see `ok_build_not_sent`.
    buildDelivery = await postThreadMessage(
      supabase,
      threadId,
      `${PACKAGE_ASK_BODY}${packagePicksBlock}`,
    );
  }

  // Build the interest seeds: initial → its linked services → couple_added.
  // Also track confirmedServiceIds for persisting to event_vendors.
  const confirmedServiceIds: string[] = [initialServiceId];
  const seeds: InterestSeed[] = [
    {
      vendorServiceId: initialServiceId,
      categoryKey: input.initialCategoryKey ?? ownedById.get(initialServiceId) ?? null,
      source: 'initial',
    },
  ];

  const { data: links } = await admin
    .from('vendor_service_links')
    .select('linked_canonical_service')
    .eq('vendor_service_id', initialServiceId);
  for (const link of links ?? []) {
    const key = (link as { linked_canonical_service?: string | null }).linked_canonical_service;
    if (key) seeds.push({ vendorServiceId: null, categoryKey: key, source: 'linked' });
  }

  // Build the full set of validated service IDs for requested_service_ids
  for (const rawId of input.alsoServiceIds) {
    const id = String(rawId).trim();
    if (!id || id === initialServiceId || !ownedById.has(id)) continue;
    seeds.push({
      vendorServiceId: id,
      categoryKey: ownedById.get(id) ?? null,
      source: 'couple_added',
    });
    confirmedServiceIds.push(id);
  }

  await recordThreadInterests(supabase, {
    threadId,
    addedByRole: 'couple',
    seeds,
  });

  /**
   * Report an `event_vendors` write fault WITHOUT failing the inquiry.
   *
   * ⚠ WHY THIS EXISTS — the write below can fail for a reason that is invisible
   * today and will stay invisible until a real vendor service row exists.
   *
   * `event_vendors.category` is the strict Postgres enum `vendor_category`
   * (`band_dj`, `host_emcee`, `planner_coordinator`, … 51 values). The value we
   * put in it comes from `vendor_services.category`, which is plain **TEXT** and
   * is treated as a CANONICAL TILE key elsewhere in the app (`live_band`,
   * `host_mc`, `coordinator` — see `lib/vendor-category-taxonomy.ts`). Those two
   * vocabularies do not overlap: `live_band` ∉ `vendor_category`. If a real row
   * carries the tile vocabulary, this insert fails with
   * `invalid input value for enum vendor_category` — the exact shape of the
   * 2026-05-22 `guest_role: "bride"` incident.
   *
   * We deliberately do NOT translate between the vocabularies here. `vendor_services`
   * has **0 rows in production**, so any mapping would be a guess about data that
   * does not exist yet, and the Song Desk build order explicitly defers it
   * ("needs one real vendor service row to settle" — never another hand-kept enum
   * list). What we fix is that the failure was UNOBSERVABLE: the attempted
   * `category` value is reported, so the FIRST real occurrence settles which
   * vocabulary actually lands and the deferred decision becomes evidence-based.
   *
   * Non-fatal by design: the thread, the message and the service interests have
   * already been written. Failing the couple's inquiry over a bookkeeping row
   * would be a worse outcome than a missing row we can reconstruct from
   * `thread_service_interests`.
   *
   * No PII: internal IDs and a taxonomy key only — never the vendor's name or
   * anything the couple typed (0035 · no PII in logs).
   */
  const reportEventVendorFault = (
    stage: 'insert' | 'update' | 'threw',
    err: unknown,
    attemptedCategory: string | null,
  ): void => {
    Sentry.captureException(err, {
      tags: {
        feature: 'inquiry-event-vendor-write',
        stage,
        // The signal that settles the vocabulary question when it first fires.
        attempted_category: attemptedCategory ?? 'n/a',
      },
      extra: { eventId, vendorProfileId, initialServiceId },
    });
  };

  // Persist requested_service_ids onto the event_vendors row that links this
  // couple's event to this marketplace vendor. The upsert on chat_threads above
  // guarantees the thread exists; the event_vendors row may have been created
  // by a prior save-to-picks or auto-add. We use array_cat to merge (not
  // overwrite) so a resumed inquiry adds new services to the existing set.
  // Best-effort: a missing row or missing column (migration not yet applied)
  // must never block the inquiry — but it is now REPORTED, not discarded.
  try {
    // Look up the event_vendors row for this (event, marketplace_vendor) pair.
    const { data: evRow } = await supabase
      .from('event_vendors')
      .select('vendor_id, requested_service_ids')
      .eq('event_id', eventId)
      .eq('marketplace_vendor_id', vendorProfileId)
      .maybeSingle();

    if (evRow?.vendor_id) {
      // Merge: union the new service IDs with any already stored. Cast through
      // unknown to satisfy TypeScript's strict mode — the column is a new
      // nullable/jsonb-like UUID[] field that the generated types may not know yet.
      const existing: string[] = Array.isArray(
        (evRow as unknown as { requested_service_ids?: string[] }).requested_service_ids,
      )
        ? ((evRow as unknown as { requested_service_ids: string[] }).requested_service_ids)
        : [];
      const merged = Array.from(new Set([...existing, ...confirmedServiceIds]));
      const { error: updateError } = await supabase
        .from('event_vendors')
        .update({ requested_service_ids: merged } as Record<string, unknown>)
        .eq('vendor_id', evRow.vendor_id as string);
      if (updateError) reportEventVendorFault('update', updateError, null);
    } else if (confirmedServiceIds.length > 0) {
      // No event_vendors row yet — create a minimal one so the service list is
      // persisted. This mirrors the auto-add path in unlock-category.ts.
      // Resolve the initial service's category for the required 'category' column.
      const categoryForRow = ownedById.get(initialServiceId) ?? null;
      if (categoryForRow) {
        // Fetch vendor name for the vendor_name column (required, non-null in schema).
        const { data: profRow } = await admin
          .from('vendor_profiles')
          .select('business_name')
          .eq('vendor_profile_id', vendorProfileId)
          .maybeSingle();
        const vendorNameForRow =
          (profRow as { business_name?: string | null } | null)?.business_name?.trim() || 'Vendor';
        const { error: insertError } = await supabase.from('event_vendors').insert({
          event_id: eventId,
          category: categoryForRow,
          vendor_name: vendorNameForRow,
          status: 'considering',
          marketplace_vendor_id: vendorProfileId,
          service_id: initialServiceId,
          requested_service_ids: confirmedServiceIds,
        } as Record<string, unknown>);
        if (insertError) reportEventVendorFault('insert', insertError, categoryForRow);
      }
    }
  } catch (caught) {
    // Kept for genuine throws. NOTE: the supabase-js calls above do NOT throw on
    // a database error — they RETURN `{ error }` — so this block was never the
    // thing catching them. The `if (error)` checks above are.
    reportEventVendorFault('threw', caught, null);
  }

  // Persist the couple's saved requirements template for this category so it
  // pre-fills next time + (when auto_send) can carry forward. Best-effort:
  //  · only when there's something to save (facets / note / auto-send), and
  //  · only when the leaf maps to a real canonical_service_schemas row (the FK
  //    target) — an unmappable legacy category gracefully SKIPS the save while
  //    the inquiry above already went through untouched.
  const hasRequirements =
    Object.keys(requirementPayload).length > 0 ||
    requirementSpecialRequest.length > 0 ||
    requirementAutoSend;
  if (hasRequirements && requirementCanonicalService) {
    try {
      const persistable = await isPersistableCanonicalService(
        admin,
        requirementCanonicalService,
      );
      if (persistable) {
        await setEventPreference(admin, eventId, requirementCanonicalService, requirementPayload, {
          specialRequest: requirementSpecialRequest || null,
          autoSend: requirementAutoSend,
        });
      }
    } catch {
      /* best-effort — the inquiry already sent + carries the requirements in
         its body; failing to save the reusable template never blocks it */
    }
  }

  revalidatePath(`/dashboard/${eventId}/messages/${threadId}`);
  // The thread + interests landed either way; what differs is whether the
  // couple's BUILD reached the vendor. Say which — never claim a delivery that
  // did not happen.
  if (buildDelivery && !buildDelivery.ok) {
    return {
      status: 'ok_build_not_sent',
      threadId,
      eventId,
      isExisting,
      reason: buildDelivery.reason,
      message: buildDelivery.message,
    };
  }
  return { status: 'ok', threadId, eventId, isExisting };
}
