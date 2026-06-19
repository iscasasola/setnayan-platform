import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Coins, ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { SubmitButton } from '@/app/_components/submit-button';
import { redeemVendorTokenVoucher } from './actions';

export const metadata = {
  title: 'Redeem a code · Vendor dashboard',
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<{
    redeemed?: string;
    code?: string;
    error?: string;
  }>;
};

/**
 * /vendor-dashboard/redeem-code — vendor-side voucher redemption surface.
 *
 * WHY · Owner brief 2026-05-29 final deliverable for vendor token grants.
 *       Vendors paste a grant_tokens voucher code and tokens credit to
 *       their wallet (via the DB RPC redeem_vendor_token_voucher). The
 *       founder-bonus auto-fires on verification · this surface is for
 *       ADDITIONAL grants (referral rewards, comp grants, promo codes).
 *
 * Access:
 *   - signed-in vendor with vendor_profiles row · bounce to /login otherwise
 *   - bounce to /vendor-dashboard/verify if no profile (they need to claim first)
 *
 * Surface:
 *   - Hero with brand-voice explainer
 *   - Wallet snapshot (current earned + purchased + total)
 *   - Code input (8 char A-Z 0-9 · auto-uppercase on blur · submit)
 *   - Success banner when ?redeemed=N is in the URL
 *   - Error banner when ?error=… is in the URL
 *   - Link back to earnings
 *
 * NOT included (deliberately V1):
 *   - Voucher history table — admin grants surface in /admin/vendors/[id]/tokens
 *     covers this from the admin side; vendor view of their own grants is
 *     V1.x post-pilot (low pilot value · pilot vendors are family/friends).
 *   - Token-spending UI — V2 cutover surfaces (telemetry boosts, manpower
 *     handshake fees) per CLAUDE.md 2026-05-28 third + tenth rows.
 */
export default async function VendorRedeemCodePage({ searchParams }: Props) {
  const search = await searchParams;

  // Signed-in vendor gate.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/vendor-dashboard/redeem-code');

  const { data: vendor } = await supabase
    .from('vendor_profiles')
    .select('vendor_profile_id, business_name')
    .eq('user_id', user.id)
    .maybeSingle();

  // No vendor profile → bounce to verify (claim flow lands them with a
  // profile · until then, no wallet to credit).
  if (!vendor) {
    redirect('/vendor-dashboard/verify');
  }

  // Wallet snapshot via service-role admin client wouldn't be necessary
  // since the vendor's own RLS lets them read their own wallet row. We
  // use the regular server client (auth.uid() flows through).
  const { data: wallet } = await supabase
    .from('vendor_wallets')
    .select('earned_tokens, purchased_tokens')
    .eq('vendor_id', vendor.vendor_profile_id)
    .maybeSingle();

  const earned = wallet?.earned_tokens ?? 0;
  const purchased = wallet?.purchased_tokens ?? 0;
  const totalBalance = earned + purchased;

  const redeemedCount =
    search?.redeemed && Number.isFinite(Number(search.redeemed))
      ? Number(search.redeemed)
      : null;
  const redeemedCode = search?.code ?? null;
  const errorMsg = search?.error ?? null;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/vendor-dashboard/earnings"
        className="mb-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to earnings
      </Link>

      <header className="mb-6 space-y-2">
        <div className="flex items-center gap-2">
          <Coins
            aria-hidden
            className="h-6 w-6 text-orange"
            strokeWidth={2}
          />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Redeem a code</h1>
        <p className="text-sm text-ink/65">
          Paste a Setnayan voucher code below to credit tokens to your wallet.
          Tokens spend toward telemetry boosts, manpower handshake fees, and
          future vendor add-ons. Earned tokens expire · purchased tokens
          never do.
        </p>
      </header>

      {redeemedCount !== null && redeemedCount > 0 && (
        <div className="mb-6 rounded-md border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-900">
          ✓ Redeemed{' '}
          {redeemedCode ? (
            <span className="font-mono">{redeemedCode}</span>
          ) : (
            'the code'
          )}{' '}
          · {redeemedCount.toLocaleString('en-PH')} tokens credited to your
          wallet.
        </div>
      )}

      {errorMsg && (
        <div className="mb-6 rounded-md border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-900">
          {errorMsg}
        </div>
      )}

      {/* Wallet snapshot */}
      <section className="mb-6 rounded-md border border-ink/10 bg-cream p-4">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-ink/60">
          Your wallet
        </h2>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-2xl font-semibold text-orange">
              {earned.toLocaleString('en-PH')}
            </div>
            <div className="mt-0.5 text-[11px] uppercase tracking-wider text-ink/60">
              Earned
            </div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-ink">
              {purchased.toLocaleString('en-PH')}
            </div>
            <div className="mt-0.5 text-[11px] uppercase tracking-wider text-ink/60">
              Purchased
            </div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-success-700">
              {totalBalance.toLocaleString('en-PH')}
            </div>
            <div className="mt-0.5 text-[11px] uppercase tracking-wider text-ink/60">
              Total balance
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-ink/55">
          When you spend tokens, expiring earned tokens go first (FIFO by
          earliest expiry). Purchased tokens stay forever.
        </p>
      </section>

      {/* Code form */}
      <section className="rounded-md border border-ink/10 bg-paper p-4">
        <form action={redeemVendorTokenVoucher} className="space-y-4">
          <div>
            <label
              htmlFor="code"
              className="block text-sm font-medium text-ink"
            >
              Voucher code
            </label>
            <p className="mt-1 text-xs text-ink/60">
              Eight characters · letters and numbers only · we&rsquo;ll handle the
              uppercase.
            </p>
            {/* CSS uppercase on the input text · server action trims +
                uppercases anyway so we don't need a client-side handler.
                Keeps this surface a pure server component. */}
            <input
              type="text"
              id="code"
              name="code"
              maxLength={8}
              pattern="[A-Za-z0-9]{8}"
              required
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="mt-2 block w-full max-w-xs rounded-md border border-ink/15 bg-paper px-3 py-2 font-mono text-sm uppercase tracking-wider"
              style={{ textTransform: 'uppercase' }}
            />
          </div>

          <div className="flex items-center gap-3">
            <SubmitButton pendingLabel="Redeeming…">Redeem code</SubmitButton>
            <p className="text-xs text-ink/55">
              Each code can be redeemed once per vendor account.
            </p>
          </div>
        </form>
      </section>
    </div>
  );
}
