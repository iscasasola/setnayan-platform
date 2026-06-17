import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { FormFlash } from '@/app/_components/forms/form-flash';
import {
  initiateApproval,
  confirmApproval,
  rejectPartnership,
  createPartnershipHq,
} from './actions';

export const metadata = { title: 'Vendor Partnerships · Admin' };

type SearchParams = {
  verified?: string;
  initiated?: string;
  rejected?: string;
  created?: string;
  error?: string;
};

type PartnershipRow = {
  id: number;
  recommending_vendor_id: string;
  recommended_vendor_id: string;
  relationship_type: string;
  additional_fee_centavos: number | null;
  discount_pct: number | null;
  covered_plan_groups: string[];
  is_active: boolean;
  admin_verified: boolean;
  created_at: string;
  recommending: { business_name: string; services: string[] } | null;
  recommended: { business_name: string; services: string[] } | null;
};

type PendingApproval = {
  approval_id: string;
  target_id: string | null;
  initiated_by: string;
  status: string;
  created_at: string;
  expires_at: string;
};

type VendorOption = {
  vendor_profile_id: string;
  business_name: string;
};

type ServiceCategoryOption = {
  id: string;
  label_en: string;
  tier: number;
};

const RELATIONSHIP_LABELS: Record<string, string> = {
  accredited: 'Accredited',
  sponsored_included: 'Included in package',
  sponsored_discounted: 'Discounted',
  general: 'General referral',
};

function formatFee(cents: number | null, type: string): string {
  if (type === 'sponsored_included') return 'Included (₱0)';
  if (cents === null) return '—';
  if (cents === 0) return '₱0';
  return `₱${(cents / 100).toLocaleString('en-PH')}`;
}

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

type Props = {
  searchParams: Promise<SearchParams>;
};

