/**
 * 🗳 THE CHAT'S POLL CARD — the one TS door to the chat_poll_* writers (owner 11 Nov 2026; migration 20271338412990).
 *
 * DECISION_LOG 2026-11-11 🗳 "… POLLS ARE THEIR OWN CARD" and "CHAT POLLS — ONE PER CHAT · THE (+) REOPENS ONCE SENT ·
 * EITHER SIDE CLOSES": a question (≤ 120) and 2–6 choices (≤ 60); each person votes once and may move or take back the
 * vote; either side closes; anyone reopens; a closed poll is saved as the decision in one tap (a tie → pick one of the
 * tied). ONE OPEN POLL PER CHAT — the database refuses a second (`chat_polls_one_open_per_thread`).
 *
 * Called from the BROWSER with the reader's own session — no server action (the server-action budget); each write is a
 * SECURITY DEFINER function that checks the chat membership itself, each read is the reader's own RLS.
 * The pure parts (the draft's rules, the tally, the winner / tie) are here too, so the card and its tests share them.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export const POLL_QUESTION_MAX = 120;
export const POLL_CHOICE_MAX = 60;
export const POLL_CHOICES_MIN = 2;
export const POLL_CHOICES_MAX = 6;

/** The words of the stream line a posted poll rides (the database writes it: `'Poll · ' || question`). */
export const POLL_LINE_PREFIX = 'Poll · ';

export type PollChoice = { choiceId: string; label: string; position: number };
export type PollVote = { voterUserId: string; choiceId: string };
export type Poll = {
  pollId: string;
  threadId: string;
  question: string;
  askedByUserId: string | null;
  closedAt: string | null;
  savedDecisionId: string | null;
  choices: PollChoice[];
  votes: PollVote[];
};

// ── the draft's rules (the database holds the same ones) ─────────────────────

/** The choices a draft would send: trimmed, empties dropped. */
export function cleanChoices(choices: readonly string[]): string[] {
  return choices.map((c) => c.trim()).filter((c) => c.length > 0);
}

/** Why a draft cannot be opened yet, or null when it can. */
export function pollDraftProblem(question: string, choices: readonly string[]): 'question' | 'too_few' | 'too_many' | 'too_long' | 'same' | null {
  const q = question.trim();
  if (q.length < 1 || q.length > POLL_QUESTION_MAX) return 'question';
  const c = cleanChoices(choices);
  if (c.length < POLL_CHOICES_MIN) return 'too_few';
  if (c.length > POLL_CHOICES_MAX) return 'too_many';
  if (c.some((x) => x.length > POLL_CHOICE_MAX)) return 'too_long';
  if (new Set(c.map((x) => x.toLowerCase())).size !== c.length) return 'same';
  return null;
}

// ── the tally ────────────────────────────────────────────────────────────────

export type TallyRow = { choice: PollChoice; count: number; voters: string[]; share: number; mine: boolean };

/** Each choice with its count, its voters, its share of the votes (0–1, for the bar) and whether it is the reader's. */
export function tallyPoll(poll: Pick<Poll, 'choices' | 'votes'>, me: string | null): TallyRow[] {
  const total = poll.votes.length;
  return [...poll.choices]
    .sort((a, b) => a.position - b.position)
    .map((choice) => {
      const voters = poll.votes.filter((v) => v.choiceId === choice.choiceId).map((v) => v.voterUserId);
      return { choice, count: voters.length, voters, share: total ? voters.length / total : 0, mine: !!me && voters.includes(me) };
    });
}

/** The choices with the most votes — one = the winner; several = a tie (every choice when nobody voted). */
export function pollLeaders(poll: Pick<Poll, 'choices' | 'votes'>): PollChoice[] {
  const rows = tallyPoll(poll, null);
  const top = Math.max(0, ...rows.map((r) => r.count));
  return rows.filter((r) => r.count === top).map((r) => r.choice);
}

/** What tapping a choice does: vote for it, or — tapping your own — take your vote back (null). */
export function voteForTap(poll: Pick<Poll, 'votes'>, me: string, choiceId: string): string | null {
  return poll.votes.some((v) => v.voterUserId === me && v.choiceId === choiceId) ? null : choiceId;
}

// ── the reads ────────────────────────────────────────────────────────────────

const POLL_COLS = 'poll_id, thread_id, question, asked_by_user_id, closed_at, saved_decision_id';

type PollRowDb = {
  poll_id: string;
  thread_id: string;
  question: string;
  asked_by_user_id: string | null;
  closed_at: string | null;
  saved_decision_id: string | null;
};

async function withParts(supabase: SupabaseClient, row: PollRowDb): Promise<Poll | null> {
  const [choices, votes] = await Promise.all([
    supabase.from('chat_poll_choices').select('choice_id, label, position').eq('poll_id', row.poll_id).order('position'),
    supabase.from('chat_poll_votes').select('voter_user_id, choice_id').eq('poll_id', row.poll_id),
  ]);
  if (choices.error || votes.error) {
    console.warn('[chat-polls] parts refused', choices.error?.code ?? votes.error?.code);
    return null;
  }
  return {
    pollId: row.poll_id,
    threadId: row.thread_id,
    question: row.question,
    askedByUserId: row.asked_by_user_id,
    closedAt: row.closed_at,
    savedDecisionId: row.saved_decision_id,
    choices: (choices.data ?? []).map((c) => ({ choiceId: c.choice_id as string, label: c.label as string, position: c.position as number })),
    votes: (votes.data ?? []).map((v) => ({ voterUserId: v.voter_user_id as string, choiceId: v.choice_id as string })),
  };
}

