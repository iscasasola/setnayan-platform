import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Coins } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SubmitButton } from '@/app/_components/submit-button';
import { grantTokensToVendor, setVendorTier } from '../../actions';
import { VENDOR_TIERS, TIER_LABEL, asVendorTier } from '@/lib/vendor-tier-caps';

export const metadata = {
  title: 'Grant tokens · Admin',
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ vendorProfileId: string }>;
  searchParams: Promise<{ granted?: string; tier?: string }>;
};

/**
 * /admin/vendors/[id]/tokens — admin direct token grant surface.
 *
 * WHY · Owner brief 2026-05-29: admin needs a manual way to credit a
 *       claimed vendor's wallet with N expiring tokens beyond the auto-100
 *       founder bonus. Use cases: rewarding referral leads, comping a
 *       verification snafu, seeding pilot family vendors above floor.
 *
 *       The grant is atomic via grant_admin_direct_tokens() RPC (migration
 *       20260703500000 PART 2) which writes earned_token_vouchers + audit
 *       row + refreshes the wallet cache in one transaction. This page is
 *       the UI · the heavy lifting lives in the DB function.
 *
 * Access:
 *   - admin only (gate at top mirrors apps/web/app/admin/vendors/edit/page.tsx)
 *   - CLAIMED vendors only (user_id NOT NULL) — unclaimed vendors don't
 *     have wallets to credit; admin pre-stages them via /edit, vendor claims,
 *     THEN admin can grant from here.
 *
 * Surfaces:
 *   - Header with vendor business_name + public_id + claim status
 *   - Current wallet snapshot: earned_tokens + purchased_tokens (V2 substrate
 *     from 20260628000000 + 20260703000000 · cached columns kept fresh by
 *     evaluate_earned_token_expiry())
 *   - Grant form: token count + TTL days + reason + Grant button
 *   - Recent grants table: token_grants_log rows for this vendor, last 10
 *
 * NOT included (deliberately):
 *   - Voucher redemptions surface — vendor self-serve at /vendor-dashboard/redeem-code
 *   - Per-voucher expiry table — too operational for V1 · admin can grep the
 *     earned_token_vouchers table directly via Supabase Studio
 */
