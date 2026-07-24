/**
 * Deterministic negotiation auto-reader for couple <-> vendor chat.
 *
 * WHY THIS EXISTS
 *   Owner ask 2026-07-24: "make negotiations easier to manage — auto-read
 *   schedules, proposals, inclusions, discounts" and let the other side
 *   accept / revise / reject. This is the READER: a pure, no-LLM (Setnayan-AI
 *   Rule 1: deterministic + free), dependency-free classifier that scans a chat
 *   message and reports which negotiation topic(s) it raises, plus a short
 *   extracted excerpt (a datetime, an amount, a requested item). The caller then
 *   surfaces the matching in-chat action card, which binds to an EXISTING
 *   propose->accept/decline state machine:
 *     schedule  -> event_appointments      (confirm / propose-new-time / decline)
 *     inclusion -> vendor_change_orders     (accept / counter / decline)
 *     discount  -> vendor_change_orders (−) OR a proposal re-quote
 *     proposal  -> Proposal Maker / respond_vendor_proposal (accept / decline)
 *
 *   It reads BOTH directions and English + a few high-signal Tagalog terms
 *   (magkano, tawad, kita, kasama), word-boundaried to avoid firing mid-word.
 *
 * DESIGN
 *   Suggestion-grade, not authority: a hit surfaces a one-tap "turn this into a
 *   request" affordance; it never auto-creates or mutates anything. So the bar
 *   is recall-leaning (catch the topic) with cheap misses — a false positive is
 *   a dismissible chip, never a blocked message. Pure + synchronous so it runs
 *   on the client (instant chips) and the server (the authoritative surfacer).
 *
 * NOT IN V1 (follow-ups): resolving a fuzzy date ("next Friday") to an actual
 * timestamp (the reader flags the topic + excerpt; the appointment composer does
 * the real date-picking), and multi-turn context ("yes, that works").
 */

export type NegotiationType = 'schedule' | 'proposal' | 'inclusion' | 'discount';

export interface NegotiationSignal {
  type: NegotiationType;
  /** Short human label for the chip / card header. */
  label: string;
  /** The extracted entity that triggered it (datetime / amount / item), if any. */
  excerpt?: string;
}

export interface NegotiationRead {
  /** True when the message raises at least one negotiation topic. */
  hasSignal: boolean;
  /** Every topic detected, most-specific first. */
  signals: NegotiationSignal[];
  /** The dominant topic to surface first (null when none). */
  primary: NegotiationType | null;
}

// -- shared building blocks ---------------------------------------------------

const MONTHS =
  '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const WEEKDAYS = '(?:mon|tue|wed|thu|fri|sat|sun)(?:day|s|nes|rs)?';

// A date-ish token: ISO, slashed, "Feb 14" / "14 Feb", weekday, or relative.
const DATE_RE = new RegExp(
  '(' +
    '\\d{4}-\\d{1,2}-\\d{1,2}' + // 2026-09-17
    '|\\d{1,2}[/-]\\d{1,2}(?:[/-]\\d{2,4})?' + // 9/17 or 09-17-2026
    '|' + MONTHS + '\\.?\\s+\\d{1,2}(?:,?\\s*\\d{4})?' + // Feb 14 / Sept 17, 2026
    '|\\d{1,2}\\s+' + MONTHS + // 14 Feb
    '|' + WEEKDAYS + // Friday
    '|tomorrow|today|tonight|bukas|mamaya|sa\\s+' + MONTHS + // relative + Tagalog
    ')',
  'i',
);

// A clock time: 14:30, 2:30 pm, 2pm, or a coarse part-of-day (EN + Tagalog).
const TIME_RE =
  /(\d{1,2}:\d{2}\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm)|\b(?:morning|noon|afternoon|evening|midnight|umaga|tanghali|hapon|gabi)\b)/i;

// Intent to meet / talk (EN + Tagalog kita/magkita/usap).
const MEET_RE =
  /\b(?:meet(?:ing|up)?|ocular|site\s*visit|visit|appointment|schedule|set\s*(?:a|up)|book\s+a\s+(?:call|meeting)|catch\s*up|video\s*call|voice\s*call|available\s+(?:on|at)|free\s+(?:on|at)|magkita|kita\s+tayo|usap(?:an)?|pakita)\b/i;

