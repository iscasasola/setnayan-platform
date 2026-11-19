/**
 * 💬 THE SUMMARY STRIP ON TOP OF THE CLIENT'S CHAT (owner 19 Nov 2026, DECISION_LOG "THE CLIENT PAGE IS ONE CHAT THAT
 * HOLDS EVERYTHING"; drawing S9ScH2Ps v3, screens 2 · 3 · 7). Four facts stay pinned where the seven tabs were, and each
 * box is the door to the shipped page behind it:
 *
 *   BOOKED       Paid  ₱18,000 of ₱45,000 (+ a bar)   → Book & Budget at the payments
 *   NOT BOOKED   Deal  ₱45,000 · they ask ₱40,000     → Every version (their ask beside it)
 *                Quote ₱45,000 · sent 12 Nov          → Book & Budget (the quote) — when nobody has countered
 *   Next         Tasting · 3 Dec                      → Schedule
 *   Forms        2 open                               → Details at Forms  (shut, with its reason, before booking)
 *   Decisions    1 waiting on you                     → Details at Decisions (counted by the chat itself — `chat-kinds`)
 *
 * 🔑 A FAILED READ NEVER LOOKS EMPTY (the pattern of `lib/guests.ts` · `vendor-dashboard/reads-are-honest.test.ts`):
 * every input says apart "could not be read" (`null`) and "there is none" (`undefined`, or a zero that was measured). A
 * box whose read failed is `failed: true` and draws "Couldn't load · tap to retry" in the danger colour — never ₱0,
 * never "0 open", never a blank.
 *
 * Pure: every input is a fact the client page already read. 🔒 lib/client-chat-strip.test.ts
 */
import { dayMonth } from './format-date';

/**
 * "Good until 26 Nov · 3 days left" / "Expired 10 Nov" — the SAME count and words `goodUntilWords` (lib/chat-cards.ts)
 * gives the counter cards. Written out here because the strip is in the client page's first load and `chat-cards` (the
 * card rules, the schedule resolver) must stay out of it; `client-chat-strip.test.ts` holds the two to the same count.
 */
export function quoteGoodUntil(goodUntil: string | null, todayIso: string): { expired: boolean; words: string | null } {
  if (!goodUntil || !/^\d{4}-\d{2}-\d{2}/.test(goodUntil)) return { expired: false, words: null };
  const day = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  const left = Math.round((day(goodUntil) - day(todayIso)) / 86_400_000);
  // The app's own short date ("26 Nov", `dayMonth`) — never the runtime's locale, so the server and a phone agree.
  const label = dayMonth(goodUntil.slice(0, 10)) ?? goodUntil.slice(0, 10);
  if (left < 0) return { expired: true, words: `Expired ${label}` };
  return { expired: false, words: `Good until ${label} · ${left === 0 ? 'last day' : `${left} day${left === 1 ? '' : 's'} left`}` };
}

export const STRIP_FAILED_WORDS = 'Couldn’t load · tap to retry';

export type StripTone = 'plain' | 'needs' | 'warn' | 'ok' | 'danger' | 'quiet';

/** Where a box goes: a door id the picked shell reads (`payments`, `forms`, `decisions`…), or the Deal sheet in the chat. */
export type StripDoor = 'payments' | 'quote' | 'schedule' | 'files' | 'forms' | 'decisions' | 'deal';

export type StripBox = {
  key: 'money' | 'next' | 'forms' | 'decisions';
  label: string;
  value: string;
  tone: StripTone;
  /** A second, smaller line (the quote's Good until, the next payment). */
  sub?: { text: string; tone: StripTone } | null;
  /** Paid ÷ agreed, 0–1 — the bar under Paid. Only when both were read and an amount is set. */
  progress?: number | null;
  /** null = not a press: a shut box says why instead (Forms before booking). */
  door: StripDoor | null;
  /** The read behind this box failed: the press retries it. */
  failed: boolean;
};

