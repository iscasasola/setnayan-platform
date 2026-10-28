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
}): string {
  const kind = args.kind?.trim() || 'Event';
  const own = (args.name ?? '').trim();
  // The event's own title already reads "<someone>'s <thing>" — keep it as the customer wrote it.
  const base = /\S['’]s\s+\S/.test(own) ? own : firstNameOf(own) ? `${firstNameOf(own)}'s ${kind}` : kind;
  return `${base} ${eventChatDate(args.date, args.nowMs)}`;
}
