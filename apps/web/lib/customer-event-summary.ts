/**
 * customer-event-summary.ts — what a supplier reads about the customer who
 * wrote to them. PURE (no React, no I/O), so it is unit-testable and safe to
 * import anywhere.
 *
 * ── THE SHAPE THE OWNER ASKED FOR (2026-09-08) ─────────────────────────────
 * *"User name create a (event type) event called (event name) last (date
 * created) with the following information: Target Date, Pax, Location, and
 * other details from the onboarding and progress of the build. with X locked
 * vendors."*
 *
 * So: one sentence that says WHO started WHAT and WHEN, then the decision facts
 * as labelled rows. The sentence carries the things that only make sense joined
 * up; the rows carry the things a supplier scans for.
 *
 * ── WHY A SENTENCE AND ROWS, NOT ONE OR THE OTHER ──────────────────────────
 * "Ice Casasola created a wedding on June 19" is a fact about a person. "target
 * date · pax · location" are fields you compare against your own calendar. Both
 * were asked for and they read differently, so they render differently — but
 * they are built HERE, together, from ONE input, because the failure this whole
 * area keeps producing is the same wedding rendered several ways on one screen
 * and no two agreeing (three renderings of one date, "Event" beside a real
 * name). One builder means one answer.
 *
 * ⚠ NOTHING HERE IS BEHIND A DISCLOSURE LADDER, AND THAT IS DELIBERATE BUT
 * NARROW. Identity stopped being gated on 2026-09-08 (the token wallet that
 * sold it is retired). The SEPARATE ladder in `get_vendor_event_brief` — exact
 * venue, timeline, seat plan, dietary, hard-NULL until an agreement exists —
 * rests on a different argument ("only an agreement earns those") that the
 * ruling did not touch. None of those fields is accepted here; adding one is an
 * owner decision, not a refactor.
 */

import { formatLongDate, formatLongTimestamp } from '@/lib/format-date';
import { guestCountRow } from '@/lib/guest-count-provenance';
import { articleFor } from '@/app/[slug]/_lib/event-words';

export type CustomerFactRow = {
  label: string;
  value: string;
  /** True when the value is a stand-in for something not yet known. */
  unknown?: boolean;
  /**
   * Small print under the value — the SECOND fact a row needs when one number
   * is not the whole truth: "150 at inquiry" under a live guest count, or how
   * many other couples want the target date.
   */
  note?: string | null;
  /**
   * A row whose `note` is the SUPPLIER'S OWN commercial position rather than
   * something about the customer, and therefore must be marked as such on
   * screen. The rail is a supplier surface, but a supplier reading their own
   * pipeline beside a customer's facts should never have to wonder whether the
   * customer can see it too.
   */
  noteIsPrivate?: boolean;
};

export type CustomerEventSummary = {
  /** "Ice Casasola created a wedding called “Cale & Ice” on June 19, 2026." */
  sentence: string;
  facts: CustomerFactRow[];
  /**
   * WHICH categories the couple has already locked, as display labels ready to
   * render — deduped, sorted, never raw database keys. Empty when nothing is
   * locked or nothing is known; a caller renders no chips rather than an
   * "unknown" chip. See {@link CustomerEventSummaryInput.lockedCategoryLabels}
   * for the disclosure note.
   */
  lockedCategories: string[];
};

export type CustomerEventSummaryInput = {
  /** The host's own display name. Null → the sentence drops the name cleanly. */
  hostName: string | null;
  /** A RESOLVED, human event-type label ("Wedding"). Not a slug. */
  eventTypeLabel: string | null;
  /** `events.display_name` — carries the couple's names. */
  eventName: string | null;
  /** `events.created_at` — a TIMESTAMP, not a date key. See below. */
  createdAt: string | null;
  /** `events.event_date` — a date key. */
  targetDate: string | null;
  /** Headcount the couple is planning for NOW (live pax). */
  pax: number | null;
  /**
   * What they ASKED with — `chat_threads.pax_at_inquiry`. The number a quote
   * was written against.
   *
   * ⚠ BOTH NUMBERS OR NEITHER. The Pax row used to print one figure with no
   * hint that a second existed, on a screen whose header showed the other one;
   * a supplier quotes against one and is paid against the other. The wording
   * comes from `guest-count-provenance.ts`, which is also what the header and
   * the accept card use, so the three cannot drift apart again.
   */
  paxAtInquiry?: number | null;
  /**
   * Who ELSE wants the target date — a count sentence from
   * `vendor-date-demand.ts`, already formatted, never names.
   *
   * 🔒 SUPPLIER SIDE ONLY. It renders marked as the supplier's own pipeline.
   * This builder accepts a finished STRING and never the underlying rows, so
   * there is no parameter here through which another couple's identity could
   * arrive.
   */
  dateDemandNote?: string | null;
  /** An already-resolved city/area label. Never a venue. */
  location: string | null;
  /** Suppliers at-or-past `contracted` — `CONFIRMED_VENDOR_STATUSES`. */
  lockedVendors: number | null;
  /** Total suppliers on the event's plan, locked or not. Sizes the fraction. */
  totalVendors?: number | null;
  /** Guest rows entered so far — "progress of the build", not the target. */
  guestsAdded?: number | null;
  /**
   * WHICH categories are already locked on this event — display labels, not
   * slugs. Owner, 2026-09-08: *"if they have lock specific vendors as well for
   * that event, we can share what categories is already locked."*
   *
   * ⚠ THIS IS A DELIBERATE WIDENING OF A LADDER, NOT A BUG FIX, AND IT IS
   * NARROWER THAN IT LOOKS. `get_vendor_event_brief` returns `vendor_roster` —
   * `{vendor_name, category}` for every OTHER locked supplier — at the BOOKED
   * stage ONLY, by construction. What the owner asked for is the CATEGORY half
   * of that fact, one rung earlier.
   *
   * 🔑 CATEGORIES ONLY. NEVER `vendor_name`. "Venue and Catering are taken"
   * tells a supplier the couple is committing real money and which slots are
   * still open — a reason to reply. "Venue is taken BY <competitor>" is a
   * different disclosure: it names a rival to someone who has not committed to
   * anything and can still walk away. The booked-stage roster keeps the names;
   * this input accepts labels only, and there is no parameter through which a
   * vendor name can arrive.
   */
  lockedCategoryLabels?: string[] | null;
};

