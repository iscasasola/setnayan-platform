/**
 * 🔒 THE PRIVATE MESSAGE LOOK — ONE PART OF THE CHATBOX KIT (DECISION_LOG 2026-11-09 🔒; owner: *"need to make it
 * evident a private message"*). Not a second chat look: the stream's own bubble takes `PRIVATE_BUBBLE_FILL` instead of
 * its two fills, and draws these two pieces, the same on the sender's side and the recipient's:
 *
 *   · `PrivateMark`  — the strip on TOP of the bubble: "🔒 Private · only you and Jose". Given `null` (a message to
 *                      everyone) it draws NOTHING, so a normal bubble can never wear it.
 *   · `PrivateTime`  — the time row under the bubble, the lock repeated: "🔒 6:05 PM".
 *
 * The fill is the app's info ramp (`--ramp-info-*`), which turns over in dark mode with every other ramp — distinct
 * from yours (the accent, filled) and theirs (the ink wash). 🔒 lib/a-private-message-looks-private.test.ts
 */
import { Lock } from 'lucide-react';
import { formatChatTimestamp } from '@/lib/chat';
import { privateStripLabel } from '@/lib/chat-private';

export const PRIVATE_BUBBLE_FILL = 'bg-info-100 text-ink ring-1 ring-inset ring-info-300';

export function PrivateMark({ privateWith }: { privateWith: string | null }) {
  if (privateWith === null) return null;
  return (
    <p className="mb-1 flex items-center gap-1 text-[11.5px] font-semibold text-info-800" data-chat-private-strip="">
      <Lock aria-hidden className="h-3 w-3 shrink-0" strokeWidth={2.2} />
      <span>{privateStripLabel(privateWith)}</span>
    </p>
  );
}

export function PrivateTime({ at, alignEnd }: { at: string; alignEnd: boolean }) {
  return (
    <p className={`mt-0.5 flex items-center gap-1 text-[11px] text-ink/55 ${alignEnd ? 'self-end pr-1' : 'self-start pl-[38px]'}`} data-chat-private-time="">
      <Lock aria-hidden className="h-3 w-3" strokeWidth={2.2} />
      <span>{formatChatTimestamp(at)}</span>
    </p>
  );
}
