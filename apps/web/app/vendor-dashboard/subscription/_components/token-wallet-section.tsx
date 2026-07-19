import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchV2VendorCatalog } from '@/lib/v2-catalog';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import {
  enrichTeamWithUsers,
  fetchVendorTeam,
  isVendorAdminRole,
} from '@/lib/vendor-team';
import { BalanceCard } from '@/app/vendor-dashboard/tokens/_components/balance-card';
import {
  VoucherList,
  type VoucherRow,
} from '@/app/vendor-dashboard/tokens/_components/voucher-list';
import {
  BuyTokensCta,
  type TokenPack,
  type TokenRecipient,
} from '@/app/vendor-dashboard/tokens/_components/buy-tokens-cta';
import {
  PendingPurchases,
  type PendingPurchase,
} from '@/app/vendor-dashboard/tokens/_components/pending-purchases';
import {
  PurchaseHistory,
  type ResolvedPurchase,
} from '@/app/vendor-dashboard/tokens/_components/purchase-history';
import {
  RecentHistory,
  type HistoryEntry,
} from '@/app/vendor-dashboard/tokens/_components/recent-history';

/**
 * TokenWalletSection — the vendor token wallet, extracted from the retired
 * /vendor-dashboard/tokens page so it can render inside the unified Plan &
 * tokens hub (/vendor-dashboard/subscription). Self-contained async server
 * component: resolves the caller + does its own reads, so the hub only has to
 * drop it in. The ?ordered / ?error banners + the apply-then-pay pay panel live
 * on the parent hub (they're shared with the plan flow).
 *
 * Reads are the same as the old page: lazy-eval expiry sweep BEFORE the wallet
 * SELECT, then a parallel batch (wallet · vouchers · grants · redemptions ·
 * pending + resolved token orders · catalog · settings), plus the team read for
 * the "buy for a teammate" picker + per-member balances. All user-scoped reads
 * go through the RLS client; team enrichment uses the admin client.
 */
