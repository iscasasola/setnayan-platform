import { Coins } from 'lucide-react';

/**
 * BalanceCard — KPI hero card for the vendor token wallet surface.
 *
 * Renders the vendor's total token balance (purchased + earned) as the
 * primary headline number, with the breakdown surfaced as supporting metadata
 * underneath. Earned tokens are 45-day-expiring vouchers per CLAUDE.md
 * 2026-05-28 third row V2 cutover; purchased tokens never expire.
 *
 * Visual register — v2.1 design system per CLAUDE.md 2026-05-28 11th row
 * "v2.1 template package adoption":
 *   - `.m-card` paper surface + thin border + low shadow
 *   - `.m-display-tight` Saira Condensed wordmark eyebrow + headline number
 *   - `.m-label-mono` uppercase tracking-0.10em mono metadata
 *   - `--m-orange` (#C96B3A) accent only on the icon chip
 *
 * Server-side rendered; takes already-resolved numeric balances + does not
 * read Supabase directly. The parent page calls evaluate_earned_token_expiry()
 * BEFORE selecting the wallet row, so the earned figure shown here reflects
 * the live non-expired balance.
 */
export function BalanceCard({
  purchased,
  earned,
}: {
  purchased: number;
  earned: number;
}) {
  const total = purchased + earned;
  const numberFormat = new Intl.NumberFormat('en-PH');

  return (
    <div className="m-card p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="m-label-mono">Tokens.</p>
          <p className="text-xs text-ink/55">Your wallet balance, live.</p>
        </div>
        <div
          aria-hidden
          className="flex h-10 w-10 items-center justify-center rounded-full"
          style={{
            background: 'rgba(201, 107, 58, 0.10)' /* --m-orange @ 10% */,
            color: 'var(--m-orange)',
          }}
        >
          <Coins className="h-5 w-5" strokeWidth={1.75} />
        </div>
      </div>

      <p
        className="m-display-tight mt-6 text-5xl sm:text-6xl"
        aria-label={`Total balance: ${total} tokens`}
      >
        {numberFormat.format(total)}
        <span className="ml-2 align-baseline text-2xl text-ink/45 sm:text-3xl">
          {total === 1 ? 'token' : 'tokens'}
        </span>
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 border-t pt-4" style={{ borderColor: 'var(--m-line)' }}>
        <div>
          <p className="m-label-mono">Earned</p>
          <p className="mt-1 text-xl font-medium text-ink">{numberFormat.format(earned)}</p>
          <p className="mt-0.5 text-[11px] text-ink/55">45-day vouchers</p>
        </div>
        <div>
          <p className="m-label-mono">Purchased</p>
          <p className="mt-1 text-xl font-medium text-ink">{numberFormat.format(purchased)}</p>
          <p className="mt-0.5 text-[11px] text-ink/55">No expiry</p>
        </div>
      </div>
    </div>
  );
}