export type StripInputs = {
  isBooked: boolean;
  /** Manila civil today, YYYY-MM-DD. */
  todayIso: string;
  peso: (php: number) => string;
  /**
   * Booked: what is paid of what was agreed (`clientPaymentView`). `null` = unread. Inside it, a figure that could not
   * be worked out is `null` too (a refused ledger with no plan).
   */
  paid: {
    paidPhp: number | null;
    agreedPhp: number | null;
    next: { amountPhp: number; dueText: string | null; check: boolean; late: boolean } | null;
  } | null;
  /** Not booked: the newest sent quote. `null` = the quotes could not be read; `undefined` = none sent. */
  quote: { totalPhp: number; sentAt: string | null; validUntil: string | null } | null | undefined;
  /**
   * Not booked: the hosts' newest OPEN counter on the total, in pesos. `null` = the asks could not be read;
   * `undefined` = nobody has countered (or their ask is on one line only — the strip then shows the quote alone).
   */
  theirAsk: number | null | undefined;
  /** The next dated thing for this client — a meeting, else the event day. `null` = unread; `undefined` = none. */
  next: { title: string; day: string } | null | undefined;
  /** Booked: the forms sent into this event. `null` = unread. */
  forms: { open: number; sent: number } | null;
  /**
   * ➡ The shipped Next step (`clientNextStep`, owner 18 Nov "Yes, keep it") — it no longer has a row of its own on top
   * of the chat: its line is said by the box it opens. A payment due is the Paid box's own second line already; the
   * crew call and "Send the handover" are said by Next; "no answer yet" by the quote. null = nothing needs them.
   */
  step?: { line: string; page: 'quote' | 'schedule' | 'files' } | null;
};

const failed = (key: StripBox['key'], label: string, door: StripDoor | null): StripBox => ({
  key,
  label,
  value: STRIP_FAILED_WORDS,
  tone: 'danger',
  door,
  failed: true,
});

function moneyBox(i: StripInputs): StripBox {
  if (i.isBooked) {
    if (i.paid === null || i.paid.paidPhp === null) return failed('money', 'Paid', 'payments');
    const { paidPhp, agreedPhp, next } = i.paid;
    const sub = next
      ? next.check
        ? { text: `${i.peso(next.amountPhp)} to confirm`, tone: 'needs' as const }
        : { text: `${i.peso(next.amountPhp)} · ${next.dueText ?? 'to collect'}`, tone: next.late ? ('danger' as const) : ('quiet' as const) }
      : null;
    // 🛑 Never a bar, and never "of ₱0", when no amount was ever agreed — nothing owed is not everything paid.
    if (agreedPhp === null || agreedPhp <= 0) return { key: 'money', label: 'Paid', value: `${i.peso(paidPhp)} received`, tone: 'plain', sub, door: 'payments', failed: false };
    const all = paidPhp >= agreedPhp;
    return {
      key: 'money',
      label: 'Paid',
      value: `${i.peso(paidPhp)} of ${i.peso(agreedPhp)}`,
      tone: 'plain',
      sub: sub ?? (all ? { text: 'All paid', tone: 'ok' } : null),
      progress: Math.max(0, Math.min(1, paidPhp / agreedPhp)),
      door: 'payments',
      failed: false,
    };
  }
  if (i.quote === null) return failed('money', 'Quote', 'quote');
  if (i.quote === undefined) return { key: 'money', label: 'Quote', value: 'Not sent yet', tone: 'quiet', door: 'quote', failed: false };
  const until = quoteGoodUntil(i.quote.validUntil ? i.quote.validUntil.slice(0, 10) : null, i.todayIso);
  const sub = until.words ? { text: until.words, tone: until.expired ? ('danger' as const) : ('warn' as const) } : null;
  // A refused asks read must not pass as "nobody countered": the box says the quote, and that their ask is unread.
  if (i.theirAsk === null) {
    return { key: 'money', label: 'Deal', value: i.peso(i.quote.totalPhp), tone: 'plain', sub: { text: 'Their ask couldn’t load', tone: 'danger' }, door: 'deal', failed: false };
  }
  if (i.theirAsk !== undefined) {
    return { key: 'money', label: 'Deal', value: `${i.peso(i.quote.totalPhp)} · they ask ${i.peso(i.theirAsk)}`, tone: 'plain', sub, door: 'deal', failed: false };
  }
  const sent = dayMonth(i.quote.sentAt ? i.quote.sentAt.slice(0, 10) : null);
  return { key: 'money', label: 'Quote', value: sent ? `${i.peso(i.quote.totalPhp)} · sent ${sent}` : i.peso(i.quote.totalPhp), tone: 'plain', sub, door: 'deal', failed: false };
}

function nextBox(i: StripInputs): StripBox {
  if (i.next === null) return failed('next', 'Next', 'schedule');
  if (i.next === undefined) return { key: 'next', label: 'Next', value: 'Nothing set yet', tone: 'quiet', door: 'schedule', failed: false };
  const day = dayMonth(i.next.day);
  return { key: 'next', label: 'Next', value: day ? `${i.next.title} · ${day}` : i.next.title, tone: 'plain', door: 'schedule', failed: false };
}

function formsBox(i: StripInputs): StripBox {
  // 🔒 Shut with its reason, never hidden (the (+)'s own words for the same gate).
  if (!i.isBooked) return { key: 'forms', label: 'Forms', value: 'Open once they book', tone: 'quiet', door: null, failed: false };
  if (i.forms === null) return failed('forms', 'Forms', 'forms');
  if (i.forms.open > 0) return { key: 'forms', label: 'Forms', value: `${i.forms.open.toLocaleString('en-PH')} open`, tone: 'plain', door: 'forms', failed: false };
  return { key: 'forms', label: 'Forms', value: i.forms.sent > 0 ? 'All answered' : 'None sent', tone: 'quiet', door: 'forms', failed: false };
}

