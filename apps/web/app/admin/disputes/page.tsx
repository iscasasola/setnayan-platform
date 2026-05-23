import { Gavel, Filter } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { relativeTime } from '@/lib/activity';

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

const STATUS_TONE: Record<DisputeRow['status'], string> = {
  open: 'bg-amber-100 text-amber-900',
  resolved_for_vendor: 'bg-emerald-100 text-emerald-800',
  resolved_for_couple: 'bg-violet-100 text-violet-800',
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
      'dispute_id,public_id,vendor_profile_id,payout_id,order_id,opened_by_user_id,category,description,status,resolved_at,resolution_notes,counts_toward_demotion,created_at',
    )
    .order('created_at', { ascending: false })
    .limit(200);
  if (status !== 'all') listQuery = listQuery.eq('status', status);
  if (category !== 'all') listQuery = listQuery.eq('category', category);
  const { data: listData, error: listError } = await listQuery;
  const rows = (listData ?? []) as DisputeRow[];

  // Resolution lookups — one round-trip per FK table, keyed on the
  // unique-IDs in the visible page. The same shape `/admin/reviews` uses.
  const vendorIds = Array.from(
    new Set(rows.map((r) => r.vendor_profile_id).filter(Boolean)),
  );
  const openerIds = Array.from(
    new Set(rows.map((r) => r.opened_by_user_id).filter((v): v is string => Boolean(v))),
  );

  const vendorMap = new Map<string, string>();
  if (vendorIds.length > 0) {
    const { data } = await admin
      .from('vendor_profiles')
      .select('vendor_profile_id, business_name')
      .in('vendor_profile_id', vendorIds);
    for (const v of data ?? []) {
      vendorMap.set(
        v.vendor_profile_id as string,
        ((v.business_name as string | null) ?? '').trim() || 'Unnamed vendor',
      );
    }
  }

  const openerMap = new Map<string, { name: string; email: string | null }>();
  if (openerIds.length > 0) {
    const { data } = await admin
      .from('users')
      .select('user_id, display_name, email')
      .in('user_id', openerIds);
    for (const u of data ?? []) {
      const display = ((u.display_name as string | null) ?? '').trim();
      const email = ((u.email as string | null) ?? '').trim() || null;
      openerMap.set(u.user_id as string, {
        name: display || email || 'Unknown',
        email,
      });
    }
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
        <div className="flex items-center gap-2">
          <Gavel className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          <h1 className="text-2xl font-semibold tracking-tight">Disputes</h1>
        </div>
        <p className="text-sm text-ink/65">
          Couples and vendors can both open a dispute when a booking goes
          sideways. The queue shows the latest 200 matching the filters below,
          newest first.
        </p>
        <p className="rounded-md border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-xs text-amber-900">
          <span className="font-semibold">Read-only V1.</span> Detail view +
          resolve actions are coming with the next refresh. Until then, update
          a row directly in Supabase Studio if a resolution call has been made
          off-platform.
        </p>
      </header>

      <StatsBanner stats={stats} quarterStart={quarterStart} />

      <FilterStrip status={status} category={category} />

      {listError ? (
        <p
          role="alert"
          className="mt-4 rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          Could not load disputes: {listError.message}
        </p>
      ) : null}

      <div className="mt-4">
        <DisputesTable rows={rows} vendorMap={vendorMap} openerMap={openerMap} />
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
      className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-ink/10 bg-cream p-4 sm:grid-cols-4"
    >
      <StatCell label="Open" value={stats.open} tone="bg-amber-100 text-amber-900" />
      <StatCell
        label="Resolved · vendor"
        value={stats.resolved_for_vendor}
        tone="bg-emerald-100 text-emerald-800"
      />
      <StatCell
        label="Resolved · couple"
        value={stats.resolved_for_couple}
        tone="bg-violet-100 text-violet-800"
      />
      <StatCell
        label="Withdrawn"
        value={stats.withdrawn}
        tone="bg-ink/10 text-ink/60"
      />
      <p className="col-span-2 mt-1 text-[11px] text-ink/55 sm:col-span-4">
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
      <span className="text-2xl font-semibold tracking-tight text-ink">{value}</span>
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
      className="flex flex-col gap-3 rounded-xl border border-ink/10 bg-cream p-3 sm:flex-row sm:items-center sm:gap-3"
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
  openerMap,
}: {
  rows: DisputeRow[];
  vendorMap: Map<string, string>;
  openerMap: Map<string, { name: string; email: string | null }>;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-ink/15 bg-cream p-8 text-center">
        <p className="text-sm text-ink/65">
          No disputes yet — vendors and couples can both open one when a
          booking goes sideways.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-ink/10 bg-cream">
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
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const vendorName = vendorMap.get(r.vendor_profile_id) ?? 'Unnamed vendor';
            const opener = r.opened_by_user_id
              ? openerMap.get(r.opened_by_user_id)
              : null;
            const descPreview = truncate(r.description, 80);
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
                <td className="px-3 py-3 font-medium text-ink">{vendorName}</td>
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
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
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
