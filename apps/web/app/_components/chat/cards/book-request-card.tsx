'use client';

/**
 * 📮 BOOK REQUEST — the database's own booking-ask lines, drawn as a card (Supplier Build 3 · lane C).
 *
 * The lines are written by the database (lane B / the booking RPCs) — "Booking ask sent by the hosts · waiting for the
 * supplier's answer" · "Booked ✓" · "Not available · <reason>" · withdrawn · closed · expired. This card reads ONLY
 * those exact words (`bookRequestFromLine`) and adds nothing to them: the answer itself (Agree · Turn it down) stays
 * the shipped one on the quote card and Today, so there is one way to answer.
 */
import { KindCard } from './card-bits';
import type { BookRequestState } from '@/lib/chat-cards';

const WORDS: Record<BookRequestState, { title: string; line: (who: string) => string; tone: string }> = {
  asked: { title: 'Booking ask', line: (who) => (who === 'you' ? 'Waiting for your answer' : `Waiting for ${who}'s answer`), tone: 'text-warn-800' },
  booked: { title: 'Booked ✓', line: () => 'The booking is confirmed.', tone: 'text-success-700' },
  not_available: { title: 'Not available', line: () => 'The supplier turned the ask down.', tone: 'text-ink/70' },
  withdrawn: { title: 'Booking ask withdrawn', line: () => 'The hosts took the ask back.', tone: 'text-ink/60' },
  closed: { title: 'Booking ask closed', line: () => 'Nothing more to answer.', tone: 'text-ink/60' },
  expired: { title: 'Booking ask expired', line: () => 'It ran out without an answer.', tone: 'text-ink/60' },
};

/** An ask a later line answered (`answeredBookAsks`) says how it was answered — never "Waiting" again. */
const ANSWERED: Record<Exclude<BookRequestState, 'asked'>, string> = {
  booked: 'Answered · booked',
  not_available: 'Answered · not available',
  withdrawn: 'Withdrawn by the hosts',
  closed: 'Closed',
  expired: 'Expired without an answer',
};

export function BookRequestCard({
  state,
  reason,
  supplierName,
  at,
  answeredAs = null,
}: {
  state: BookRequestState;
  reason: string | null;
  supplierName: string;
  at: string;
  /** The state of the later line that answered this ask; null = nothing answered it yet. */
  answeredAs?: BookRequestState | null;
}) {
  const w = WORDS[state];
  const answered = state === 'asked' && answeredAs && answeredAs !== 'asked' ? ANSWERED[answeredAs] : null;
  const words = answered ?? (state === 'not_available' && reason ? reason : w.line(supplierName));
  // An ask still open is a card (the supplier's turn); anything answered or ended is one settled line.
  if (state !== 'asked' || answered) {
    return (
      <KindCard
        kind="plain"
        topic="details"
        kicker={`Setnayan · ${at}`}
        title={w.title}
        turn={state === 'booked' || answeredAs === 'booked' ? 'done' : 'old'}
        settled={
          <>
            {w.title.replace(/ ✓$/, '')} · <span data-book-request={state} data-book-request-answered={answered ? answeredAs : undefined}>{words}</span>
          </>
        }
      />
    );
  }
  return (
    <KindCard kind="plain" topic="details" kicker={`Setnayan · ${at}`} title={w.title} turn={supplierName === 'you' ? 'me' : 'wait'}>
      <p className={`text-[15px] font-medium ${w.tone}`} data-book-request={state}>
        {words}
      </p>
    </KindCard>
  );
}