export default async function AdminVendorTokensPage({
  params,
  searchParams,
}: Props) {
  const { vendorProfileId } = await params;
  const search = await searchParams;

  // Admin-only gate — bounce non-admins before any DB read.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: me } = await supabase
    .from('users')
    .select('is_internal, is_team_member, account_type')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!(me?.is_internal || me?.is_team_member || me?.account_type === 'admin')) {
    redirect('/dashboard');
  }

  const admin = createAdminClient();

  // Vendor profile · need business_name + public_id + claim state + wallet
  // join. wallets columns earned_tokens + purchased_tokens are cached values
  // refreshed by evaluate_earned_token_expiry() at grant time.
  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select(
      'vendor_profile_id, public_id, user_id, business_name, location_city, is_published, tier_state, tier_expires_at',
    )
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  if (!vendor) notFound();
  const currentTier = asVendorTier(
    (vendor as { tier_state?: string | null }).tier_state,
  );
  const currentTierExpiresAt =
    (vendor as { tier_expires_at?: string | null }).tier_expires_at ?? null;

  // Wallet snapshot · NULL row means the vendor hasn't received any tokens
  // yet (the founder-bonus trigger creates the row on verification). We
  // treat that as zero balance with a brand-voice notice.
  const { data: wallet } = await admin
    .from('vendor_wallets')
    .select('earned_tokens, purchased_tokens')
    .eq('vendor_id', vendorProfileId)
    .maybeSingle();

  // Recent grants · last 10 rows from token_grants_log for this vendor,
  // newest first. Used to show admin what's already been granted (and by whom).
  const { data: recentGrants } = await admin
    .from('token_grants_log')
    .select(
      'log_id, grant_source, tokens_granted, rationale, granted_at, granted_by_admin_id',
    )
    .eq('vendor_id', vendorProfileId)
    .order('granted_at', { ascending: false })
    .limit(10);

  const earned = wallet?.earned_tokens ?? 0;
  const purchased = wallet?.purchased_tokens ?? 0;
  const totalBalance = earned + purchased;
  const isClaimed = vendor.user_id !== null;
  const hasWalletRow = wallet !== null;
  const grantedCount = search?.granted ? Number(search.granted) : null;
  const tierSet = search?.tier ? asVendorTier(search.tier) : null;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/admin/vendors"
        className="mb-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to vendors
      </Link>

      <header className="mb-6 space-y-2">
        <div className="flex items-center gap-2">
          <Coins aria-hidden className="h-5 w-5 text-orange" strokeWidth={2} />
          <span className="rounded-full bg-success-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-success-900">
            {isClaimed ? 'Claimed' : 'Unclaimed'}
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Grant tokens · {vendor.business_name}
        </h1>
        <p className="text-sm text-ink/60">
          {vendor.location_city ?? 'No city set'} · <span className="font-mono text-xs">{vendor.public_id}</span>
        </p>
      </header>

      {grantedCount !== null && Number.isFinite(grantedCount) && (
        <div className="mb-6 rounded-md border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-900">
          ✓ Granted {grantedCount.toLocaleString('en-PH')} tokens. The vendor&rsquo;s wallet now shows {totalBalance.toLocaleString('en-PH')} total tokens.
        </div>
      )}

      {tierSet !== null && (
        <div className="mb-6 rounded-md border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-900">
          ✓ Tier set to <strong>{TIER_LABEL[tierSet]}</strong>.
        </div>
      )}

      {/* Subscription tier — until self-serve checkout lands, this is the only
          way to reach Pro/Enterprise (every paid-tier gate depends on it). */}
      <section className="mb-6 rounded-md border border-ink/10 bg-paper p-4">
        <h2 className="mb-1 text-xs font-medium uppercase tracking-[0.15em] text-ink/60">
          Subscription tier
        </h2>
        <p className="mb-3 text-xs text-ink/60">
          Current: <span className="font-medium text-ink">{TIER_LABEL[currentTier]}</span>
          {currentTierExpiresAt && (
            <>
              {' '}· expires{' '}
              <span className="font-medium text-ink">
                {new Date(currentTierExpiresAt).toLocaleDateString('en-PH', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </>
          )}
          {!currentTierExpiresAt && currentTier !== 'free' && (
            <span className="ml-1 text-warn-700">(open-ended — no auto-downgrade)</span>
          )}
          . Set Pro/Enterprise after confirming an off-platform subscription payment
          (self-serve checkout is a later phase).
        </p>
        <form action={setVendorTier} className="space-y-3">
          <input type="hidden" name="vendor_id" value={vendor.vendor_profile_id} />
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="tier_state" className="block text-xs font-medium text-ink/70 mb-1">
                Tier
              </label>
              <select
                id="tier_state"
                name="tier_state"
                defaultValue={currentTier}
                className="rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm"
              >
                {VENDOR_TIERS.map((t) => (
                  <option key={t} value={t}>
                    {TIER_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="tier_expires_at" className="block text-xs font-medium text-ink/70 mb-1">
                Subscription ends <span className="text-ink/50">(optional)</span>
              </label>
              <input
                type="date"
                id="tier_expires_at"
                name="tier_expires_at"
                defaultValue={
                  currentTierExpiresAt
                    ? currentTierExpiresAt.slice(0, 10)
                    : ''
                }
                className="rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm"
              />
            </div>
            <SubmitButton className="button-secondary h-10 px-4 text-sm" pendingLabel="Saving…">
              Set tier
            </SubmitButton>
          </div>
          <p className="text-xs text-ink/50">
            Leave end date blank for open-ended comp access (you&rsquo;ll need to revert manually).
            Pro/Enterprise billing is 28-day cycles — 1 cycle from today ={' '}
            {new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toLocaleDateString('en-PH', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}.
          </p>
        </form>
      </section>

      {!isClaimed && (
        <div className="mb-6 rounded-md border border-warn-200 bg-warn-50 px-4 py-3 text-sm text-warn-900">
          This vendor hasn&rsquo;t claimed yet. Grant the tokens now — they&rsquo;ll see the balance the moment they sign in via their claim link.
        </div>
      )}

      {/* Wallet snapshot */}
      <section className="mb-6 rounded-md border border-ink/10 bg-cream p-4">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-ink/60">
          Wallet snapshot
        </h2>
        {!hasWalletRow ? (
          <p className="text-sm text-warn-800 bg-warn-50 border border-warn-200 rounded-md px-3 py-2">
            No wallet row yet — the vendor hasn&rsquo;t been verified (the founder-bonus
            grant creates the wallet on verification). You can still grant tokens now;
            they&rsquo;ll be visible the moment the vendor verifies.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-2xl font-semibold text-orange">{earned.toLocaleString('en-PH')}</div>
                <div className="mt-0.5 text-[11px] uppercase tracking-wider text-ink/60">Earned (expiring)</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-ink">{purchased.toLocaleString('en-PH')}</div>
                <div className="mt-0.5 text-[11px] uppercase tracking-wider text-ink/60">Purchased (lifetime)</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-success-700">{totalBalance.toLocaleString('en-PH')}</div>
                <div className="mt-0.5 text-[11px] uppercase tracking-wider text-ink/60">Total balance</div>
              </div>
            </div>
            <p className="mt-3 text-xs text-ink/50">
              Earned tokens expire (founder bonus + admin grants + voucher redemptions
              + telemetry rewards) and burn down first. Purchased tokens never expire.
            </p>
          </>
        )}
      </section>

      {/* Grant form */}
      <section className="mb-6 rounded-md border border-ink/10 bg-paper p-4">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-ink/60">
          Grant tokens
        </h2>
        <form action={grantTokensToVendor} className="space-y-4">
          <input type="hidden" name="vendor_id" value={vendor.vendor_profile_id} />

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="token_count"
                className="block text-sm font-medium text-ink"
              >
                How many tokens?
              </label>
              <p className="mt-1 text-xs text-ink/60">
                Whole number between 1 and 10,000.
              </p>
              <input
                type="number"
                id="token_count"
                name="token_count"
                min="1"
                max="10000"
                step="1"
                defaultValue="100"
                required
                className="mt-2 block w-full rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="ttl_days"
                className="block text-sm font-medium text-ink"
              >
                Available for (days)
              </label>
              <p className="mt-1 text-xs text-ink/60">
                Default 45 · matches the founder-bonus convention.
              </p>
              <input
                type="number"
                id="ttl_days"
                name="ttl_days"
                min="1"
                max="365"
                step="1"
                defaultValue="45"
                required
                className="mt-2 block w-full rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="grant_reason"
              className="block text-sm font-medium text-ink"
            >
              Reason <span className="text-ink/60">(optional)</span>
            </label>
            <p className="mt-1 text-xs text-ink/60">
              Short note for the audit log — e.g. &ldquo;Referred 3 vendors&rdquo; or
              &ldquo;Verification snafu comp.&rdquo;
            </p>
            <textarea
              id="grant_reason"
              name="grant_reason"
              maxLength={500}
              rows={2}
              className="mt-2 block w-full rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <SubmitButton className="button-primary h-10 px-5 text-sm" pendingLabel="Granting…">
              Grant tokens
            </SubmitButton>
            <p className="text-xs text-ink/60">
              Logged to <span className="font-mono">admin_audit_log</span> + audit row in <span className="font-mono">token_grants_log</span>.
            </p>
          </div>
        </form>
      </section>

      {/* Recent grants */}
      <section className="rounded-md border border-ink/10 bg-paper p-4">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-ink/60">
          Recent grants
        </h2>
        {!recentGrants || recentGrants.length === 0 ? (
          <p className="text-sm text-ink/60">
            No grants yet for this vendor. Tokens are added via admin direct
            grants, subscription bundles, or voucher redemptions.
          </p>
        ) : (
          <ul className="divide-y divide-ink/10">
            {recentGrants.map((g) => (
              <li key={g.log_id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-ink">
                    {g.tokens_granted.toLocaleString('en-PH')} tokens
                    <span className="ml-2 rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink/60">
                      {g.grant_source}
                    </span>
                  </div>
                  {g.rationale && (
                    <p className="mt-0.5 text-xs text-ink/60 line-clamp-2">{g.rationale}</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xs text-ink/60">
                    {new Date(g.granted_at).toLocaleString('en-PH', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
