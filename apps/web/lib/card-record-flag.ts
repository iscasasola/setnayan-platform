/**
 * CARD RECORD ("the veteran service card") — feature flag.
 *
 * Gates the compiled-history section that a service card grows over time:
 * a "Booked N× on Setnayan" bar, the event-type mix, an ANONYMIZED ledger of
 * recent events served (type + month-year + pax band — never a name, a venue,
 * an exact date or an exact head-count), and the milestone medals at
 * 10 / 25 / 50 / 100 bookings. Owner-locked 2026-07-28 ("build it now, let's
 * keep everything simple") — see DECISION_LOG.md row 2819.
 *
 * OFF (the default) ⇒ the couple's `/v/[slug]` card and the vendor's services
 * manager render byte-identically to today, and neither surface runs the
 * record reader at all — flag-OFF costs not one extra query.
 *
 * NEXT_PUBLIC_ because both mounting surfaces are server components that read
 * it to decide whether to fetch, so the check has to survive the client bundle
 * boundary the same way every other launch flag here does. Only the exact
 * truthy strings enable it; anything else (including a missing var) is OFF, so
 * the section ships dark and the owner flips it on.
 */
export function cardRecordEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_CARD_RECORD_ENABLED;
  return v === 'true' || v === '1' || v === 'TRUE';
}
