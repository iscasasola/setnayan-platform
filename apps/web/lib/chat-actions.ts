'use server';

import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchThreadById } from './chat';
import { sendChatMessageCore } from './chat-send';
import { resolveCounterpartyUserIds } from './chat-block';
import { emitNotification } from './notification-emit';
import { isMissingRelationError, logQueryError } from '@/lib/supabase/error-detect';
import { triggerVendorActivityRecompute } from '@/lib/vendor-activity';
import { CONFIRMED_VENDOR_STATUSES } from '@/lib/events';

/**
 * Mark a thread as read for the current user — stamps (or refreshes)
 * chat_thread_reads.last_read_at = now() for (thread_id, auth.uid()). Called on
 * render when a user opens a thread (couple + vendor thread pages) so the
 * Messages-icon unread badge clears for threads they've actually seen.
 *
 * Takes a plain threadId (not FormData) so it can be invoked directly from a
 * server component's render path. NO-OP on ANY error — most importantly when
 * the chat_thread_reads table doesn't exist yet because the owner hasn't pushed
 * migration 20260728000000_chat_thread_reads.sql. Opening a thread must never
 * fail just because read-tracking isn't live; the unread count simply stays
 * stale (reads 0 via the same-migration RPC) until the migration lands. RLS on
 * the table already restricts writes to user_id = auth.uid(); we set user_id
 * explicitly to satisfy the WITH CHECK.
 */
export async function markThreadRead(threadId: string): Promise<void> {
  if (typeof threadId !== 'string' || threadId.length === 0) return;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('chat_thread_reads')
      .upsert(
        { thread_id: threadId, user_id: user.id, last_read_at: new Date().toISOString() },
        { onConflict: 'thread_id,user_id' },
      );
    if (error) {
      // Pre-migration (table absent) or a transient RLS/network error — log
      // and move on. Reading a thread is never blocked by read-marker writes.
      logQueryError(
        'markThreadRead',
        error,
        { thread_id: threadId, missing_relation: isMissingRelationError(error) },
        'graceful_degrade',
      );
    }
  } catch (caught) {
    logQueryError(
      'markThreadRead (threw)',
      caught instanceof Error ? caught : new Error(String(caught)),
      { thread_id: threadId },
      'graceful_degrade',
    );
  }
}

/**
 * Decides whether the current user is the couple or the vendor on a thread,
 * then inserts a message tagged with that role. Used by both /dashboard and
 * /vendor-dashboard so message creation is consistent across surfaces.
 */
export async function sendChatMessage(formData: FormData) {
  const threadId = formData.get('thread_id');
  const body = formData.get('body');
  const returnTo = formData.get('return_to');
  if (typeof threadId !== 'string' || typeof body !== 'string') {
    throw new Error('Invalid input');
  }

  const supabase = await createClient();
  const result = await sendChatMessageCore(supabase, { threadId, body });
  if (!result.ok) {
    // Empty body is a no-op redirect on web (the textarea simply stays put).
    if (result.code === 'empty') {
      if (typeof returnTo === 'string' && returnTo.startsWith('/')) redirect(returnTo);
      return;
    }
    if (result.code === 'unauthenticated') redirect('/login');
    throw new Error(result.message);
  }

  if (typeof returnTo === 'string' && returnTo.startsWith('/')) {
    revalidatePath(returnTo);
    redirect(returnTo);
  }
}

