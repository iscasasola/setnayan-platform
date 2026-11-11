/**
 * The chat's own lines that ARE a lane-C card, read by their exact words (Supplier Build 3 · lane C).
 *
 * NO IMPORTS ON PURPOSE: the message stream asks `streamLineKind` for every line, so this module rides in the chat's
 * first load — and the shared bundle has almost no headroom. Every card itself is a lazy chunk (`cards/lazy-cards.tsx`).
 */

export type AskSubject = 'quote' | 'plan' | 'form';

// ── Book-request cards (the database's own lines, lane B migration 20271329937802 § 6) ──────────────────────────

export type BookRequestState = 'asked' | 'booked' | 'not_available' | 'withdrawn' | 'closed' | 'expired';

/** A booking-ask system line → its card, or null when the line is something else. Exact words, never guessed. */
export function bookRequestFromLine(body: string | null | undefined): { state: BookRequestState; reason: string | null } | null {
  const b = (body ?? '').trim();
  if (b === "Booking ask sent by the hosts · waiting for the supplier's answer") return { state: 'asked', reason: null };
  if (b === 'Booked ✓') return { state: 'booked', reason: null };
  if (b === 'Not available') return { state: 'not_available', reason: null };
  if (b.startsWith('Not available · ')) return { state: 'not_available', reason: b.slice('Not available · '.length) || null };
  if (b === 'Booking ask withdrawn by the hosts') return { state: 'withdrawn', reason: null };
  if (b === 'Booking ask closed') return { state: 'closed', reason: null };
  if (b === 'Booking ask expired without an answer') return { state: 'expired', reason: null };
  return null;
}

/** An Ask-for-a-change system line (this lane's migration) → its subject, or null. */
export function changeAskFromLine(body: string | null | undefined): { subject: AskSubject; answered: 'revised' | 'declined' | null } | null {
  const b = (body ?? '').trim();
  const subj = (w: string): AskSubject | null => (w === 'Quotation' ? 'quote' : w === 'Payment plan' ? 'plan' : w === 'Form' ? 'form' : null);
  let m = /^Asked for a change · (Quotation|Payment plan|Form) · /.exec(b);
  if (m) {
    const s = subj(m[1]!);
    return s ? { subject: s, answered: null } : null;
  }
  m = /^Change asked · (Quotation|Payment plan|Form) · (the supplier is sending a new version|declined by the supplier)/.exec(b);
  if (m) {
    const s = subj(m[1]!);
    return s ? { subject: s, answered: m[2]!.startsWith('declined') ? 'declined' : 'revised' } : null;
  }
  return null;
}

/** The title a supplier's shipped form line names ("I sent you a form — “<title>”. Answer it in your event."), or null. */
export function formLineTitle(body: string | null | undefined): string | null {
  const m = /^I sent you a form — “(.+)”\. Answer it in your event\.$/.exec((body ?? '').trim());
  return m ? m[1]! : null;
}

/** "Guest count changed · 150 → 170 guests" (lane B's booking-change line) → the two counts; anything else → null. */
export function guestCountFromLine(body: string | null | undefined): { from: number; to: number } | null {
  const m = /^Guest count changed · (\d+) → (\d+) guests$/.exec((body ?? '').trim());
  return m ? { from: Number(m[1]), to: Number(m[2]) } : null;
}


/**
 * 🗳 "Poll · <question>" — the line a posted poll rides (migration 20271338412990 writes it with the poll). Its close /
 * reopen lines ("Poll closed · …", "Poll reopened · …") stay plain lines.
 */
export function pollFromLine(body: string | null | undefined): { question: string } | null {
  const b = (body ?? '').trim();
  return b.startsWith('Poll · ') && b.length > 'Poll · '.length ? { question: b.slice('Poll · '.length) } : null;
}

/** 🤝 "Counter · <the total|line> · ₱X · <who>" / "Plan proposed · <who>" (migration 20271340018194) → its card. */
export function negotiationFromLine(body: string | null | undefined): 'counter' | 'plan' | null {
  const b = (body ?? '').trim();
  return b.startsWith('Counter · ') ? 'counter' : b.startsWith('Plan proposed · ') ? 'plan' : null;
}

/** Which lane-C card a SYSTEM line is, or null (the stream then draws the plain Setnayan line it always drew). */
export function streamLineKind(body: string | null | undefined): 'book' | 'ask' | 'guests' | 'poll' | 'negotiate' | null {
  if (bookRequestFromLine(body)) return 'book';
  if (negotiationFromLine(body)) return 'negotiate';
  if (pollFromLine(body)) return 'poll';
  if (changeAskFromLine(body)) return 'ask';
  if (guestCountFromLine(body)) return 'guests';
  return null;
}
