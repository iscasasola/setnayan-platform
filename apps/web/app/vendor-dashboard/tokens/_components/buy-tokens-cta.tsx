import { ShoppingBag } from 'lucide-react';

/**
 * BuyTokensCta — token-pack purchase upsell card.
 *
 * Pack pricing per CLAUDE.md 2026-05-28 third row V2 architectural pivot
 * (blueprint Part 5 token economy · baseline ₱180–₱250/token across 5 pack
 * denominations):
 *   4 tokens   · ₱1,000  · ₱250/token
 *   10 tokens  · ₱2,400  · ₱240/token
 *   25 tokens  · ₱5,500  · ₱220/token
 *   50 tokens  · ₱10,000 · ₱200/token
 *   100 tokens · ₱18,000 · ₱180/token
 *
 * V2 Phase L1 (post-pilot) ships the purchase flow at /vendor-dashboard/tokens/buy
 * per V2_Cutover_Plan_2026-05-28.md. This component renders pack pricing as
 * read-only educational copy with a polite descriptive callout — NOT
 * "Coming soon" engineering dev-text per [[feedback_setnayan_no_dev_text_post_launch]].
 */

const PACKS = [
  { tokens: 4, php: 1000 },
  { tokens: 10, php: 2400 },
  { tokens: 25, php: 5500 },
  { tokens: 50, php: 10000 },
  { tokens: 100, php: 18000 },
];

const NUMBER = new Intl.NumberFormat('en-PH');

export function BuyTokensCta() {
  return (
    <div className="m-card p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="m-label-mono">Token packs</p>
          <p className="mt-1 text-sm text-ink/65">
            Pre-purchase tokens to accept bids and unlock per-action features.
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

      <ul className="space-y-2">
        {PACKS.map((pack) => {
          const perToken = Math.round(pack.php / pack.tokens);
          return (
            <li
              key={pack.tokens}
              className="flex items-center justify-between rounded-md border px-3 py-2"
              style={{ borderColor: 'var(--m-line)' }}
            >
              <div>
                <p className="text-sm font-medium text-ink">{pack.tokens} tokens</p>
                <p className="text-[11px] text-ink/50">
                  ₱{NUMBER.format(perToken)}/token
                </p>
              </div>
              <p className="text-sm font-semibold text-ink">
                ₱{NUMBER.format(pack.php)}
              </p>
            </li>
          );
        })}
      </ul>

      <div
        className="mt-4 rounded-md border-l-2 px-3 py-2 text-xs text-ink/65"
        style={{
          borderColor: 'var(--m-orange)',
          background: 'rgba(201, 107, 58, 0.04)',
        }}
      >
        Token pack purchase opens this week. Verified vendors receive 100 founder
        tokens at no charge when verification is approved.
      </div>
    </div>
  );
}
