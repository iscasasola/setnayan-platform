'use server';

/**
 * 💬 UNICHAT PART H1 — the server half of EDIT · UNSEND · REMIND ME (approved Unichat prototype v3, DECISION_LOG
 * 2026-11-20). Every one runs under the CALLER's own session; the database decides who, what and when
 * (`edit_my_chat_message` · `unsend_my_chat_message` · the `chat_message_reminders` policies — migration
 * 20271354347259). Nothing here is the rule; this file turns a refusal into the words the person reads.
 */
import { createClient } from '@/lib/supabase/server';
import { chatContactFilterEnabled } from '@/lib/chat-contact-filter-flag';
import { evaluateMessage } from '@/lib/chat-contact-filter';
import { messageChangeRefusal, messageChangeWords } from '@/lib/chat-message-extras';
import { CHAT_REMINDER_NOT_REMOVED, CHAT_REMINDER_NOT_SET, isReminderChoice, reminderWhen } from '@/lib/chat-reminders';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type EditChatMessageResult =
  | { ok: true; body: string; editedAt: string | null; unsentAt: string | null }
  | { ok: false; message: string };

/**
 * Change your own message — ONE server action, two intents (the action budget never rises; unsend is a mode of edit).
 * `'edit'` (default): save new words. The database re-checks it is yours, still new, words only, and clean.
 * `'unsend'`: unsend your own words or voice note. The row stays; everyone reads "… unsent a message". `body` is ignored.
 */
export async function editChatMessage(
  messageId: string,
  body: string,
  intent: 'edit' | 'unsend' = 'edit',
): Promise<EditChatMessageResult> {
  if (intent === 'unsend') return unsendOwnMessage(messageId);
  if (typeof messageId !== 'string' || !UUID.test(messageId) || typeof body !== 'string') {
    return { ok: false, message: messageChangeWords('edit', 'failed') };
  }
  const trimmed = body.trim();
  if (trimmed.length === 0) return { ok: false, message: messageChangeWords('edit', 'empty') };
  if (trimmed.length > 4000) return { ok: false, message: messageChangeWords('edit', 'too_long') };
  // The send's own screen, with the send's own switch — the database screens the edit too, whatever this says.
  if (chatContactFilterEnabled() && evaluateMessage(trimmed).blocked) {
    return { ok: false, message: messageChangeWords('edit', 'contact_blocked') };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('edit_my_chat_message', { p_message_id: messageId, p_body: trimmed });
  if (error) {
    const why = messageChangeRefusal(error.message);
    if (why === 'failed') console.error('[editChatMessage] failed:', error.message);
    return { ok: false, message: messageChangeWords('edit', why) };
  }
  const row = (Array.isArray(data) ? data[0] : data) as { edited_at: string | null } | null | undefined;
  return { ok: true, body: trimmed, editedAt: row?.edited_at ?? null, unsentAt: null };
}

/** Not exported — the `'unsend'` intent of `editChatMessage`. */
async function unsendOwnMessage(messageId: string): Promise<EditChatMessageResult> {
  if (typeof messageId !== 'string' || !UUID.test(messageId)) return { ok: false, message: messageChangeWords('unsend', 'failed') };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('unsend_my_chat_message', { p_message_id: messageId });
  if (error) {
    const why = messageChangeRefusal(error.message);
    if (why === 'failed') console.error('[editChatMessage:unsend] failed:', error.message);
    return { ok: false, message: messageChangeWords('unsend', why) };
  }
  const row = (Array.isArray(data) ? data[0] : data) as { unsent_at: string | null } | null | undefined;
  return { ok: true, body: '', editedAt: null, unsentAt: row?.unsent_at ?? new Date().toISOString() };
}

/** `remindAt` is `null` only for `intent: 'clear'` (the reminder came off). */
export type SetChatReminderResult = { ok: true; remindAt: string | null } | { ok: false; message: string };

/**
 * "Remind me" on one message: later today · tomorrow · a date. The time is worked out HERE, on the server's clock.
 * One reminder per person per message — setting again moves it (remove, then set: there is no end-user UPDATE).
 */
export async function setChatReminder(input: {
  messageId: string;
  choice: string;
  date?: string | null;
  side: string;
  /** 'clear' takes your reminder off instead (one route for both — every `use server` export is a Vercel route). */
  intent?: 'set' | 'clear';
}): Promise<SetChatReminderResult> {
  if (input?.intent === 'clear') {
    const out = await clearMyChatReminder(input.messageId);
    return out.ok ? { ok: true, remindAt: null } : out;
  }
  const { messageId, choice, date, side } = input ?? ({} as typeof input);
  if (typeof messageId !== 'string' || !UUID.test(messageId) || !isReminderChoice(choice) || (side !== 'couple' && side !== 'vendor')) {
    return { ok: false, message: CHAT_REMINDER_NOT_SET };
  }
  const when = reminderWhen(choice, Date.now(), date);
  if (!when.ok) return { ok: false, message: when.message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'Sign in again to set a reminder.' };

  // The message, under the caller's own RLS: no row = not theirs to be reminded of (the insert policy says so again).
  const msg = await supabase.from('chat_messages').select('thread_id').eq('message_id', messageId).maybeSingle();
  if (msg.error || !msg.data) {
    if (msg.error) console.error('[setChatReminder] message read failed:', msg.error.message);
    return { ok: false, message: CHAT_REMINDER_NOT_SET };
  }
  const cleared = await supabase.from('chat_message_reminders').delete().eq('message_id', messageId).eq('user_id', user.id);
  if (cleared.error) {
    console.error('[setChatReminder] clearing the earlier reminder failed:', cleared.error.message);
    return { ok: false, message: CHAT_REMINDER_NOT_SET };
  }
  const remindAt = new Date(when.at).toISOString();
  const { error } = await supabase.from('chat_message_reminders').insert({
    message_id: messageId,
    thread_id: (msg.data as { thread_id: string }).thread_id,
    user_id: user.id,
    side,
    remind_at: remindAt,
  });
  if (error) {
    console.error('[setChatReminder] insert failed:', error.message);
    return { ok: false, message: CHAT_REMINDER_NOT_SET };
  }
  return { ok: true, remindAt };
}

type ClearChatReminderResult = { ok: true } | { ok: false; message: string };

/** Take your own reminder off a message — reached through `setChatReminder({ intent: 'clear' })`, never its own route. */
async function clearMyChatReminder(messageId: string): Promise<ClearChatReminderResult> {
  if (typeof messageId !== 'string' || !UUID.test(messageId)) return { ok: false, message: CHAT_REMINDER_NOT_REMOVED };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: CHAT_REMINDER_NOT_REMOVED };
  const { error } = await supabase.from('chat_message_reminders').delete().eq('message_id', messageId).eq('user_id', user.id);
  if (error) {
    console.error('[setChatReminder · clear] failed:', error.message);
    return { ok: false, message: CHAT_REMINDER_NOT_REMOVED };
  }
  return { ok: true };
}
