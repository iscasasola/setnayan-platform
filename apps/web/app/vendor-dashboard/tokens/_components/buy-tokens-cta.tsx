'use client';

/**
 * BuyTokensCta — interactive token-pack purchase card.
 *
 * DB-PRICED · the packs come from vendor_billing_catalog (offering_type =
 * 'token_pack') read in page.tsx and passed down. NO hardcoded prices — the
 * admin /admin/pricing surface is the single source of truth (owner 2026-06-08
 * "all values must not be hardcoded · verify from the database created by
 * admin"). Token unit is ₱100 in the DB today; if the admin reprices, this card
 * reflects it on next render.
 *
 * Each pack is a server-action form (startTokenPurchase) that opens an
 * apply-then-pay order — the vendor then pays externally and an admin (or a
 * future payment webhook) confirms it. See actions.ts + migration
 * 20260916000000.
 *
 * MOBILE CHANNEL PRICING
 *
 * When running inside the Capacitor native shell (isNativeApp()), the card
 * shows SRP prices (1.5× the DB web price, rounded to the nearest ₱50) to
 * reflect the channel surcharge. A "Buy on web for less" banner guides the
 * vendor to setnayan.com for the canonical web price.
 *
 * The server action always uses the sku_code — the DB RPC re-reads the
 * authoritative price. The displayed mobile SRP is informational only and
 * does NOT flow to the DB. The actual QR-code payment amount will match
 * the DB (web) price. This is intentional: the vendor is being nudged to the
 * web checkout where the lower price applies; if they order on mobile, they
 * pay the DB price (which is the same regardless of channel at the DB level).
 *
 * TODO (Phase 2): if a true mobile-SRP SKU set is added to the DB catalog,
 * swap the displayed price to the mobile-specific SKU price so the QR amount
 * matches what the vendor sees.
 */

import { useEffect, useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { WebNudgeBanner } from '@/app/vendor-dashboard/_components/web-nudge-banner';
import { isNativeApp } from '@/lib/capacitor';
import { startTokenPurchase } from '../actions';

export type TokenPack = {
  sku_code: string;
  token_count: number;
  price_php: number;
};

const NUMBER = new Intl.NumberFormat('en-PH');

/**
 * Mobile SRP multiplier: 1.5× the web price.
 * Pack SRP prices (at ₱100/token web price):
 *   4-pack  → ₱400 web  → ₱600 mobile
 *   10-pack → ₱1,000 web → ₱1,500 mobile
 *   25-pack → ₱2,500 web → ₱3,750 mobile
 *   50-pack → ₱5,000 web → ₱7,500 mobile
 *   100-pack→ ₱10,000 web → ₱15,000 mobile
 *
 * If the admin changes the base token price, the SRP scales proportionally.
 */
const MOBILE_SRP_MULTIPLIER = 1.5;

function mobileSrp(webPrice: number): number {
  // Round to nearest ₱50 for clean display.
  return Math.round((webPrice * MOBILE_SRP_MULTIPLIER) / 50) * 50;
}

export function BuyTokensCta({ packs }: { packs: TokenPack[] }) {
  const [native, setNative] = useState(false);

  useEffect(() => {
    setNative(isNativeApp());
  }, []);

  // Web price per token (from the cheapest single-token pack or derived from
  // smallest pack). Used only for the nudge banner copy.
  const firstPack = packs[0];
  const webTokenPrice =
    firstPack != null
      ? Math.round(firstPack.price_php / firstPack.token_count)
      : 100;
  const mobileTokenPrice = Math.round(webTokenPrice * MOBILE_SRP_MULTIPLIER);

  return (
    <div className="m-card p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="m-label-mono">Token packs</p>
          <p className="mt-1 text-sm text-ink/65">
            Buy tokens to unlock matched couples. Purchased tokens never expire.
          </p>
        </div>
        <div
          aria-hidden
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{
            background: 'rgba(45, 48, 56, 0.06)' /* --m-ink @ 6% */,
            color: 'var(--m-ink)',
          }}
        >
          <ShoppingBag className="h-4.5 w-4.5" strokeWidth={1.75} />
        </div>
      </div>

      {/* Mobile: show nudge banner above the pack list */}
      {native && (
        <WebNudgeBanner
          savingsCopy={`₱${NUMBER.format(webTokenPrice)}/token (save ₱${NUMBER.format(mobileTokenPrice - webTokenPrice)} each)`}
          webUrl="https://setnayan.com/vendor-dashboard/tokens"
        />
      )}

      {packs.length === 0 ? (
        <p className="text-sm text-ink/60">
          Token packs are being set up. Check back shortly.
        </p>
      ) : (
        <ul className="space-y-2">
          {packs.map((pack) => {
            const displayPrice = native ? mobileSrp(pack.price_php) : pack.price_php;
            const displayPerToken = Math.round(displayPrice / pack.token_count);
            return (
              <li
                key={pack.sku_code}
                className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                style={{ borderColor: 'var(--m-line)' }}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">
                    {NUMBER.format(pack.token_count)} tokens
                  </p>
                  <p className="text-[11px] text-ink/50">
                    ₱{NUMBER.format(displayPrice)} · ₱{NUMBER.format(displayPerToken)}/token
                  </p>
                </div>
                <form action={startTokenPurchase} className="shrink-0">
                  <input type="hidden" name="pack_sku_code" value={pack.sku_code} />
                  <SubmitButton className="button-primary h-9 px-4 text-sm" pendingLabel="Starting…">Buy</SubmitButton>
                </form>
              </li>
            );
          })}
        </ul>
      )}

      <div
        className="mt-4 rounded-md border-l-2 px-3 py-2 text-xs text-ink/65"
        style={{
          borderColor: 'var(--m-orange)',
          background: 'rgba(201, 107, 58, 0.04)',
        }}
      >
        Pay by BDO or GCash — you&rsquo;ll get a reference code and instructions
        after you start. Tokens land once our team confirms your payment.
        Verified vendors also receive 100 founder tokens at no charge.
      </div>
    </div>
  );
}
