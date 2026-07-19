import { Gavel, Filter, ShieldCheck, PackageCheck } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { relativeTime } from '@/lib/activity';
import { resolveDispute } from './actions';
import { SubmitButton } from '@/app/_components/submit-button';
import { ConfirmForm } from '@/app/_components/confirm-form';
import {
  fetchPolicyAcknowledgementsByVendor,
  type PolicyAcknowledgement,
} from '@/lib/vendor-service-payment-schedules.server';
import {
  fetchHandoversByVendor,
  type HandoverEvidenceRow,
} from '@/lib/booking-handovers.server';
import {
  VENDOR_TIERS,
  asVendorTier,
  TIER_LABEL,
  type VendorTier,
} from '@/lib/vendor-tier-caps';

import { requireAdmin } from '@/lib/admin/require-admin';
export const metadata = { title: 'Disputes · Admin' };

/**
 * /admin/disputes — V1 read-only list surface for `public.vendor_disputes`.
 *
 * Why this exists now:
 *  - Iteration 0023 § 3.6 (Disputes & Refunds) called for an admin queue
 *    surface; the underlying schema was locked 2026-05-16 via migration
 *    20260516210000_vendor_payout_model.sql but the UI surface hadn't
 *    landed in app code yet.
 *  - The 5-20 personal/family pilot cohort (per `project_setnayan_pilot_timeline`)
 *    is exercising real BDO/GCash reconciliation. A no-show or refund
 *    dispute filed during pilot needs a visible queue — without one, the
 *    owner only learns about the dispute by tailing Supabase logs.
 *
 * Why read-only:
 *  - V1 MVP. Detail page + resolve actions land in V1.x once the pilot
 *    surfaces the actual resolution-flow shape we need. Until then the
 *    owner reads the queue + updates rows manually via Supabase Studio
 *    if a resolution call has been made off-platform.
 *
 * Why filters live in the URL:
 *  - Matches the established pattern from `/admin/users` (status filter
 *    via `?filter=`) and `/admin/reviews` (filter via `?filter=`). Keeps
 *    filter state shareable + deep-linkable + back-button-friendly with
 *    zero client JS.
 *
 * Auth is enforced at the layout level (`apps/web/app/admin/layout.tsx`
 * calls `notFound()` for non-admins). This page is reached only by admins.
 */

type DisputeRow = {
  dispute_id: string;
  public_id: string;
  vendor_profile_id: string;
  payout_id: string | null;
  order_id: string | null;
  opened_by_user_id: string | null;
  category:
    | 'no_show'
    | 'late_arrival'
    | 'quality_issue'
    | 'communication'
    | 'refund_request'
    | 'other';
  description: string;
  status: 'open' | 'resolved_for_vendor' | 'resolved_for_couple' | 'withdrawn';
  resolved_at: string | null;
  resolution_notes: string | null;
  counts_toward_demotion: boolean;
  vendor_contest: string | null;
  vendor_contested_at: string | null;
  created_at: string;
};

type StatusFilter =
  | 'all'
  | 'open'
  | 'resolved_for_vendor'
  | 'resolved_for_couple'
  | 'withdrawn';

type CategoryFilter =
  | 'all'
  | 'no_show'
  | 'late_arrival'
  | 'quality_issue'
  | 'communication'
  | 'refund_request'
  | 'other';

const STATUS_LABEL: Record<DisputeRow['status'], string> = {
  open: 'Open',
  resolved_for_vendor: 'Resolved · vendor',
  resolved_for_couple: 'Resolved · couple',
  withdrawn: 'Withdrawn',
};

// Glass PR-8 (§ 3.4) — warm-semantic status tones; the stock red-*/warn-*/
// violet-* scales are retired. `resolved_for_couple` uses info-slate
// (--sn-info), the canonical replacement for the retired violet.
const STATUS_TONE: Record<DisputeRow['status'], string> = {
  open: 'bg-[var(--sn-warning-soft)] text-[color:var(--sn-warning)]',
  resolved_for_vendor: 'bg-[var(--sn-success-soft)] text-[color:var(--sn-success)]',
  resolved_for_couple: 'bg-[var(--sn-info-soft)] text-[color:var(--sn-info)]',
  withdrawn: 'bg-ink/10 text-ink/60',
};

