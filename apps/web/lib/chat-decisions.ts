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