// -- discount -----------------------------------------------------------------

const DISCOUNT_RE =
  /\b(?:discount|promo|tawad|bawas|deal|best\s+price|lower\s+(?:the\s+)?price|bring\s+it\s+(?:down|to)|can\s+you\s+(?:lower|reduce)|any\s+(?:discount|promo)|mas\s+mura|make\s+it\s+cheaper|budget\s+is)\b|\d+\s*%\s*off|\bmura\b/i;
// Amount / percent inside a discount message.
const DISCOUNT_AMOUNT_RE =
  /(\d+\s*%|(?:₱|php|p)\s*\d[\d,]*(?:\.\d+)?|\b\d[\d,]{2,}(?:\.\d+)?\b)/i;

// -- inclusion ----------------------------------------------------------------

const INCLUSION_RE =
  /\b(?:include[ds]?|inclusion|included|add[- ]?on|comes?\s+with|throw\s+in|freebie|bonus\s+(?:item|shot|hour)|extra\s+(?:hour|photographer|shooter|camera|cake|table)|second\s+(?:photographer|shooter|camera)|drone|prenup|kasama\b|isama|idagdag|dagdag(?:an)?|pwede\s+bang?\s+isama|can\s+you\s+add|do\s+you\s+(?:offer|have)|sana\s+may)\b/i;
// The requested item — text right after an add/include verb.
const INCLUSION_ITEM_RE =
  /(?:include|add|with|offer|isama|idagdag|dagdag(?:an)?)\s+(?:a\s+|an\s+|the\s+|ng\s+|yung\s+)?([a-z0-9][a-z0-9 '\-]{2,40})/i;

// -- proposal / price ---------------------------------------------------------

const PROPOSAL_RE =
  /\b(?:how\s+much|magkano|quote|quotation|pricing|price\s+list|package\s+(?:price|rate)|your\s+rate|total\s+(?:cost|price)|estimate|breakdown|send\s+(?:me\s+)?a\s+(?:quote|proposal)|proposal)\b/i;

function trimExcerpt(s: string | undefined, max = 48): string | undefined {
  if (!s) return undefined;
  const t = s.trim().replace(/\s+/g, ' ');
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

/**
 * Read a chat message for negotiation topics. Pure — no I/O, no throw.
 */
export function detectNegotiation(body: string): NegotiationRead {
  if (typeof body !== 'string' || body.trim().length === 0) {
    return { hasSignal: false, signals: [], primary: null };
  }

  const signals: NegotiationSignal[] = [];

  // schedule — a meeting intent plus a date/time, OR a bare date+time.
  const dateM = body.match(DATE_RE);
  const timeM = body.match(TIME_RE);
  const meets = MEET_RE.test(body);
  if ((meets && (dateM || timeM)) || (dateM && timeM)) {
    const when = [dateM?.[0], timeM?.[0]].filter(Boolean).join(' ');
    signals.push({ type: 'schedule', label: 'Schedule request', excerpt: trimExcerpt(when) });
  }

  // discount — an ask to lower the price.
  if (DISCOUNT_RE.test(body)) {
    const amt = body.match(DISCOUNT_AMOUNT_RE);
    signals.push({ type: 'discount', label: 'Discount request', excerpt: trimExcerpt(amt?.[0]) });
  }

  // inclusion — an ask to add / include something.
  if (INCLUSION_RE.test(body)) {
    const item = body.match(INCLUSION_ITEM_RE);
    signals.push({ type: 'inclusion', label: 'Inclusion request', excerpt: trimExcerpt(item?.[1]) });
  }

  // proposal — a price / quote ask (only if not already a discount ask, which
  // is the more specific money topic).
  if (PROPOSAL_RE.test(body) && !signals.some((s) => s.type === 'discount')) {
    signals.push({ type: 'proposal', label: 'Quote request' });
  }

  // Primary = most specific present, in this order.
  const order: NegotiationType[] = ['schedule', 'discount', 'inclusion', 'proposal'];
  const primary = order.find((t) => signals.some((s) => s.type === t)) ?? null;
  // Sort signals to match the priority order for stable display.
  signals.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));

  return { hasSignal: signals.length > 0, signals, primary };
}
