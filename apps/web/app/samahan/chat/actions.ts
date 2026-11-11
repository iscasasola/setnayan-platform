'use server';

/**
 * 💬 EVENT GROUP CHATS — the writes (specs DECISION_LOG 2026-11-12 "EVENT GROUP CHATS APPROVED AS DRAWN"). Every one
 * goes through the caller's OWN session: the database decides who is in a group, who may add, who may leave and who a
 * private line may go to (migration 20271340374819) — these actions only carry the words and say the refusals in words.
 * A group line never names a supplier and never carries a money card (`chat_messages_group_rules`).
 */
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { CHAT_PRIVATE_FIELD, CHAT_PRIVATE_RECIPIENT_COLUMN, CHAT_PRIVATE_RECIPIENTS_COLUMN, PRIVATE_WORDS_ONLY_MESSAGE, privateToListFromForm } from '@/lib/chat-private';
import { CONTACT_BLOCK_MESSAGE, evaluateMessage } from '@/lib/chat-contact-filter';
import { GROUP_FILES_NOT_YET, groupChatHref } from '@/lib/chat-groups';

async function groupEventId(supabase: Awaited<ReturnType<typeof createClient>>, threadId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('chat_group_head', { p_thread_id: threadId });
  if (error) {
    logQueryError('groupEventId (chat_group_head)', error, { thread_id: threadId }, 'will_throw');
    return null;
  }
  const row = ((data ?? []) as Array<{ event_id: string; is_member: boolean }>)[0];
  return row && row.is_member ? row.event_id : null;
}

/** The composer's Send in a group: words, to everyone or privately to one or several people in it. */
async function sendGroupMessage(formData: FormData): Promise<void> {
  const threadId = formData.get('thread_id');
  const raw = formData.get('body');
  if (typeof threadId !== 'string' || typeof raw !== 'string') throw new Error('Invalid input');
  const body = raw.trim().slice(0, 4000);
  const file = formData.get('attachment');
  const hasFile = (file instanceof File && file.size > 0) || Boolean(formData.get('attachment_ref'));
  const privateList = privateToListFromForm(formData.getAll(CHAT_PRIVATE_FIELD), null);
  if (hasFile) throw new Error(privateList.length > 0 ? PRIVATE_WORDS_ONLY_MESSAGE : GROUP_FILES_NOT_YET);
  if (!body) return;
  if (evaluateMessage(body).blocked) throw new Error(CONTACT_BLOCK_MESSAGE);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const eventId = await groupEventId(supabase, threadId);
  if (!eventId) throw new Error('You are not in this group.');

  const to = privateList.filter((id) => id !== user.id);
  const { error } = await supabase.from('chat_messages').insert({
    thread_id: threadId,
    event_id: eventId,
    body,
    // One person keeps the shipped column; several go in the list (the database sorts and checks each).
    ...(to.length === 1 ? { [CHAT_PRIVATE_RECIPIENT_COLUMN]: to[0] } : to.length > 1 ? { [CHAT_PRIVATE_RECIPIENTS_COLUMN]: to } : {}),
  });
  if (error) {
    logQueryError('sendGroupMessage (chat_messages insert)', error, { thread_id: threadId }, 'will_throw');
    if (error.message.includes('CONTACT_BLOCKED')) throw new Error(CONTACT_BLOCK_MESSAGE);
    if (error.message.includes('PRIVATE_NOT_A_MEMBER')) throw new Error('That person is not in this group — your message was not sent.');
    throw new Error('Your message was not sent. Try again.');
  }
}

/** (＋) on the strip — hosts and the coordinator, from inside the group. */
async function addToGroup(threadId: string, userIds: string[]): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('chat_group_add', { p_thread_id: threadId, p_people: userIds });
  if (error) logQueryError('addToGroup (chat_group_add)', error, { thread_id: threadId }, 'graceful_degrade');
  else if (data !== 'added' && data !== 'already') logQueryError('addToGroup (refused)', { message: String(data) }, { thread_id: threadId }, 'graceful_degrade');
  revalidatePath(groupChatHref(threadId));
}

/** Your own face → Leave (hosts only; the database refuses anyone else). */
async function leaveGroup(threadId: string, note: string | null): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('chat_group_leave', { p_thread_id: threadId, p_note: note });
  if (error) logQueryError('leaveGroup (chat_group_leave)', error, { thread_id: threadId }, 'graceful_degrade');
  else if (data !== 'left') logQueryError('leaveGroup (refused)', { message: String(data) }, { thread_id: threadId }, 'graceful_degrade');
  revalidatePath(groupChatHref(threadId));
}

/** "Join this chat again?" — a host who left comes back by themselves. */
async function rejoinGroup(threadId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { error } = await supabase.rpc('chat_group_add', { p_thread_id: threadId, p_people: [user.id] });
  if (error) logQueryError('rejoinGroup (chat_group_add)', error, { thread_id: threadId }, 'graceful_degrade');
  revalidatePath(groupChatHref(threadId));
  redirect(groupChatHref(threadId));
}

/** "+ New group" (hosts only): a name and the ticked people. */
async function createGroup(eventId: string, name: string, people: string[]): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('chat_group_create', { p_event_id: eventId, p_name: name, p_people: people });
  if (error || typeof data !== 'string') {
    logQueryError('createGroup (chat_group_create)', error, { event_id: eventId }, 'graceful_degrade');
    redirect(`/samahan/chat/new?event=${eventId}&error=1`);
  }
  revalidatePath(`/dashboard/${eventId}/messages`);
  redirect(groupChatHref(data));
}

/**
 * THE ONE EXPORTED ACTION (scripts/lint-server-action-budget.mjs — every export is a Vercel route): a dispatcher, bound
 * by the page per use — `groupChat.bind(null, 'send')` is the composer's Send, `.bind(null, 'add', threadId)` the strip's
 * ＋, `.bind(null, 'leave', threadId)` your own face, `.bind(null, 'rejoin')` / `.bind(null, 'create')` the two forms.
 */
export async function groupChat(op: 'send' | 'add' | 'leave' | 'rejoin' | 'create', a?: FormData | string, b?: unknown): Promise<void> {
  if (op === 'send') {
    if (!(a instanceof FormData)) throw new Error('Invalid input');
    return sendGroupMessage(a);
  }
  if (op === 'add') return addToGroup(String(a), Array.isArray(b) ? b.filter((x): x is string => typeof x === 'string') : []);
  if (op === 'leave') return leaveGroup(String(a), typeof b === 'string' ? b : null);
  if (!(a instanceof FormData)) throw new Error('Invalid input');
  if (op === 'rejoin') {
    const threadId = a.get('thread_id');
    if (typeof threadId !== 'string') throw new Error('Invalid input');
    return rejoinGroup(threadId);
  }
  if (op === 'create') {
    const eventId = a.get('event_id');
    const name = a.get('name');
    if (typeof eventId !== 'string' || typeof name !== 'string') throw new Error('Invalid input');
    return createGroup(eventId, name, a.getAll('person').filter((v): v is string => typeof v === 'string'));
  }
  throw new Error('Unknown group action');
}
