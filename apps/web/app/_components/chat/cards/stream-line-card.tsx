'use client';

/**
 * The stream's system lines that ARE a lane-C card (Supplier Build 3 · lane C): a booking ask, an ask for a change,
 * a guest-count change. The stream asks `streamLineKind` (pure, no import cost) whether a line is one; only then is
 * this chunk fetched. Anything else stays the plain Setnayan line it always was.
 */
import { bookRequestFromLine, changeAskFromLine, guestCountFromLine } from '@/lib/chat-cards';
import { BookRequestCard } from './book-request-card';
import { ChangeAskCard } from './ask-change-card';
import { GuestRecountCard } from './guest-recount-card';

export function StreamLineCard({
  body,
  createdAt,
  at,
  threadId,
  viewer,
  supplierName,
  eventDate,
  returnPath,
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
}) {
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
  return null;
}
