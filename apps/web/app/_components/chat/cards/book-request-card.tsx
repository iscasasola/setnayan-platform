'use client';

/**
 * 📮 BOOK REQUEST — the database's own booking-ask lines, drawn as a card (Supplier Build 3 · lane C).
 *
 * The lines are written by the database (lane B / the booking RPCs) — "Booking ask sent by the hosts · waiting for the
 * supplier's answer" · "Booked ✓" · "Not available · <reason>" · withdrawn · closed · expired. This card reads ONLY
 * those exact words (`bookRequestFromLine`) and adds nothing to them: the answer itself (Agree · Turn it down) stays
 * the shipped one on the quote card and Today, so there is one way to answer.
 */
import { ChatCardShell } from '../chat-step-card';
import type { BookRequestState } from '@/lib/chat-cards';

const WORDS: Record<BookRequestState, { title: string; line: (who: string) => string; tone: string }> = {
  asked: { title: 'Booking ask', line: (who) => (who === 'you' ? 'Waiting for your answer' : `Waiting for ${who}'s answer`), tone: 'text-warn-800' },
  booked: { title: 'Booked ✓', line: () => 'The booking is confirmed.', tone: 'text-success-700' },
  not_available: { title: 'Not available', line: () => 'The supplier turned the ask down.', tone: 'text-ink/70' },
  withdrawn: { title: 'Booking ask withdrawn', line: () => 'The hosts took the ask back.', tone: 'text-ink/60' },
  closed: { title: 'Booking ask closed', line: () => 'Nothing more to answer.', tone: 'text-ink/60' },
  expired: { title: 'Booking ask expired', line: () => 'It ran out without an answer.', tone: 'text-ink/60' },
};

export function BookRequestCard({ state, reason, supplierName, at }: { state: BookRequestState; reason: string | null; supplierName: string; at: string }) {
  const w = WORDS[state];
  return (
    <ChatCardShell topic="details" kicker={`Setnayan · ${at}`} title={w.title} tone="auto">
      <p className={`text-[15px] font-medium ${w.tone}`} data-book-request={state}>
        {state === 'not_available' && reason ? reason : w.line(supplierName)}
      </p>
    </ChatCardShell>
  );
}
