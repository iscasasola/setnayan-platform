import type { SupabaseClient } from '@supabase/supabase-js';
import { isMissingRelationError, logQueryError } from '@/lib/supabase/error-detect';

/**
 * `'system'` is an AUTOMATED Setnayan message in the thread (e.g. the Build 3d-C
 * re-quote nudge) — rendered as a centered Setnayan note, never "from the
 * couple" or "from the vendor". It is inserted server-side via the service-role
 * admin client (migration 20270101010000 adds the enum value), so it bypasses
 * the couple/vendor RLS INSERT policy, and it deliberately does NOT trip the
 * `sender_role='vendor'` name-reveal trigger.
 */
export type ChatSenderRole = 'couple' | 'vendor' | 'coordinator' | 'system';

/**
 * Accept-gate state per CLAUDE.md 2026-06-02 ("the chat will only reveal when
 * the vendor accepts the inquiry"). A thread starts `pending` (couple's inquiry
 * waiting); the vendor flips it to `accepted` (chat open both ways, name
 * revealed) or `declined` (couple shown alternatives). Pre-migration threads
 * were backfilled to `accepted`.
 */
// Mirrors the public.chat_inquiry_status DB enum. 'displaced' (couple locked
// another vendor in the same hard-single group — REVIVABLE), 'withdrawn' and
// 'expired' are lifecycle-closed states provisioned in 20261126000000; the app
// treats them as closed inquiries (folded out of the active inbox lists).
export type ChatInquiryStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'displaced'
  | 'withdrawn'
  | 'expired';

export type ChatThreadRow = {
  thread_id: string;
  public_id: string;
  event_id: string;
  vendor_profile_id: string;
  created_at: string;
  updated_at: string;
  inquiry_status: ChatInquiryStatus;
  accepted_at: string | null;
  declined_at: string | null;
  decline_reason: string | null;
  // Adaptive Pax Pricing (2026-06-13): the immutable count this inquiry was
  // first quoted against, and the live count pushed to the thread. null on
  // pre-feature threads.
  pax_at_inquiry: number | null;
  pax_current: number | null;
  /**
   * Timestamp of the vendor's first chat_messages INSERT on this thread.
   * Stamped by the `stamp_vendor_first_reply` DB trigger (migration
   * 20270110320018) and defense-in-depth-stamped by sendChatMessage.
   * Null until the vendor sends their first reply. Used to compute
   * avg_response_minutes in lib/vendor-activity.ts.
   */
  vendor_first_reply_at: string | null;
  /**
   * Creator Economy PR-C (migration 20270819553697) — inquiry provenance,
   * PRIVATE to the vendor. `referring_chapter_id` = CTA-click attribution (the
   * chapter whose Book CTA started the thread); `inquiry_source` = the owner's
   * source taxonomy (NULL = Website Inquiry — see lib/inquiry-source.ts);
   * `is_returning` = the returning-customer companion flag. All optional so a
   * pre-migration DB degrades to no chips.
   */
  referring_chapter_id?: string | null;
  inquiry_source?: string | null;
  is_returning?: boolean | null;
  /** The inquirer (thread opener) — powers the vendor-side "creator collab
   *  active" marker (PR-C). Base-table column; optional for older mappers. */
  created_by_user_id?: string | null;
};

export type CoupleThreadWithVendor = ChatThreadRow & {
  /**
   * Per-user Viber-style archive state for the CURRENT viewer, computed from the
   * embedded chat_thread_reads.archived_at (migration 20270714177342). True when
   * the viewer archived the thread AND no newer message has arrived since (a new
   * message bumps updated_at past archived_at → auto-un-archives). Always false
   * pre-migration — the archive embed graceful-degrades (see fetchCoupleThreads).
   */
  archived: boolean;
  vendor: {
    business_name: string;
    logo_url: string | null;
    public_id: string;
    /**
     * Anonymity surface fields per CLAUDE.md 2026-05-30 refinement row
     * "V2.1 BRIEF AMENDMENT #2 LOCKED · vendor matrix · venue exception
     * locked". Couples viewing the thread list see screen_name (Bark
     * format "Manila Wedding Photographer #4218") for Free + Verified
     * vendors who haven't yet replied · the real business_name for
     * Pro/Enterprise tier vendors · revealed vendors (name_revealed_at
     * stamped post-first-reply) · and venue vendors (services overlap
     * with religious_venue / venue exemption). Resolution lives in
     * `resolveVendorDisplayName(input)` — keep these in lock-step with
     * `VendorAnonymityInput` so the helper accepts the join shape
     * directly.
     */
    screen_name: string | null;
    name_revealed_at: string | null;
    services: string[] | null;
    location_city: string | null;
    /**
     * Phase C tier gate (vendor-tier-caps). `tier_state` enum on
     * vendor_profiles (free | verified | pro | enterprise) drives the
     * day-1 name reveal — Pro/Enterprise (isTrueNameTier) surface the
     * real business_name in the thread list even before name_revealed_at
     * is stamped. Null (pre-migration deploy / missing) → free → hidden.
     */
    tier_state: string | null;
  } | null;
};

