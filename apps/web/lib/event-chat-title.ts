/**
 * THE NAME OF AN EVENT'S CHAT, ON THE SUPPLIER'S SIDE — "<customer first name>'s <Kind> (<Mon D>)" (owner 2026-10-28,
 * verbatim: *"So chat will be like indalecio's wedding dec 18"* → corrected: *"User's event (date)"*; DECISION_LOG
 * 84b87fe8: suppliers list customers and chats BY EVENT — *"each user can have multiple chats to the supplier"*).
 *
 *   eventChatTitle({ name: 'Indalecio Casasola', kind: 'Wedding', date: '2026-12-18', nowMs })  → "Indalecio's Wedding (Dec 18)"
 *   …date in another year                                                                     → "Indalecio's Wedding (Dec 18, 2027)"
 *   …the event's own name already reads that way ("Ana's Debut")                              → "Ana's Debut (Mar 2)"
 *   …no name                                                                                  → "Wedding (Dec 18)"
 *   …no date                                                                                  → "Indalecio's Wedding (date not set)"
 *
 * ONE source for the three places it is read — the Customers row, the supplier's inbox row and the supplier's thread
 * head — so one event can never be called two things (`lib/one-event-one-chat-title.test.ts`). A couple with two events
 * is two titles, two rows, two chats: the date is part of the name.
 */

import { fitDateScope, type EventFitDates } from '@/lib/bench-bookable-days';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** "2027-05-22" → "May 22, 2027" — fixed month names, so the server and the tests read the same words. */
function dayWithYear(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTH_SHORT[(m ?? 1) - 1]} ${d}, ${y}`;
}

/**
 * 📅 THE COUPLE'S DATE OPTIONS, BEFORE A DATE IS SET (walk 13 Nov 2026: a birthday with one candidate, 2027-05-22,
 * read "(date not set)" · DATE "Not set yet" · "no date yet" to the supplier it asked). The days come from
 * `fitDateScope` — the ONE reader of `event_date → date_candidates → date_window` that Find already judges on — so
 * the supplier is told exactly the days the couple's search was filtered by.
 *
 *   one candidate   → "May 22, 2027 · option"
 *   several         → "May 22, 2027 or Jun 5, 2027 · options"
 *   a date window   → "May 1, 2027 – May 20, 2027 · window"
 *   a set day, a span, a month, or nothing → null (the caller's own date words, or "Not set yet", stand).
 */
export function eventDateOptionWords(ev: EventFitDates): string | null {
  const scope = fitDateScope(ev);
  if (!scope || scope.days.length === 0) return null;
  if (scope.kind === 'dates') {
    return `${scope.days.map(dayWithYear).join(' or ')} · ${scope.days.length > 1 ? 'options' : 'option'}`;
  }
  if (scope.kind === 'range') {
    const first = scope.days[0]!;
    const last = scope.days[scope.days.length - 1]!;
    return first === last ? `${dayWithYear(first)} · window` : `${dayWithYear(first)} – ${dayWithYear(last)} · window`;
  }
  return null;
}

/**
 * The candidate days alone, for a sentence — "May 22, 2027" · "May 22, 2027 or Jun 5, 2027". Null unless the event's
 * date is its candidates (`fitDateScope` kind 'dates'). The couple's opening message says them (walk 13 Nov 2026).
 */
export function eventCandidateDays(ev: EventFitDates): string | null {
  const scope = fitDateScope(ev);
  return scope?.kind === 'dates' && scope.days.length > 0 ? scope.days.map(dayWithYear).join(' or ') : null;
}

/** "Ana & Miguel" → "Ana"; "Indalecio Casasola" → "Indalecio"; "" → null. */
export function firstNameOf(name: string | null | undefined): string | null {
  const first = (name ?? '').trim().split(/\s*(?:&|\+|,|\band\b)\s*|\s+/i)[0]?.trim();
  return first ? first : null;
}

/** "(Dec 18)" · "(Dec 18, 2027)" · "(date not set)" — Manila calendar year. */
export function eventChatDate(date: string | null | undefined, nowMs: number): string {
  const iso = (date ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '(date not set)';
  const thisYear = new Date(nowMs + 8 * 3_600_000).toISOString().slice(0, 4);
  const words = new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
    ...(iso.slice(0, 4) === thisYear ? {} : { year: 'numeric' }),
  });
  return `(${words})`;
}

export function eventChatTitle(args: {
  /** The customer as they named their event (`events.display_name`) — null when there is none to show. */
  name: string | null | undefined;
  /** The kind of event in words ("Wedding") — null when unknown. */
  kind: string | null | undefined;
  date: string | null | undefined;
  nowMs: number;
  /** `eventDateOptionWords` — said in place of "(date not set)" when the couple has candidate dates or a window. */
  options?: string | null;
}): string {
  const kind = args.kind?.trim() || 'Event';
  const own = (args.name ?? '').trim();
  // The event's own title already reads "<someone>'s <thing>" — keep it as the customer wrote it.
  const base = /\S['’]s\s+\S/.test(own) ? own : firstNameOf(own) ? `${firstNameOf(own)}'s ${kind}` : kind;
  const day = eventChatDate(args.date, args.nowMs);
  return `${base} ${day === '(date not set)' && args.options?.trim() ? `(${args.options.trim()})` : day}`;
}

