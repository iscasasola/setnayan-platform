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
import { articleFor } from '@/app/[slug]/_lib/event-words';

export type CustomerFactRow = {
  label: string;
  value: string;
  /** True when the value is a stand-in for something not yet known. */
  unknown?: boolean;
};

export type CustomerEventSummary = {
  /** "Ice Casasola created a wedding called “Cale & Ice” on June 19, 2026." */
  sentence: string;
  facts: CustomerFactRow[];
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
  /** Headcount the couple is planning for. */
  pax: number | null;
  /** An already-resolved city/area label. Never a venue. */
  location: string | null;
  /** Suppliers at-or-past `contracted` — `CONFIRMED_VENDOR_STATUSES`. */
  lockedVendors: number | null;
  /** Total suppliers on the event's plan, locked or not. Sizes the fraction. */
  totalVendors?: number | null;
  /** Guest rows entered so far — "progress of the build", not the target. */
  guestsAdded?: number | null;
};

const UNKNOWN = 'Not set yet';

/** Trim to null so `''` and `'   '` never render as a name or a label. */
function clean(v: string | null | undefined): string | null {
  return v?.trim() || null;
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
    },
    {
      label: 'Pax',
      // "~230 planning" reads as an estimate, which it is. A bare "230" invites
      // a supplier to quote against a number the couple has not committed to.
      value: input.pax != null ? `~${input.pax} planning` : UNKNOWN,
      unknown: input.pax == null,
    },
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

  return { sentence, facts };
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