export type VendorThreadWithEvent = ChatThreadRow & {
  /** See CoupleThreadWithVendor.archived — same per-viewer archive state, vendor side. */
  archived: boolean;
  /**
   * Anonymization-until-accept (Glass PR-6b · Vendor_Inquiry_Anonymization_Spec
   * _2026-07-15). PRE-ACCEPT the couple's identity must NOT ship to the vendor
   * client at all: `display_name` (the event title carries the couple's names)
   * and `public_id` (a link to the couple's public event page) are STRIPPED to
   * null for any thread that isn't revealed (see isInquiryRevealed / the mapper
   * below). `event_date` is retained — the spec permits showing the date. This
   * is data-layer enforcement, independent of the RLS backstop (a vendor holds
   * no `events` RLS, so the embed is already null for them — this makes the
   * masking explicit and intentional rather than an implicit accident that a
   * future policy change could silently undo). Post-accept the row passes
   * through unchanged.
   */
  event: {
    display_name: string | null;
    event_date: string | null;
    public_id: string | null;
  } | null;
};

export type ChatMessageRow = {
  message_id: string;
  thread_id: string;
  event_id: string;
  vendor_profile_id: string;
  sender_user_id: string | null;
  sender_role: ChatSenderRole;
  body: string;
  created_at: string;
  /** Set when this message announces a vendor proposal (renders as a card). */
  proposal_id?: string | null;
  /**
   * Optional file attachment (chat file sharing, PR 2). All four are NULL on
   * text-only messages. `attachment_url` is the public R2 URL; the renderer
   * shows an <img> thumbnail for image MIMEs and a file chip otherwise.
   */
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_mime?: string | null;
  attachment_size_bytes?: number | null;
  /**
   * TRUE for Auto-Reply Assistant messages (vendor-autoreply Phase 3b,
   * migration 20270822679405). Posted server-side via service_role with
   * sender_role='vendor' + sender_user_id=null; the thread UI renders a
   * visible AI label (§2B — never disguised as a human vendor). Optional so
   * pre-migration rows / the no-is_bot fallback select degrade to "not a bot".
   */
  is_bot?: boolean;
};

const THREAD_SELECT =
  'thread_id,public_id,event_id,vendor_profile_id,created_by_user_id,created_at,updated_at,inquiry_status,accepted_at,declined_at,decline_reason,pax_at_inquiry,pax_current,vendor_first_reply_at,referring_chapter_id,inquiry_source,is_returning';

/**
 * Count of message threads with at least one unread message for the current
 * user — drives the unread badge on the Messages icon (the MessageSquare link
 * shipped icon-only in PR #837). Delegates the per-thread "is there a message
 * from someone else newer than my last_read_at?" math to the SQL function
 * `count_unread_message_threads()` (migration 20260728000000_chat_thread_reads.sql),
 * which is SECURITY DEFINER + scoped to the caller via auth.uid().
 *
 * GRACEFUL DEGRADE (mirrors countUnread in lib/notifications.ts): this sits on
 * the dashboard-chrome render path, so a thrown error would crash the whole
 * /dashboard/[eventId]/* subtree. The migration is owner-pushed and may not be
 * applied yet — when the function/table is absent the RPC returns a
 * missing-relation error (42883 undefined_function / PGRST202 etc.). On ANY
 * error we log + return 0 so the deploy is safe before the migration lands; the
 * badge simply reads 0 until the owner pushes it.
 *
 * `userId` is accepted for parity with countUnread + for the log context; the
 * SQL resolves the user from auth.uid() server-side, so it isn't passed to the RPC.
 */