export async function notifyOtherParty(args: {
  threadId: string;
  eventId: string;
  vendorProfileId: string;
  senderRole: 'couple' | 'vendor';
  senderUserId: string;
  body: string;
  /**
   * True when the message being sent is the first one in the thread. Only
   * fires for couple-to-vendor direction (a booking inquiry). Used to swap
   * the notification type from chat_message to vendor_inquiry_received.
   */
  isFirstMessage?: boolean;
}): Promise<void> {
  const admin = createAdminClient();

  // Look up labels for the notification title (event name vs. vendor name).
  const [eventRes, vendorRes] = await Promise.all([
    admin
      .from('events')
      .select('display_name')
      .eq('event_id', args.eventId)
      .maybeSingle(),
    admin
      .from('vendor_profiles')
      .select('business_name, user_id')
      .eq('vendor_profile_id', args.vendorProfileId)
      .maybeSingle(),
  ]);

  const eventName = eventRes.data?.display_name ?? 'your event';
  const vendorName = vendorRes.data?.business_name?.trim() || 'a vendor';
  const preview = args.body.slice(0, 140);

  if (args.senderRole === 'couple') {
    // The vendor user is the recipient.
    if (!vendorRes.data?.user_id) return;
    if (args.isFirstMessage) {
      // First couple-to-vendor message — fire vendor_inquiry_received with a
      // longer preview (200 chars per spec) and a more pointed title.
      // Returning-client enrichment (owner-locked 2026-06-12): when this
      // couple previously CONFIRMED-booked the vendor on a different event,
      // say so in the notification + email. Best-effort — a null lookup
      // (error or simply no prior booking) falls back to the plain copy.
      const priorLocked = await findPriorLockedEventName(
        admin,
        args.eventId,
        args.vendorProfileId,
      );
      await emitNotification({
        userId: vendorRes.data.user_id,
        type: 'vendor_inquiry_received',
        title: priorLocked
          ? `New booking inquiry from ${eventName} — a returning client`
          : `New booking inquiry from ${eventName}`,
        body: priorLocked
          ? `This couple previously booked you for ${priorLocked}. ${args.body.slice(0, 200)}`
          : args.body.slice(0, 200),
        relatedUrl: `/vendor-dashboard/messages/${args.threadId}`,
      });
      return;
    }
    await emitNotification({
      userId: vendorRes.data.user_id,
      type: 'chat_message',
      title: `New message from ${eventName}`,
      body: preview,
      relatedUrl: `/vendor-dashboard/messages/${args.threadId}`,
    });
    return;
  }

  // sender is vendor — notify every couple user on the event.
  const { data: members } = await admin
    .from('event_members')
    .select('user_id')
    .eq('event_id', args.eventId)
    .eq('member_type', 'couple');
  for (const m of members ?? []) {
    if (m.user_id === args.senderUserId) continue;
    await emitNotification({
      userId: m.user_id,
      type: 'chat_message',
      title: `New message from ${vendorName}`,
      body: preview,
      relatedUrl: `/dashboard/${args.eventId}/messages/${args.threadId}`,
    });
  }
}

/**
 * Returning-client lookup for the inquiry-received notification (owner-locked
 * 2026-06-12: "when an inquiry from an old locked client, we want to notify
 * that this is coming from a client they previously locked"). Predicate =
 * prior CONFIRMED booking (event_vendors.status in CONFIRMED_VENDOR_STATUSES,
 * marketplace_vendor_id = this vendor) on a DIFFERENT event sharing a
 * couple-type event_members member with the inquiry's event — the same
 * (stricter) predicate as the inbox badge RPC (get_returning_client_flags),
 * but run with the admin client since this fires server-side at inquiry time
 * with no vendor session. Returns the most recent prior event's display_name,
 * or null on no match / any error (best-effort — never blocks the inquiry).
 */