const CATEGORY_LABEL: Record<DisputeRow['category'], string> = {
  no_show: 'No-show',
  late_arrival: 'Late arrival',
  quality_issue: 'Quality issue',
  communication: 'Communication',
  refund_request: 'Refund request',
  other: 'Other',
};

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'resolved_for_vendor', label: 'Resolved · vendor' },
  { value: 'resolved_for_couple', label: 'Resolved · couple' },
  { value: 'withdrawn', label: 'Withdrawn' },
];

const CATEGORY_FILTER_OPTIONS: { value: CategoryFilter; label: string }[] = [
  { value: 'all', label: 'All categories' },
  { value: 'no_show', label: 'No-show' },
  { value: 'late_arrival', label: 'Late arrival' },
  { value: 'quality_issue', label: 'Quality issue' },
  { value: 'communication', label: 'Communication' },
  { value: 'refund_request', label: 'Refund request' },
  { value: 'other', label: 'Other' },
];

type Props = {
  searchParams: Promise<{
    status?: string;
    category?: string;
  }>;
};

export default async function AdminDisputesPage({ searchParams }: Props) {
  await requireAdmin();
  const search = await searchParams;
  // Default landing view = open queue. That's the surface the owner reaches
  // for first (what needs attention); resolved + withdrawn are historical.
  const status = normalizeStatusFilter(search.status ?? 'open');
  const category = normalizeCategoryFilter(search.category ?? 'all');

  const admin = createAdminClient();

  // Main list query — uses the dedicated indexes on `vendor_disputes`
  // (vendor_disputes_created_at_idx) so newest-first ordering is cheap.
  let listQuery = admin
    .from('vendor_disputes')
    .select(
      'dispute_id,public_id,vendor_profile_id,payout_id,order_id,opened_by_user_id,category,description,status,resolved_at,resolution_notes,counts_toward_demotion,vendor_contest,vendor_contested_at,created_at',
    )
    .order('created_at', { ascending: false })
    .limit(200);
  if (status !== 'all') listQuery = listQuery.eq('status', status);
  if (category !== 'all') listQuery = listQuery.eq('category', category);
  const { data: listData, error: listError } = await listQuery;
  if (listError) {
    logQueryError('AdminDisputesPage (vendor_disputes)', listError);
  }
  const rows = (listData ?? []) as DisputeRow[];

  // Resolution lookups — one round-trip per FK table, keyed on the
  // unique-IDs in the visible page. The same shape `/admin/reviews` uses.
  const vendorIds = Array.from(
    new Set(rows.map((r) => r.vendor_profile_id).filter(Boolean)),
  );
  const openerIds = Array.from(
    new Set(rows.map((r) => r.opened_by_user_id).filter((v): v is string => Boolean(v))),
  );

  // The vendor-name + opener-user FK lookups both derive from `rows` but not
  // from each other — one parallel batch instead of two serial round-trips
  // (owner perf pass 2026-06-03). An empty id list resolves to {data:[]} with
  // no query (same pattern as vendor-dashboard/bookings).
  const [{ data: vendorData }, { data: openerData }] = await Promise.all([
    vendorIds.length > 0
      ? admin
          .from('vendor_profiles')
          .select('vendor_profile_id, business_name, tier_state')
          .in('vendor_profile_id', vendorIds)
      : Promise.resolve({ data: [] }),
    openerIds.length > 0
      ? admin
          .from('users')
          .select('user_id, display_name, email')
          .in('user_id', openerIds)
      : Promise.resolve({ data: [] }),
  ]);

  const vendorMap = new Map<string, string>();
  // Priority-dispute sort — resolve each disputed vendor's tier_state so premium
  // vendors' disputes surface first. Reuses the canonical `tier_state` enum +
  // asVendorTier() normalizer other admin surfaces read (lib/vendor-tier-caps.ts).
  // This is a READ-ONLY ordering concern; nothing here writes back.
  const vendorTierMap = new Map<string, VendorTier>();
  for (const v of vendorData ?? []) {
    vendorMap.set(
      v.vendor_profile_id as string,
      ((v.business_name as string | null) ?? '').trim() || 'Unnamed vendor',
    );
    vendorTierMap.set(
      v.vendor_profile_id as string,
      asVendorTier((v as { tier_state?: string | null }).tier_state),
    );
  }

  // Tier priority rank — index into VENDOR_TIERS (free=0 … enterprise=highest),
  // so enterprise > pro > solo > verified > free. A vendor with no resolved
  // profile (e.g. deleted) defaults to 'free' via asVendorTier(undefined).
  const tierRank = (vendorProfileId: string): number =>
    VENDOR_TIERS.indexOf(vendorTierMap.get(vendorProfileId) ?? 'free');

  // Stable re-order: tier rank DESC, then preserve the DB order the query
  // already applied (created_at DESC). `rows` is server-controlled + capped at
  // 200, so an in-memory sort is cheap and avoids a migration/RPC.
  const sortedRows = rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      const rankDelta = tierRank(b.r.vendor_profile_id) - tierRank(a.r.vendor_profile_id);
      return rankDelta !== 0 ? rankDelta : a.i - b.i;
    })
    .map((x) => x.r);

  // No-Show Downpayment Protection — pull the FROZEN reservation-policy
  // acknowledgements for every vendor in view, keyed by vendor_profile_id. These
  // are the immutable evidence rows a forfeit dispute (esp. category=no_show)
  // is adjudicated against. Admin-only surface (the layout already gates on
  // is_admin), so the service-role read is in-bounds.
  let policyAcksByVendor = new Map<string, PolicyAcknowledgement[]>();
  try {
    policyAcksByVendor = await fetchPolicyAcknowledgementsByVendor({
      adminClient: admin,
      vendorProfileIds: vendorIds,
    });
  } catch (e) {
    logQueryError('AdminDisputesPage (policy acknowledgements)', e);
  }

  // Delivery Handover (Wave 4) — delivery + couple-acknowledgement state for
  // every vendor in view, keyed by vendor_profile_id. Surfaced beside a dispute
  // so support can see whether the vendor delivered and whether the couple
  // confirmed receipt. Admin-only surface (layout gates is_admin).
  let handoversByVendor = new Map<string, HandoverEvidenceRow[]>();
  try {
    handoversByVendor = await fetchHandoversByVendor({
      adminClient: admin,
      vendorProfileIds: vendorIds,
    });
  } catch (e) {
    logQueryError('AdminDisputesPage (handovers)', e);
  }

  const openerMap = new Map<string, { name: string; email: string | null }>();
  for (const u of openerData ?? []) {
    const display = ((u.display_name as string | null) ?? '').trim();
    const email = ((u.email as string | null) ?? '').trim() || null;
    openerMap.set(u.user_id as string, {
      name: display || email || 'Unknown',
      email,
    });
  }

  // Stats banner — current quarter only. We want the banner to read as a
  // pulse check ("what's happened this quarter?") rather than an
  // all-time count that grows monotonically forever.
  const quarterStart = currentQuarterStart();
  const { data: statsData } = await admin
    .from('vendor_disputes')
    .select('status')
    .gte('created_at', quarterStart.toISOString())
    .limit(5000);
  const statRows = (statsData ?? []) as Array<{ status: DisputeRow['status'] }>;
  const stats = {
    open: statRows.filter((r) => r.status === 'open').length,
    resolved_for_vendor: statRows.filter((r) => r.status === 'resolved_for_vendor').length,
    resolved_for_couple: statRows.filter((r) => r.status === 'resolved_for_couple').length,
    withdrawn: statRows.filter((r) => r.status === 'withdrawn').length,
  };

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <p className="sn-eye">Recourse · conflicts</p>
        <div className="flex items-center gap-2">
          <Gavel className="h-6 w-6 text-[color:var(--sn-gold-500)]" strokeWidth={1.75} />
          <h1 className="sn-h1">Disputes</h1>
        </div>
        <p className="max-w-2xl text-sm text-[color:var(--sn-ink-500)]">
          Couples and vendors can both open a dispute when a booking goes
          sideways. The queue shows the latest 200 matching the filters below,
          ordered by vendor tier (enterprise first) then newest.
        </p>
        <p className="rounded-md border border-white/60 bg-white/70 px-3 py-2 text-xs text-[color:var(--sn-ink-500)]">
          Use <span className="font-semibold">Resolve</span> on any open row to
          record the outcome (couple / vendor / withdrawn) with a note. The
          opener is notified automatically. A standalone detail page with the
          full evidence trail is the next refresh.
        </p>
      </header>

      <StatsBanner stats={stats} quarterStart={quarterStart} />

      <FilterStrip status={status} category={category} />

      {listError ? (
        <p
          role="alert"
          className="mt-4 rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          Disputes couldn&apos;t load right now. We&apos;ve logged the issue — refresh in a moment or check Sentry for the full detail.
        </p>
      ) : null}

      <div className="mt-4">
        <DisputesTable
          rows={sortedRows}
          vendorMap={vendorMap}
          vendorTierMap={vendorTierMap}
          openerMap={openerMap}
          policyAcksByVendor={policyAcksByVendor}
          handoversByVendor={handoversByVendor}
        />
      </div>

      <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
        Source · iteration 0023 § 3.6 · table{' '}
        <code>vendor_disputes</code> (migration 20260516210000)
      </p>
    </div>
  );
}

