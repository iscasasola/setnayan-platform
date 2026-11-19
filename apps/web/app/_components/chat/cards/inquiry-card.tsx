'use client';

/**
 * ✉ THE FIRST INQUIRY IS A CARD (owner 19 Nov 2026, DECISION_LOG "THE CLIENT PAGE IS ONE CHAT THAT HOLDS EVERYTHING";
 * drawing S9ScH2Ps v3, screen 10) — supplier side. Everything needed to quote, and ONE button.
 *
 * The inquiry itself stays the hosts' own message under this card (their words are never rewritten). The card reads:
 *   · the SERVICE off the inquiry's own last line ("Service: X" / "Services: A · B" — `inquiryServicesLine`, written by
 *     `startServiceInquiry`); no such line → the card says "Not given";
 *   · the date, guests, venue and budget from the brief the client page already read (`ChatHome.inquiry`) — a fact the
 *     hosts did not give says "Not given", never a blank;
 *   · whether that date is open on the shop's calendar (the thread page's own day answer) — unknown says nothing.
 *
 * "Reply with an offer" opens the SHIPPED Make a quote card (the (+)'s first row, one card at a time). Once a quote
 * is in the chat the card is settled: it says so, with no button.
 */
import { Send } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { PLUS_CARD_TITLE, plusGate } from '@/lib/chat-plus';
import { PLUS_DRAFT_ANCHOR, jumpTo, patchPlus, usePlus } from '@/lib/chat-plus-store';
import { dayMonth } from '@/lib/format-date';
import { inquiryServiceOf } from '@/lib/chat-card-lines';
import { KindCard } from './card-bits';
import type { InquiryFacts } from '../chat-home';

export const NOT_GIVEN = 'Not given';

function Fact({ name, value }: { name: string; value: string | null }) {
  return (
    <div className="flex min-h-[28px] items-baseline justify-between gap-3 text-[14px]">
      <span className="text-ink/70">{name}</span>
      <span className={`min-w-0 truncate text-right tabular-nums ${value ? 'font-semibold text-ink' : 'text-[color:var(--m-slate-2)]'}`}>{value ?? NOT_GIVEN}</span>
    </div>
  );
}

export function InquiryCard({
  threadId,
  body,
  from,
  at,
  facts,
  calendar,
}: {
  threadId: string;
  /** The inquiry message's own words. */
  body: string;
  /** Who asked, as this chat names them. */
  from: string;
  at: string;
  facts: InquiryFacts;
  calendar: 'open' | 'busy' | null;
}) {
  const plus = usePlus(threadId);
  const running = plus.draft
    ? { key: 'draft', card: plus.draft.kind, title: PLUS_CARD_TITLE[plus.draft.kind], by: 'you' as const, status: 'draft' as const, anchorId: PLUS_DRAFT_ANCHOR }
    : plus.sent;
  const service = inquiryServiceOf(body);
  const day = facts.date && /^\d{4}-\d{2}-\d{2}/.test(facts.date) ? facts.date.slice(0, 10) : null;
  const date = day ? `${dayMonth(day)} ${day.slice(0, 4)}` : null;
  const reply = () => {
    // ONE (+) card at a time (owner 8 Nov): with one open, say which and go to it.
    const gate = plusGate(running ?? null);
    if (gate.shut) {
      patchPlus(threadId, { toast: { text: gate.message, at: Date.now() } });
      if (running) jumpTo(running.anchorId);
      return;
    }
    patchPlus(threadId, { draft: { kind: 'quote', startedAt: Date.now() } });
    window.setTimeout(() => jumpTo(PLUS_DRAFT_ANCHOR), 60);
  };
  return (
    <KindCard
      kind="plain"
      topic="chat"
      kicker={`Inquiry · from ${from} · ${at}`}
      title={service ?? 'An inquiry'}
      tone="theirs"
      turn={facts.hasQuote ? 'done' : 'me'}
      settled={facts.hasQuote ? `${service ?? 'An inquiry'} · You replied with a quote` : undefined}
    >
      <div className="grid gap-0.5" data-inquiry="">
        {service ? null : <Fact name="Service" value={null} />}
        <Fact name="Date" value={date} />
        <Fact name="Guests" value={facts.guests} />
        <Fact name="Venue" value={facts.venue} />
        <Fact name="Budget" value={facts.budget} />
        {date && calendar ? (
          <p className={`pt-1 text-[13px] font-medium ${calendar === 'open' ? 'text-success-700' : ''}`} style={calendar === 'busy' ? { color: 'rgb(var(--color-warn))' } : undefined} data-inquiry-calendar={calendar}>
            {calendar === 'open' ? 'Date is open on your calendar' : 'Date is busy on your calendar'}
          </p>
        ) : null}
        {facts.hasQuote ? (
          <p className="pt-1 text-[13px] font-medium text-success-700" role="status" data-inquiry-settled="">
            You replied with a quote
          </p>
        ) : (
          <div className="flex justify-end pt-2">
            <ActionButton tone="brand" main icon={Send} label="Reply with an offer" onClick={reply} data-inquiry-reply="" />
          </div>
        )}
      </div>
    </KindCard>
  );
}
