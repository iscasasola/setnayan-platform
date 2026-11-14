import Link from 'next/link';
import { ArrowRight, Plus } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { formatPhp } from '@/lib/php';
import { formatCount } from '@/lib/format-number';
import { TIER_LABEL } from '@/lib/vendor-tier-caps';
import type { UltraAddOnKind, UltraAddOnRow } from '@/lib/vendor-ultra-addons';
import { buyUltraAddOn } from '../ultra-addon-actions';

/**
 * ULTRA ADD-ONS — owner 2026-11-06 (DECISION_LOG "ULTRA ADD-ON PRICES", *"seat, branch + 990 / the rest is +199"*, and
 * the same day: list EVERY Ultra add-on — *"add categories limit, add service cards limit, team seat, branches, wait
 * list, booked limit per date"*).
 *
 * 🔑 Every row and every price is `ultraAddOns()` — the `vendor_billing_catalog` rows, in the owner's order. Nothing is
 * typed here; a row the admin switches off simply leaves the list. An unreadable catalogue says so instead of showing
 * an empty list.
 *
 * Ultra buys here: the four count add-ons post their KIND ONLY to `buyUltraAddOn` (apply-then-pay — the
 * price is re-read server-side); the seat and the branch keep their shipped surfaces (Team · Branches) and link there.
 * Every other plan reads the list with "Only Ultra can add these" and no buy button.
 */
export function UltraAddonsCard({
  rows,
  canBuy,
  owned,
}: {
  /** `ultraAddOns()` — null when the catalogue could not be read. */
  rows: UltraAddOnRow[] | null;
  /** The shop's plan may buy them (Ultra). */
  canBuy: boolean;
  /** How many of each the shop has bought (count add-ons only). */
  owned: Partial<Record<UltraAddOnKind, number>>;
}) {
  if (rows !== null && rows.length === 0) return null;
  const ultra = TIER_LABEL.enterprise;
  return (
    // Rule 2 · a section on the page with a hairline above, not a card.
    <section className="mt-5 border-t border-[color:var(--m-line)] pt-4" data-ultra-addons="">
      <p className="text-base font-semibold text-ink">Bigger than {ultra}? Add more.</p>
      <p className="mt-0.5 text-sm text-[color:var(--m-slate-2)]">
        {canBuy ? 'Each one adds to your plan, every 4 weeks.' : `Only ${ultra} can add these.`}
      </p>
      {rows === null ? (
        <p className="mt-3 text-sm text-[color:var(--m-slate-2)]" role="status">
          We couldn’t read the add-on prices just now. Refresh to try again.
        </p>
      ) : (
        <ul className="mt-3 divide-y" style={{ borderColor: 'var(--m-line)' }}>
          {rows.map((r) => {
            const have = owned[r.kind] ?? 0;
            return (
              <li key={r.sku} className="flex min-h-11 flex-wrap items-center gap-3 py-2.5" data-addon={r.kind}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{r.label}</p>
                  <p className="text-[13px] text-[color:var(--m-slate-2)]">
                    {formatPhp(r.pricePhp)} / 4 weeks
                    {have > 0 ? ` · you have +${formatCount(have)}` : ''}
                  </p>
                </div>
                {canBuy ? (
                  r.buyHref ? (
                    <Link href={r.buyHref} className="ab ab-brand !min-h-11">
                      Add one
                      <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden />
                    </Link>
                  ) : (
                    <form action={buyUltraAddOn}>
                      <input type="hidden" name="addon" value={r.kind} />
                      <SubmitButton className="ab ab-brand !min-h-11" pendingLabel="Starting…">
                        <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
                        Add one
                      </SubmitButton>
                    </form>
                  )
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
