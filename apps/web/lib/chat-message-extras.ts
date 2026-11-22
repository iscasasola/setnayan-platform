/**
 * 💬 UNICHAT PART H1 — the pure half of EDIT · UNSEND · VOICE NOTES (approved Unichat prototype v3, DECISION_LOG
 * 2026-11-20; drawing `build-sessions/UNICHAT-LIVE-2026-11-19.html`: "Hold your own new message: Edit or Unsend.",
 * `Date.now()-m.born < 900000`, a voice note has Unsend only, an unsent message becomes "… unsent a message").
 *
 * What the SCREEN may offer. The database decides again, on its own clock and its own rows
 * (`edit_my_chat_message` / `unsend_my_chat_message`, migration 20271354347259) — nothing here is the rule, only the
 * reason a row is or is not in the menu. Held by `lib/chat-message-extras.test.ts`.
 */
import type { ChatMessageRow } from '@/lib/chat';

/** The drawing's window: 15 minutes after sending. The database adds 30 s of grace for a slow network. */
export const CHAT_EDIT_WINDOW_MS = 15 * 60 * 1000;

/** The longest voice note, in seconds — the drawing's clamp (`Math.min(59, …)`): the bubble reads 0:01 … 0:59. */
export const CHAT_VOICE_MAX_SECONDS = 59;
/** Shorter than this was a tap, not a recording. */
export const CHAT_VOICE_MIN_MS = 700;
/** Slide this far left while holding and the recording is thrown away. */
export const CHAT_VOICE_CANCEL_PX = 80;

/**
 * What a phone's recorder produces: Chrome and Android `audio/webm` (Opus), Firefox `audio/ogg`, Safari and every
 * iPhone `audio/mp4` (AAC). Part of the chat's one allowlist (`CHAT_ATTACHMENT_MIME`), never offered by the file picker.
 */
export const CHAT_VOICE_MIME = ['audio/webm', 'audio/mp4', 'audio/ogg'] as const;

type Extras = Pick<
  ChatMessageRow,
  | 'sender_user_id'
  | 'created_at'
  | 'body'
  | 'proposal_id'
  | 'appointment_id'
  | 'change_order_id'
  | 'amendment_id'
  | 'offered_service_id'
  | 'vendor_offer_id'
  | 'attachment_r2_key'
  | 'attachment_url'
  | 'attachment_mime'
  | 'is_bot'
> & { unsent_at?: string | null; edited_at?: string | null; voice_seconds?: number | null };

/** A voice note: an audio file with its length. */
export function isVoiceNote(m: Pick<Extras, 'attachment_r2_key' | 'attachment_mime' | 'voice_seconds'>): boolean {
  return !!m.attachment_r2_key && (m.attachment_mime ?? '').toLowerCase().startsWith('audio/') && typeof m.voice_seconds === 'number';
}

export function isUnsent(m: { unsent_at?: string | null }): boolean {
  return !!m.unsent_at;
}

function isCard(m: Extras): boolean {
  return (
    !!m.is_bot ||
    m.proposal_id != null ||
    m.appointment_id != null ||
    m.change_order_id != null ||
    m.amendment_id != null ||
    m.offered_service_id != null ||
    m.vendor_offer_id != null
  );
}

function insideWindow(m: Extras, nowMs: number): boolean {
  const sent = Date.parse(m.created_at);
  return Number.isFinite(sent) && nowMs - sent < CHAT_EDIT_WINDOW_MS;
}

/** Your own words, still new: Edit is offered. Never a card, a file, a voice note or an unsent line. */
export function canOfferEdit(m: Extras, meId: string, nowMs: number): boolean {
  if (!meId || m.sender_user_id !== meId || isUnsent(m) || isCard(m)) return false;
  if (m.attachment_r2_key || m.attachment_url) return false;
  if ((m.body ?? '').trim() === '') return false;
  return insideWindow(m, nowMs);
}

/** Your own words or your own voice note, still new: Unsend is offered. A photo or document leaves by its own swipe. */
export function canOfferUnsend(m: Extras, meId: string, nowMs: number): boolean {
  if (!meId || m.sender_user_id !== meId || isUnsent(m) || isCard(m)) return false;
  if (m.attachment_url) return false;
  if (m.attachment_r2_key && !isVoiceNote(m)) return false;
  if (!m.attachment_r2_key && (m.body ?? '').trim() === '') return false;
  return insideWindow(m, nowMs);
}