/**
 * THE NAME OF AN EVENT'S ROW ON CUSTOMERS › EVENTS — "<the event's own name> · <Kind> · <Mon D>" (owner 2026-10-29,
 * DECISION_LOG "CUSTOMERS ARE EVENTS, NOT PEOPLE": *"one row per event, e.g. 'Indalecio & Claire · Wedding · Dec 18'"*;
 * the approved v13 prototype draws every Events row this way; re-reported 2026-10-30 *"Customers still show people and
 * not events"* — a row that led with one person's first name, "Indalecio's Wedding", read as a person).
 *
 *   eventRowTitle({ name: 'Indalecio & Claire', kind: 'Wedding', date: '2026-12-18', nowMs }) → "Indalecio & Claire · Wedding · Dec 18"
 *   …date in another year                                                                → "… · Wedding · Dec 18, 2027"
 *   …the name already says the kind ("Reyes debut")                                      → "Reyes debut · Oct 3"
 *   …no name                                                                             → "Wedding · Dec 18"
 *   …no date                                                                             → "Indalecio & Claire · Wedding · date not set"
 *
 * 🔑 THE SAME EVENT, THE SAME FACTS AS ITS CHAT TITLE (`eventChatTitle`): one name, one kind, one date, the year only when
 * it is not this year — read from the one date formatter (`eventChatDate`), so the row and the chat it opens can never
 * name two different days. The chat keeps its own words (owner 2026-10-28, *"User's event (date)"*); the row is the
 * EVENT, so it carries the event's whole name — both hosts — never one person's.
 */
export function eventRowTitle(args: {
  /** The event's own name (`events.display_name`) — null when there is none to show. */
  name: string | null | undefined;
  /** The kind of event in words ("Wedding") — null when unknown. */
  kind: string | null | undefined;
  date: string | null | undefined;
  nowMs: number;
  /** `eventDateOptionWords` — said in place of "date not set" when the couple has candidate dates or a window. */
  options?: string | null;
}): string {
  const own = (args.name ?? '').trim();
  const kind = args.kind?.trim() || (own ? null : 'Event');
  const saysKind = Boolean(kind && own && own.toLowerCase().includes(kind.toLowerCase()));
  const said = eventChatDate(args.date, args.nowMs).slice(1, -1);
  const day = said === 'date not set' && args.options?.trim() ? args.options.trim() : said;
  return [own || null, saysKind ? null : kind, day].filter(Boolean).join(' · ');
}
