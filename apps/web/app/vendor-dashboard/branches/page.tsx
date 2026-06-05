import { redirect } from 'next/navigation';
import { Building2, Lock, MapPin, RefreshCw, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRole, canManageVendor } from '@/lib/vendor-role';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import {
  fetchVendorBranches,
  BRANCH_FEE_PHP,
  BRANCH_PERIOD_DAYS,
  BRANCH_RADIUS_MIN_KM,
  BRANCH_RADIUS_MAX_KM,
  BRANCH_LABEL_MAX,
  BRANCH_CITY_MAX,
  type BranchStatus,
} from '@/lib/vendor-branches';
import { SubmitButton } from '@/app/_components/submit-button';
import { createBranch, cancelBranch, renewBranch } from './actions';

export const metadata = { title: 'Branches · Vendor' };

type Props = {
  searchParams: Promise<{
    created?: string;
    cancelled?: string;
    renewed?: string;
    error?: string;
  }>;
};

const STATUS_TONE: Record<BranchStatus, string> = {
  active: 'bg-emerald-100 text-emerald-800',
  pending_payment: 'bg-amber-100 text-amber-800',
  expired: 'bg-rose-100 text-rose-800',
  cancelled: 'bg-ink/10 text-ink/55',
};
const STATUS_LABEL: Record<BranchStatus, string> = {
  active: 'Active',
  pending_payment: 'Pending payment',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

function peso(n: number): string {
  return '₱' + n.toLocaleString('en-PH');
}

export default async function VendorBranchesPage({ searchParams }: Props) {
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  // owner/admin only — agents/viewers never see this surface.
  const role = await resolveVendorRole(supabase, user.id);
  if (!canManageVendor(role)) redirect('/vendor-dashboard');

  // Enterprise-only (owner-locked 2026-06-05). tier_state isn't in the shared
  // profile select, so soft-probe it.
  let tier: string | null = null;
  try {
    const { data } = await supabase
      .from('vendor_profiles')
      .select('tier_state')
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .maybeSingle();
    tier = (data as { tier_state?: string } | null)?.tier_state ?? null;
  } catch {
    tier = null;
  }
  const isEnterprise = tier === 'enterprise';

  return (
    <section className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
          <Building2 aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Branches</h1>
        <p className="max-w-prose text-base text-ink/65">
          Run more than one location? Add a branch sub-account so each site has its
          own service area. Each branch is{' '}
          <span className="font-medium text-ink">
            {peso(BRANCH_FEE_PHP)} every {BRANCH_PERIOD_DAYS} days
          </span>{' '}
          and is available on the <span className="font-medium text-ink">Enterprise</span> plan.
        </p>
      </header>

      {search.error ? (
        <p
          role="alert"
          className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {decodeURIComponent(search.error)}
        </p>
      ) : null}
      {search.created ? (
        <p
          role="status"
          className="rounded-md border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          Branch added. Pay {peso(BRANCH_FEE_PHP)} using reference{' '}
          <span className="font-mono font-semibold">{decodeURIComponent(search.created)}</span> — it
          activates once our team confirms your payment (within 24 hours).
        </p>
      ) : null}
      {search.renewed ? (
        <p
          role="status"
          className="rounded-md border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          Renewal started. Pay {peso(BRANCH_FEE_PHP)} using reference{' '}
          <span className="font-mono font-semibold">{decodeURIComponent(search.renewed)}</span> — the
          branch reactivates for another {BRANCH_PERIOD_DAYS} days once our team confirms.
        </p>
      ) : null}
      {search.cancelled ? (
        <p
          role="status"
          className="rounded-md border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          Branch cancelled.
        </p>
      ) : null}

      {!isEnterprise ? (
        <EnterpriseGate />
      ) : (
        <EnterpriseBody supabase={supabase} vendorProfileId={profile.vendor_profile_id} />
      )}
    </section>
  );
}

function EnterpriseGate() {
  return (
    <div className="rounded-2xl border border-ink/10 bg-cream p-8 text-center">
      <span className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-ink/5 text-ink/50">
        <Lock aria-hidden className="h-6 w-6" strokeWidth={1.5} />
      </span>
      <h2 className="text-lg font-semibold text-ink">Branches are an Enterprise feature</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink/65">
        Upgrade your business to the Enterprise plan to add branch sub-accounts —
        each with its own city and service area. Talk to the Setnayan team to switch
        your plan, then come back here to add your first branch.
      </p>
    </div>
  );
}

async function EnterpriseBody({
  supabase,
  vendorProfileId,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  vendorProfileId: string;
}) {
  const [branches, settings] = await Promise.all([
    fetchVendorBranches(supabase, vendorProfileId),
    fetchPlatformSettings(supabase),
  ]);
  const hasPending = branches.some((b) => b.status === 'pending_payment');

  return (
    <>
      {/* Add a branch */}
      <section className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-5">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Add a branch
        </h2>
        <p className="text-xs text-ink/55">
          Adding a branch creates a {peso(BRANCH_FEE_PHP)} charge. Pay it via BDO or
          GCash with the reference we generate; your team confirms it and the branch
          goes live.
        </p>
        <form action={createBranch} className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="block text-xs font-medium text-ink/70">Branch name</span>
            <input
              name="branch_label"
              required
              maxLength={BRANCH_LABEL_MAX}
              placeholder="e.g. Cebu studio"
              className="input-field"
            />
          </label>
          <label className="block space-y-1">
            <span className="block text-xs font-medium text-ink/70">City</span>
            <input
              name="branch_city"
              required
              maxLength={BRANCH_CITY_MAX}
              placeholder="e.g. Cebu City"
              className="input-field"
            />
          </label>
          <label className="block space-y-1">
            <span className="block text-xs font-medium text-ink/70">
              Service radius (km)
            </span>
            <input
              name="branch_radius_km"
              type="number"
              required
              min={BRANCH_RADIUS_MIN_KM}
              max={BRANCH_RADIUS_MAX_KM}
              defaultValue={25}
              className="input-field"
            />
          </label>
          <label className="block space-y-1">
            <span className="block text-xs font-medium text-ink/70">Pay with</span>
            <select name="channel" defaultValue="bdo" className="input-field cursor-pointer">
              <option value="bdo">BDO bank transfer</option>
              <option value="gcash">GCash</option>
            </select>
          </label>
          <div className="sm:col-span-2">
            <SubmitButton className="button-primary w-full sm:w-auto" pendingLabel="Adding…">
              <MapPin className="mr-1.5 h-4 w-4" strokeWidth={1.75} aria-hidden />
              Add branch · {peso(BRANCH_FEE_PHP)}
            </SubmitButton>
          </div>
        </form>
      </section>

      {/* How to pay — only when something is pending */}
      {hasPending ? (
        <section className="space-y-2 rounded-2xl border border-amber-200/70 bg-amber-50/50 p-5">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-amber-900/70">
            How to pay
          </h2>
          <p className="text-sm text-ink/75">
            Send {peso(BRANCH_FEE_PHP)} per pending branch and put its{' '}
            <span className="font-medium">reference code</span> in the transfer note so
            our team can match it.
          </p>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            {settings.bdo_account_number ? (
              <div className="rounded-lg border border-ink/10 bg-cream p-3">
                <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
                  BDO
                </dt>
                <dd className="mt-0.5 text-ink">
                  {settings.bdo_account_name ?? 'Setnayan'}
                  <br />
                  <span className="font-mono">{settings.bdo_account_number}</span>
                </dd>
              </div>
            ) : null}
            {settings.gcash_number ? (
              <div className="rounded-lg border border-ink/10 bg-cream p-3">
                <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
                  GCash
                </dt>
                <dd className="mt-0.5 text-ink">
                  {settings.gcash_account_name ?? 'Setnayan'}
                  <br />
                  <span className="font-mono">{settings.gcash_number}</span>
                </dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}

      {/* Branches list */}
      <section className="space-y-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Your branches ({branches.filter((b) => b.status !== 'cancelled').length})
        </h2>
        {branches.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink/15 bg-cream p-8 text-center">
            <Building2 aria-hidden className="mx-auto mb-2 h-6 w-6 text-ink/30" strokeWidth={1.5} />
            <p className="text-sm font-medium text-ink">No branches yet.</p>
            <p className="mt-1 text-xs text-ink/55">Add your first branch above.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {branches.map((b) => (
              <li
                key={b.branch_id}
                className="flex items-start justify-between gap-3 rounded-2xl border border-ink/10 bg-cream p-4"
              >
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-base font-semibold text-ink">{b.branch_label}</p>
                  <p className="text-sm text-ink/65">
                    {b.branch_city} · {b.branch_radius_km} km radius
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${STATUS_TONE[b.status]}`}
                    >
                      {STATUS_LABEL[b.status]}
                    </span>
                    {b.status === 'pending_payment' && b.reference_code ? (
                      <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[11px] text-ink/70">
                        Ref <span className="font-mono font-semibold">{b.reference_code}</span>
                      </span>
                    ) : null}
                  </div>
                </div>
                {b.status !== 'cancelled' ? (
                  <div className="flex shrink-0 items-center gap-2">
                    {b.status === 'expired' ? (
                      <form action={renewBranch}>
                        <input type="hidden" name="branch_id" value={b.branch_id} />
                        <input type="hidden" name="channel" value="bdo" />
                        <button
                          type="submit"
                          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 text-xs font-medium text-amber-900 hover:border-amber-500"
                        >
                          <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                          Renew · {peso(BRANCH_FEE_PHP)}
                        </button>
                      </form>
                    ) : null}
                    <form action={cancelBranch}>
                      <input type="hidden" name="branch_id" value={b.branch_id} />
                      <button
                        type="submit"
                        aria-label="Cancel branch"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-ink/5 text-ink/70 hover:bg-terracotta/10 hover:text-terracotta"
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                      </button>
                    </form>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
