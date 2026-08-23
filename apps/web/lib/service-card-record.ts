/**
 * THE CARD RECORD — a service card compiles its own history.
 *
 * Owner-locked 2026-07-28 (DECISION_LOG row 2819): "every event this card
 * creates is documented on the card". A card that has done work earns a record
 * — how many events it has served, what kind, a short anonymized ledger of the
 * most recent ones, and a milestone medal at 10 / 25 / 50 / 100.
 *
 * TWO HALVES, deliberately split:
 *   • compileCardRecord() is PURE — raw reader payload in, view model out. It
 *     is where every rule that decides what a card has "earned" lives, so those
 *     rules are unit-testable without a database (service-card-record.test.ts).
 *   • fetchServiceCardRecords() is the thin server wrapper around the
 *     SECURITY DEFINER reader. It holds no rules.
 *
 * PRIVACY — the envelope is enforced in SQL, not here. `public.service_card_records`
 * (migration 20271018283550) returns only de-identified aggregates: a count,
 * per-event-type counts, and at most six PAST events as
 * (event_type, 'YYYY-MM', pax BAND). No name, no id, no exact date, no venue,
 * no price, no exact head-count ever crosses the wire, so there is nothing for
 * this module to redact. Three things follow, and all three are DELIBERATELY
 * absent from this file:
 *   • the pax BAND thresholds live in SQL and only in SQL — this module owns
 *     their human LABELS and nothing else, so the boundary numbers are never
 *     restated on two sides of the wire and cannot drift apart;
 *   • the MINIMUM-N floor (below K arm's-length events a card returns its count
 *     alone, with type_mix and ledger empty) is likewise applied in SQL. This
 *     module never learns K: it simply renders whatever collections it is
 *     given, and empty ones render as nothing. A caller therefore cannot forget
 *     to suppress, and this file cannot drift from the floor;
 *   • the ledger's COMPLETED-MONTH boundary is SQL's too.
 *
 * TOTALITY — compileCardRecord() must NEVER throw. Its input is a JSONB blob
 * crossing a network boundary, and both mount points are inside page renders on
 * a public route: an exception here is a 500 on a vendor's whole profile page,
 * not a missing decoration. So every element is parsed defensively and anything
 * malformed is SKIPPED rather than propagated — a junk row costs its own row,
 * never the section and never the page.
 *
 * NOT server-only, on purpose: the section component that renders this ends up
 * in the client bundle (it is mounted inside the `'use client'` services
 * gallery), and it imports these TYPES. Every string a card displays is
 * produced HERE, on the server, so the component itself stays a dumb view and
 * pulls no data-layer code into the browser.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { formatEventTypeLabel } from '@/lib/reviews';

// ---------------------------------------------------------------------------
// The rules
// ---------------------------------------------------------------------------

/**
 * Milestone medals. A medal is a PURE FUNCTION of the booked count — nothing is
 * awarded, stored, or granted, so a medal can never drift from the number it
 * claims to represent, and a booking that is later voided silently un-earns it.
 * Owner-locked ladder 2026-07-28.
 */
export const MILESTONE_THRESHOLDS = [10, 25, 50, 100] as const;

/**
 * Hard cap on ledger rows. The SQL reader already LIMITs to this, and the pure
 * compiler re-applies it: a long ledger is a timeline (and a bigger disclosure
 * surface), a short one is a record. Kept here as the single named home so the
 * component never has to know the number.
 */
export const LEDGER_MAX = 6;

/**
 * Human labels for the four pax bands the SQL reader emits, plus the honest
 * 'unknown' (events.estimated_pax is nullable and very often NULL — the reader
 * says so rather than guessing). The THRESHOLDS behind these keys live in the
 * migration and are deliberately not repeated here.
 */
export const PAX_BAND_LABEL: Record<string, string> = {
  under_50: 'Under 50 pax',
  '50_99': '50–99 pax',
  '100_199': '100–199 pax',
  '200_plus': '200+ pax',
};

