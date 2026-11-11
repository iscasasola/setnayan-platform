/**
 * 🤝 OPEN A DECISION — the one TS door to `chat_decision_open()` (migration 20271332497337).
 *
 * Either side of a conversation opens a decision topic; the RPC writes the topic and posts its
 * "Decision opened · <title>" line. Closing / reopening is `DecisionToggle` (`chat_decision_set_closed`).
 * Lane C's Decision card calls this; it is exported here so the card writes through the same door the
 * database guards (a member of the chat, or the shop's team), never an INSERT of its own.
 *
 * Answers: `{ ok: true, topicId }`, or `{ ok: false, reason }` — 'empty' (no title, nothing sent),
 * 'not_allowed' (not in this chat), 'failed' (anything else; the caller says "try again").
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type OpenDecision = { ok: true; topicId: string } | { ok: false; reason: 'empty' | 'not_allowed' | 'failed' };

/** The longest title the database keeps (`left(btrim(p_title), 120)`). */
export const DECISION_TITLE_MAX = 120;

export async function openDecision(supabase: SupabaseClient, threadId: string, title: string): Promise<OpenDecision> {
  const clean = title.trim().slice(0, DECISION_TITLE_MAX);
  if (!clean) return { ok: false, reason: 'empty' };
  const { data, error } = await supabase.rpc('chat_decision_open', { p_thread_id: threadId, p_title: clean });
  if (error) {
    console.warn('[openDecision] refused', error.code);
    return { ok: false, reason: error.code === '42501' ? 'not_allowed' : 'failed' };
  }
  return typeof data === 'string' && data ? { ok: true, topicId: data } : { ok: false, reason: 'failed' };
}

// ── 🗳 FILING A MESSAGE UNDER A DECISION · EDIT TOPIC (owner 11 Nov 2026, migration 20271338412990) ─────────────────
// Double-tap a message → add it to an open decision (or Move / Remove it); a pinned decision opens to its filed messages
// and an Edit topic. Each is ONE call to its SECURITY DEFINER writer, which checks the chat membership itself.

/** What a filing writer answers (the database's own words). */
export type FilingOutcome = 'ok' | 'already' | 'filed_elsewhere' | 'closed' | 'private' | 'not_filed' | 'same' | 'not_found' | 'failed';
export type RenameOutcome = 'ok' | 'unchanged' | 'empty' | 'closed' | 'not_found' | 'failed';

const FILING_WORDS: readonly FilingOutcome[] = ['ok', 'already', 'filed_elsewhere', 'closed', 'private', 'not_filed', 'same', 'not_found'];

function filingOutcome(where: string, data: unknown, error: { code?: string } | null): FilingOutcome {
  if (error) {
    console.warn(`[${where}] refused`, error.code);
    return 'failed';
  }
  return FILING_WORDS.includes(data as FilingOutcome) ? (data as FilingOutcome) : 'failed';
}

/** File a shared message under an open decision. 'filed_elsewhere' = it sits under another open one: offer Move. */
export async function fileMessage(supabase: SupabaseClient, topicId: string, messageId: string): Promise<FilingOutcome> {
  const { data, error } = await supabase.rpc('chat_decision_file_message', { p_topic_id: topicId, p_message_id: messageId });
  return filingOutcome('fileMessage', data, error);
}

/** Move a filed message to another open decision of the same chat. */
export async function moveMessage(supabase: SupabaseClient, messageId: string, fromTopicId: string, toTopicId: string): Promise<FilingOutcome> {
  const { data, error } = await supabase.rpc('chat_decision_move_message', {
    p_message_id: messageId,
    p_from_topic_id: fromTopicId,
    p_to_topic_id: toTopicId,
  });
  return filingOutcome('moveMessage', data, error);
}

/** Take a message out of a decision (swipe left / Remove from …). Undo = `fileMessage` again. */
export async function removeMessage(supabase: SupabaseClient, topicId: string, messageId: string): Promise<FilingOutcome> {
  const { data, error } = await supabase.rpc('chat_decision_remove_message', { p_topic_id: topicId, p_message_id: messageId });
  return filingOutcome('removeMessage', data, error);
}

/** Edit topic — saves in place on an OPEN decision (120 characters, the database trims). */
export async function renameDecision(supabase: SupabaseClient, topicId: string, title: string): Promise<RenameOutcome> {
  const clean = title.trim().slice(0, DECISION_TITLE_MAX);
  if (!clean) return 'empty';
  const { data, error } = await supabase.rpc('chat_decision_rename', { p_topic_id: topicId, p_title: clean });
  if (error) {
    console.warn('[renameDecision] refused', error.code);
    return 'failed';
  }
  return (['ok', 'unchanged', 'empty', 'closed', 'not_found'] as const).includes(data as never) ? (data as RenameOutcome) : 'failed';
}
