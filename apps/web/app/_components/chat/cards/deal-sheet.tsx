'use client';

/**
 * 🤝 EVERY VERSION, THEIR ASK BESIDE IT (owner 19 Nov 2026, DECISION_LOG "THE CLIENT PAGE IS ONE CHAT THAT HOLDS
 * EVERYTHING" — the negotiation tools; drawing S9ScH2Ps v3, screen 7). Raised full screen by the strip's Deal / Quote
 * box, over the chat (the one `RiseScreen`).
 *
 * It EXTENDS the shipped "See every version": the same versions (`QuoteVersion`, `versionsNewestFirst`), the same
 * words for a line's price (`quoteLinePriceWords`) — the last two versions side by side — plus:
 *   · THEIR ASK as one more column: the hosts' newest open counter (`change_asks_read`, the masking reader). A counter
 *     is on the total or on ONE line, so only that row and the total carry a figure; the others say "—";
 *   · "You are ₱X apart" — your current total less what their ask would make it (`counterOutcome`, the one rule);
 *   · Your lowest — private, typed by the supplier (`LowestRow`);
 *   · in the lower third: Drop an offer · Counter (or Answer their ask, which goes to their counter's own card —
 *     Accept · Counter · Decline live there, never a second copy).
 *
 * A refused read says "Couldn't load", never "no ask" and never "one version".
 */
import { useCallback, useEffect, useState } from 'react';
import { MessageCircleQuestion, Tag } from 'lucide-react';
import { ActionButton, EqualRow } from '@/components/action-button';
import { RiseScreen, WithRiseClose } from '@/app/_components/rise/rise-screen';
import { counterOutcome, goodUntilWords, manilaToday } from '@/lib/chat-cards';
import { gapWords, theirOpenAsk } from '@/lib/chat-deal';
import { PLUS_CARD_TITLE, plusGate } from '@/lib/chat-plus';
import { PLUS_DRAFT_ANCHOR, jumpTo, patchPlus, usePlus } from '@/lib/chat-plus-store';
import { formatCentavosPhp } from '@/lib/php';
import { quoteLinePriceWords } from '@/lib/quote-line-price-words';
import { versionDay, type QuoteVersion } from '@/lib/quote-versions';
import { loadChangeAsks, loadNegotiation, type ChangeAskRow, type NegotiationQuote } from './card-calls';
import { CouldNotLoad, Loading, type Read } from './card-bits';
import { LowestRow } from './lowest-price';