/**
 * Label for a pax band key. Returns null for 'unknown' and for any key the
 * reader might grow later — a card shows no pax chip rather than an
 * unexplained code.
 */
export function paxBandLabel(band: string | null | undefined): string | null {
  if (!band) return null;
  return PAX_BAND_LABEL[band] ?? null;
}

/**
 * 'YYYY-MM' → 'Jun 2026'. Parsed as UTC so a month never slips backwards for a
 * viewer west of Greenwich. Anything unparseable passes through unchanged
 * rather than rendering "Invalid Date".
 */
export function formatRecordMonth(monthYear: string | null | undefined): string | null {
  if (!monthYear) return null;
  if (!/^\d{4}-\d{2}$/.test(monthYear)) return null;
  const d = new Date(`${monthYear}-01T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return MONTH_FMT.format(d);
}

const MONTH_FMT = new Intl.DateTimeFormat('en-PH', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

/**
 * The `record` JSONB `public.service_card_records(uuid[])` returns per card.
 *
 * Typed as `unknown`-ish on purpose: this crosses a network boundary, so the
 * compiler below treats every field as untrusted and parses it defensively
 * rather than trusting the annotation. The named shape documents intent; it
 * does not guarantee it.
 */
export type ServiceCardRecordRow = {
  booked_count?: unknown;
  type_mix?: unknown;
  ledger?: unknown;
  option_sample_n?: unknown;
  option_mix?: unknown;
  documented_events?: unknown;
};

/** One slice of the event-type mix, ready to render. */
export type CompiledMixSlice = {
  /** Raw slug — kept for React keys and test assertions, never displayed. */
  eventType: string;
  /** "Wedding" / "Gender Reveal" — via the shipped formatEventTypeLabel. */
  label: string;
  n: number;
  /** Share of the mix, 0–100, for the proportion bar. */
  pct: number;
};

/** One anonymized ledger row, ready to render. */
export type CompiledLedgerRow = {
  label: string;
  /** 'Jun 2026', or null when the reader had no month. */
  month: string | null;
  /** '100–199 pax', or null when the head-count is unknown. */
  pax: string | null;
};

/**
 * One line of "what couples actually picked", ready to render.
 *
 * There is no `pct` and no bar. The number that matters is the pair — 4 of 6 —
 * and a percentage of a sample of six reads as a statistic about a market
 * rather than a fact about six couples.
 */
export type CompiledOptionPick = {
  label: string;
  /** Couples (EVENTS, never rows) who chose it. Never below the SQL floor. */
  n: number;
};

/** The compiled record — everything the section component needs, pre-formatted. */
export type CompiledCardRecord = {
  bookedCount: number;
  mix: CompiledMixSlice[];
  ledger: CompiledLedgerRow[];
  milestones: { earned: number[]; next: number | null };
  /**
   * WHAT COUPLES PICKED, and out of how many.
   *
   * ⚠ BOTH FLOORS LIVE IN SQL, NOT HERE. `optionSampleN` is 0 and `optionPicks`
   * is empty whenever the reader withheld them — this module must never
   * reconstruct, round or bucket a suppressed number, because a floor applied
   * in a component has already shipped the raw number to the browser. The only
   * job here is to refuse anything malformed.
   */
  optionSampleN: number;
  optionPicks: CompiledOptionPick[];
  /**
   * CELEBRATIONS THIS SHOP DOCUMENTED — events it has visible, screened photos
   * from (owner ruling 2026-08-24: *"no photo, no proof the event took place"*).
   *
   * ⚠ A SHOP FACT, NOT A CARD FACT. Captures are keyed on the vendor profile, so
   * every card of a shop carries the same number and the UI must label it that
   * way — exactly like the shop rating rendered beside it.
   *
   * ⚠ UNFLOORED ON PURPOSE. Unlike `optionPicks`, this counts the shop's OWN
   * work, so "1" discloses nothing about WHICH celebration — and the owner
   * asked for a number that moves from the first one, as a nudge to record
   * everything.
   */
  documentedEvents: number;
};

/** The zero record — a card that has served nothing shows nothing. */
export const EMPTY_CARD_RECORD: CompiledCardRecord = {
  bookedCount: 0,
  mix: [],
  ledger: [],
  milestones: { earned: [], next: MILESTONE_THRESHOLDS[0] },
  optionSampleN: 0,
  optionPicks: [],
  documentedEvents: 0,
};

// ---------------------------------------------------------------------------
// The pure compiler
// ---------------------------------------------------------------------------

/**
 * Any JSON scalar → a non-negative integer count. Never throws, never returns
 * NaN/Infinity/negative: an unparseable count is 0, which renders as "no record
 * yet" — the honest degradation.
 */
function toCount(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : 0;
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

/** A plain non-null object (not an array). */
function isRecordObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Any JSON value → a trimmed string, or '' for anything that is not a string. */
function toText(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** An array, or [] for anything else — a malformed collection is an empty one. */
function toArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/**
 * Milestone medals for a booked count. `earned` is every threshold reached, in
 * ascending order; `next` is the lowest threshold not yet reached, or null once
 * the top of the ladder is passed (there is no medal beyond the last one, and
 * inventing one would be a promise the product has not made).
 */
export function milestonesFor(bookedCount: number): { earned: number[]; next: number | null } {
  const n = toCount(bookedCount);
  const earned = MILESTONE_THRESHOLDS.filter((t) => n >= t);
  const next = MILESTONE_THRESHOLDS.find((t) => n < t) ?? null;
  return { earned: [...earned], next };
}

/**
 * Compile the reader's payload into the card's view model. PURE — no clock, no
 * network, no environment — and TOTAL: it never throws, for any input. Both
 * mount points call it inside a page render on a public route, so an exception
 * here would be a 500 on a vendor's entire profile page rather than a missing
 * decoration. A null, non-object, or wholly malformed payload compiles to the
 * zero record; a malformed ELEMENT is skipped and its neighbours survive.
 *
 * Every defensive step has a reason:
 *   • the mix is re-sorted (count desc, then slug asc) so the bar is stable and
 *     deterministic even if the reader's ORDER BY ever changes;
 *   • percentages are computed against the MIX TOTAL, not bookedCount, so the
 *     proportion bar always sums to the whole width it is given — and the two
 *     legitimately differ whenever the SQL minimum-N floor empties the mix;
 *   • the ledger is re-sorted newest-first and re-capped at LEDGER_MAX —
 *     'YYYY-MM' sorts lexicographically, which is also chronologically;
 *   • rows with no event type are dropped from the mix (they cannot be labeled
 *     honestly) but a ledger row without a month is KEPT, because the event
 *     itself is real and only its date is missing;
 *   • an EMPTY mix/ledger beside a non-zero count is a NORMAL, expected state,
 *     not a bug: it is exactly what the SQL minimum-N floor produces. The
 *     count-only record is a first-class shape all the way to the component.
 */
export function compileCardRecord(raw: unknown): CompiledCardRecord {
  if (!isRecordObject(raw)) return EMPTY_CARD_RECORD;

  const bookedCount = toCount(raw.booked_count);

  const mixRows: { eventType: string; n: number }[] = [];
  for (const el of toArray(raw.type_mix)) {
    if (!isRecordObject(el)) continue; // a junk element costs only itself
    const eventType = toText(el.event_type);
    const n = toCount(el.n);
    if (eventType.length === 0 || n <= 0) continue;
    mixRows.push({ eventType, n });
  }
  mixRows.sort((a, b) => b.n - a.n || a.eventType.localeCompare(b.eventType));

  const mixTotal = mixRows.reduce((sum, r) => sum + r.n, 0);
  const mix: CompiledMixSlice[] = mixRows.map((r) => ({
    eventType: r.eventType,
    label: formatEventTypeLabel(r.eventType),
    n: r.n,
    pct: mixTotal > 0 ? (r.n / mixTotal) * 100 : 0,
  }));

  const ledgerRows: { eventType: string; monthYear: string; paxBand: string }[] = [];
  for (const el of toArray(raw.ledger)) {
    if (!isRecordObject(el)) continue;
    ledgerRows.push({
      eventType: toText(el.event_type),
      monthYear: toText(el.month_year),
      paxBand: toText(el.pax_band),
    });
  }
  ledgerRows.sort((a, b) => b.monthYear.localeCompare(a.monthYear));

  const ledger: CompiledLedgerRow[] = ledgerRows.slice(0, LEDGER_MAX).map((r) => ({
    label: formatEventTypeLabel(r.eventType),
    month: formatRecordMonth(r.monthYear),
    pax: paxBandLabel(r.paxBand),
  }));

  // ── WHAT COUPLES PICKED ───────────────────────────────────────────────────
  // The reader has already applied both floors. A line that arrives here is
  // one at least K couples chose, out of a sample of at least K bookings — so
  // there is nothing to suppress and nothing to compute, only shapes to refuse.
  const documentedEvents = toCount(raw.documented_events);
  const optionSampleN = toCount(raw.option_sample_n);
  const optionPicks: CompiledOptionPick[] = [];
  for (const el of toArray(raw.option_mix)) {
    if (!isRecordObject(el)) continue; // a junk element costs only itself
    const label = toText(el.label);
    const n = toCount(el.n);
    if (label.length === 0 || n <= 0) continue;
    optionPicks.push({ label, n });
  }
  optionPicks.sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));

  return {
    bookedCount,
    mix,
    ledger,
    milestones: milestonesFor(bookedCount),
    documentedEvents,
    optionSampleN,
    // A line can never claim more couples than the sample it came from. If the
    // two ever disagree the payload is not trustworthy, so the whole block is
    // dropped rather than half-shown — an impossible number on a public card is
    // worse than no number.
    optionPicks: optionPicks.every((p) => p.n <= optionSampleN) ? optionPicks : [],
  };
}

/**
 * DOES THIS CARD HAVE ANYTHING TO SAY?
 *
 * ONE predicate, because there were THREE — the vendor's services manager, the
 * public gallery and the details sheet each asked `bookedCount > 0` on their
 * own, and the section component asked a fourth time. Checking a condition in
 * four places is four chances to forget, and the next surface makes five; this
 * project has already paid for that shape once, on a feature where forgetting
 * meant leaving a photo wall open.
 *
 * 🔑 AND THE FOUR COPIES WERE ABOUT TO BECOME WRONG. `bookedCount` counts
 * `event_vendors` rows carrying this card's `service_id` — and a PACKAGE lock
 * cascades rows that carry NO `service_id` at all. So a card booked only
 * through its own ★ Customization package scores zero there while having a real
 * record of picks, and every one of those four gates would have hidden it.
 *
 * ⚠ THAT UNDERCOUNT IS NAMED, NOT FIXED HERE. Making `booked_count` see package
 * bookings would move a public trust number ("Booked N× on Setnayan") on a live
 * card, which is a decision of its own and not a side effect of showing picks.
 * What this file does instead is refuse to print a headline that is not true:
 * the booked line renders only when the count is real, and the picks carry
 * their own denominator.
 */
export function cardRecordHasSomethingToSay(
  record: CompiledCardRecord | null | undefined,
): record is CompiledCardRecord {
  if (!record) return false;
  return record.bookedCount > 0 || record.optionSampleN > 0;
}

/**
 * Does the SHOP have a record worth opening the section for on the shop's OWN
 * card view?
 *
 * The documented-celebrations count is a SHOP fact, so it is true of a card
 * that has itself done nothing — which is why it does not open the section on a
 * couple's card, the same restraint the shop rating already shows. On the
 * vendor's own manager it DOES open it, because that is where the owner's nudge
 * lives: *"to make sure that they record everything"* only works if the shop can
 * see the number before its first booking.
 */
export function cardRecordHasSomethingToSayToTheShop(
  record: CompiledCardRecord | null | undefined,
): record is CompiledCardRecord {
  if (!record) return false;
  // NOT short-circuited through cardRecordHasSomethingToSay: its `record is`
  // predicate narrows the FALSE branch to `never`, so the second half could not
  // read a field. Both conditions are spelled out instead.
  return (
    record.bookedCount > 0 || record.optionSampleN > 0 || record.documentedEvents > 0
  );
}

// ---------------------------------------------------------------------------
// The server wrapper
// ---------------------------------------------------------------------------

/**
 * Hard cap on ids per call. Mirrors the SQL guard: over the cap the reader
 * returns NOTHING, so sending more than this would silently blank every card
 * rather than some. Chunking here keeps that impossible.
 *
 * ⚠ The authoritative cap is the migration's `v_max_ids`. This constant exists
 * only to stay at or under it — raising it without raising the SQL side would
 * turn a full gallery into an empty one.
 */
export const RECORD_BATCH_MAX = 50;

/**
 * Read + compile records for a list of cards, keyed by vendor_service_id.
 *
 * ONE round-trip per batch. This matters: `/v/[slug]` is force-dynamic and
 * renders the vendor's whole gallery, so a per-card reader would have meant one
 * RPC per card on every uncached public request.
 *
 * Fail-soft by contract — an RPC error logs and yields an EMPTY MAP, and both
 * mount points treat a missing entry as "no record", so a failed read costs the
 * decoration and never the page.
 *
 * @param supabase  A server-side client. The RPC is SECURITY DEFINER, granted
 *                  to `authenticated` + `service_role` and NOT to anon: the
 *                  public page reads it through the service-role client while
 *                  rendering, and the vendor's own manager reads it as the
 *                  signed-in vendor. No browser calls it directly.
 */
export async function fetchServiceCardRecords(
  supabase: SupabaseClient,
  vendorServiceIds: readonly string[],
): Promise<Map<string, CompiledCardRecord>> {
  const ids = [...new Set(vendorServiceIds.filter(Boolean))];
  const out = new Map<string, CompiledCardRecord>();
  if (ids.length === 0) return out;

  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += RECORD_BATCH_MAX) {
    chunks.push(ids.slice(i, i + RECORD_BATCH_MAX));
  }

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const { data, error } = await supabase.rpc('service_card_records', {
        p_service_ids: chunk,
      });
      if (error) {
        // eslint-disable-next-line no-console
        console.error('[service-card-record] rpc failed', {
          count: chunk.length,
          error: error.message,
        });
        return [];
      }
      return (data ?? []) as { vendor_service_id?: unknown; record?: unknown }[];
    }),
  );

  for (const rows of results) {
    for (const row of rows) {
      const id = typeof row?.vendor_service_id === 'string' ? row.vendor_service_id : null;
      if (!id) continue;
      out.set(id, compileCardRecord(row.record));
    }
  }
  return out;
}

/**
 * Single-card convenience over the batch reader — the vendor-side surfaces that
 * hold exactly one card should not have to build an array. Deliberately a thin
 * wrapper rather than its own RPC: one public function is easier to audit than
 * two, and the envelope is defined once.
 */
export async function fetchServiceCardRecord(
  supabase: SupabaseClient,
  vendorServiceId: string,
): Promise<CompiledCardRecord> {
  const map = await fetchServiceCardRecords(supabase, [vendorServiceId]);
  return map.get(vendorServiceId) ?? EMPTY_CARD_RECORD;
}