const UNKNOWN = 'Not set yet';

/** Trim to null so `''` and `'   '` never render as a name or a label. */
function clean(v: string | null | undefined): string | null {
  return v?.trim() || null;
}

/**
 * The Guests row, with its provenance.
 *
 * "~230 planning" reads as an estimate, which it is. A bare "230" invites a
 * supplier to quote against a number the couple has not committed to — and a
 * bare number of EITHER kind invites them to quote against the wrong one, which
 * is the more expensive mistake and the reason the inquiry count is named here.
 */
function paxRow(input: CustomerEventSummaryInput): CustomerFactRow {
  const row = guestCountRow({ live: input.pax, atInquiry: input.paxAtInquiry ?? null });
  if (!row) return { label: 'Pax', value: UNKNOWN, unknown: true };
  return { label: 'Pax', value: row.value, note: row.note };
}

export function buildCustomerEventSummary(
  input: CustomerEventSummaryInput,
): CustomerEventSummary {
  const host = clean(input.hostName);
  const eventName = clean(input.eventName);
  const location = clean(input.location);

  // Lowercased for mid-sentence use ("created a wedding", never "a Wedding"),
  // and defaulted to the neutral 'event' — never to 'wedding'. Seventeen event
  // types exist and guessing the commonest one is how a funeral came to read
  // "A couple planning a funeral" in the code this replaces.
  const type = clean(input.eventTypeLabel)?.toLowerCase() ?? 'event';

  // ⚠ `articleFor`, not a bare "a". The noun is resolved, so its grammar is
  // too: "an anniversary", "an engagement party". Its own docblock records
  // shipping "a event" the first time a hardcoded noun became a variable.
  const opener = host ? `${host} created` : 'This customer created';
  const named = eventName ? ` called “${eventName}”` : '';
  const when = input.createdAt ? ` on ${formatLongTimestamp(input.createdAt)}` : '';
  const sentence = `${opener} ${articleFor(type)} ${type}${named}${when}.`;

  const facts: CustomerFactRow[] = [
    {
      label: 'Target date',
      value: input.targetDate ? formatLongDate(input.targetDate) : UNKNOWN,
      unknown: !input.targetDate,
      // Only ever set when there is a date to be in demand for.
      note: input.targetDate ? (clean(input.dateDemandNote) ?? null) : null,
      noteIsPrivate: true,
    },
    paxRow(input),
    { label: 'Location', value: location ?? UNKNOWN, unknown: !location },
    {
      label: 'Locked suppliers',
      value: lockedLabel(input.lockedVendors, input.totalVendors),
      unknown: input.lockedVendors == null,
    },
  ];

  // Build progress — only when the couple has actually started, so a brand-new
  // event does not render a row saying "0 added" as if that were a finding.
  if (input.guestsAdded != null && input.guestsAdded > 0) {
    facts.push({ label: 'Guest list', value: `${input.guestsAdded} added so far` });
  }

  // Deduped + sorted so the same plan always renders the same chip order — a
  // list that reshuffles between loads reads as the plan having changed.
  const lockedCategories = Array.from(
    new Set((input.lockedCategoryLabels ?? []).map((c) => clean(c)).filter((c): c is string => !!c)),
  ).sort((a, b) => a.localeCompare(b));

  return { sentence, facts, lockedCategories };
}

/**
 * "0 of 3" · "2 locked" · "None yet".
 *
 * 🔑 THE DENOMINATOR IS THE POINT. A bare "0 locked suppliers" reads as an
 * empty plan; "0 of 3" says the couple is actively choosing and this supplier
 * is in a live race. Those call for opposite replies, so the fraction is shown
 * whenever a total is known and larger.
 */
function lockedLabel(locked: number | null, total: number | null | undefined): string {
  if (locked == null) return UNKNOWN;
  if (total != null && total > locked) return `${locked} of ${total}`;
  return locked === 0 ? 'None yet' : `${locked} locked`;
}
