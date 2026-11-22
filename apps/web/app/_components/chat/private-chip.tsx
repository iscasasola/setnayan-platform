'use client';

/**
 * 🔒 THE ONE PRIVATE CHIP (Unichat parts D + E, 20 Nov 2026; DECISION_LOG 2026-11-20 "UNICHAT PART E — FIVE CALLS",
 * call 4: "One Private chip. E's stays for now and folds into Part D's chip component when D lands").
 *
 * Part D drew Private as a filter chip in the row the sliders raise; Part E drew its own sky "Private" tag over the box
 * while whispering, with the line that says who a whisper reaches. They were two chips for one thing — this is the
 * only one. Both places draw THIS component:
 *
 *  · `onPress` given → the chip in the row (`KIND_CHIPS`' 'private'): a press, the paper chip with the sky lock; picked,
 *    it fills sky (the drawing's `.k-private` — `--kc: var(--whink)`).
 *  · no `onPress` → the status over the box while whispering (E's look: sky tint, sky words, the lock before the word),
 *    with WHO it reaches beside it and the dispute ⓘ (safety review F7).
 *
 * `line` is what sits beside the status chip: who it reaches ("Only you, Jose and your coordinator" · "You and the
 * hosts" · "Only your team"), or — when the read of who is here FAILED — "Couldn't load…", said as a failure and never
 * as "no one" (`lib/a-failed-whisper-read-is-not-nobody.test.ts`). The lock is the 20 Nov drawing's icon before the
 * word (controller, owner delegation 20 Nov, call 5). Private stays sky in dark too (DARK_MODE_STANDARD §2).
 */
import type { CSSProperties } from 'react';
import { Lock } from 'lucide-react';
import { formatCount } from '@/lib/format-number';
import { WHISPER_DISPUTE_NOTE, type WhisperSide } from '@/lib/chat-whisper';
import { InfoTip } from '../info-tip';

type RowProps = {
  /** The chips row: picking it shows the private lines only (and turns the box to Whisper where it can). */
  onPress: () => void;
  pressed: boolean;
  count: number | null;
  style?: CSSProperties;
};

type StatusProps = {
  onPress?: undefined;
  /** Which side's whisper this is — read by the guards and the shots. */
  side: WhisperSide;
  /** Who it reaches (`'reach'`), the read of who is here FAILED (`'failed'`), or nobody else is here (`'nobody'`). */
  line: { kind: 'reach' | 'failed' | 'nobody'; text: string };
  /** The row is out and its own Private chip is on screen: draw the line only, never a second chip. */
  lineOnly?: boolean;
};

export function PrivateChip(props: RowProps | StatusProps) {
  if (props.onPress) {
    const { onPress, pressed, count, style } = props;
    return (
      <button
        type="button"
        aria-pressed={pressed}
        onClick={onPress}
        style={style}
        className={`sn-press sn-hit relative inline-flex h-8 min-h-0 shrink-0 items-center gap-1 rounded-full px-3 text-[13px] font-semibold shadow-sm ${
          pressed ? 'bg-[rgb(var(--color-private-text))] text-cream' : 'bg-[color:var(--m-paper)] text-ink'
        }`}
        data-chat-kind-chip="private"
        data-chat-private-chip="row"
      >
        <Lock aria-hidden className={`h-3 w-3 shrink-0 ${pressed ? '' : 'text-[rgb(var(--color-private-text))]'}`} strokeWidth={2.2} />
        Private
        {count != null ? <span className={`text-[12px] font-normal tabular-nums ${pressed ? 'text-cream' : 'text-[color:var(--m-slate-2)]'}`}>{formatCount(count)}</span> : null}
      </button>
    );
  }
  const { side, line, lineOnly = false } = props;
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-1.5 px-1 text-[12px] font-semibold text-[rgb(var(--color-private-text))]"
      data-chat-whisper-line={line.kind === 'reach' ? 'on' : line.kind}
      data-chat-whisper-reach={side}
    >
      {lineOnly ? null : (
        <span className="inline-flex items-center gap-1 rounded-full bg-[rgb(var(--color-private-tint))] px-2.5 py-0.5 text-[12px] font-bold text-[rgb(var(--color-private-text))] ring-1 ring-inset ring-[rgb(var(--color-private)/0.45)]" data-chat-private-chip=""><Lock aria-hidden className="h-3 w-3 shrink-0" strokeWidth={2.2} />Private</span>
      )}
      {line.kind !== 'reach' ? (
        <span {...(line.kind === 'failed' ? { 'data-chat-whisper-read-failed': '' } : {})}>{line.text}</span>
      ) : (
        <InfoTip label={line.text} ariaLabel="Who sees this" align="end">
          {WHISPER_DISPUTE_NOTE}
        </InfoTip>
      )}
    </div>
  );
}
