'use client';

/**
 * The stream's system lines that ARE a lane-C card (Supplier Build 3 · lane C): a booking ask, an ask for a change,
 * a guest-count change, a quote that rose (or fell back) with the guest list. The stream asks `streamLineKind` (pure, no import cost) whether a line is one; only then is
 * this chunk fetched. Anything else stays the plain Setnayan line it always was.
 */
import { bookRequestFromLine, changeAskFromLine, guestCountFromLine } from '@/lib/chat-cards';
import { pollFromLine, quoteFallFromLine, quoteRiseFromLine } from '@/lib/chat-card-lines';
import { PollCard } from './poll-card';
import { BookRequestCard } from './book-request-card';
import { ChangeAskCard } from './ask-change-card';
import { GuestRecountCard, QuoteFellCard, QuoteRoseCard } from './guest-recount-card';

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
}) {
  if (pollFromLine(body) && messageId && meId && nameOf) {
    return <PollCard threadId={threadId} messageId={messageId} meId={meId} nameOf={nameOf} />;
  }
  const book = bookRequestFromLine(body);
  if (book) return <BookRequestCard state={book.state} reason={book.reason} supplierName={supplierName} at={at} />;
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
  return null;
}
