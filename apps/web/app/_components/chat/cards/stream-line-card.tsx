'use client';

/**
 * The stream's system lines that ARE a lane-C card (Supplier Build 3 · lane C): a booking ask, an ask for a change,
 * a guest-count change, a quote that rose (or fell back) with the guest list, and the deal's end (a receipt, the crew
 * for the day, a handover, the review ask — Unichat part H2). The stream asks `streamLineKind` (pure, no import cost) whether a line is one; only then is
 * this chunk fetched. Anything else stays the plain Setnayan line it always was.
 */
import { bookRequestFromLine, changeAskFromLine, guestCountFromLine, type BookRequestState } from '@/lib/chat-cards';
import {
  dayCrewFromLine,
  handoverFromLine,
  negotiationFromLine,
  pollFromLine,
  quoteFallFromLine,
  quoteRiseFromLine,
  receiptFromLine,
  reviewAskFromLine,
  scheduleChangeFromLine,
  timeAskFromLine,
} from '@/lib/chat-card-lines';
import { PollCard } from './poll-card';
import { BookRequestCard } from './book-request-card';
import { ChangeAskCard } from './ask-change-card';
import { GuestRecountCard, QuoteFellCard, QuoteRoseCard } from './guest-recount-card';
import { NegotiationCard } from './negotiate-cards';
import { ScheduleChangeCard } from './schedule-change-card';
import { ReceiptCard } from './receipt-card';
import { CrewDayCard } from './crew-day-card';
import { HandoverCard, ReviewAskCard } from './handover-card';
import { ScheduleTimeAskCard } from './schedule-time-ask-card';

export function StreamLineCard({
  body,
  createdAt,
  at,
  threadId,
  viewer,
  supplierName,
  eventDate,
  returnPath,
  messageId,
  meId,
  nameOf,
  answeredAs = null,
}: {
  body: string;
  createdAt: string;
  /** The line's time, already worded by the stream. */
  at: string;
  threadId: string;
  viewer: 'vendor' | 'couple';
  supplierName: string;
  eventDate: string | null;
  returnPath: string;
  /** The line's own id — a poll line finds its poll by it. */
  messageId?: string;
  meId?: string;
  nameOf?: (userId: string) => string;
  /** A booking ask a later line answered → that answer's state (`answeredBookAsks`). */
  answeredAs?: BookRequestState | null;
}) {
  if (pollFromLine(body) && messageId && meId && nameOf) {
    return <PollCard threadId={threadId} messageId={messageId} meId={meId} nameOf={nameOf} />;
  }
  // 🤝 A counter or a proposed plan: the OTHER side's Accept · Counter · Decline (PR-3).
  const nego = negotiationFromLine(body);
  if (nego) return <NegotiationCard threadId={threadId} kind={nego} askedAt={createdAt} viewer={viewer} />;
  const book = bookRequestFromLine(body);
  if (book) return <BookRequestCard state={book.state} reason={book.reason} supplierName={supplierName} at={at} answeredAs={answeredAs} />;
  const ask = changeAskFromLine(body);
  if (ask) {
    // Only the ASK line carries its card; the answer line ("Change asked · … · declined") stays a plain line.
    if (ask.answered) return <p className="text-center text-[13px] text-ink/60">{body}</p>;
    return <ChangeAskCard threadId={threadId} subject={ask.subject} askedAt={createdAt} viewer={viewer} returnPath={returnPath} />;
  }
  const g = guestCountFromLine(body);
  if (g) return <GuestRecountCard threadId={threadId} from={g.from} to={g.to} viewer={viewer} supplierName={supplierName} eventDate={eventDate} />;
  const rise = quoteRiseFromLine(body);
  if (rise) return <QuoteRoseCard pax={rise.pax} deltaWords={rise.deltaWords} viewer={viewer} supplierName={supplierName} />;
  const fall = quoteFallFromLine(body);
  if (fall) return <QuoteFellCard pax={fall.pax} deltaWords={fall.deltaWords} viewer={viewer} supplierName={supplierName} />;
  // 🗓 A host's chapter move (SCHEDULES HAND-IN-HAND part (b)): pinned on the supplier's side until Seen.
  const sched = scheduleChangeFromLine(body);
  if (sched) return <ScheduleChangeCard threadId={threadId} createdAt={createdAt} {...sched} viewer={viewer} supplierName={supplierName} />;
  // 🏁 The deal's end (Unichat part H2): a confirmed payment's receipt, the crew for the day, a handover, the review.
  const receipt = receiptFromLine(body);
  if (receipt) return <ReceiptCard threadId={threadId} createdAt={createdAt} {...receipt} viewer={viewer} supplierName={supplierName} />;
  const handover = handoverFromLine(body);
  if (handover) {
    // The hosts' confirmation is history: the handover's own card already folded to "received".
    if (handover.received) return <p className="text-center text-[13px] text-ink/60">{body}</p>;
    return <HandoverCard threadId={threadId} createdAt={createdAt} kind={handover.kind} viewer={viewer} supplierName={supplierName} />;
  }
  if (reviewAskFromLine(body)) return <ReviewAskCard threadId={threadId} viewer={viewer} supplierName={supplierName} />;
  if (dayCrewFromLine(body)) return <CrewDayCard threadId={threadId} viewer={viewer} supplierName={supplierName} />;
  // 🗓 A time-change ASK, either way (Unichat part F): the supplier's request the hosts answer, or the hosts' ask the
  // supplier answers — the row's own state, read back by the card.
  const timeAsk = timeAskFromLine(body);
  if (timeAsk) return <ScheduleTimeAskCard threadId={threadId} createdAt={createdAt} line={timeAsk} viewer={viewer} supplierName={supplierName} />;
  return null;
}