export async function TokenWalletSection() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return null;

  const vendorId = profile.vendor_profile_id;

  // Lazy-eval expiry sweep BEFORE the wallet SELECT (no-cron preference).
  const { error: evalError } = await supabase.rpc(
    'evaluate_earned_token_expiry',
    { p_vendor_id: vendorId },
  );
  if (evalError) {
    // eslint-disable-next-line no-console
    console.warn('[plan-tokens] evaluate_earned_token_expiry failed:', evalError);
  }

  const [
    walletRes,
    vouchersRes,
    grantsRes,
    redemptionsRes,
    pendingRes,
    resolvedRes,
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
    supabase
      .from('vendor_token_purchases')
      .select(
        'purchase_id, reference_code, token_count, amount_php, status, created_at, paid_at, rejection_reason',
      )
      .eq('vendor_id', vendorId)
      .neq('status', 'pending_payment')
      .order('created_at', { ascending: false })
      .limit(20),
    fetchV2VendorCatalog(),
    fetchPlatformSettings(supabase),
  ]);

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

  const resolvedPurchases: ResolvedPurchase[] = (resolvedRes.data ?? []).map((p) => ({
    purchase_id: p.purchase_id,
    reference_code: p.reference_code,
    token_count: p.token_count,
    amount_php: Number(p.amount_php),
    status: p.status as 'paid' | 'rejected',
    created_at: p.created_at,
    paid_at: p.paid_at,
    rejection_reason: p.rejection_reason,
  }));

  const purchased = walletRes.data?.purchased_tokens ?? 0;
  const earned = walletRes.data?.earned_tokens ?? 0;

  // Team — recipient picker + per-member balances.
  const teamRows = await fetchVendorTeam(supabase, vendorId);
  const adminDb = createAdminClient();
  const team = await enrichTeamWithUsers(adminDb, teamRows);
  const memberLabel = (m: (typeof team)[number]) =>
    m.display_name?.trim() || m.email || 'Team member';

  const recipients: TokenRecipient[] = [
    { user_id: '', label: 'Yourself' },
    ...team
      .filter((m) => m.user_id !== user.id)
      .map((m) => ({ user_id: m.user_id, label: memberLabel(m) })),
  ];

  const { data: memberWalletRows } = await supabase
    .from('vendor_member_token_wallets')
    .select('user_id, purchased_tokens')
    .eq('vendor_id', vendorId);
  const memberPurchased = new Map<string, number>(
    (memberWalletRows ?? []).map((r) => [
      r.user_id as string,
      r.purchased_tokens as number,
    ]),
  );
  const teamBalances = team.map((m) => {
    const isFounder = m.user_id === user.id;
    return {
      key: m.vendor_team_member_id,
      label: memberLabel(m),
      isFounder,
      isAdmin: isVendorAdminRole(m.role),
      purchased: isFounder ? purchased : memberPurchased.get(m.user_id) ?? 0,
    };
  });

  const vouchers: VoucherRow[] = (vouchersRes.data ?? []).map((v) => ({
    voucher_id: v.voucher_id,
    tokens_granted: v.tokens_granted,
    tokens_remaining: v.tokens_remaining,
    granted_at: v.granted_at,
    expires_at: v.expires_at,
    grant_source: v.grant_source,
  }));

  const grantEntries: HistoryEntry[] = (grantsRes.data ?? []).map((g) => ({
    kind: 'grant',
    id: g.grant_id,
    at: g.granted_at,
    tokens: g.tokens_granted,
    source: g.grant_source,
    rationale: g.rationale,
  }));

  const redemptionEntries: HistoryEntry[] = (redemptionsRes.data ?? []).map((r) => ({
    kind: 'redemption',
    id: r.redemption_id,
    at: r.redeemed_at,
    tokens: r.tokens_spent,
    service_code: r.service_code,
  }));

  const history: HistoryEntry[] = [...grantEntries, ...redemptionEntries]
    .sort((a, b) => (a.at > b.at ? -1 : a.at < b.at ? 1 : 0))
    .slice(0, 15);

  return (
    <section className="mt-10">
      <div className="mb-4">
        <p className="sn-eye">Tokens</p>
        <h2 className="mt-1 text-2xl font-extrabold tracking-[-0.015em] sm:text-3xl">
          Your token wallet.
        </h2>
        <p className="mt-2 max-w-prose text-sm text-ink/65">
          Tokens unlock matched couples. Earned tokens expire 45 days after they
          are granted; purchased tokens never expire.
        </p>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4 sm:space-y-6">
          <BalanceCard purchased={purchased} earned={earned} />
          <RecentHistory entries={history} />
        </div>
        <div className="space-y-4 sm:space-y-6">
          <PendingPurchases purchases={pendingPurchases} settings={settings} />
          <VoucherList vouchers={vouchers} />
          <BuyTokensCta packs={packs} recipients={recipients} />
          {teamBalances.length > 1 ? (
            <div className="sn-tile p-6">
              <p className="sn-eye">Team token balances</p>
              <p className="mt-1 text-sm text-ink/65">
                Tokens are personal — each member spends their own when answering
                couples.
              </p>
              <ul className="mt-3 divide-y divide-ink/10">
                {teamBalances.map((b) => (
                  <li
                    key={b.key}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <span className="min-w-0 truncate text-sm text-ink">
                      {b.label}
                      {b.isFounder ? (
                        <span className="ml-2 rounded-full bg-ink/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/65">
                          You · founder
                        </span>
                      ) : b.isAdmin ? (
                        <span className="ml-2 rounded-full bg-sky-100 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-sky-800">
                          Admin
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 font-mono text-sm tabular-nums text-ink">
                      {b.purchased}
                      <span className="ml-1 text-[11px] text-ink/50">tokens</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <PurchaseHistory purchases={resolvedPurchases} />
        </div>
      </div>
    </section>
  );
}