async function findPriorLockedEventName(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
  vendorProfileId: string,
): Promise<string | null> {
  try {
    const { data: members } = await admin
      .from('event_members')
      .select('user_id')
      .eq('event_id', eventId)
      .eq('member_type', 'couple');
    const userIds = Array.from(
      new Set((members ?? []).map((m) => m.user_id).filter(Boolean)),
    );
    if (userIds.length === 0) return null;

    const { data: otherMemberships } = await admin
      .from('event_members')
      .select('event_id')
      .in('user_id', userIds)
      .eq('member_type', 'couple')
      .neq('event_id', eventId);
    const otherEventIds = Array.from(
      new Set((otherMemberships ?? []).map((m) => m.event_id).filter(Boolean)),
    );
    if (otherEventIds.length === 0) return null;

    const { data: booked } = await admin
      .from('event_vendors')
      .select('event_id')
      .eq('marketplace_vendor_id', vendorProfileId)
      .in('event_id', otherEventIds)
      .in('status', CONFIRMED_VENDOR_STATUSES as unknown as string[]);
    const bookedEventIds = Array.from(
      new Set((booked ?? []).map((b) => b.event_id).filter(Boolean)),
    );
    if (bookedEventIds.length === 0) return null;

    const { data: priorEvent } = await admin
      .from('events')
      .select('display_name')
      .in('event_id', bookedEventIds)
      .order('event_date', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    return priorEvent?.display_name?.trim() || null;
  } catch {
    // Best-effort enrichment only — never let it break inquiry delivery.
    return null;
  }
}

// ── Accept-gate vendor actions (CLAUDE.md 2026-06-02) ───────────────────────
// A vendor accepts a pending inquiry (chat opens both ways; the
// reveal_vendor_name_on_thread_accept trigger stamps name_revealed_at) or
// declines it (the couple is told + pointed at alternatives). Only the vendor
// on the thread may respond — a couple calling these fails the vendor check.

async function loadVendorThreadForActor(threadId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const thread = await fetchThreadById(supabase, threadId);
  if (!thread) throw new Error('Thread not found');

  const { data: vendor } = await supabase
    .from('vendor_profiles')
    .select('vendor_profile_id')
    .eq('vendor_profile_id', thread.vendor_profile_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!vendor) throw new Error('Only the vendor can respond to this inquiry');

  return { supabase, thread };
}

export async function acceptInquiry(formData: FormData) {
  const threadId = formData.get('thread_id');
  const returnTo = formData.get('return_to');
  if (typeof threadId !== 'string') throw new Error('Invalid input');

  // Expected token/tier failures below redirect back with ?error= (the toast
  // bridge surfaces it inline) instead of throwing to the error boundary.
  const back =
    typeof returnTo === 'string' && returnTo.startsWith('/')
      ? returnTo
      : `/vendor-dashboard/messages/${threadId}`;
  const fail = (msg: string): never =>
    redirect(`${back}${back.includes('?') ? '&' : '?'}error=1&msg=${encodeURIComponent(msg)}`);

  const { supabase, thread } = await loadVendorThreadForActor(threadId);

  if (thread.inquiry_status !== 'accepted') {
    // Burn-on-answer (owner-locked token economy 2026-06-05). Accepting an
    // inquiry IS the vendor's "answer" (a vendor can't even reply before
    // accepting). It costs ONE idempotent unlock per (vendor, event), banded
    // by the wedding's region (₱100/200/300 = 1/2/3 tokens), and that single
    // unlock covers ALL of this vendor's services for the event. The RPC
    // (unlock_vendor_event) is atomic + idempotent + TIER-GATED. Per the LIVE
    // body (migration 20270307985604, verified retune 2026-06-25): FREE can't
    // accept in-app inquiries; VERIFIED is capped at ≤10 new unlocks/rolling-week
    // AND burns 1-3 tokens per answer; SOLO/PRO/ENTERPRISE are uncapped + burn
    // 1-3 tokens. The band resolves events.region → public.regions.burn_band by
    // alias-match (burn-band single source, migration 20270331100000).
    //   NOTE — the old "FREE-VERIFIED answers free" carve-out and the returning-
    //   customer FLAT-1 "resync" branch are NO LONGER in the live RPC: the resync
    //   branch was dropped at 20270221294989 (vendor_tier_solo) and verified was
    //   moved onto the burning path at 20270307985604. Don't reason from those.
    // A re-accept of an already-unlocked (vendor,event) is free + un-gated. Any
    // RAISE rolls the whole tx back (no phantom unlock) — we surface a friendly,
    // tier-appropriate message and do NOT accept. The RPC also ownership-checks
    // the caller (defense-in-depth atop the loadVendorThreadForActor gate above).
    const { error: burnErr } = await supabase.rpc('unlock_vendor_event', {
      p_vendor_profile_id: thread.vendor_profile_id,
      p_event_id: thread.event_id,
    });
    if (burnErr) {
      if (/TIER_FREE_NO_INAPP/.test(burnErr.message)) {
        fail('Get your account verified to start receiving and answering couples in the app.');
      }
      if (/VERIFIED_WEEKLY_LIMIT/.test(burnErr.message)) {
        fail(
          'You’ve answered your 10 inquiries for this week. Upgrade to Pro for unlimited inquiries, or come back next week.',
        );
      }
      if (/INSUFFICIENT_WALLET_BALANCES/.test(burnErr.message)) {
        fail(
          'You need tokens to accept this inquiry. Top up your token balance, then try again — one unlock covers all your services for this event.',
        );
      }
      fail('Could not accept right now — please try again in a moment.');
    }

    const { error } = await supabase
      .from('chat_threads')
      .update({ inquiry_status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('thread_id', thread.thread_id);
    if (error) throw new Error(error.message);
    // The reveal_vendor_name_on_thread_accept trigger stamps name_revealed_at.
    await notifyCoupleOfInquiryOutcome({
      eventId: thread.event_id,
      vendorProfileId: thread.vendor_profile_id,
      threadId: thread.thread_id,
      type: 'inquiry_accepted',
    });
    // Part B — Setnayan Exclusive perk reveal (v2.1 §7.2).
    // After the vendor burns tokens to pursue an inquiry, insert one system
    // message per service that carries an exclusive_perk_text, using the
    // admin client so the 'system' sender_role bypasses couple/vendor RLS.
    await revealExclusivePerks({
      threadId: thread.thread_id,
      eventId: thread.event_id,
      vendorProfileId: thread.vendor_profile_id,
    });

    // Accepting IS the vendor's "answer" to an inquiry — refresh their
    // responsiveness/conversion stats (response_rate_pct, inquiry_to_booking_pct)
    // off the request path (cron-free; after() runs post-response).
    after(() => triggerVendorActivityRecompute(thread.vendor_profile_id));
  }

  if (typeof returnTo === 'string' && returnTo.startsWith('/')) {
    revalidatePath(returnTo);
    redirect(returnTo);
  }
  revalidatePath('/vendor-dashboard/messages');
}

export async function declineInquiry(formData: FormData) {
  const threadId = formData.get('thread_id');
  const returnTo = formData.get('return_to');
  const reasonRaw = formData.get('reason');
  const reason =
    typeof reasonRaw === 'string' && reasonRaw.trim().length > 0
      ? reasonRaw.trim().slice(0, 500)
      : null;
  if (typeof threadId !== 'string') throw new Error('Invalid input');

  const { supabase, thread } = await loadVendorThreadForActor(threadId);

  if (thread.inquiry_status === 'pending') {
    const { error } = await supabase
      .from('chat_threads')
      .update({
        inquiry_status: 'declined',
        declined_at: new Date().toISOString(),
        decline_reason: reason,
      })
      .eq('thread_id', thread.thread_id);
    if (error) throw new Error(error.message);
    await notifyCoupleOfInquiryOutcome({
      eventId: thread.event_id,
      vendorProfileId: thread.vendor_profile_id,
      threadId: thread.thread_id,
      type: 'inquiry_declined',
      reason,
    });
  }

  if (typeof returnTo === 'string' && returnTo.startsWith('/')) {
    revalidatePath(returnTo);
    redirect(returnTo);
  }
  revalidatePath('/vendor-dashboard/messages');
}

/**
 * Notify every couple member of the inquiry outcome. ACCEPTED reveals the
 * vendor's name (trigger), so it's safe to surface business_name + link to the
 * now-open thread. DECLINED keeps the vendor anonymous (no name leak per
 * hybrid-anonymity) and points the couple at alternatives on the Services tab.
 */
async function notifyCoupleOfInquiryOutcome(args: {
  eventId: string;
  vendorProfileId: string;
  threadId: string;
  type: 'inquiry_accepted' | 'inquiry_declined';
  /** Vendor's decline reason (declined only) · surfaced to the couple so the
   *  "no" crosses the wire. Anonymity preserved — no vendor name with it. */
  reason?: string | null;
}): Promise<void> {
  const admin = createAdminClient();
  const accepted = args.type === 'inquiry_accepted';

  let vendorName = 'A vendor';
  if (accepted) {
    const { data } = await admin
      .from('vendor_profiles')
      .select('business_name')
      .eq('vendor_profile_id', args.vendorProfileId)
      .maybeSingle();
    vendorName = data?.business_name?.trim() || 'A vendor';
  }

  const { data: members } = await admin
    .from('event_members')
    .select('user_id')
    .eq('event_id', args.eventId)
    .eq('member_type', 'couple');

  for (const m of members ?? []) {
    await emitNotification({
      userId: m.user_id,
      type: args.type,
      title: accepted
        ? `${vendorName} accepted your inquiry`
        : 'A vendor declined your inquiry',
      body: accepted
        ? 'Your chat is open — send a message to keep planning together.'
        : args.reason
          ? `Why: “${args.reason}” — browse similar vendors to keep your options open.`
          : 'They are not available — browse similar vendors to keep your options open.',
      relatedUrl: accepted
        ? `/dashboard/${args.eventId}/messages/${args.threadId}`
        : `/dashboard/${args.eventId}/vendors`,
    });
  }
}

// ── Setnayan Exclusive perk reveal (Part B, v2.1 §7.2) ──────────────────────
/**
 * After a vendor's token-pursue succeeds (burn_on_answer / acceptInquiry),
 * fetch all active services this vendor has for the event thread and insert
 * one 'system' chat message per service that carries exclusive_perk_text.
 *
 * The admin client is used (service-role) so the 'system' sender_role can
 * bypass the couple/vendor INSERT RLS that guards chat_messages — the same
 * pattern as the Build 3d-C re-quote nudge (migration 20270101010000).
 *
 * Best-effort: any error is logged and silently swallowed so the accept flow
 * is never blocked by a missing column (pre-migration) or an empty perk set.
 */
async function revealExclusivePerks(args: {
  threadId: string;
  eventId: string;
  vendorProfileId: string;
}): Promise<void> {
  try {
    const admin = createAdminClient();

    // Fetch the vendor's active services that carry a perk.
    // We scope to is_active=true since draft services aren't visible publicly.
    const { data: services } = await admin
      .from('vendor_services')
      .select('vendor_service_id,title,category,exclusive_perk_text')
      .eq('vendor_profile_id', args.vendorProfileId)
      .eq('is_active', true)
      .not('exclusive_perk_text', 'is', null);

    if (!services || services.length === 0) return;

    // Build one system message per service with a perk.
    const messages = services
      .filter(
        (s: { exclusive_perk_text?: string | null }) =>
          typeof s.exclusive_perk_text === 'string' && s.exclusive_perk_text.trim().length > 0,
      )
      .map((s: {
        vendor_service_id: string;
        title: string | null;
        category: string;
        exclusive_perk_text: string;
      }) => {
        const label = s.title?.trim() || s.category;
        return {
          thread_id: args.threadId,
          event_id: args.eventId,
          vendor_profile_id: args.vendorProfileId,
          // service-role insert — sender_user_id can be null for system msgs.
          sender_user_id: null as unknown as string,
          sender_role: 'system' as const,
          body: `**Setnayan Exclusive unlocked 🎁** ${label}: ${s.exclusive_perk_text}`,
        };
      });

    if (messages.length === 0) return;

    const { error } = await admin.from('chat_messages').insert(messages);
    if (error) {
      // Gracefully degrade — likely a pre-migration column miss. Never block accept.
      console.error('[revealExclusivePerks] insert error (non-blocking):', error.message);
    }
  } catch (caught) {
    console.error(
      '[revealExclusivePerks] threw (non-blocking):',
      caught instanceof Error ? caught.message : String(caught),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────
// UGC safety (Apple App Store Guideline 1.2) — REPORT + BLOCK the chat
// counterparty from the thread menu. Report reuses public.user_reports
// (target_type='user'); Block uses the additive blocked_users table (the
// chat_messages_block_guard RESTRICTIVE policy is the authoritative send
// block — these actions + the composer gating are the in-app surface).
// ─────────────────────────────────────────────────────────────────────────

const CHAT_REPORT_REASONS = new Set([
  'nudity_sexual',
  'violence',
  'hate_harassment',
  'spam',
  'not_my_event',
  'other',
]);

/** couple | vendor | null (not a member) — mirrors sendChatMessage's probe. */
async function resolveThreadRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  thread: { event_id: string; vendor_profile_id: string },
  userId: string,
): Promise<'couple' | 'vendor' | null> {
  const [coupleCheck, vendorCheck] = await Promise.all([
    supabase
      .from('event_members')
      .select('event_id')
      .eq('event_id', thread.event_id)
      .eq('user_id', userId)
      .eq('member_type', 'couple')
      .maybeSingle(),
    supabase
      .from('vendor_profiles')
      .select('vendor_profile_id')
      .eq('vendor_profile_id', thread.vendor_profile_id)
      .eq('user_id', userId)
      .maybeSingle(),
  ]);
  if (coupleCheck.data) return 'couple';
  if (vendorCheck.data) return 'vendor';
  return null;
}

function safeReturn(returnTo: FormDataEntryValue | null, suffix: string): string | null {
  return typeof returnTo === 'string' && returnTo.startsWith('/')
    ? `${returnTo}${returnTo.includes('?') ? '&' : '?'}${suffix}`
    : null;
}

export async function reportUser(formData: FormData) {
  const threadId = formData.get('thread_id');
  const reason = formData.get('reason');
  const details = formData.get('details');
  if (
    typeof threadId !== 'string' ||
    typeof reason !== 'string' ||
    !CHAT_REPORT_REASONS.has(reason)
  ) {
    throw new Error('Invalid report');
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const thread = await fetchThreadById(supabase, threadId);
  if (!thread) throw new Error('Thread not found');
  const role = await resolveThreadRole(supabase, thread, user.id);
  if (!role) throw new Error('Not a member of this thread');

  // target_id must be a real user id (target_type='user'). If we somehow can't
  // resolve the counterparty, fail loud rather than store a mis-typed id.
  const targetUserId = (await resolveCounterpartyUserIds(thread, role))[0];
  if (!targetUserId) throw new Error('Could not identify the person to report.');
  const { error } = await supabase.from('user_reports').insert({
    reporter_user_id: user.id,
    event_id: thread.event_id,
    target_type: 'user',
    target_id: targetUserId,
    reason,
    details:
      typeof details === 'string' && details.trim()
        ? details.trim().slice(0, 1000)
        : null,
  });
  if (error) throw new Error(error.message);

  const dest = safeReturn(formData.get('return_to'), 'reported=1');
  if (dest) {
    revalidatePath(dest);
    redirect(dest);
  }
}

export async function blockUser(formData: FormData) {
  const threadId = formData.get('thread_id');
  if (typeof threadId !== 'string') throw new Error('Invalid input');
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const thread = await fetchThreadById(supabase, threadId);
  if (!thread) throw new Error('Thread not found');
  const role = await resolveThreadRole(supabase, thread, user.id);
  if (!role) throw new Error('Not a member of this thread');

  const counterpartyIds = (await resolveCounterpartyUserIds(thread, role)).filter(
    (id) => id !== user.id,
  );
  if (counterpartyIds.length > 0) {
    const { error } = await supabase.from('blocked_users').upsert(
      counterpartyIds.map((id) => ({
        blocker_user_id: user.id,
        blocked_user_id: id,
      })),
      { onConflict: 'blocker_user_id,blocked_user_id', ignoreDuplicates: true },
    );
    if (error) throw new Error(error.message);
  }

  const dest = safeReturn(formData.get('return_to'), 'blocked=1');
  if (dest) {
    revalidatePath(dest);
    redirect(dest);
  }
}

export async function unblockUser(formData: FormData) {
  const threadId = formData.get('thread_id');
  if (typeof threadId !== 'string') throw new Error('Invalid input');
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const thread = await fetchThreadById(supabase, threadId);
  if (!thread) throw new Error('Thread not found');
  const role = await resolveThreadRole(supabase, thread, user.id);
  if (!role) throw new Error('Not a member of this thread');

  const counterpartyIds = await resolveCounterpartyUserIds(thread, role);
  if (counterpartyIds.length > 0) {
    const { error } = await supabase
      .from('blocked_users')
      .delete()
      .eq('blocker_user_id', user.id)
      .in('blocked_user_id', counterpartyIds);
    if (error) throw new Error(error.message);
  }

  const dest = safeReturn(formData.get('return_to'), 'unblocked=1');
  if (dest) {
    revalidatePath(dest);
    redirect(dest);
  }
}