/** The quiet line everyone reads where the message was — the drawing's words. */
export function unsentLine(who: 'you' | string): string {
  return who === 'you' ? 'You unsent a message' : `${who} unsent a message`;
}

/** "0:07" — a voice note's length. */
export function voiceLength(seconds: number | null | undefined): string {
  const s = Math.max(0, Math.min(5999, Math.round(Number.isFinite(seconds as number) ? (seconds as number) : 0)));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** What the recorder's own type becomes on the file: `audio/webm;codecs=opus` → `audio/webm`; anything else → null. */
export function voiceMimeOf(recorderType: string | null | undefined): (typeof CHAT_VOICE_MIME)[number] | null {
  const base = ((recorderType ?? '').split(';')[0] ?? '').trim().toLowerCase();
  return (CHAT_VOICE_MIME as readonly string[]).includes(base) ? (base as (typeof CHAT_VOICE_MIME)[number]) : null;
}

/** The first type this browser's recorder says it can make, in our order of preference. */
export function pickVoiceMime(isSupported: (mime: string) => boolean): string | null {
  for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg']) {
    try {
      if (isSupported(m)) return m;
    } catch {
      /* a browser that throws on an unknown type simply does not support it */
    }
  }
  return null;
}

const VOICE_EXT: Record<(typeof CHAT_VOICE_MIME)[number], string> = { 'audio/webm': 'webm', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg' };
export function voiceFileName(mime: (typeof CHAT_VOICE_MIME)[number]): string {
  return `Voice note.${VOICE_EXT[mime]}`;
}

/** The length a send may store: whole seconds, 1 … the cap. `null` when nothing usable was posted. */
export function voiceSecondsFromForm(raw: unknown): number | null {
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.max(1, Math.min(CHAT_VOICE_MAX_SECONDS, Math.round(n)));
}
export const CHAT_VOICE_SECONDS_FIELD = 'voice_seconds';

export type MessageChangeRefusal = 'not_yours' | 'gone' | 'not_words' | 'filed' | 'window_closed' | 'empty' | 'too_long' | 'contact_blocked' | 'failed';

/** The database's marker in a refusal → the reason. Unknown text is `failed` — never guessed at. */
export function messageChangeRefusal(dbMessage: string | null | undefined): MessageChangeRefusal {
  const t = dbMessage ?? '';
  if (t.includes('NOT_YOURS') || t.includes('NOT_SIGNED_IN')) return 'not_yours';
  if (t.includes('GONE')) return 'gone';
  if (t.includes('NOT_WORDS')) return 'not_words';
  if (t.includes('FILED')) return 'filed';
  if (t.includes('WINDOW_CLOSED')) return 'window_closed';
  if (t.includes('EMPTY')) return 'empty';
  if (t.includes('TOO_LONG')) return 'too_long';
  if (t.includes('CONTACT_BLOCKED')) return 'contact_blocked';
  return 'failed';
}

/** The words the sender reads when a change did not happen. The message itself is untouched in every case. */
export function messageChangeWords(act: 'edit' | 'unsend', why: MessageChangeRefusal): string {
  const verb = act === 'edit' ? 'edited' : 'unsent';
  switch (why) {
    case 'window_closed':
      return `A message can be ${verb} for 15 minutes after sending.`;
    case 'filed':
      return 'This message is filed under a decision, so it stays as it is.';
    case 'gone':
      return 'This message was already unsent.';
    case 'not_words':
      return act === 'edit' ? 'Only a message of words can be edited.' : 'Only words or a voice note can be unsent.';
    case 'not_yours':
      return act === 'edit' ? 'You can only edit your own message.' : 'You can only unsend your own message.';
    case 'empty':
      return 'A message needs words.';
    case 'too_long':
      return 'Message too long — max 4,000 characters';
    case 'contact_blocked':
      return 'Phone numbers, emails and outside-app contacts are not allowed in a conversation.';
    default:
      return act === 'edit' ? 'Couldn’t save your edit. Try again.' : 'Couldn’t unsend it. Try again.';
  }
}

/** Composer ⇄ stream, the shipped window-event pattern (`chat-stream:*`). */
export const CHAT_EDIT_START_EVENT = 'chat-stream:edit-start';
export const CHAT_EDITED_EVENT = 'chat-stream:edited';
export type ChatEditStart = { threadId: string; messageId: string; body: string };
export type ChatEdited = { threadId: string; messageId: string; body: string; editedAt: string };
