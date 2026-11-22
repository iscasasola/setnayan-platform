/**
 * 🧾 DETAILS › AGREED NOW, AS DRAWN (Unichat part G, owner 20 Nov 2026; drawing UNICHAT-LIVE-2026-11-19, the Details
 * page: "Agreed now — Event · Venue · Hosts · Coordinator · Supplier · Stage"). The plain rows above the shipped
 * "Changed N×" rows (`AgreedNow`), each from a fact the client page already read — pure, no read of its own.
 *
 * THE HONEST-READS RULE: a fact that was not read is not drawn as empty.
 *   · Hosts — `undefined` (the brief carried no `hosts` key) draws no row; an empty list says so.
 *   · Coordinator — the brief's `vendor_roster` exists only once this shop is booked, so before that there is no row
 *     at all (never "None"); booked with no coordinator on the roster is said plainly.
 *   · Stage — `null` (the quotes read was refused) draws no row; never a guessed "Inquiry".
 * The Event row is the card's own: it needs the event's type, which only the card reads.
 */
import { dayMonth } from '@/lib/format-date';
import { eventTypeWord } from '@/lib/event-vocabulary';

export type AgreedFact = { label: string; value: string };

export function agreedFacts(i: {
  venue: string | null;
  /** Host first names (`hostRows`), or undefined when the brief carried none. */
  hosts: readonly string[] | undefined;
  /** The brief's `vendor_roster` (booked only) — `{ vendor_name, category }` entries; anything else is unread. */
  roster: unknown;
  /** The services that make a shop the coordinator (`COORDINATOR_TRADE_SERVICES`). */
  coordinatorTrade: readonly string[];
  supplier: string | null;
  stage: string | null;
}): AgreedFact[] {
  const rows: AgreedFact[] = [];
  rows.push({ label: 'Venue', value: i.venue?.trim() || 'Not set yet' });
  if (i.hosts !== undefined) rows.push({ label: 'Hosts', value: i.hosts.length > 0 ? i.hosts.join(' & ') : 'Nobody in the chat yet' });
  if (Array.isArray(i.roster)) {
    const trade = new Set(i.coordinatorTrade);
    const names = i.roster
      .filter((r): r is { vendor_name: string; category: string } => Boolean(r) && typeof r === 'object' && typeof (r as { vendor_name?: unknown }).vendor_name === 'string' && typeof (r as { category?: unknown }).category === 'string')
      .filter((r) => trade.has(r.category))
      .map((r) => r.vendor_name);
    rows.push({ label: 'Coordinator', value: names.length > 0 ? [...new Set(names)].join(', ') : 'None booked' });
  }
  if (i.supplier?.trim()) rows.push({ label: 'Supplier', value: i.supplier.trim() });
  if (i.stage) rows.push({ label: 'Stage', value: i.stage });
  return rows;
}

/** The Event row — the event's type word and its day ("Wedding · 18 Dec"); no day yet is said, never left blank. */
export function agreedEventFact(eventType: string | null, eventDate: string | null): AgreedFact {
  const word = eventTypeWord(eventType);
  const day = dayMonth(eventDate ? eventDate.slice(0, 10) : null);
  return { label: 'Event', value: `${word.charAt(0).toUpperCase()}${word.slice(1)} · ${day ?? 'no date yet'}` };
}