function StatsBanner({
  stats,
  quarterStart,
}: {
  stats: {
    open: number;
    resolved_for_vendor: number;
    resolved_for_couple: number;
    withdrawn: number;
  };
  quarterStart: Date;
}) {
  const quarterLabel = `Q${Math.floor(quarterStart.getMonth() / 3) + 1} ${quarterStart.getFullYear()}`;
  return (
    <section
      aria-label="Dispute counts this quarter"
      className="sn-tile mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4"
    >
      <StatCell
        label="Open"
        value={stats.open}
        tone="bg-[var(--sn-warning-soft)] text-[color:var(--sn-warning)]"
      />
      <StatCell
        label="Resolved · vendor"
        value={stats.resolved_for_vendor}
        tone="bg-[var(--sn-success-soft)] text-[color:var(--sn-success)]"
      />
      <StatCell
        label="Resolved · couple"
        value={stats.resolved_for_couple}
        tone="bg-[var(--sn-info-soft)] text-[color:var(--sn-info)]"
      />
      <StatCell
        label="Withdrawn"
        value={stats.withdrawn}
        tone="bg-ink/10 text-ink/60"
      />
      <p className="col-span-2 mt-1 text-[11px] text-[color:var(--sn-ink-400)] sm:col-span-4">
        Counts for {quarterLabel} (current quarter).
      </p>
    </section>
  );
}

function StatCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span
        className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${tone}`}
      >
        {label}
      </span>
      <span className="font-mono text-2xl font-semibold tracking-tight tabular-nums text-[color:var(--sn-ink-900)]">
        {value}
      </span>
    </div>
  );
}

function FilterStrip({
  status,
  category,
}: {
  status: StatusFilter;
  category: CategoryFilter;
}) {
  return (
    <form
      method="get"
      className="sn-tile flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3"
      aria-label="Dispute filters"
    >
      <div className="flex items-center gap-2 text-ink/60">
        <Filter aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        <span className="font-mono text-[10px] uppercase tracking-[0.15em]">Filter</span>
      </div>
      <label className="flex flex-1 flex-col gap-1 text-xs text-ink/60 sm:flex-row sm:items-center sm:gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.15em]">Status</span>
        <select
          name="status"
          defaultValue={status}
          className="input-field min-w-[12rem]"
        >
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-1 flex-col gap-1 text-xs text-ink/60 sm:flex-row sm:items-center sm:gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.15em]">Category</span>
        <select
          name="category"
          defaultValue={category}
          className="input-field min-w-[12rem]"
        >
          {CATEGORY_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="button-secondary self-start sm:self-auto">
        Apply
      </button>
    </form>
  );
}

function DisputesTable({
  rows,
  vendorMap,
  vendorTierMap,
  openerMap,
  policyAcksByVendor,
  handoversByVendor,
}: {
  rows: DisputeRow[];
  vendorMap: Map<string, string>;
  vendorTierMap: Map<string, VendorTier>;
  openerMap: Map<string, { name: string; email: string | null }>;
  policyAcksByVendor: Map<string, PolicyAcknowledgement[]>;
  handoversByVendor: Map<string, HandoverEvidenceRow[]>;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-ink/15 bg-white/50 p-8 text-center">
        <p className="text-sm text-[color:var(--sn-ink-500)]">
          No disputes yet — vendors and couples can both open one when a
          booking goes sideways.
        </p>
      </div>
    );
  }

  return (
    <div className="sn-tile overflow-x-auto !p-0">
      <table className="w-full text-left text-sm">
        <thead className="bg-ink/[0.03] text-[11px] uppercase tracking-[0.12em] text-ink/55">
          <tr>
            <th className="px-3 py-3 font-medium">Dispute</th>
            <th className="px-3 py-3 font-medium">Vendor</th>
            <th className="hidden px-3 py-3 font-medium md:table-cell">Opened by</th>
            <th className="px-3 py-3 font-medium">Category</th>
            <th className="hidden px-3 py-3 font-medium lg:table-cell">Description</th>
            <th className="px-3 py-3 font-medium">Status</th>
            <th className="hidden px-3 py-3 font-medium md:table-cell">Opened</th>
            <th className="px-3 py-3 font-medium">Resolve</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const vendorName = vendorMap.get(r.vendor_profile_id) ?? 'Unnamed vendor';
            const vendorTier = vendorTierMap.get(r.vendor_profile_id) ?? 'free';
            const opener = r.opened_by_user_id
              ? openerMap.get(r.opened_by_user_id)
              : null;
            const descPreview = truncate(r.description, 80);
            // No-Show Downpayment Protection — frozen reservation-policy evidence
            // for this vendor. Surfaced under the description so support can
            // adjudicate a forfeit against immutable, acknowledged-at-lock terms.
            const acks = policyAcksByVendor.get(r.vendor_profile_id) ?? [];
            const handovers = handoversByVendor.get(r.vendor_profile_id) ?? [];
            return (
              <tr
                key={r.dispute_id}
                className="border-t border-ink/5 hover:bg-terracotta/[0.04]"
              >
                <td className="px-3 py-3">
                  <p className="font-mono text-[11px] font-medium text-ink">
                    {r.public_id}
                  </p>
                  {!r.counts_toward_demotion ? (
                    <p className="mt-1 text-[10px] uppercase tracking-[0.15em] text-ink/45">
                      Excluded from demotion count
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-3 font-medium text-ink">
                  <span className="block">{vendorName}</span>
                  <TierChip tier={vendorTier} />
                </td>
                <td className="hidden px-3 py-3 md:table-cell">
                  {opener ? (
                    <>
                      <p className="text-ink">{opener.name}</p>
                      {opener.email && opener.email !== opener.name ? (
                        <p className="text-xs text-ink/55">{opener.email}</p>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-ink/45">—</span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <span className="inline-flex items-center rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/70">
                    {CATEGORY_LABEL[r.category]}
                  </span>
                </td>
                <td className="hidden px-3 py-3 text-ink/80 lg:table-cell">
                  <p title={r.description}>{descPreview}</p>
                  {r.vendor_contest ? (
                    <details className="mt-2">
                      <summary className="inline-flex cursor-pointer select-none items-center gap-1 text-[11px] font-medium text-terracotta">
                        <Gavel aria-hidden className="h-3 w-3" strokeWidth={2} />
                        Vendor&apos;s response
                      </summary>
                      <p className="mt-1.5 whitespace-pre-wrap rounded-lg border border-terracotta/20 bg-terracotta/[0.04] p-2.5 text-[11px] text-ink/80">
                        {r.vendor_contest}
                      </p>
                    </details>
                  ) : null}
                  {acks.length > 0 ? (
                    <details className="mt-2">
                      <summary className="inline-flex cursor-pointer select-none items-center gap-1 text-[11px] font-medium text-terracotta">
                        <ShieldCheck aria-hidden className="h-3 w-3" strokeWidth={2} />
                        Reservation policy evidence ({acks.length})
                      </summary>
                      <ul className="mt-2 space-y-2">
                        {acks.map((a) => (
                          <PolicyEvidence key={a.ackId} ack={a} />
                        ))}
                      </ul>
                    </details>
                  ) : null}
                  {handovers.length > 0 ? (
                    <details className="mt-2">
                      <summary className="inline-flex cursor-pointer select-none items-center gap-1 text-[11px] font-medium text-terracotta">
                        <PackageCheck aria-hidden className="h-3 w-3" strokeWidth={2} />
                        Delivery handover ({handovers.length})
                      </summary>
                      <ul className="mt-2 space-y-2">
                        {handovers.map((h) => (
                          <HandoverEvidence key={h.handoverId} handover={h} />
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </td>
                <td className="px-3 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${STATUS_TONE[r.status]}`}
                  >
                    {STATUS_LABEL[r.status]}
                  </span>
                </td>
                <td className="hidden px-3 py-3 text-xs text-ink/60 md:table-cell">
                  <span title={r.created_at}>{relativeTime(r.created_at)}</span>
                </td>
                <td className="px-3 py-3 align-top">
                  {r.status === 'open' ? (
                    <details className="min-w-[12rem]">
                      <summary className="cursor-pointer select-none text-xs font-medium text-terracotta">
                        Resolve
                      </summary>
                      <ConfirmForm
                        action={resolveDispute}
                        title="Apply this resolution?"
                        confirmLabel="Apply resolution"
                        message="This adjudicates the dispute — the decision is final, is recorded in the audit log, and notifies whoever opened it. It binds their next step (e.g. the agreed refund, reschedule, or substitute)."
                        className="mt-2 space-y-2"
                      >
                        <input type="hidden" name="dispute_id" value={r.dispute_id} />
                        <select
                          name="resolution"
                          defaultValue=""
                          required
                          className="input-field text-xs"
                          aria-label="Resolution outcome"
                        >
                          <option value="" disabled>
                            Choose outcome…
                          </option>
                          <option value="resolved_for_couple">Resolved · couple</option>
                          <option value="resolved_for_vendor">Resolved · vendor</option>
                          <option value="withdrawn">Withdrawn</option>
                        </select>
                        <textarea
                          name="resolution_notes"
                          rows={2}
                          placeholder="Decision + rationale (required unless withdrawn)"
                          className="input-field text-xs"
                          aria-label="Resolution notes"
                        />
                        <SubmitButton pendingLabel="Applying…" className="button-secondary text-xs">
                          Apply resolution
                        </SubmitButton>
                      </ConfirmForm>
                    </details>
                  ) : (
                    <span
                      className="text-xs text-ink/45"
                      title={r.resolution_notes ?? undefined}
                    >
                      {r.resolved_at ? relativeTime(r.resolved_at) : '—'}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * No-Show Downpayment Protection — one frozen reservation-policy acknowledgement
 * rendered as immutable forfeit evidence in the admin dispute view. Shows the
 * EXACT terms the couple acknowledged at lock + when, so support adjudicates a
 * forfeit against the snapshot, not the (editable) live vendor template.
 */
function PolicyEvidence({ ack }: { ack: PolicyAcknowledgement }) {
  const p = ack.snapshot;
  const acknowledgedAt = (() => {
    const d = new Date(ack.acknowledgedAt);
    return Number.isNaN(d.getTime())
      ? ack.acknowledgedAt
      : d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
  })();
  const amountLabel =
    p?.downpayment_amount_php != null
      ? `₱${Math.round(p.downpayment_amount_php).toLocaleString('en-PH')}`
      : null;
  return (
    <li className="rounded-lg border border-terracotta/20 bg-terracotta/[0.04] p-2.5 text-[11px] text-ink/80">
      <p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-terracotta-700">
        Acknowledged {acknowledgedAt}
      </p>
      <ul className="mt-1 space-y-0.5">
        {p?.downpayment_non_refundable ? (
          <li>
            • Downpayment{amountLabel ? ` (${amountLabel})` : ''} non-refundable
          </li>
        ) : null}
        {p?.no_show_forfeit ? <li>• No-show forfeits the downpayment</li> : null}
        {p?.refund_window_days != null ? (
          <li>• Refundable within {p.refund_window_days} day{p.refund_window_days === 1 ? '' : 's'} of booking</li>
        ) : null}
      </ul>
      {p?.cancellation_terms ? (
        <p className="mt-1 whitespace-pre-wrap border-t border-terracotta/15 pt-1 text-ink/65">
          “{p.cancellation_terms}”
        </p>
      ) : null}
    </li>
  );
}

/**
 * Delivery Handover — one vendor handover rendered as delivery/acknowledgement
 * evidence in the admin dispute view. Shows what was delivered, when, and
 * whether the couple confirmed receipt — so support sees the "did they deliver,
 * did the couple confirm?" trail when adjudicating a quality/no-show dispute.
 */
function HandoverEvidence({ handover }: { handover: HandoverEvidenceRow }) {
  const kindLabel =
    handover.kind === 'gallery_link'
      ? 'Gallery link'
      : handover.kind === 'file'
        ? 'Sample / proof'
        : handover.kind === 'note'
          ? 'Note'
          : 'All delivered';
  const deliveredAt = fmtPhDate(handover.deliveredAt);
  const ackedAt = fmtPhDate(handover.coupleAcknowledgedAt);
  return (
    <li className="rounded-lg border border-terracotta/20 bg-terracotta/[0.04] p-2.5 text-[11px] text-ink/80">
      <p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-terracotta-700">
        {kindLabel} · delivered {deliveredAt}
      </p>
      {handover.label ? <p className="mt-0.5 text-ink/70">{handover.label}</p> : null}
      <p className="mt-1">
        {handover.status === 'acknowledged' && ackedAt
          ? `Couple confirmed receipt ${ackedAt}.`
          : handover.status === 'disputed'
            ? 'Marked disputed.'
            : 'Awaiting couple confirmation.'}
      </p>
      {handover.kind === 'gallery_link' && handover.payload ? (
        <a
          href={handover.payload}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-0.5 inline-block text-terracotta underline"
        >
          open link
        </a>
      ) : null}
    </li>
  );
}

/**
 * Priority-dispute sort — a compact tier badge under the vendor name so an admin
 * can see at a glance which tier a disputed vendor is on (the queue is ordered
 * enterprise → free, so premium disputes surface first). Tones step up with tier
 * priority; label copy reuses the canonical TIER_LABEL map.
 */
// Glass PR-8 — tones step up with tier priority; violet (enterprise/custom) is
// retired to info-slate (--sn-info, the canonical violet replacement), custom
// being the strongest step (solid slate).
const TIER_CHIP_TONE: Record<VendorTier, string> = {
  enterprise: 'bg-[var(--sn-info-soft)] text-[color:var(--sn-info)]',
  custom: 'bg-[color:var(--sn-info)] text-white',
  pro: 'bg-[var(--sn-success-soft)] text-[color:var(--sn-success)]',
  solo: 'bg-[var(--sn-warning-soft)] text-[color:var(--sn-warning)]',
  verified: 'bg-ink/10 text-ink/70',
  free: 'bg-ink/5 text-ink/55',
};

function TierChip({ tier }: { tier: VendorTier }) {
  return (
    <span
      className={`mt-1 inline-flex w-fit items-center rounded-full px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.15em] ${TIER_CHIP_TONE[tier]}`}
      title={`Vendor tier · ${TIER_LABEL[tier]}`}
    >
      {TIER_LABEL[tier]}
    </span>
  );
}

function fmtPhDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── Helpers ────────────────────────────────────────────────────────────────

function normalizeStatusFilter(raw: string): StatusFilter {
  switch (raw) {
    case 'all':
    case 'open':
    case 'resolved_for_vendor':
    case 'resolved_for_couple':
    case 'withdrawn':
      return raw;
    default:
      // Stale or malformed `?status=` values fall back to the default landing
      // view (`open`) rather than rejecting — admin URLs get shared around
      // and a friendly fallback beats a hard error.
      return 'open';
  }
}

function normalizeCategoryFilter(raw: string): CategoryFilter {
  switch (raw) {
    case 'all':
    case 'no_show':
    case 'late_arrival':
    case 'quality_issue':
    case 'communication':
    case 'refund_request':
    case 'other':
      return raw;
    default:
      return 'all';
  }
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  // Trim on a space boundary when possible — avoids ugly mid-word cuts on
  // single-line previews.
  const slice = text.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  return (lastSpace > max - 20 ? slice.slice(0, lastSpace) : slice) + '…';
}

function currentQuarterStart(now = new Date()): Date {
  const month = now.getMonth();
  const quarterStartMonth = month - (month % 3);
  return new Date(now.getFullYear(), quarterStartMonth, 1, 0, 0, 0, 0);
}
