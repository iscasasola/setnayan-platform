import { ShoppingBag } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { startTokenPurchase } from '../actions';

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
 */

export type TokenPack = {
  sku_code: string;
  token_count: number;
  price_php: number;
};

const NUMBER = new Intl.NumberFormat('en-PH');

export function BuyTokensCta({ packs }: { packs: TokenPack[] }) {
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

      {packs.length === 0 ? (
        <p className="text-sm text-ink/60">
          Token packs are being set up. Check back shortly.
        </p>
      ) : (
        <ul className="space-y-2">
          {packs.map((pack) => {
            const perToken = Math.round(pack.price_php / pack.token_count);
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
                    ₱{NUMBER.format(pack.price_php)} · ₱{NUMBER.format(perToken)}/token
                  </p>
                </div>
                <form action={startTokenPurchase} className="shrink-0">
                  <input type="hidden" name="pack_sku_code" value={pack.sku_code} />
                  <SubmitButton pendingLabel="Starting…">Buy</SubmitButton>
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
