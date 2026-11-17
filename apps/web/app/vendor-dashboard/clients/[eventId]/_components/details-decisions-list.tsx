'use client';

import { useMemo } from 'react';
import { InfoTip } from '@/app/_components/info-tip';
import { ReplyControls, type ReplyContext } from '@/app/_components/chat-thread-views';
import { buildThreadDecisions, type ThreadDecisionFacts } from '@/lib/thread-decisions';

/**
 * 🤝 DECISIONS ON DETAILS (Build 2 · row #42, v118 `dec`) — every quote, meeting, adjustment, logged payment and
 * guest-count change in this client's conversation, each saying where it stands NOW, on the client's Details page.
 *
 * Drawn by the THREAD PAGE from its one draw (`SupplierThreadBody view="decisions"` → `messages/[threadId]/page.tsx`),
 * so this list has no read of its own: the facts arrive merged by `threadDecisionFacts` — the SAME merge the
 * conversation's Decisions view runs — and this only reads the clock and lays them out.
 *
 * v118's look: "Decisions · N" over plain rows split by a dashed rule (frames only on what you press — the answer
 * buttons), "Kind · what" then the now-line, the one waiting on you in the ask colour, its answer under it. The
 * answer is the shipped `ReplyControls` (the stream's own forms and actions), landing back on Details.
 *
 * ⚠ `partial` — a card read was refused: said in one line, never a shorter list that reads as the whole record.
 */
export function DetailsDecisionsList({
  facts,
  partial,
  reply,
}: {
  facts: Omit<ThreadDecisionFacts, 'nowMs'>;
  partial: boolean;
  reply: ReplyContext;
}) {
  // "Waiting 4 days" is relative to the reader's present — the clock is read here, as the stream reads it.
  const entries = useMemo(() => buildThreadDecisions({ ...facts, nowMs: Date.now() }), [facts]);
  return (
    <section data-details-decisions="" aria-label="Decisions">
      <InfoTip
        label={`Decisions · ${entries.length}`}
        labelAs="h3"
        labelClassName="home-k2"
        align="start"
      >
        Every quote, meeting, payment and change with this couple collects here, each showing where it stands now. The
        same list is in Chat.
      </InfoTip>
      {partial ? (
        <p className="pb-1 text-xs text-ink/70" role="note" data-details-decisions-partial="">
          Some couldn&rsquo;t load. Chat has the full list.
        </p>
      ) : null}
      {entries.length === 0 ? (
        <p className="py-2 text-xs text-ink/70" data-details-decisions-empty="">
          Nothing decided yet.
        </p>
      ) : (
        <ol>
          {entries.map((e) => (
            <li key={e.key} className="border-t border-dashed border-ink/15 py-2" data-decision={e.kind}>
              <p className="text-sm font-medium text-ink">
                {e.kindLabel} · <span className="font-normal">{e.title}</span>
              </p>
              <p
                className={`mt-0.5 text-[13px] ${e.now.needsYou ? 'font-medium text-terracotta-700' : 'text-ink/70'}`}
                data-decision-now={e.now.needsYou ? 'you' : ''}
              >
                {e.now.wasText ? <s className="mr-1 text-ink/70">{e.now.wasText}</s> : null}
                {e.now.text}
              </p>
              {e.reply ? <ReplyControls reply={e.reply} ctx={reply} /> : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
