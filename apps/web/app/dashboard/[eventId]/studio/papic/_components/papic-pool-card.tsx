import { Users } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchPapicPassTiers } from '@/lib/papic-pass-tiers';
import { fetchEventPoolStatus } from '@/lib/papic-event-pool';
import { papicPoolRungPhrase, papicBucketPhrase } from '@/lib/papic-tier-copy';
import { purchasePapicPoolTopUp } from '../actions';

/**
 * Papic POOL — add shots to the event's SHARED pool.
 *
 * ── WHY THIS EXISTS (2026-07-31) ─────────────────────────────────────────────
 * Papic Pool was ADVERTISED in two live places and buyable in none.
 *
 *   • The onboarding services card prints the whole ladder — "+3,000 ₱1,000 /
 *     +6,000 ₱2,000 / +10,000 ₱3,000" — and closes with "Top up any time from
 *     your Papic studio."
 *   • The Suite card says "add more any time" under a CTA reading "Open the
 *     pool ›".
 *
 * Both link here, to /studio/papic — which sold a dedicated One camera and
 * (until the same day) two retired per-camera rungs, and had no pool ladder at
 * all. The three `PAPIC_GUEST*` rows have been `is_active = true` at owner-set
 * prices since the 2026-07-29 two-type lock, and `grantPapicPassPoints` in
 * lib/sku-activation.ts has been wired to convert a paid one into a
 * `papic_event_point_grants` row the whole time. The ONLY missing link was a
 * doorway that mints the order. This is that doorway.
 *
 * The sibling `HostPoolMeterCard` is deliberately NOT that doorway: its header
 * says it "carries NO purchase copy or doorway", it is read-only, and it is
 * flag-dark behind NEXT_PUBLIC_PAPIC_POOL_BAR. So it could not have closed this
 * even when switched on. This card is the buy path; that one is the meter.
 *
 * ── THE SHAPE, MIRRORED FROM PapicOneCard ────────────────────────────────────
 * Same contract, deliberately: rungs READ from `papic_pass_tiers` (admin-
 * editable, `is_active` filtered in the fetch), price READ from
 * `platform_retail_catalog_v2`, phrase from lib/papic-tier-copy. A rung whose
 * catalog row is missing, zero or inactive DISAPPEARS rather than rendering at
 * an invented price, and if none survive the card renders nothing instead of an
 * empty form. No literal peso figure or shot count appears in this file.
 *
 * ── POOL vs ONE, and why the copy leans on it ────────────────────────────────
 * These shots are SHARED: every guest who scans the event QR spends from the
 * same purse. That is the entire difference from a One camera's dedicated
 * balance, and a card that only quoted a number would sell the two as the same
 * product at different prices — which is exactly the confusion the 2026-07-30
 * naming lock ("only Papic Pool and Papic One") was written to end.
 */
const ERROR_COPY: Record<string, string> = {
  unknown_rung: 'That option is no longer available. Pick one of the sizes below.',
  unavailable: 'That option is not on sale right now. Try another size.',
  order_failed: "We couldn't start that order, so nothing was charged. Please try again.",
};

export async function PapicPoolCard({
  eventId,
  error,
}: {
  eventId: string;
  error?: string | null;
}) {
  const admin = createAdminClient();

  const [tiers, pool] = await Promise.all([
    fetchPapicPassTiers(admin),
    // Display only. Same reader the capture path meters against, so the balance
    // shown here and the fence that stops a shutter cannot disagree.
    fetchEventPoolStatus(admin, eventId).catch(() => null),
  ]);

  // `is_topup` rungs are excluded. PAPIC_GUEST_TOPUP is RETIRED — every rung is
  // additive and repeatable since migration 20271019231590, which made a
  // separate "+10,000 top-up" a duplicate of PAPIC_GUEST_10K. Its tier row is
  // already is_active=false so fetchPapicPassTiers drops it; this filter is the
  // second lock, so re-activating the legacy row for an old order's sake can
  // never put a duplicate rung back on this ladder. The three owner-priced Pool
  // rungs are exactly the non-topup set.
  const sellable = tiers.filter((t) => !t.isTopup);
  if (sellable.length === 0) return null;

  const prices = await fetchPoolRungPrices(
    admin,
    sellable.map((t) => t.serviceCode),
  );
  const rungs = sellable
    .map((t) => ({ ...t, pricePhp: prices.get(t.serviceCode) ?? null }))
    .filter((t) => t.pricePhp != null && t.pricePhp > 0);
  if (rungs.length === 0) return null;

  const remaining = pool?.applies === true ? pool.remainingPoints : null;

  return (
    <section className="space-y-4 rounded-2xl border border-ink/10 bg-surface p-5 sm:p-6">
      <div className="space-y-1.5">
        <p className="flex items-center gap-2 text-lg font-semibold tracking-tight text-ink">
          <Users aria-hidden className="h-5 w-5 text-mulberry" strokeWidth={1.75} />
          Papic Pool — shots everyone shares
        </p>
        <p className="text-sm text-ink/70">
          One shared pot for the whole event. Every guest who scans your QR
          shoots from it, on any phone, with nothing to install. Add shots any
          time — they never expire before your day.
        </p>
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-700">
          {ERROR_COPY[error] ??
            'Something went wrong, and nothing was charged. Please try again.'}
        </p>
      )}

      {remaining != null && (
        <p className="text-sm text-ink/70">
          {remaining.toLocaleString('en-PH')} shots left in the pool —{' '}
          {papicBucketPhrase(remaining)}.
        </p>
      )}

      <form action={purchasePapicPoolTopUp} className="space-y-3">
        <input type="hidden" name="event_id" value={eventId} />

        <label className="block space-y-1">
          <span className="text-xs font-medium text-ink/70">How many shots</span>
          <select
            name="service_code"
            className="w-full rounded-xl border border-ink/15 bg-surface px-3 py-2 text-sm text-ink"
          >
            {rungs.map((r) => (
              <option key={r.serviceCode} value={r.serviceCode}>
                {papicPoolRungPhrase(r.points, r.pricePhp as number)}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-xl bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-terracotta-700"
        >
          Continue to payment
        </button>
      </form>

      <p className="text-xs text-ink/50">
        Apply-then-pay — payment instructions next. Shots land in the pool once
        your payment is confirmed.
      </p>
    </section>
  );
}

/** Live rung prices, straight from the catalog — the single billing source. */
async function fetchPoolRungPrices(
  admin: ReturnType<typeof createAdminClient>,
  codes: readonly string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (codes.length === 0) return out;
  try {
    const { data, error } = await admin
      .from('platform_retail_catalog_v2')
      .select('service_code, retail_price_php, is_active')
      .in('service_code', codes as string[]);
    if (error || !Array.isArray(data)) return out;
    for (const row of data) {
      if ((row as { is_active?: unknown }).is_active !== true) continue;
      const n = Number((row as { retail_price_php?: unknown }).retail_price_php ?? 0);
      if (Number.isFinite(n) && n > 0) {
        out.set(String((row as { service_code?: unknown }).service_code ?? ''), n);
      }
    }
    return out;
  } catch {
    return out;
  }
}