export async function countUnreadMessages(
  supabase: SupabaseClient,
  userId?: string,
): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('count_unread_message_threads');
    if (error) {
      logQueryError(
        'countUnreadMessages',
        error,
        { user_id: userId ?? null, missing_relation: isMissingRelationError(error) },
        'graceful_degrade',
      );
      return 0;
    }
    const n = typeof data === 'number' ? data : Number(data ?? 0);
    return Number.isFinite(n) ? n : 0;
  } catch (caught) {
    // Network / client throw (not a PostgREST error object) — never let the
    // chrome badge take down the dashboard. Log + fall back to 0.
    logQueryError(
      'countUnreadMessages (threw)',
      caught instanceof Error ? caught : new Error(String(caught)),
      { user_id: userId ?? null },
      'graceful_degrade',
    );
    return 0;
  }
}

/**
 * How many COUPLE-authored messages exist on a thread. Feeds chat-send's
 * pre-accept allowance (the inquiry + exactly ONE follow-up while the thread is
 * `pending`) and its "first message = new inquiry" notification swap.
 *
 * WHY the `sender_role` filter is load-bearing: a `pending` thread is NOT
 * couple-only. The Vendor Auto-Reply Assistant posts into a still-pending
 * thread as `sender_role='vendor', is_bot=true, sender_user_id=null`
 * (lib/vendor-autoreply/inbox-hook.ts:227 — scheduled from chat-send's own
 * `after()` on the couple's message), and `'system'` Setnayan notes exist in
 * the enum too. Counting EVERY row on the thread (the shipped behaviour before
 * this helper) let the bot's own answer eat one of the couple's two allowed
 * pre-accept messages — so a bot that asked a clarifying question could strand
 * its own conversation: the couple hit `followup_used` and could not reply.
 * Only couple-authored rows may consume the couple's allowance.
 *
 * Deliberate non-choices:
 *  - `'coordinator'` rows are NOT counted. No coordinator write path reaches a
 *    pending thread today (chat-send resolves senderRole couple|vendor only,
 *    via event_members.member_type='couple'). Wire them in here if that changes.
 *  - No `.eq('is_bot', false)`. Couple rows are never bot, and `is_bot`
 *    (migration 20270822679405) is owner-pushed — fetchMessages already
 *    graceful-degrades for its absence, so filtering on it would risk erroring
 *    this count on an un-migrated DB.
 *  - An errored count still falls through to 0 (gate opens). Pre-existing
 *    behaviour, deliberately unchanged here.
 */
export async function countCoupleMessages(
  admin: SupabaseClient,
  threadId: string,
): Promise<number> {
  const { count } = await admin
    .from('chat_messages')
    .select('*', { count: 'exact', head: true })
    .eq('thread_id', threadId)
    .eq('sender_role', 'couple');
  return count ?? 0;
}

/**
 * Compute the current viewer's Viber-style archive state for a thread row that
 * embedded `reads:chat_thread_reads(archived_at)`. RLS scopes the embed to the
 * caller (chat_thread_reads_self_all → user_id = auth.uid()), so `reads` is a
 * 0-or-1-element array of THIS user's marker. Archived ⇔ archived_at set AND no
 * newer message since (updated_at ≤ archived_at); a later message auto-unarchives.
 */
function computeArchived(row: {
  updated_at: string;
  reads?: { archived_at: string | null }[] | null;
}): boolean {
  const reads = row.reads;
  if (!Array.isArray(reads) || reads.length === 0) return false;
  const archivedAt = reads[0]?.archived_at;
  if (!archivedAt) return false;
  return new Date(archivedAt).getTime() >= new Date(row.updated_at).getTime();
}

const COUPLE_VENDOR_EMBED =
  'vendor:vendor_profiles(business_name, logo_url, public_id, screen_name, name_revealed_at, services, location_city, tier_state)';