export default async function AdminVendorPartnershipsPage({ searchParams }: Props) {
  const sp = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const meId = user?.id ?? '';

  const admin = createAdminClient();

  // Pending partnerships (admin_verified=false, is_active=true)
  const { data: rawPending } = await admin
    .from('vendor_partnerships')
    .select(
      'id, recommending_vendor_id, recommended_vendor_id, relationship_type, additional_fee_centavos, discount_pct, covered_plan_groups, is_active, admin_verified, created_at',
    )
    .eq('admin_verified', false)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  // Recently verified
  const { data: rawVerified } = await admin
    .from('vendor_partnerships')
    .select(
      'id, recommending_vendor_id, recommended_vendor_id, relationship_type, additional_fee_centavos, discount_pct, covered_plan_groups, is_active, admin_verified, created_at',
    )
    .eq('admin_verified', true)
    .order('created_at', { ascending: false })
    .limit(10);

  const pendingRows = (rawPending ?? []) as Omit<PartnershipRow, 'recommending' | 'recommended'>[];
  const verifiedRows = (rawVerified ?? []) as Omit<PartnershipRow, 'recommending' | 'recommended'>[];

  // Resolve vendor names for all rows in one round-trip
  const allVendorIds = new Set<string>();
  [...pendingRows, ...verifiedRows].forEach((r) => {
    allVendorIds.add(r.recommending_vendor_id);
    allVendorIds.add(r.recommended_vendor_id);
  });
  const vendorNameMap = new Map<string, { business_name: string; services: string[] }>();
  if (allVendorIds.size > 0) {
    const { data: vendorNames } = await admin
      .from('vendor_profiles')
      .select('vendor_profile_id, business_name, services')
      .in('vendor_profile_id', [...allVendorIds]);
    for (const v of (vendorNames ?? []) as {
      vendor_profile_id: string;
      business_name: string;
      services: string[] | null;
    }[]) {
      vendorNameMap.set(v.vendor_profile_id, {
        business_name: v.business_name,
        services: v.services ?? [],
      });
    }
  }

  // Resolve pending two-admin approvals for these partnerships
  const pendingIds = pendingRows.map((r) => String(r.id));
  const pendingApprovalsMap = new Map<string, PendingApproval>();
  if (pendingIds.length > 0) {
    const { data: approvals } = await admin
      .from('admin_approval_requests')
      .select('approval_id, target_id, initiated_by, status, created_at, expires_at')
      .eq('action_type', 'approve_vendor_partnership')
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .in('target_id', pendingIds);
    for (const a of (approvals ?? []) as PendingApproval[]) {
      if (a.target_id) pendingApprovalsMap.set(a.target_id, a);
    }
  }

  // Resolve admin display names for pending approvals
  const initiatorIds = new Set([...pendingApprovalsMap.values()].map((a) => a.initiated_by));
  const adminNameMap = new Map<string, string>();
  if (initiatorIds.size > 0) {
    const { data: adminUsers } = await admin
      .from('users')
      .select('user_id, display_name, email')
      .in('user_id', [...initiatorIds]);
    for (const u of (adminUsers ?? []) as { user_id: string; display_name: string | null; email: string | null }[]) {
      adminNameMap.set(u.user_id, u.display_name ?? u.email ?? '—');
    }
  }

  // All vendors for the "Add partnership" search dropdowns
  const { data: allVendors } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id, business_name')
    .eq('is_active', true)
    .order('business_name', { ascending: true })
    .limit(500);
  const vendorOptions = (allVendors ?? []) as VendorOption[];

  // Top-level plan group categories for the covered_plan_groups multi-select
  const { data: cats } = await admin
    .from('service_categories')
    .select('id, label_en, tier')
    .eq('tier', 1)
    .eq('status', 'active')
    .order('sort_order', { ascending: true });
  const categoryOptions = (cats ?? []) as ServiceCategoryOption[];

  const enrich = (
    row: Omit<PartnershipRow, 'recommending' | 'recommended'>,
  ): PartnershipRow => ({
    ...row,
    recommending: vendorNameMap.get(row.recommending_vendor_id) ?? null,
    recommended: vendorNameMap.get(row.recommended_vendor_id) ?? null,
  });

  const pending = pendingRows.map(enrich);
  const verified = verifiedRows.map(enrich);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 space-y-2">
        <p className="m-eyebrow text-[color:var(--m-orange-2)]">
          Setnayan HQ · Vendor quality
        </p>
        <h1 className="m-display-tight text-3xl text-[color:var(--m-ink)] sm:text-4xl">
          Vendor Partnerships
        </h1>
        <p className="text-base text-ink/65">
          Vendors and HQ can declare commercial relationships here. Badges are{' '}
          <strong className="text-ink">invisible to couples</strong> until a second admin
          verifies them (four-eyes gate). Reject sets the partnership inactive — no badge
          ever shows.
        </p>
      </header>

      {sp.error ? (
        <FormFlash tone="error">{decodeURIComponent(sp.error)}</FormFlash>
      ) : null}
      {sp.verified ? (
        <FormFlash tone="success">Partnership verified. Badge is now live.</FormFlash>
      ) : null}
      {sp.initiated ? (
        <FormFlash tone="success">
          Approval initiated. A different admin must confirm before the badge goes live.
        </FormFlash>
      ) : null}
      {sp.rejected ? (
        <FormFlash tone="success">Partnership rejected and deactivated.</FormFlash>
      ) : null}
      {sp.created ? (
        <FormFlash tone="success">
          Partnership created by HQ. It needs two-admin verification before going live.
        </FormFlash>
      ) : null}

      {/* ── PENDING QUEUE ────────────────────────────────────────────────── */}
      <section className="mb-10">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="m-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Pending verification ({pending.length})
          </h2>
          <p className="text-xs text-ink/45">
            {pending.length === 0
              ? 'Nothing waiting for review.'
              : 'Two admins must verify each claim before couples see the badge.'}
          </p>
        </div>

        {pending.length === 0 ? (
          <div className="m-card p-8 text-center text-sm text-ink/55">
            No partnerships awaiting verification. Set na &apos;yan.
          </div>
        ) : (
          <ul className="space-y-4">
            {pending.map((row) => {
              const partnershipIdStr = String(row.id);
              const pendingApproval = pendingApprovalsMap.get(partnershipIdStr);
              const isMineInitiated = pendingApproval?.initiated_by === meId;
              const hasApprovalRequest = !!pendingApproval;

              return (
                <li key={row.id} className="m-card p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    {/* Details */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-mulberry/10 px-2 py-0.5 text-[11px] font-bold text-mulberry">
                          {RELATIONSHIP_LABELS[row.relationship_type] ?? row.relationship_type}
                        </span>
                        {row.discount_pct ? (
                          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                            {row.discount_pct}% off
                          </span>
                        ) : null}
                        {row.additional_fee_centavos !== null &&
                        row.relationship_type !== 'sponsored_included' ? (
                          <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                            {formatFee(row.additional_fee_centavos, row.relationship_type)}
                          </span>
                        ) : null}
                      </div>

                      <p className="text-sm font-semibold text-ink">
                        {row.recommending?.business_name ?? row.recommending_vendor_id}
                        <span className="mx-2 font-normal text-ink/40">recommends</span>
                        {row.recommended?.business_name ?? row.recommended_vendor_id}
                      </p>

                      {row.recommending?.services?.length ? (
                        <p className="text-xs text-ink/50">
                          Recommending:{' '}
                          {row.recommending.services.slice(0, 3).join(', ')}
                        </p>
                      ) : null}

                      {row.covered_plan_groups?.length ? (
                        <p className="text-xs text-ink/60">
                          Covers:{' '}
                          <span className="font-medium">
                            {row.covered_plan_groups.join(', ')}
                          </span>
                        </p>
                      ) : null}

                      <p className="text-xs text-ink/40">
                        Submitted {timeAgo(row.created_at)}
                      </p>

                      {hasApprovalRequest ? (
                        <p className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">
                          Approval initiated by{' '}
                          <strong>{adminNameMap.get(pendingApproval.initiated_by) ?? '—'}</strong>{' '}
                          {timeAgo(pendingApproval.created_at)} —{' '}
                          {isMineInitiated
                            ? 'waiting for a different admin to confirm.'
                            : 'you can confirm or reject below.'}
                        </p>
                      ) : null}
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      {hasApprovalRequest && !isMineInitiated ? (
                        /* Second admin: can confirm or reject the pending approval */
                        <>
                          <form>
                            <input type="hidden" name="approval_id" value={pendingApproval!.approval_id} />
                            <input type="hidden" name="partnership_id" value={partnershipIdStr} />
                            <button
                              formAction={confirmApproval}
                              type="submit"
                              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700"
                            >
                              Confirm &amp; verify (2nd admin)
                            </button>
                          </form>
                          <form>
                            <input type="hidden" name="partnership_id" value={partnershipIdStr} />
                            <button
                              formAction={rejectPartnership}
                              type="submit"
                              className="rounded-md border border-terracotta/40 bg-white px-3 py-1.5 text-xs font-bold text-terracotta-700 transition-colors hover:bg-terracotta-50"
                            >
                              Reject
                            </button>
                          </form>
                        </>
                      ) : hasApprovalRequest && isMineInitiated ? (
                        /* Initiating admin: can only reject (can't self-confirm) */
                        <form>
                          <input type="hidden" name="partnership_id" value={partnershipIdStr} />
                          <button
                            formAction={rejectPartnership}
                            type="submit"
                            className="rounded-md border border-terracotta/40 bg-white px-3 py-1.5 text-xs font-bold text-terracotta-700 transition-colors hover:bg-terracotta-50"
                          >
                            Reject
                          </button>
                        </form>
                      ) : (
                        /* No pending approval yet: first admin initiates */
                        <>
                          <form>
                            <input type="hidden" name="partnership_id" value={partnershipIdStr} />
                            <button
                              formAction={initiateApproval}
                              type="submit"
                              className="rounded-md bg-ink px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-ink/90"
                            >
                              Approve (two-admin gate)
                            </button>
                          </form>
                          <p className="max-w-[180px] text-right text-[10px] text-ink/45">
                            A second admin must also confirm before the badge goes live.
                          </p>
                          <form>
                            <input type="hidden" name="partnership_id" value={partnershipIdStr} />
                            <button
                              formAction={rejectPartnership}
                              type="submit"
                              className="rounded-md border border-terracotta/40 bg-white px-3 py-1.5 text-xs font-bold text-terracotta-700 transition-colors hover:bg-terracotta-50"
                            >
                              Reject
                            </button>
                          </form>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── ADD PARTNERSHIP (HQ manual entry) ───────────────────────────── */}
      <section className="mb-10 rounded-2xl border border-terracotta/20 bg-gradient-to-br from-cream to-terracotta-50/30 p-5 sm:p-6">
        <h2 className="mb-1 m-mono text-[11px] uppercase tracking-[0.2em] text-terracotta-700">
          Add partnership (HQ entry)
        </h2>
        <p className="mb-4 text-xs text-ink/55">
          Manually record a partnership that vendors confirmed verbally. It still
          requires two-admin approval before the badge goes live.
        </p>

        <form action={createPartnershipHq} className="grid gap-4 sm:grid-cols-2">
          {/* Recommending vendor */}
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Recommending vendor</span>
            <select
              name="recommending_vendor_id"
              required
              className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
            >
              <option value="">Select vendor…</option>
              {vendorOptions.map((v) => (
                <option key={v.vendor_profile_id} value={v.vendor_profile_id}>
                  {v.business_name}
                </option>
              ))}
            </select>
          </label>

          {/* Recommended vendor */}
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Recommended vendor</span>
            <select
              name="recommended_vendor_id"
              required
              className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
            >
              <option value="">Select vendor…</option>
              {vendorOptions.map((v) => (
                <option key={v.vendor_profile_id} value={v.vendor_profile_id}>
                  {v.business_name}
                </option>
              ))}
            </select>
          </label>

          {/* Relationship type */}
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Relationship type</span>
            <select
              name="relationship_type"
              required
              className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
            >
              <option value="">Select type…</option>
              {Object.entries(RELATIONSHIP_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          {/* Additional fee */}
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Additional fee (centavos)</span>
            <input
              type="number"
              name="additional_fee_centavos"
              min={0}
              placeholder="e.g. 100000 = ₱1,000 · leave blank = unknown"
              className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
            />
          </label>

          {/* Discount pct */}
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Discount % (for discounted type)</span>
            <input
              type="number"
              name="discount_pct"
              min={0}
              max={100}
              placeholder="e.g. 10"
              className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
            />
          </label>

          {/* Covered plan groups */}
          <div className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-semibold text-ink">Covered plan groups</span>
            <p className="text-xs text-ink/50">
              Which checklist categories does this partnership help resolve?
            </p>
            <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
              {categoryOptions.map((cat) => (
                <label key={cat.id} className="flex cursor-pointer items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    name="covered_plan_groups"
                    value={cat.id}
                    className="accent-mulberry"
                  />
                  {cat.label_en}
                </label>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ink/90"
            >
              Create partnership (pending verification)
            </button>
          </div>
        </form>
      </section>

      {/* ── RECENTLY VERIFIED ───────────────────────────────────────────── */}
      {verified.length > 0 ? (
        <section>
          <h2 className="mb-3 m-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Recently verified ({verified.length} shown)
          </h2>
          <div className="m-card overflow-hidden p-0">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-ink/10 text-left text-[11px] uppercase tracking-wide text-ink/45">
                  <th className="px-4 py-2 font-medium">Recommending</th>
                  <th className="px-4 py-2 font-medium">Recommended</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Fee / Discount</th>
                  <th className="px-4 py-2 font-medium">Verified</th>
                </tr>
              </thead>
              <tbody>
                {verified.map((row) => (
                  <tr key={row.id} className="border-b border-ink/5 last:border-0">
                    <td className="px-4 py-2 font-medium">
                      {row.recommending?.business_name ?? '—'}
                    </td>
                    <td className="px-4 py-2">{row.recommended?.business_name ?? '—'}</td>
                    <td className="px-4 py-2">
                      <span className="rounded-md bg-mulberry/10 px-2 py-0.5 text-[11px] font-semibold text-mulberry">
                        {RELATIONSHIP_LABELS[row.relationship_type] ?? row.relationship_type}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-ink/70">
                      {row.discount_pct ? `${row.discount_pct}% off` : null}
                      {row.discount_pct && row.additional_fee_centavos !== null ? ' · ' : null}
                      {formatFee(row.additional_fee_centavos, row.relationship_type)}
                    </td>
                    <td className="px-4 py-2 text-ink/55">{timeAgo(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
