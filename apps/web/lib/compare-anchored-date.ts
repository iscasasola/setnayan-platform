/**
 * compare-anchored-date.ts — the per-plan-column date verdict (B5).
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * "Your plans" already had a per-column availability footer, but it renders only
 * for events whose date is a year or a month ("17 days free in November"). Both
 * real production events are DAY-precision, so that row has never once been
 * reachable on real data — dormant, not broken.
 *
 * Once the couple has committed to a date, the window question is the wrong one.
 * The only question left is whether the people in this plan are free on THAT
 * day — and if not, WHICH of them is not, because that is the one fact that
 * turns an affordable plan into an impossible one.
 *
 * ── WHY IT IS A PURE CORE ───────────────────────────────────────────────────
 * Same contract as `bench-sort` / `bench-card-actions` / `your-team` /
 * `plans-panel`: the caller injects everything. `page.tsx` is a server component
 * that resolves ~2100 lines of model before it could reach this logic, so
 * derivation living there is derivation that can never be tested. Injected, the
 * dedupe and the fail-soft rule below are exercised directly.
 *
 * ── NO NEW QUERY ────────────────────────────────────────────────────────────
 * `dateFit` is the map `page.tsx` already builds for the bench's date badge via
 * the batched `getBatchVendorAvailableDays`, under exactly the same
 * day-precision condition. This regroups it by plan column; it reads no
 * calendars of its own.
 */

/** One column's verdict. `checkedCount === 0` ⇒ nothing to say, render a dash. */
export type AnchoredDateColumn = {
  /** Connected vendors in this column whose calendar we could actually read. */
  checkedCount: number;
  /** Names of those booked on the day, de-duplicated, in pick order. */
  bookedNames: string[];
};

export type AnchoredDateColumnInput = {
  key: string;
  picks: ReadonlyArray<{ vendorId?: string }>;
};

/**
 * Group the already-computed per-vendor day fit into one verdict per column.
 *
 * TWO RULES, both load-bearing:
 *
 * 1 · FAIL SOFT TOWARD SILENCE. A vendor absent from `dateFit` has no calendar
 *     signal — off-platform, not marketplace-connected, or a read that flaked.
 *     It is NOT counted as checked and can never be reported booked. The bench's
 *     own badge takes the same direction (a flake reads free, never a false
 *     "booked"), and here the stakes are higher: this row names a real supplier
 *     to the couple hiring them. An absence must never become an accusation.
 *
 * 2 · ONE VENDOR IS ONE CALENDAR. The same vendor picked for two categories is
 *     one booking question, so they are counted once and named once — otherwise
 *     a plan reads "Alba Studios, Alba Studios booked that day".
 */
export function anchoredDateByColumn({
  columns,
  dateFit,
  nameOf,
}: {
  columns: ReadonlyArray<AnchoredDateColumnInput>;
  dateFit: ReadonlyMap<string, 'free' | 'booked'>;
  nameOf: (vendorId: string) => string;
}): Record<string, AnchoredDateColumn> {
  const byColumn: Record<string, AnchoredDateColumn> = {};
  for (const col of columns) {
    const seen = new Set<string>();
    const bookedNames: string[] = [];
    let checkedCount = 0;
    for (const p of col.picks) {
      if (!p.vendorId || seen.has(p.vendorId)) continue;
      const fit = dateFit.get(p.vendorId);
      if (!fit) continue; // rule 1 — no signal, no claim
      seen.add(p.vendorId); // rule 2 — one calendar per vendor
      checkedCount += 1;
      if (fit === 'booked') bookedNames.push(nameOf(p.vendorId));
    }
    byColumn[col.key] = { checkedCount, bookedNames };
  }
  return byColumn;
}
