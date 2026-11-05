import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * TWO FACTS A THREAD SHOWS THAT ITS VIEWER'S OWN SESSION CANNOT READ (owner 2026-10-28, on the chat: *"yes show seen"*
 * and *"yes"* to the shop member's name on a supplier message).
 *
 *   • SEEN — the other side's latest `chat_thread_reads.last_read_at`. That table's RLS is self-only
 *     (`chat_thread_reads_self_all`, migration 20260728000000), so the page reads it here with the service client,
 *     AFTER it has proved the viewer is a party to the thread (both thread pages 404 otherwise), and only ever as ONE
 *     timestamp — never who, never their other threads.
 *   • WHO REPLIED — the first name (`users.display_name`'s first word) of each shop member who sent a message on THIS
 *     thread. Already stored per message (`chat_messages.sender_user_id`), so no schema. The caller passes
 *     `revealed`: a shop whose name is still masked (`isVendorNameRevealed` false) gets no names, because a person's
 *     name would undo the mask.
 *
 * 🔑 "THE OTHER SIDE" IS WHO HAS SPOKEN FOR IT. Readers are the users who sent a message from the other side on this
 * thread, plus — for a couple reading — the shop's team (`vendor_team_members`). A member of the other side who has
 * never written and is not on a shop team is not counted, so the line can only UNDER-claim (Delivered when it was in
 * fact seen), never say Seen when nobody there has read it.
 */

type Row = { sender_role: string; sender_user_id: string | null };

export async function readThreadReceipts(
  admin: SupabaseClient,
  args: {
    threadId: string;
    viewerRole: 'couple' | 'vendor';
    viewerUserId: string;
    vendorProfileId: string;
    messages: readonly Row[];
    /** Couple side only: may a shop member's name be shown (the shop's own name is revealed)? */
    revealed?: boolean;
  },
): Promise<{ theirLastReadAt: string | null; senderNames: Record<string, string> }> {
  const otherRole = args.viewerRole === 'couple' ? 'vendor' : 'couple';
  const senders = new Set<string>();
  for (const m of args.messages) {
    if (m.sender_role === otherRole && m.sender_user_id && m.sender_user_id !== args.viewerUserId) senders.add(m.sender_user_id);
  }

  const readers = new Set(senders);
  if (args.viewerRole === 'couple') {
    const team = await admin.from('vendor_team_members').select('user_id').eq('vendor_profile_id', args.vendorProfileId);
    if (team.error) logQueryError('readThreadReceipts.team', team.error, { thread_id: args.threadId }, 'graceful_degrade');
    for (const r of (team.data ?? []) as Array<{ user_id: string }>) if (r.user_id !== args.viewerUserId) readers.add(r.user_id);
  }

  let theirLastReadAt: string | null = null;
  if (readers.size > 0) {
    const reads = await admin
      .from('chat_thread_reads')
      .select('last_read_at')
      .eq('thread_id', args.threadId)
      .in('user_id', [...readers])
      .order('last_read_at', { ascending: false })
      .limit(1);
    if (reads.error) logQueryError('readThreadReceipts.reads', reads.error, { thread_id: args.threadId }, 'graceful_degrade');
    theirLastReadAt = ((reads.data ?? [])[0] as { last_read_at?: string } | undefined)?.last_read_at ?? null;
  }

  const senderNames: Record<string, string> = {};
  if (args.viewerRole === 'couple' && args.revealed && senders.size > 0) {
    const users = await admin.from('users').select('user_id, display_name').in('user_id', [...senders]);
    if (users.error) logQueryError('readThreadReceipts.names', users.error, { thread_id: args.threadId }, 'graceful_degrade');
    for (const u of (users.data ?? []) as Array<{ user_id: string; display_name: string | null }>) {
      const first = (u.display_name ?? '').trim().split(/\s+/)[0];
      if (first) senderNames[u.user_id] = first;
    }
  }

  return { theirLastReadAt, senderNames };
}
