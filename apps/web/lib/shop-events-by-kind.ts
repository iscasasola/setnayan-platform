/**
 * shop-events-by-kind.ts — the shop page's "N events ›" and the sheet behind it.
 *
 * Owner 2026-10-30 (OWNER-NOTES item 114, supplier website by plan v3): *"count events and clicking it will show what
 * kind of events total"* ⇒ the shop page says "120+ events ›" — events of EVERY kind, not "weddings" — and a tap shows
 * the total by kind (Weddings · Debuts · Corporate · …  · Total), the ones done through Setnayan marked receipt-backed.
 *
 * ── WHAT IS MEASURED, AND WHAT IS ONLY SAID ─────────────────────────────────
 * Two sources exist and they are NOT the same kind of claim:
 *   · THROUGH SETNAYAN — `vendor_completed_events` (the Track record's own read, `fetchVendorCompletedEvents`): one
 *     row per delivered booking, receipt-backed, each with its `event_type`. Counted exactly, per kind.
 *   · THE SHOP'S OWN COUNT — `vendor_profiles.weddings_done_approx`, the one number a shop has ever been able to
 *     declare. It is WEDDINGS (its migration says so), so it only ever feeds the Wedding row, and it makes the total
 *     an "at least" ("84+"), never an exact figure.
 * A count of debuts or corporate events the shop did OUTSIDE Setnayan has no column — this module does not invent one.
 *
 * 🔑 THE SHOP'S OWN WEDDING COUNT ALREADY INCLUDES ITS SETNAYAN WEDDINGS (it is "every wedding you have done"), so the
 * Wedding row is the larger of the two, never their sum — adding them would count one wedding twice.
 *
 * ⚠ NOTHING MEASURED → NOTHING SAID. No rows and no declared count is `null`, and the page draws no "0 events".
 * The Track record read is capped (`limit`); a capped read can only make the total an "at least" too.
 *
 * Pure, so its test executes it.
 */

export type EventKindRow = {
  /** `event_type` key ('wedding', 'debut', …), or '' for a row with none. */
  key: string;
  /** The display label (the live event-type vocab, else a humanised key). */
  label: string;
  /** What the row says: the shop's own count where it has one (weddings), else the Setnayan count. */
  count: number;
  /** TRUE when `count` is an at-least (the shop's own approximate figure). */
  atLeast: boolean;
  /** Of `count`, how many were done through Setnayan (receipt-backed). */
  viaSetnayan: number;
};

export type EventsByKind = {
  total: number;
  /** TRUE when the total is an at-least — a declared count is in it, or the Setnayan read was capped. */
  atLeast: boolean;
  /** Receipt-backed events done through Setnayan, all kinds. */
  viaSetnayan: number;
  kinds: EventKindRow[];
};

const WEDDING_KEY = 'wedding';

export function eventsByKind(input: {
  completed: ReadonlyArray<{ event_type: string | null }>;
  /** TRUE when the completed-events read returned as many rows as its limit (there may be more). */
  completedCapped: boolean;
  /** `weddings_done_approx` — the shop's own wedding count, or null when never said. */
  declaredWeddings: number | null | undefined;
  labelFor: (key: string) => string;
}): EventsByKind | null {
  const via = new Map<string, number>();
  for (const row of input.completed) {
    const key = (row.event_type ?? '').trim().toLowerCase();
    via.set(key, (via.get(key) ?? 0) + 1);
  }
  const declared =
    typeof input.declaredWeddings === 'number' && Number.isFinite(input.declaredWeddings) && input.declaredWeddings > 0
      ? Math.floor(input.declaredWeddings)
      : null;

  const kinds: EventKindRow[] = [];
  const viaWeddings = via.get(WEDDING_KEY) ?? 0;
  if (declared !== null || viaWeddings > 0) {
    const ownIsBigger = declared !== null && declared > viaWeddings;
    kinds.push({
      key: WEDDING_KEY,
      label: input.labelFor(WEDDING_KEY),
      count: ownIsBigger ? declared : viaWeddings,
      atLeast: ownIsBigger,
      viaSetnayan: viaWeddings,
    });
  }
  const others = [...via.entries()]
    .filter(([k]) => k !== WEDDING_KEY)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  for (const [key, n] of others) {
    kinds.push({ key, label: input.labelFor(key), count: n, atLeast: false, viaSetnayan: n });
  }
  if (kinds.length === 0) return null;

  const total = kinds.reduce((s, k) => s + k.count, 0);
  const viaSetnayan = input.completed.length;
  return {
    total,
    atLeast: kinds.some((k) => k.atLeast) || input.completedCapped,
    viaSetnayan,
    kinds,
  };
}

/** "120+ events" · "3 events" · "1 event". */
export function eventsCountLabel(e: Pick<EventsByKind, 'total' | 'atLeast'>): string {
  const n = e.total.toLocaleString('en-PH');
  return `${n}${e.atLeast ? '+' : ''} ${e.total === 1 && !e.atLeast ? 'event' : 'events'}`;
}
