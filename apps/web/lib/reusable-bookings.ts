/**
 * Reusable Locked Bookings — pure helpers + the safety-critical rules. NO
 * database, NO `server-only`, so the invariants (scope sanitization, the
 * status machine, the distinct-event / new-lock-new-fee rule) are unit-testable
 * and importable by both the couple and vendor server actions.
 *
 * THE MODEL (owner-locked 2026-07-24): the couple INITIATES reuse; the TEMPLATE
 * is VENDOR-owned; the vendor SETS the new price. Reuse copies the
 * scope/inclusions, NEVER the fee-paid status → re-price + re-confirm = a NEW
 * lock = a NEW fee (via collectBookingFeeAtLock), counted toward the vendor's
 * first-5-free like any booking.
 *
 * The DB-touching wrappers live in lib/reusable-bookings.server.ts and compose
 * these; the fee itself is NOT re-implemented here — reuse rides the UNCHANGED
 * finalizeVendor → collectBookingFeeAtLock path.
 */

/**
 * Feature flag — default OFF. When off, the couple "book again" entry points and
 * the vendor reuse inbox render nothing and every server action is an inert
 * no-op, so behaviour is byte-identical to today. NEXT_PUBLIC_ because both the
 * server actions and the client entry points read it. Mirrors
 * lib/coordinator-propose-lock.ts / lib/booking-fee-gate.ts.
 */
export function isReusableBookingsEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_REUSABLE_BOOKINGS_ENABLED;
  return v === 'true' || v === '1' || v === 'TRUE';
}

/** The reuse-request lifecycle. */
export type ReuseRequestStatus =
  | 'pending' // couple asked; vendor has not responded
  | 'quoted' // vendor set a new price
  | 'accepted' // couple accepted the quote → a fresh event_vendors row was minted
  | 'declined' // vendor declined (e.g. a retired package)
  | 'cancelled'; // couple withdrew before resolution

export const REUSE_REQUEST_STATUSES: readonly ReuseRequestStatus[] = [
  'pending',
  'quoted',
  'accepted',
  'declined',
  'cancelled',
];

/** Terminal states — no further transitions. */
const TERMINAL: ReadonlySet<ReuseRequestStatus> = new Set(['accepted', 'declined', 'cancelled']);

/**
 * The reuse-request state machine — the single source of truth for who may move
 * the request where. Strict so a mutation to any arm is caught by a test.
 *
 *   pending  → quoted (vendor re-prices) | declined (vendor) | cancelled (couple)
 *   quoted   → accepted (couple)         | declined (vendor) | cancelled (couple)
 *   accepted / declined / cancelled → (terminal)
 */
export function canTransitionReuse(
  from: ReuseRequestStatus,
  to: ReuseRequestStatus,
  actor: 'couple' | 'vendor',
): boolean {
  if (TERMINAL.has(from)) return false;
  switch (to) {
    case 'quoted':
      return actor === 'vendor' && from === 'pending';
    case 'declined':
      // A vendor can ALWAYS decline (incl. a re-quote they no longer want to
      // honour / a retired package) while the request is live.
      return actor === 'vendor' && (from === 'pending' || from === 'quoted');
    case 'cancelled':
      return actor === 'couple' && (from === 'pending' || from === 'quoted');
    case 'accepted':
      // Only a QUOTED request can be accepted — the couple must have a price.
      return actor === 'couple' && from === 'quoted';
    default:
      return false;
  }
}

/**
 * A single vendor-owned scope line: a human label + optional detail. Explicitly
 * NO amount, NO couple identity — that separation is the privacy guarantee.
 */
export type ScopeLine = { label: string; detail: string | null };

// Keys that carry a PRICE or a COUPLE's instance data. If any of these ever
// appears on a source line item it is DROPPED — never carried into the template.
const FORBIDDEN_SCOPE_KEYS: ReadonlySet<string> = new Set([
  'amount_centavos',
  'amount',
  'amount_php',
  'price',
  'price_centavos',
  'total',
  'total_centavos',
  'subtotal',
  'confirmed_guests',
  'guest_name',
  'couple_name',
  'contact_email',
  'contact_phone',
  'email',
  'phone',
]);

