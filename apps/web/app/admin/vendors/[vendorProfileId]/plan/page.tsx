import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BadgeCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SubmitButton } from '@/app/_components/submit-button';
import { setVendorTier } from '../../actions';
import { VENDOR_TIERS, TIER_LABEL, asVendorTier } from '@/lib/vendor-tier-caps';

import { requireAdmin } from '@/lib/admin/require-admin';
export const metadata = {
  title: 'Vendor plan · Admin',
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ vendorProfileId: string }>;
  searchParams: Promise<{ tier?: string }>;
};

/**
 * /admin/vendors/[id]/plan — set a vendor's subscription tier.
 *
 * WAS /admin/vendors/[id]/tokens. The token half of that page (wallet
 * snapshot · grant form · recent grants) is DELETED under the owner's
 * 2026-07-21 retirement — "token can retire, there should be nothing that
 * needs token anymore". The route is renamed because the word `tokens` is
 * itself user-visible in the address bar.
 *
 * ⚠ THE TIER FORM IS WHY THIS PAGE STILL EXISTS. `setVendorTier` has exactly
 * ONE caller — this file. Deleting the page wholesale (the obvious reading of
 * "delete the admin token pages") would have removed the only way to put a
 * vendor on Pro/Enterprise, and every paid-tier gate reads `tier_state`.
 * Self-serve checkout is a later phase; until it lands this form is the only
 * door.
 *
 * Access: admin only — gate mirrors apps/web/app/admin/vendors/edit/page.tsx.
 */
export default async function AdminVendorPlanPage({
  params,
  searchParams,
}: Props) {
  await requireAdmin();
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

  const isClaimed = vendor.user_id !== null;
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
          <BadgeCheck aria-hidden className="h-5 w-5 text-orange" strokeWidth={2} />
          <span className="rounded-full bg-success-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-success-900">
            {isClaimed ? 'Claimed' : 'Unclaimed'}
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Plan · {vendor.business_name}
        </h1>
        <p className="text-sm text-ink/60">
          {vendor.location_city ?? 'No city set'} ·{' '}
          <span className="font-mono text-xs">{vendor.public_id}</span>
        </p>
      </header>

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
        <div className="rounded-md border border-warn-200 bg-warn-50 px-4 py-3 text-sm text-warn-900">
          This vendor hasn&rsquo;t claimed yet. A tier set now applies the moment they
          sign in via their claim link.
        </div>
      )}
    </div>
  );
}
