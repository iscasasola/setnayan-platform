import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchV2VendorCatalog } from '@/lib/v2-catalog';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { BalanceCard } from './_components/balance-card';
import { VoucherList, type VoucherRow } from './_components/voucher-list';
import { BuyTokensCta, type TokenPack } from './_components/buy-tokens-cta';
import {
  PendingPurchases,
  type PendingPurchase,
} from './_components/pending-purchases';
import { RecentHistory, type HistoryEntry } from './_components/recent-history';

/**
 * /vendor-dashboard/tokens — V2 vendor token wallet surface.
 *
 * Ships V2 Cutover Phase C per CLAUDE.md 2026-05-28 third row "V1 → V2
 * ARCHITECTURAL PIVOT LOCK" + the per-voucher granularity migration shipped
 * by 20260703000000_v2_phase_a_per_voucher_granularity.sql + the founder-
 * bonus + admin-grant + voucher-grant_tokens migration shipped by
 * 20260703500000_vendor_token_grants.sql.
 *
 * READ PATTERN
 *
 * Lazy-eval before every wallet read per [[reference_setnayan_cron_strategy]]
 * (no-cron preference). We call `evaluate_earned_token_expiry(p_vendor_id)`
 * BEFORE SELECTing the wallet row · the RPC sweeps expired vouchers and
 * rewrites `vendor_wallets.earned_tokens` to the live non-expired sum. The
 * subsequent wallet SELECT therefore reflects the truth as of NOW().
 *
 * The 4 sub-fetches (wallet · vouchers · grants · redemptions) run in
 * parallel via Promise.all after the lazy-eval RPC completes. Total round
 * trips: 1 RPC + 1 Promise.all batch = 2 sequential round trips. Matches
 * the perf-pass discipline from CLAUDE.md 2026-05-28 12th row "perf
 * optimization shipped via PR #567".
 *
 * SCHEMA NOTE — column naming
 *
 * The Phase A migration uses `vendor_id` (NOT `vendor_profile_id`) on every
 * V2 wallet/voucher/grant/redemption table. The `fetchOwnVendorProfile`
 * helper returns `vendor_profile_id` from the V1 `vendor_profiles` table —
 * they're the same UUID (the FK target), just different column names on
 * different tables. We thread the value through as `vendorId` to keep both
 * conventions honored at their query sites without renaming the variable.
 *
 * EMPTY STATES
 *
 * No wallet row (first visit): RPC creates the row via UPSERT; we render
 * zero balance + a polite onboarding hint via the VoucherList empty state.
 *
 * No vouchers: handled inside VoucherList.
 *
 * No history (no grants AND no redemptions): handled inside RecentHistory.
 *
 * ENTRY POINTS (orphan-prevention)
 *
 * Vendor-nav subnav tab between Earnings + Verify per the layout.tsx
 * additive insert (Coins icon · "Tokens" label). Reachable from every
 * vendor-dashboard page header. Nav Phase 2 reorg (queued Task #46) may
 * later move this into a different grouping; the additive insert keeps
 * this PR composable with that future change.
 *
 * RLS
 *
 * Vendor-only reads: `fetchOwnVendorProfile` enforces `vendor_profiles.
 * user_id = auth.uid()` so the resolved `vendorId` is always the caller's
 * own. The 4 V2 token tables already have RLS policies from the Phase A
 * migration scoping reads to `vendor_id = current_vendor_id()` (the
 * Phase A helper). We use the user-scoped client (`createClient()`)
 * throughout — no admin-client escape — so RLS gates every read at the
 * database layer in addition to the WHERE clauses below.
 */

export const metadata = { title: 'Tokens · Vendor' };

const NUMBER = new Intl.NumberFormat('en-PH');

type Props = {
  searchParams: Promise<{ ordered?: string; error?: string }>;
};