const MAX_SCOPE_LINES = 40;
const MAX_LABEL_LEN = 160;
const MAX_DETAIL_LEN = 500;

function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t.slice(0, max) : null;
}

/**
 * Sanitize a source booking's scope into the reusable, VENDOR-owned template.
 *
 * Accepts either:
 *   • vendor_proposals.line_items — [{label, detail, amount_centavos, …}], OR
 *   • event_vendors.host_inclusions — a string[] of inclusion labels.
 *
 * Guarantees, by construction:
 *   • NO price ever survives (every amount/price/total key is stripped; only
 *     `label` + `detail` are re-emitted).
 *   • NO couple instance data survives — we NEVER read merge_snapshot /
 *     rendered_body, and any PII-ish key on a line item is dropped.
 * These two guarantees are the "template ≠ instance" privacy wall the model
 * requires (the template must never leak another couple's instance data).
 */
export function sanitizeScopeSnapshot(
  source: ReadonlyArray<Record<string, unknown>> | ReadonlyArray<string> | null | undefined,
): ScopeLine[] {
  if (!Array.isArray(source)) return [];
  const out: ScopeLine[] = [];
  for (const raw of source) {
    if (out.length >= MAX_SCOPE_LINES) break;
    if (typeof raw === 'string') {
      const label = cleanText(raw, MAX_LABEL_LEN);
      if (label) out.push({ label, detail: null });
      continue;
    }
    if (!raw || typeof raw !== 'object') continue;
    // Defensively refuse anything shaped like couple/price data even if it also
    // has a label — but we only ever COPY the label + detail, so a stray
    // forbidden key can never ride along. This check exists purely to make the
    // guarantee explicit + test-pinned.
    for (const k of Object.keys(raw)) {
      if (FORBIDDEN_SCOPE_KEYS.has(k)) {
        // no-op: the key is simply not read below. Kept as a self-documenting
        // guard so a future edit that tries to spread `...raw` fails review.
      }
    }
    const label = cleanText((raw as Record<string, unknown>).label, MAX_LABEL_LEN);
    const detail = cleanText((raw as Record<string, unknown>).detail, MAX_DETAIL_LEN);
    if (label) out.push({ label, detail });
  }
  return out;
}

/**
 * Assert the reuse targets a DISTINCT event from the source. This is the crux
 * of "new lock = new fee": the booking-fee ledger keys on (vendor, event) and
 * the charge on the event_vendor, so only a DIFFERENT target event yields a
 * fresh ledger row / frozen free-5 ordinal / new charge. Re-booking into the
 * SAME event would collide with the existing charge and wrongly inherit its
 * paid/free state — so it is forbidden here AND by a table CHECK.
 */
export function reuseTargetsDistinctEvent(
  sourceEventId: string | null | undefined,
  targetEventId: string,
): boolean {
  if (!targetEventId) return false;
  if (!sourceEventId) return true; // no source anchor → nothing to collide with
  return sourceEventId !== targetEventId;
}

/**
 * A source booking is REUSABLE iff it is a committed lock with a marketplace
 * (verified-able) vendor identity. Off-platform / manual vendors (no
 * marketplace_vendor_id) carry no vendor_profiles template and no fee concept,
 * so they are not reusable through this path.
 */
const LOCKED_STATUSES: ReadonlySet<string> = new Set([
  'contracted',
  'deposit_paid',
  'delivered',
  'complete',
]);

export function isReusableSourceBooking(args: {
  status: string | null | undefined;
  marketplaceVendorId: string | null | undefined;
}): boolean {
  return (
    typeof args.status === 'string' &&
    LOCKED_STATUSES.has(args.status) &&
    !!args.marketplaceVendorId
  );
}