export function DealSheet({
  threadId,
  versions,
  counterpartyLabel,
  onClose,
}: {
  threadId: string;
  /** Every version of this chat's quote, in order — null = not read (or refused). */
  versions: readonly QuoteVersion[] | null;
  counterpartyLabel: string;
  onClose: () => void;
}) {
  const today = manilaToday();
  const [read, setRead] = useState<Read<{ asks: ChangeAskRow[]; quote: NegotiationQuote | null }>>({ at: 'loading' });
  const load = useCallback(() => {
    setRead({ at: 'loading' });
    void Promise.all([loadChangeAsks(threadId), loadNegotiation(threadId)]).then(([a, q]) => {
      setRead(a.ok && q.ok ? { at: 'ok', data: { asks: a.asks, quote: q.quote } } : { at: 'failed' });
    });
  }, [threadId]);
  useEffect(() => load(), [load]);
  const plus = usePlus(threadId);
  const running = plus.draft
    ? { key: 'draft', card: plus.draft.kind, title: PLUS_CARD_TITLE[plus.draft.kind], by: 'you' as const, status: 'draft' as const, anchorId: PLUS_DRAFT_ANCHOR }
    : plus.sent;

  // The live quote's own versions, newest last; the table shows the last two.
  const live = read.at === 'ok' ? read.data.quote : null;
  const mine = versions ? versions.filter((v) => v.status !== 'draft') : null;
  const current = mine && mine.length > 0 ? (mine.find((v) => v.proposalId === live?.proposalId) ?? mine[mine.length - 1]!) : null;
  const before = current?.previous ?? null;
  const ask = read.at === 'ok' ? theirOpenAsk(read.data.asks, today) : null;
  const onLive = !!ask && !!live && ask.proposalId === live.proposalId;
  const outcome =
    ask && live && onLive
      ? counterOutcome({
          totalCentavos: live.totalCentavos,
          lines: live.lines,
          amountCentavos: ask.amountCentavos ?? 0,
          scopeLabel: ask.scopeLabel ?? null,
          floorCentavos: live.floorCentavos,
          planRows: live.planRows,
          paidSeqs: new Set(live.paidSeqs),
        })
      : null;
  const gap = current && outcome ? gapWords(current.totalCentavos, outcome.newTotalCentavos) : null;
  const booked = live?.locks.quote === true;

  /** Drop a (+) card from here: close this screen first, then the card lands in the chat (one at a time). */
  const drop = (kind: 'offer' | 'counter' | 'quote', close: () => void) => {
    const gate = plusGate(running ?? null);
    close();
    window.setTimeout(() => {
      if (gate.shut) {
        patchPlus(threadId, { toast: { text: gate.message, at: Date.now() } });
        if (running) jumpTo(running.anchorId);
        return;
      }
      patchPlus(threadId, { draft: { kind, startedAt: Date.now() } });
      window.setTimeout(() => jumpTo(PLUS_DRAFT_ANCHOR), 60);
    }, 320);
  };
  /** Their counter's own card in the chat — Accept · Counter · Decline live there. */
  const toTheirAsk = (close: () => void) => {
    close();
    window.setTimeout(() => {
      const cards = document.querySelectorAll<HTMLElement>('[data-negotiation="counter"][data-negotiation-status="open"]');
      const card = cards[cards.length - 1]?.closest<HTMLElement>('[data-chat-card]');
      if (!card) return;
      if (!card.id) card.id = 'chat-their-ask';
      jumpTo(card.id);
    }, 320);
  };

  const cell = 'px-2 py-2 text-right tabular-nums';
  return (
    <RiseScreen
      title="Every version"
      line={`${counterpartyLabel} · back to chat`}
      data="deal"
      onClose={onClose}
      thumb={
        read.at === 'ok' && current && !booked ? (
          <WithRiseClose fallback={onClose}>
            {(close) => (
              <EqualRow data="data-deal-actions">
                <ActionButton tone="neutral" icon={Tag} label="Drop an offer" onClick={() => drop('offer', close)} />
                {ask ? (
                  <ActionButton tone="brand" main icon={MessageCircleQuestion} label="Answer their ask" onClick={() => toTheirAsk(close)} />
                ) : (
                  <ActionButton tone="brand" main icon={MessageCircleQuestion} label="Change quote" onClick={() => drop('quote', close)} />
                )}
              </EqualRow>
            )}
          </WithRiseClose>
        ) : undefined
      }
    >
      <div className="grid gap-4 px-4 pt-3" data-deal-sheet="">
        {read.at === 'loading' ? (
          <Loading />
        ) : read.at === 'failed' || versions === null ? (
          <CouldNotLoad what="the versions" onRetry={load} />
        ) : !current ? (
          <p className="text-[15px] text-ink/70">No quote in this chat yet.</p>
        ) : (
          <>
            <table className="w-full table-fixed text-[13.5px]" data-deal-table="">
              <thead>
                <tr className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-[color:var(--m-slate-2)]">
                  <th className="w-[34%] px-2 py-2 text-left font-bold">Line</th>
                  {before ? <th className={`${cell} font-bold`}>v{before.version} · {versionDay(before.at)}</th> : null}
                  <th className={`${cell} font-bold`}>v{current.version} · {versionDay(current.at)}</th>
                  {ask ? <th className={`${cell} font-bold`}>Their ask</th> : null}
                </tr>
              </thead>
              <tbody>
                {current.lines.map((li, i) => {
                  const was = before?.lines.find((b) => b.label === li.label) ?? null;
                  const asked = ask && onLive && ask.scopeLabel && ask.scopeLabel === li.label ? formatCentavosPhp(ask.amountCentavos ?? 0) : '—';
                  return (
                    <tr key={`${li.label}-${i}`} className="border-t border-[color:var(--m-line)]">
                      <td className="truncate px-2 py-2 text-ink">{li.label}</td>
                      {before ? <td className={`${cell} text-ink/70`}>{was ? quoteLinePriceWords(was) : '—'}</td> : null}
                      <td className={`${cell} text-ink`}>{quoteLinePriceWords(li)}</td>
                      {ask ? <td className={`${cell} text-ink/70`}>{asked}</td> : null}
                    </tr>
                  );
                })}
                <tr className="border-t border-[color:var(--m-line)] font-semibold">
                  <td className="px-2 py-2 text-ink">Total</td>
                  {before ? <td className={`${cell} text-ink/70`}>{formatCentavosPhp(before.totalCentavos)}</td> : null}
                  <td className={`${cell} text-ink`}>{formatCentavosPhp(current.totalCentavos)}</td>
                  {ask ? (
                    <td className={`${cell} text-sn-accent`} data-deal-their-total="">
                      {outcome ? formatCentavosPhp(outcome.newTotalCentavos) : '—'}
                    </td>
                  ) : null}
                </tr>
              </tbody>
            </table>
            {ask && !onLive ? <p className="text-[13px] text-ink/60">Their ask was on an earlier version.</p> : null}
            {gap ? (
              <p className="flex items-baseline justify-between gap-3 text-[15px] text-ink" data-deal-gap="">
                <span>You are {gap.amount} apart</span>
                <span className="tabular-nums text-ink/60">{gap.percent}</span>
              </p>
            ) : null}
            {ask?.goodUntil ? <p className="text-[13px] text-ink/60">Their ask · {goodUntilWords(ask.goodUntil, today).words}</p> : null}
            {booked ? <p className="text-[13px] text-ink/60">Booked at this quote · propose a change order on their Schedule.</p> : null}
            <LowestRow threadId={threadId} />
          </>
        )}
      </div>
    </RiseScreen>
  );
}