export default async function VendorTokensPage({ searchParams }: Props) {
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const vendorId = profile.vendor_profile_id;

  // ── LAZY-EVAL EXPIRY SWEEP ──────────────────────────────────────────────
  // Must run BEFORE the wallet SELECT so `earned_tokens` reflects the live
  // non-expired voucher sum. Best-effort: if the RPC errors (e.g., schema
  // out of sync mid-deploy), we still render with whatever the wallet row
  // last cached. Worst-case staleness is bounded by how often the page is
  // visited — vendor checks their wallet, the next visit's RPC catches up.
  const { error: evalError } = await supabase.rpc(
    'evaluate_earned_token_expiry',
    { p_vendor_id: vendorId },
  );
  if (evalError) {
    // Server-side log only; do not surface to vendor. The wallet row may
    // be a few minutes stale until the next visit triggers a fresh sweep.
    // eslint-disable-next-line no-console
    console.warn('[tokens] evaluate_earned_token_expiry failed:', evalError);
  }

  // ── PARALLEL READS ──────────────────────────────────────────────────────
  // wallet · vouchers · grants · redemptions · pending purchases · packs ·
  // platform settings all fan out in one round trip. Packs + settings drive
  // the DB-priced buy card + apply-then-pay instructions (no hardcoded prices).
  const [
    walletRes,
    vouchersRes,
    grantsRes,
    redemptionsRes,
    pendingRes,
    vendorCatalog,
    settings,
  ] = await Promise.all([
    supabase
      .from('vendor_wallets')
      .select('purchased_tokens, earned_tokens')
      .eq('vendor_id', vendorId)
      .maybeSingle(),
    supabase
      .from('earned_token_vouchers')
      .select(
        'voucher_id, tokens_granted, tokens_remaining, granted_at, expires_at, grant_source',
      )
      .eq('vendor_id', vendorId)
      .gt('tokens_remaining', 0)
      .order('expires_at', { ascending: true })
      .limit(10),
    supabase
      .from('token_grants_log')
      .select('grant_id, grant_source, tokens_granted, granted_at, rationale')
      .eq('vendor_id', vendorId)
      .order('granted_at', { ascending: false })
      .limit(10),
    supabase
      .from('token_redemptions_log')
      .select('redemption_id, tokens_spent, service_code, redeemed_at')
      .eq('vendor_id', vendorId)
      .order('redeemed_at', { ascending: false })
      .limit(10),
    supabase
      .from('vendor_token_purchases')
      .select('purchase_id, reference_code, token_count, amount_php, created_at')
      .eq('vendor_id', vendorId)
      .eq('status', 'pending_payment')
      .order('created_at', { ascending: false })
      .limit(10),
    fetchV2VendorCatalog(),
    fetchPlatformSettings(supabase),
  ]);

  // DB-priced token packs (offering_type = 'token_pack'), cheapest first.
  const packs: TokenPack[] = vendorCatalog
    .filter((r) => r.offering_type === 'token_pack' && (r.token_grant_count ?? 0) > 0)
    .map((r) => ({
      sku_code: r.sku_code,
      token_count: r.token_grant_count as number,
      price_php: r.price_php,
    }))
    .sort((a, b) => a.token_count - b.token_count);

  const pendingPurchases: PendingPurchase[] = (pendingRes.data ?? []).map((p) => ({
    purchase_id: p.purchase_id,
    reference_code: p.reference_code,
    token_count: p.token_count,
    amount_php: Number(p.amount_php),
    created_at: p.created_at,
  }));

  const purchased = walletRes.data?.purchased_tokens ?? 0;
  const earned = walletRes.data?.earned_tokens ?? 0;

  const vouchers: VoucherRow[] = (vouchersRes.data ?? []).map((v) => ({
    voucher_id: v.voucher_id,
    tokens_granted: v.tokens_granted,
    tokens_remaining: v.tokens_remaining,
    granted_at: v.granted_at,
    expires_at: v.expires_at,
    grant_source: v.grant_source,
  }));

  // Merge grants + redemptions into a single chronological timeline and
  // slice to 15 entries per the RecentHistory component contract.
  const grantEntries: HistoryEntry[] = (grantsRes.data ?? []).map((g) => ({
    kind: 'grant',
    id: g.grant_id,
    at: g.granted_at,
    tokens: g.tokens_granted,
    source: g.grant_source,
    rationale: g.rationale,
  }));

  const redemptionEntries: HistoryEntry[] = (redemptionsRes.data ?? []).map(
    (r) => ({
      kind: 'redemption',
      id: r.redemption_id,
      at: r.redeemed_at,
      tokens: r.tokens_spent,
      service_code: r.service_code,
    }),
  );

  const history: HistoryEntry[] = [...grantEntries, ...redemptionEntries]
    .sort((a, b) => (a.at > b.at ? -1 : a.at < b.at ? 1 : 0))
    .slice(0, 15);

  // Count vouchers expiring within 7 days for the soft urgency callout.
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const expiringSoonCount = vouchers.filter((v) => {
    const t = new Date(v.expires_at).getTime();
    return t > now && t - now <= sevenDaysMs;
  }).length;

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-6 sm:mb-8">
        <p className="m-eyebrow">Vendor wallet</p>
        <h1 className="m-display-tight mt-1 text-3xl sm:text-4xl">
          Your token balance.
        </h1>
        <p className="mt-2 max-w-prose text-sm text-ink/65">
          Tokens unlock per-action features (bid acceptance, manpower handshakes,
          telemetry rewards). Earned tokens expire 45 days after they are granted.
          Purchased tokens never expire.
        </p>

        {search.ordered && (
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            ✓ Purchase started. Pay with the reference{' '}
            <span className="font-mono font-semibold">{search.ordered}</span> using
            the instructions below — your tokens land once we confirm the payment.
          </div>
        )}

        {search.error && (
          <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {search.error}
          </div>
        )}

        {expiringSoonCount > 0 && (
          <div
            className="mt-4 inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs"
            style={{
              borderColor: 'rgba(180, 95, 6, 0.30)',
              background: 'rgba(180, 95, 6, 0.06)',
              color: 'rgb(180, 95, 6)',
            }}
          >
            <span aria-hidden>•</span>
            <span>
              {NUMBER.format(expiringSoonCount)}{' '}
              {expiringSoonCount === 1 ? 'voucher expires' : 'vouchers expire'}{' '}
              within the next 7 days. Spend them on bid acceptance to keep the
              balance.
            </span>
          </div>
        )}
      </header>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4 sm:space-y-6">
          <BalanceCard purchased={purchased} earned={earned} />
          <RecentHistory entries={history} />
        </div>
        <div className="space-y-4 sm:space-y-6">
          <PendingPurchases purchases={pendingPurchases} settings={settings} />
          <VoucherList vouchers={vouchers} />
          <BuyTokensCta packs={packs} />
        </div>
      </div>
    </main>
  );
}
