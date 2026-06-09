import type { SupabaseClient } from '@supabase/supabase-js';
import { isMissingRelationError, logQueryError } from '@/lib/supabase/error-detect';

export type ChatSenderRole = 'couple' | 'vendor' | 'coordinator';

/**
 * Accept-gate state per CLAUDE.md 2026-06-02 ("the chat will only reveal when
 * the vendor accepts the inquiry"). A thread starts `pending` (couple's inquiry
 * waiting); the vendor flips it to `accepted` (chat open both ways, name
 * revealed) or `declined` (couple shown alternatives). Pre-migration threads
 * were backfilled to `accepted`.
 */
export type ChatInquiryStatus = 'pending' | 'accepted' | 'declined';

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
};

export type CoupleThreadWithVendor = ChatThreadRow & {
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
  event: {
    display_name: string;
    event_date: string | null;
    public_id: string;
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
};

const THREAD_SELECT =
  'thread_id,public_id,event_id,vendor_profile_id,created_at,updated_at,inquiry_status,accepted_at,declined_at,decline_reason';

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

export async function fetchCoupleThreads(
  supabase: SupabaseClient,
  eventId: string,
): Promise<CoupleThreadWithVendor[]> {
  const { data, error } = await supabase
    .from('chat_threads')
    .select(
      `${THREAD_SELECT}, vendor:vendor_profiles(business_name, logo_url, public_id, screen_name, name_revealed_at, services, location_city, tier_state)`,
    )
    .eq('event_id', eventId)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(`fetchCoupleThreads failed: ${error.message}`);
  return (data ?? []) as unknown as CoupleThreadWithVendor[];
}

export async function fetchVendorThreads(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<VendorThreadWithEvent[]> {
  const { data, error } = await supabase
    .from('chat_threads')
    .select(`${THREAD_SELECT}, event:events(display_name, event_date, public_id)`)
    .eq('vendor_profile_id', vendorProfileId)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(`fetchVendorThreads failed: ${error.message}`);
  return (data ?? []) as unknown as VendorThreadWithEvent[];
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

export async function fetchMessages(
  supabase: SupabaseClient,
  threadId: string,
): Promise<ChatMessageRow[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select(
      'message_id,thread_id,event_id,vendor_profile_id,sender_user_id,sender_role,body,created_at',
    )
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
