/**
 * 🔒 THE PRIVATE MESSAGE LOOK — ONE PART OF THE CHATBOX KIT (DECISION_LOG 2026-11-09 🔒; owner: *"need to make it
 * evident a private message"*). Not a second chat look: the stream's own bubble takes `PRIVATE_BUBBLE_FILL` instead of
 * its two fills, and draws these two pieces, the same on the sender's side and the recipient's:
 *
 *   · `PrivateMark`  — the strip on TOP of the bubble: "🔒 Private · only you and Jose" · "🔒 Private · only you, Ana
 *                      and Miguel" (several, owner 12 Nov). Given `null` (a message to
 *                      everyone) it draws NOTHING, so a normal bubble can never wear it.
 *   · `PrivateTime`  — the time row under the bubble, the lock repeated: "🔒 6:05 PM".
 *
 * 🔒 PRIVATE IS SKY BLUE (owner ruling, 9 Nov): the fill, the words and the lock are the `--color-private` family — the
 * constants and their measured contrast live in `lib/chat-private.ts`, so the bubble and the composer share one blue.
 * 🔒 lib/a-private-message-looks-private.test.ts
 */
import { Lock } from 'lucide-react';
import { formatChatTimestamp } from '@/lib/chat';
import { PRIVATE_BUBBLE_FILL, PRIVATE_MARK, PRIVATE_STRIP_TEXT, privateStripLabel } from '@/lib/chat-private';
import { WHISPER_STRIP } from '@/lib/chat-whisper';

export { PRIVATE_BUBBLE_FILL, PRIVATE_STRIP_TEXT };

/** `privateWith` — the OTHER people's names as this reader sees them (one, or several since 12 Nov); null/[] = shared. */
export function PrivateMark({
  privateWith,
  whisper = false,
  label,
}: {
  privateWith: string | readonly string[] | null;
  whisper?: boolean;
  /** 🤫 The whisper's own strip by its side (Unichat part E, `whisperStrip`); absent → the 19 Nov words. */
  label?: string;
}) {
  // 🤫 A WHISPER (DECISION_LOG 2026-11-19 "MESSAGE ⇄ WHISPER APPROVED"): the strip across the bubble's top, sky blue,
  // "Whisper · co-hosts only" — no names (every one on its side hears it). 🔒 The drawing's lock opens it (UNICHAT-LIVE
  // 20 Nov `.lk` / `.wnote`: the lock, 12px, before the words) — the 20 Nov drawing over 19 Nov's "not a lock"
  // (controller, under owner delegation 20 Nov).
  if (whisper) {
    return (
      <p
        className="-mx-3 -mt-2 mb-1.5 flex items-center gap-1 bg-[rgb(var(--color-private-text))] px-3 py-[3px] text-[11px] font-bold text-[rgb(var(--color-private-tint))]"
        data-chat-whisper-strip=""
      >
        <Lock aria-hidden className="h-3 w-3 shrink-0" strokeWidth={2.2} />
        <span>{label ?? WHISPER_STRIP}</span>
      </p>
    );
  }
  if (privateWith === null || privateWith.length === 0) return null;
  return (
    <p className={`mb-1 flex items-center gap-1 text-[11.5px] font-semibold ${PRIVATE_STRIP_TEXT}`} data-chat-private-strip="">
      <Lock aria-hidden className="h-3 w-3 shrink-0" strokeWidth={2.2} />
      <span>{privateStripLabel(privateWith)}</span>
    </p>
  );
}

export function PrivateTime({ at, alignEnd, whisper = false }: { at: string; alignEnd: boolean; whisper?: boolean }) {
  return (
    <p className={`mt-0.5 flex items-center gap-1 text-[11px] text-ink/55 ${alignEnd ? 'self-end pr-1' : 'self-start pl-[38px]'}`} data-chat-private-time="">
      {whisper ? null : <Lock aria-hidden className={`h-3 w-3 ${PRIVATE_MARK}`} strokeWidth={2.2} />}
      <span>{formatChatTimestamp(at)}</span>
    </p>
  );
}