export async function fetchCoupleThreads(
  supabase: SupabaseClient,
  eventId: string,
): Promise<CoupleThreadWithVendor[]> {
  // Try the archive-aware query first (embeds the per-user archived_at marker).
  // GRACEFUL DEGRADE: migration 20270714177342 (chat_thread_reads.archived_at)
  // is owner-pushed and may not be live yet — the embed then errors. On ANY
  // error we retry WITHOUT the archive embed and treat every thread as active,
  // so the Messages page never crashes ahead of the migration.
  const withArchive = await supabase
    .from('chat_threads')
    .select(`${THREAD_SELECT}, ${COUPLE_VENDOR_EMBED}, reads:chat_thread_reads(archived_at)`)
    .eq('event_id', eventId)
    .order('updated_at', { ascending: false });
  if (!withArchive.error) {
    return (withArchive.data ?? []).map((row) => {
      const { reads: _reads, ...rest } = row as Record<string, unknown> & {
        reads?: { archived_at: string | null }[] | null;
      };
      return { ...rest, archived: computeArchived(row as never) } as unknown as CoupleThreadWithVendor;
    });
  }
  logQueryError(
    'fetchCoupleThreads (archive embed)',
    withArchive.error,
    { event_id: eventId, missing_relation: isMissingRelationError(withArchive.error) },
    'graceful_degrade',
  );
  const { data, error } = await supabase
    .from('chat_threads')
    .select(`${THREAD_SELECT}, ${COUPLE_VENDOR_EMBED}`)
    .eq('event_id', eventId)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(`fetchCoupleThreads failed: ${error.message}`);
  return (data ?? []).map((row) => ({ ...(row as object), archived: false })) as unknown as CoupleThreadWithVendor[];
}

/**
 * Anonymization-until-accept enforcement (Glass PR-6b). For any vendor thread
 * that isn't revealed (the vendor hasn't burned the token to accept), strip the
 * couple's identity fields — event title (`display_name`) + public-page link
 * (`public_id`) — from the DTO so they never reach the vendor client. Keeps
 * `event_date` (permitted). Revealed threads pass through unchanged. Mirrors
 * isInquiryRevealed in lib/inquiry-mask.ts; inlined here to keep chat.ts free of
 * a server-only import (this module is imported by couple-side code too).
 */
function maskVendorThreadEvent(row: VendorThreadWithEvent): VendorThreadWithEvent {
  const revealed = row.accepted_at != null || row.inquiry_status === 'accepted';
  if (revealed || !row.event) return row;
  return {
    ...row,
    event: { display_name: null, event_date: row.event.event_date, public_id: null },
  };
}

