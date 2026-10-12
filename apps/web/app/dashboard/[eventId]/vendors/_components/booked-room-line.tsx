'use client';

/**
 * The room-size line of a booked VENUE's row (owner 2026-10-07 — *"ceremony and
 * reception and accomodation has size"*; the prototype's `.sent` line):
 *
 *   Room size  18 × 24 m  [sent ✓]  · used by your seat plan
 *   Room size  not sent   ( Ask them )
 *   Room size  asked — waiting
 *
 * "Ask them" posts ONE canned line in the couple's own conversation with the
 * venue, through the door a typed message uses (`sendChatMessage` →
 * `sendChatMessageCore`) — no new action, and every chat rule applies to it.
 * "asked — waiting" lasts for this visit only: nothing records that a size was
 * asked for, so a reload offers the button again.
 */
import { useContext, useState, useTransition } from 'react';
import { MessageCircle } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { formatCount } from '@/lib/format-number';
import { sendChatMessage } from '@/lib/chat-actions';
import { ROOM_SIZE_ASK, type RoomLine } from '@/lib/booked-rows';
import { BookedStandInCtx } from './booked-stand-ins';

export function BookedRoomLine({ line, threadId }: { line: RoomLine; threadId: string | null }) {
  const standIn = useContext(BookedStandInCtx);
  const [pending, start] = useTransition();
  const [asked, setAsked] = useState(false);
  const [failed, setFailed] = useState(false);

  const ask = () => {
    if (!threadId || pending) return;
    start(async () => {
      setFailed(false);
      try {
        if (standIn.askRoom) await standIn.askRoom(threadId);
        else {
          const fd = new FormData();
          fd.set('thread_id', threadId);
          fd.set('body', ROOM_SIZE_ASK);
          await sendChatMessage(fd);
        }
        setAsked(true);
      } catch {
        setFailed(true);
      }
    });
  };

  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1.5" data-booked-room={line.kind}>
      <span className="whitespace-nowrap text-ink">Room size</span>
      {line.kind === 'sent' ? (
        <>
          <b className="font-semibold tabular-nums text-ink">
            {formatCount(line.widthM)} × {formatCount(line.lengthM)} m
          </b>
          <span className="whitespace-nowrap rounded-full bg-success-100 px-2.5 py-1 text-[12px] leading-none text-success-900">sent ✓</span>
          {line.seatPlan ? <span className="text-ink/55">· used by your seat plan</span> : null}
        </>
      ) : line.kind === 'unread' ? (
        <span className="text-ink/55">we couldn’t check</span>
      ) : asked ? (
        <span className="text-ink/55">asked — waiting</span>
      ) : (
        <>
          <span className="text-ink/55">not sent</span>
          {line.canAsk && threadId ? (
            <ActionButton tone="info" icon={MessageCircle} label="Ask them" disabled={pending} onClick={ask} />
          ) : null}
          {failed ? <span className="basis-full text-[12px] text-[rgb(var(--color-danger))]">That did not send. Nothing changed.</span> : null}
        </>
      )}
    </p>
  );
}