/** The three boxes the page can fill on the server; Decisions is counted by the chat itself (`decisionsBox`). */
export function chatStrip(i: StripInputs): StripBox[] {
  let money = moneyBox(i);
  let next = nextBox(i);
  const step = i.step ?? null;
  if (step?.page === 'schedule') next = { key: 'next', label: 'Next', value: step.line, tone: 'needs', door: 'schedule', failed: false };
  if (step?.page === 'files') next = { key: 'next', label: 'Next', value: step.line, tone: 'needs', door: 'files', failed: false };
  if (step?.page === 'quote' && !i.isBooked && !money.failed && !money.sub) money = { ...money, sub: { text: 'No answer yet', tone: 'quiet' } };
  return [money, next, formsBox(i)];
}

/**
 * Decisions — counted from the SAME merge the chat's cards and Details › Decisions are drawn from, so the box can never
 * disagree with the list it opens. `undefined` = the chat has not counted yet (its first frame); `null` = some cards
 * could not be loaded, so the count is not known (never drawn as "none").
 */
export function decisionsBox(waiting: number | null | undefined): StripBox {
  if (waiting === null) return failed('decisions', 'Decisions', 'decisions');
  if (waiting === undefined) return { key: 'decisions', label: 'Decisions', value: 'Checking…', tone: 'quiet', door: 'decisions', failed: false };
  if (waiting > 0) return { key: 'decisions', label: 'Decisions', value: `${waiting.toLocaleString('en-PH')} waiting on you`, tone: 'needs', door: 'decisions', failed: false };
  return { key: 'decisions', label: 'Decisions', value: 'None open', tone: 'quiet', door: 'decisions', failed: false };
}

/**
 * The next dated thing: the soonest meeting still to come (today counts), else the event day while it is still ahead.
 * `meetings: null` = the read was refused → the box says so (`null`), never the event day standing in for a meeting.
 */
export function nextDated(i: {
  todayIso: string;
  eventDate: string | null;
  meetings: readonly { title: string; day: string | null; status: string }[] | null;
}): { title: string; day: string } | null | undefined {
  if (i.meetings === null) return null;
  const soon = i.meetings
    .filter((m) => m.day !== null && m.day >= i.todayIso && m.status !== 'cancelled' && m.status !== 'declined' && m.status !== 'done')
    .sort((a, b) => a.day!.localeCompare(b.day!))[0];
  const eventDay = i.eventDate && /^\d{4}-\d{2}-\d{2}/.test(i.eventDate) ? i.eventDate.slice(0, 10) : null;
  if (soon && (!eventDay || eventDay < i.todayIso || soon.day! <= eventDay)) return { title: soon.title, day: soon.day! };
  if (eventDay && eventDay >= i.todayIso) return { title: 'Event day', day: eventDay };
  return soon ? { title: soon.title, day: soon.day! } : undefined;
}

// ── The one suggested step inside the text box (drawing screen 11 — supplier only this build) ───────────────────────

export type SuggestInputs = {
  /** There is a conversation to act in; without one there is no text box. */
  hasThread: boolean;
  isBooked: boolean;
  peso: (php: number) => string;
  /** A sent quote exists. `null` = the quotes could not be read. */
  hasQuote: boolean | null;
  /** A meeting is set and still to come. `null` = unread. */
  hasMeetingAhead: boolean | null;
  /** Booked: the next payment still to come that is not waiting on the supplier to confirm. `undefined` = unread. */
  nextDue: { amountPhp: number } | null | undefined;
};

/**
 * Inquiry → Make a quote · Quoted, no meeting set → Set an ocular · Booked with a payment due → Ask for ₱X.
 * 🔑 An unread stage suggests NOTHING (never the step of the stage below it): a refused quotes read is not "no quote".
 */
export function suggestedStep(i: SuggestInputs): { label: string; card: 'quote' | 'meeting' | 'payment' } | null {
  if (!i.hasThread) return null;
  if (i.isBooked) {
    if (!i.nextDue) return null;
    return { label: `Ask for ${i.peso(i.nextDue.amountPhp)}`, card: 'payment' };
  }
  if (i.hasQuote === null) return null;
  if (!i.hasQuote) return { label: 'Make a quote', card: 'quote' };
  if (i.hasMeetingAhead === null) return null;
  if (!i.hasMeetingAhead) return { label: 'Set an ocular', card: 'meeting' };
  return null;
}