export async function fetchVendorThreads(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<VendorThreadWithEvent[]> {
  // Same archive-aware-with-graceful-degrade shape as fetchCoupleThreads.
  const withArchive = await supabase
    .from('chat_threads')
    .select(`${THREAD_SELECT}, event:events(display_name, event_date, public_id), reads:chat_thread_reads(archived_at)`)
    .eq('vendor_profile_id', vendorProfileId)
    .order('updated_at', { ascending: false });
  if (!withArchive.error) {
    return (withArchive.data ?? []).map((row) => {
      const { reads: _reads, ...rest } = row as Record<string, unknown> & {
        reads?: { archived_at: string | null }[] | null;
      };
      return maskVendorThreadEvent({
        ...rest,
        archived: computeArchived(row as never),
      } as unknown as VendorThreadWithEvent);
    });
  }
  logQueryError(
    'fetchVendorThreads (archive embed)',
    withArchive.error,
    { vendor_profile_id: vendorProfileId, missing_relation: isMissingRelationError(withArchive.error) },
    'graceful_degrade',
  );
  const { data, error } = await supabase
    .from('chat_threads')
    .select(`${THREAD_SELECT}, event:events(display_name, event_date, public_id)`)
    .eq('vendor_profile_id', vendorProfileId)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(`fetchVendorThreads failed: ${error.message}`);
  return (data ?? []).map((row) =>
    maskVendorThreadEvent({ ...(row as object), archived: false } as unknown as VendorThreadWithEvent),
  );
}

/**
 * Returning-client flags for the vendor inbox (owner-locked 2026-06-12:
 * "when an inquiry from an old locked client, we want to notify that this is
 * coming from a client they previously locked").
 *
 * One row per inquiry event whose couple previously CONFIRMED-booked this
 * vendor on a DIFFERENT event (the badge predicate), with that prior event's
 * display name/date and `resync_flat` — the looser prior-UNLOCK predicate
 * under which accepting burns a FLAT 1 token (migration
 * 20261201000000_returning_customer_resync_burn.sql).
 *
 * Batched (one RPC for all pending threads — no N+1) and SECURITY DEFINER on
 * the SQL side: vendor RLS can't read the couple's other-event event_members
 * rows, so a direct query would silently return nothing.
 *
 * GRACEFUL DEGRADE (mirrors countUnreadMessages): the migration may not be
 * applied yet — on ANY error we log + return an empty map so the inbox never
 * crashes; the badge simply doesn't render until the migration lands.
 */
export type ReturningClientFlag = {
  event_id: string;
  prior_event_display_name: string | null;
  prior_event_date: string | null;
  resync_flat: boolean;
};

export async function fetchReturningClientFlags(
  supabase: SupabaseClient,
  vendorProfileId: string,
  eventIds: string[],
): Promise<Map<string, ReturningClientFlag>> {
  const unique = Array.from(new Set(eventIds.filter(Boolean)));
  if (unique.length === 0) return new Map();
  try {
    const { data, error } = await supabase.rpc('get_returning_client_flags', {
      p_vendor_profile_id: vendorProfileId,
      p_event_ids: unique,
    });
    if (error) {
      logQueryError(
        'fetchReturningClientFlags',
        error,
        {
          vendor_profile_id: vendorProfileId,
          missing_relation: isMissingRelationError(error),
        },
        'graceful_degrade',
      );
      return new Map();
    }
    const map = new Map<string, ReturningClientFlag>();
    for (const row of (data ?? []) as ReturningClientFlag[]) {
      if (row?.event_id) map.set(row.event_id, row);
    }
    return map;
  } catch (caught) {
    logQueryError(
      'fetchReturningClientFlags (threw)',
      caught instanceof Error ? caught : new Error(String(caught)),
      { vendor_profile_id: vendorProfileId },
      'graceful_degrade',
    );
    return new Map();
  }
}

/**
 * Phase D — lead trust flag for the masked lead ("informed accept"). Returns
 * whether the couple on this event is an "active planner" (already has ≥1
 * accepted vendor thread = real engagement). Non-PII, positive-only. Mirrors
 * fetchReturningClientFlags' graceful-degrade contract: any error (incl. the RPC
 * not being in prod yet) resolves to false so the masked lead still renders.
 */
export async function fetchLeadTrustActivePlanner(
  supabase: SupabaseClient,
  vendorProfileId: string,
  eventId: string,
): Promise<boolean> {
  if (!eventId) return false;
  try {
    const { data, error } = await supabase.rpc('get_lead_trust_flags' as never, {
      p_vendor_profile_id: vendorProfileId,
      p_event_ids: [eventId],
    } as never);
    if (error || !Array.isArray(data)) return false;
    const row = (data as { event_id: string; active_planner: boolean }[])[0];
    return row?.active_planner === true;
  } catch {
    return false;
  }
}

export async function fetchThreadById(
  supabase: SupabaseClient,
  threadId: string,
): Promise<ChatThreadRow | null> {
  const { data, error } = await supabase
    .from('chat_threads')
    .select(THREAD_SELECT)
    .eq('thread_id', threadId)
    .maybeSingle();
  if (error) throw new Error(`fetchThreadById failed: ${error.message}`);
  return (data ?? null) as ChatThreadRow | null;
}

const MESSAGE_SELECT =
  'message_id,thread_id,event_id,vendor_profile_id,sender_user_id,sender_role,body,created_at,proposal_id,attachment_url,attachment_name,attachment_mime,attachment_size_bytes';

export async function fetchMessages(
  supabase: SupabaseClient,
  threadId: string,
): Promise<ChatMessageRow[]> {
  // Bot-label-aware select first (is_bot · migration 20270822679405, vendor
  // autoreply Phase 1). GRACEFUL DEGRADE (mirrors fetchCoupleThreads): the
  // migration is owner-pushed and may not be live yet — an unknown column
  // errors the whole select, so on ANY error retry WITHOUT is_bot and treat
  // every message as human. The thread page must never crash ahead of the
  // migration.
  const withBot = await supabase
    .from('chat_messages')
    .select(`${MESSAGE_SELECT},is_bot`)
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });
  if (!withBot.error) return (withBot.data ?? []) as ChatMessageRow[];
  logQueryError(
    'fetchMessages (is_bot select)',
    withBot.error,
    { thread_id: threadId, missing_relation: isMissingRelationError(withBot.error) },
    'graceful_degrade',
  );
  const { data, error } = await supabase
    .from('chat_messages')
    .select(MESSAGE_SELECT)
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`fetchMessages failed: ${error.message}`);
  return (data ?? []) as ChatMessageRow[];
}

export function formatChatTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