/** The poll a stream line carries (by its message id). `null` = refused / not found — the card says "Couldn't load". */
export async function loadPollForMessage(supabase: SupabaseClient, messageId: string): Promise<Poll | null> {
  const { data, error } = await supabase.from('chat_polls').select(POLL_COLS).eq('message_id', messageId).maybeSingle();
  if (error || !data) {
    if (error) console.warn('[chat-polls] poll refused', error.code);
    return null;
  }
  return withParts(supabase, data as PollRowDb);
}

/** Is a poll open in this chat right now? (`null` = the read was refused — say nothing rather than guess.) */
export async function chatHasOpenPoll(supabase: SupabaseClient, threadId: string): Promise<boolean | null> {
  const { count, error } = await supabase
    .from('chat_polls')
    .select('poll_id', { count: 'exact', head: true })
    .eq('thread_id', threadId)
    .is('closed_at', null);
  if (error) {
    console.warn('[chat-polls] open-poll read refused', error.code);
    return null;
  }
  return (count ?? 0) > 0;
}

// ── the writes ───────────────────────────────────────────────────────────────

export type OpenPollResult =
  | { ok: true; pollId: string }
  | { ok: false; reason: 'draft' | 'one_open' | 'contact' | 'not_allowed' | 'failed' };

/** Open a poll. `one_open` = another poll is open in this chat — close it first. */
export async function openPoll(supabase: SupabaseClient, threadId: string, question: string, choices: readonly string[]): Promise<OpenPollResult> {
  if (pollDraftProblem(question, choices)) return { ok: false, reason: 'draft' };
  const { data, error } = await supabase.rpc('chat_poll_open', {
    p_thread_id: threadId,
    p_question: question.trim(),
    p_choices: cleanChoices(choices),
  });
  if (error) {
    console.warn('[openPoll] refused', error.code);
    const reason =
      error.code === '23505' ? 'one_open' : error.code === '23514' ? 'contact' : error.code === '42501' ? 'not_allowed' : error.code === '22023' ? 'draft' : 'failed';
    return { ok: false, reason };
  }
  return typeof data === 'string' && data ? { ok: true, pollId: data } : { ok: false, reason: 'failed' };
}

export type PollWriteOutcome = 'ok' | 'withdrawn' | 'unchanged' | 'closed' | 'bad_choice' | 'one_open' | 'saved' | 'not_found' | 'failed';
const POLL_WORDS: readonly PollWriteOutcome[] = ['ok', 'withdrawn', 'unchanged', 'closed', 'bad_choice', 'one_open', 'saved', 'not_found'];

async function pollWrite(supabase: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<PollWriteOutcome> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    console.warn(`[${fn}] refused`, error.code);
    return 'failed';
  }
  return POLL_WORDS.includes(data as PollWriteOutcome) ? (data as PollWriteOutcome) : 'failed';
}

/** Vote, move the vote (another choice), or take it back (`null`). */
export function votePoll(supabase: SupabaseClient, pollId: string, choiceId: string | null): Promise<PollWriteOutcome> {
  return pollWrite(supabase, 'chat_poll_vote', { p_poll_id: pollId, p_choice_id: choiceId });
}

/** Close poll — either side. */
export function closePoll(supabase: SupabaseClient, pollId: string): Promise<PollWriteOutcome> {
  return pollWrite(supabase, 'chat_poll_close', { p_poll_id: pollId });
}

/** Reopen — anyone in the chat; refused while another poll is open (`one_open`) or once saved as the decision (`saved`). */
export function reopenPoll(supabase: SupabaseClient, pollId: string): Promise<PollWriteOutcome> {
  return pollWrite(supabase, 'chat_poll_reopen', { p_poll_id: pollId });
}

export type SaveAsDecisionResult =
  | { ok: true; topicId: string }
  | { ok: false; reason: 'tie'; tiedChoiceIds: string[] }
  | { ok: false; reason: 'still_open' | 'already_saved' | 'bad_choice' | 'not_allowed' | 'failed' };

/** Save a CLOSED poll as the decision — the winning choice (or, after a tie, the picked one) becomes a decision topic. */
export async function savePollAsDecision(supabase: SupabaseClient, pollId: string, choiceId: string | null = null): Promise<SaveAsDecisionResult> {
  const { data, error } = await supabase.rpc('chat_poll_save_as_decision', { p_poll_id: pollId, p_choice_id: choiceId });
  if (error) {
    console.warn('[savePollAsDecision] refused', error.code);
    const msg = error.message ?? '';
    if (/\bTIE\b/.test(msg)) {
      const ids = String((error as { details?: string }).details ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      return { ok: false, reason: 'tie', tiedChoiceIds: ids };
    }
    if (error.code === '55000') return { ok: false, reason: 'still_open' };
    if (error.code === '23505') return { ok: false, reason: 'already_saved' };
    if (error.code === '22023') return { ok: false, reason: 'bad_choice' };
    if (error.code === '42501') return { ok: false, reason: 'not_allowed' };
    return { ok: false, reason: 'failed' };
  }
  return typeof data === 'string' && data ? { ok: true, topicId: data } : { ok: false, reason: 'failed' };
}
