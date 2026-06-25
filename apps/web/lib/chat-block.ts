import { createAdminClient } from '@/lib/supabase/admin';
import type { ChatThreadRow } from '@/lib/chat';

type ThreadParties = Pick<ChatThreadRow, 'event_id' | 'vendor_profile_id'>;

/**
 * The user ids on the OTHER side of a thread from the caller's perspective
 * (Apple 1.2 chat block). Couple → the vendor owner. Vendor → every couple
 * member on the event. Uses the admin client because a couple can't read
 * vendor_profiles.user_id under RLS (and vice-versa) — same pattern as
 * notifyOtherParty() in chat-actions.ts.
 */
export async function resolveCounterpartyUserIds(
  thread: ThreadParties,
  myRole: 'couple' | 'vendor',
): Promise<string[]> {
  const admin = createAdminClient();
  if (myRole === 'couple') {
    const { data } = await admin
      .from('vendor_profiles')
      .select('user_id')
      .eq('vendor_profile_id', thread.vendor_profile_id)
      .maybeSingle();
    const uid = (data as { user_id?: string } | null)?.user_id;
    return uid ? [uid] : [];
  }
  const { data } = await admin
    .from('event_members')
    .select('user_id')
    .eq('event_id', thread.event_id)
    .eq('member_type', 'couple');
  return ((data as { user_id: string }[] | null) ?? [])
    .map((r) => r.user_id)
    .filter(Boolean);
}

export type ThreadBlockState = {
  blockedByMe: boolean; // the caller blocked the counterparty
  blockedByThem: boolean; // the counterparty blocked the caller
};

/**
 * Whether a block exists in either direction between the caller and the thread
 * counterparty. Drives the thread-menu label + composer gating; the
 * chat_messages_block_guard RESTRICTIVE policy is the authoritative enforcement.
 */
export async function getThreadBlockState(
  thread: ThreadParties,
  myUserId: string,
  myRole: 'couple' | 'vendor',
): Promise<ThreadBlockState> {
  const counterpartyIds = await resolveCounterpartyUserIds(thread, myRole);
  if (counterpartyIds.length === 0) {
    return { blockedByMe: false, blockedByThem: false };
  }
  const admin = createAdminClient();
  const ids = counterpartyIds.join(',');
  const { data } = await admin
    .from('blocked_users')
    .select('blocker_user_id, blocked_user_id')
    .or(
      `and(blocker_user_id.eq.${myUserId},blocked_user_id.in.(${ids})),` +
        `and(blocked_user_id.eq.${myUserId},blocker_user_id.in.(${ids}))`,
    );
  let blockedByMe = false;
  let blockedByThem = false;
  for (const row of (data as
    | { blocker_user_id: string; blocked_user_id: string }[]
    | null) ?? []) {
    if (row.blocker_user_id === myUserId) blockedByMe = true;
    else if (row.blocked_user_id === myUserId) blockedByThem = true;
  }
  return { blockedByMe, blockedByThem };
}
