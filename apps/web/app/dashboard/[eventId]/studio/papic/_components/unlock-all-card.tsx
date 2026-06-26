import { Sparkles, Check } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  eventSkuActive,
  eventOwnsSku,
  PAPIC_UNLOCK_ALL_SKU,
} from '@/lib/entitlements';
import { formatPeso } from '@/lib/v2-catalog';
import { purchasePapicUnlockAll } from '../actions';

/**
 * Papic Unlock All — the Papic-vertical everything-pass (owner 2026-06-26).
 *
 * One purchase opens every Papic feature for the event AND lifts every Papic
 * allowance: every camera shoots unlimited, Camera Bridge is included, and the
 * per-guest 150-credit cap is gone. Server component on the Papic add-on page.
 *
 * Reads on the ADMIN client so a co-host who didn't place the order still sees
 * ownership (orders RLS is purchaser-scoped — same reason eventActiveSkus does).
 * The price is LIVE from the admin-managed catalog (graceful fallback if the
 * row isn't seeded). Always renders: the buy CTA when unowned, an active /
 * pending state once the event holds a pass. The apply-then-pay order reuses the
 * page's existing ?papic_purchased confirmation banner.
 */

/** Last-resort price if the catalog row is missing (pre-migration) — never the
 *  source of truth; the LIVE price is admin-managed in the catalog. */
const PAPIC_UNLOCK_ALL_FALLBACK_PHP = 15000;

const INCLUDED: readonly string[] = [
  'Unlimited guest cameras — no 150-photo cap',
  'Unlimited Camera Bridge (DSLR pairing)',
  'Every camera shoots unlimited · no per-camera charge',
  'Kwento, Photo Wall, Thank You, Stories, Pabati & SDE',
];

export async function UnlockAllCard({ eventId }: { eventId: string }) {
  const admin = createAdminClient();

  const [active, ownedInclPending, priceRow] = await Promise.all([
    eventSkuActive(admin, eventId, PAPIC_UNLOCK_ALL_SKU),
    eventOwnsSku(admin, eventId, PAPIC_UNLOCK_ALL_SKU),
    admin
      .from('platform_retail_catalog_v2')
      .select('retail_price_php, is_active')
      .eq('service_code', PAPIC_UNLOCK_ALL_SKU)
      .maybeSingle()
      .then(
        (r) => r.data ?? null,
        () => null,
      ),
  ]);

  const pending = ownedInclPending && !active;
  const priceP = Number((priceRow as { retail_price_php?: number } | null)?.retail_price_php);
  const pricePhp =
    Number.isFinite(priceP) && priceP > 0 ? priceP : PAPIC_UNLOCK_ALL_FALLBACK_PHP;
  // Admin can dark the SKU (is_active=false); hide the buy CTA then, but still
  // surface the active/pending state if the event already holds a pass.
  const buyable =
    (priceRow as { is_active?: boolean } | null)?.is_active !== false;

  return (
    <section className="rounded-2xl border border-terracotta/30 bg-surface p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <Sparkles
          aria-hidden
          className="mt-0.5 h-5 w-5 shrink-0 text-terracotta"
          strokeWidth={2}
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-ink">Papic Unlock All</h2>
          <p className="mt-1 text-sm text-ink/60">
            One purchase opens every Papic feature for your event — and lifts every limit.
          </p>

          <ul className="mt-3 space-y-1.5">
            {INCLUDED.map((line) => (
              <li key={line} className="flex items-start gap-2 text-sm text-ink/75">
                <Check
                  aria-hidden
                  className="mt-0.5 h-4 w-4 shrink-0 text-terracotta"
                  strokeWidth={2.5}
                />
                <span>{line}</span>
              </li>
            ))}
          </ul>

          {active ? (
            <p className="mt-4 inline-flex items-center gap-2 rounded-lg bg-terracotta/10 px-3 py-2 text-sm font-medium text-ink">
              <Check aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={2.5} />
              Unlock All is active — every camera unlimited, every add-on on.
            </p>
          ) : pending ? (
            <p className="mt-4 rounded-lg bg-ink/5 px-3 py-2 text-sm text-ink/70">
              Payment under review — Unlock All activates once the Setnayan team confirms
              your transfer.
            </p>
          ) : buyable ? (
            <form action={purchasePapicUnlockAll} className="mt-4">
              <input type="hidden" name="event_id" value={eventId} />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-cream hover:bg-ink/90"
              >
                Unlock everything · ₱{formatPeso(pricePhp)}
              </button>
              <p className="mt-2 text-xs text-ink/50">
                Apply now, pay by bank transfer or GCash — your team confirms it, then
                everything turns on.
              </p>
            </form>
          ) : null}
        </div>
      </div>
    </section>
  );
}
