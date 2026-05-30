import type { SupabaseClient } from '@supabase/supabase-js';

export type ChatSenderRole = 'couple' | 'vendor' | 'coordinator';

export type ChatThreadRow = {
  thread_id: string;
  public_id: string;
  event_id: string;
  vendor_profile_id: string;
  created_at: string;
  updated_at: string;
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
  'thread_id,public_id,event_id,vendor_profile_id,created_at,updated_at';

export async function fetchCoupleThreads(
  supabase: SupabaseClient,
  eventId: string,
): Promise<CoupleThreadWithVendor[]> {
  const { data, error } = await supabase
    .from('chat_threads')
    .select(
      `${THREAD_SELECT}, vendor:vendor_profiles(business_name, logo_url, public_id, screen_name, name_revealed_at, services, location_city)`,
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
