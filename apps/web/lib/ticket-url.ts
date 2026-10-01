/**
 * apps/web/lib/ticket-url.ts — "WHERE TO GET TICKETS" (pure).
 *
 * Owner, 2026-09-29 (DECISION_LOG "DISCOVER — UNPARKED", item b): a PUBLIC
 * event may carry a link to where its tickets are sold. 🔑 THE ORGANIZER SELLS
 * THE TICKETS — NEVER SETNAYAN. `events.ticket_url` is only the address of the
 * organizer's own page; nothing in the product prices, sells or records a ticket.
 *
 * ONE shape, held in two places that must agree:
 *   · the DB CHECK `events_ticket_url_https` (migration 20271254654868) — the
 *     rule no writer can skip;
 *   · `parseTicketUrl` below — so the host is told in words before the round
 *     trip, and the guest page never draws a link the CHECK would have refused.
 * `ticket-url.test.ts` reads the migration and holds the two equal.
 *
 * No I/O, no `server-only`: the Maker's client panel, the server action and the
 * guest page all read this one file.
 */

/** The CHECK's length cap. */
export const TICKET_URL_MAX = 500;

/**
 * The CHECK's pattern, character for character as the migration spells it
 * (Postgres ARE). https, a dotted host, an optional port, then an optional
 * path/query/fragment with no whitespace. No `user@` (an `@` cannot sit in the
 * host part), no `http:`, no `javascript:`, no `data:`.
 */
export const TICKET_URL_SQL_PATTERN =
  '^https://[A-Za-z0-9.-]+\\.[A-Za-z]{2,}(:[0-9]{1,5})?([/?#][^[:space:]]*)?$';

/** The same pattern for JavaScript — only the POSIX class is re-spelt. */
const TICKET_URL_RE = new RegExp(TICKET_URL_SQL_PATTERN.replace('[^[:space:]]', '[^\\s]'));

export type TicketUrlParse =
  | { ok: true; value: string | null }
  | { ok: false; reason: 'not_https' | 'too_long' | 'not_a_link' };

/**
 * A host's typed value → what may be stored. Blank clears the link (`null`).
 * A value with no scheme at all ("tickets.example.com") is read as https — the
 * way a person types an address — and is then held to the same rule.
 */
export function parseTicketUrl(raw: unknown): TicketUrlParse {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw !== 'string') return { ok: false, reason: 'not_a_link' };
  const typed = raw.trim();
  if (typed === '') return { ok: true, value: null };
  // A scheme is letters then `:` NOT followed by a digit — so
  // "tickets.example.com:8443/x" is a host and port, while "http:", "javascript:"
  // and "data:" are schemes, refused by name.
  if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(typed) && !/^https:\/\//i.test(typed)) {
    return { ok: false, reason: 'not_https' };
  }
  const withScheme = /^https:\/\//i.test(typed) ? `https://${typed.slice(8)}` : `https://${typed}`;
  if (withScheme.length > TICKET_URL_MAX) return { ok: false, reason: 'too_long' };
  if (!TICKET_URL_RE.test(withScheme)) return { ok: false, reason: 'not_a_link' };
  try {
    const u = new URL(withScheme);
    if (u.protocol !== 'https:' || u.username || u.password) return { ok: false, reason: 'not_a_link' };
  } catch {
    return { ok: false, reason: 'not_a_link' };
  }
  return { ok: true, value: withScheme };
}

/** What the host is told when the link is refused. Plain English. */
export const TICKET_URL_ERROR_TEXT: Record<Exclude<TicketUrlParse, { ok: true }>['reason'], string> = {
  not_https: 'The tickets link must start with https://',
  too_long: `The tickets link is too long — keep it under ${TICKET_URL_MAX} characters.`,
  not_a_link: 'That does not look like a web address. Paste the full link to the ticket page.',
};

/**
 * The link the guest page draws, or null. Only a PUBLIC event shows it — the
 * link belongs to the event's public face (Discover lists public events only),
 * and a stored link is re-read through the same parser, so a row written
 * before (or around) the CHECK can never become an `href`.
 */
export function publicTicketUrl(input: { visibility: string | null | undefined; ticketUrl: unknown }): string | null {
  if (input.visibility !== 'public') return null;
  const parsed = parseTicketUrl(input.ticketUrl);
  return parsed.ok ? parsed.value : null;
}
