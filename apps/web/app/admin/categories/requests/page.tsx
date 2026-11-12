import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { requireAdmin } from '@/lib/admin/require-admin';
import { PageMasthead } from '@/app/_components/page-masthead';
import {
  ADMIN_SERVICE_REQUESTS_HREF,
  isRequestStatus,
  sameNameKey,
  type RequestStatus,
} from '@/lib/service-requests';
import { loadRequestTree } from '@/lib/service-requests.server';
import { AdminStatusPill } from './_components/admin-request-bits';

export const metadata = { title: 'Service requests · Admin' };

type Row = {
  request_id: string;
  proposed_label: string;
  proposed_by_vendor_id: string;
  tile_id: string | null;
  status: RequestStatus;
  created_at: string;
  reviewed_at: string | null;
};

const dateFmt = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });

/**
 * /admin/categories/requests — "Service requests" (owner rulings 2026-11-13, ruling 5).
 *
 * What suppliers asked us to add. Pending first (one row per NAME: "n shops" when several shops asked
 * for the same one — a decision moves them all), then Decided. Extends the shipped
 * `/admin/categories?show=requests` list into a page of its own; the Decision is one dropdown on the
 * request's page.
 *
 * 🔑 Loading (loading.tsx), empty ("No requests waiting") and a refused read ("Couldn't load
 * requests · Try again") never look alike — a refused read is never drawn as "none".
 */
export default async function ServiceRequestsAdminPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const admin = createAdminClient();
  const [reqRes, tree] = await Promise.all([
    admin
      .from('taxonomy_category_requests')
      .select('request_id, proposed_label, proposed_by_vendor_id, tile_id, status, created_at, reviewed_at')
      .order('created_at', { ascending: false })
      .limit(500),
    loadRequestTree(),
  ]);
  if (reqRes.error) logQueryError('ServiceRequestsAdminPage (taxonomy_category_requests)', reqRes.error);
  const rows = reqRes.error ? null : ((reqRes.data ?? []) as Array<Row & { status: string }>).filter((r) => isRequestStatus(r.status)) as Row[];

  let shopName = new Map<string, string>();
  if (rows && rows.length > 0) {
    const ids = [...new Set(rows.map((r) => r.proposed_by_vendor_id))];
    const { data, error } = await admin.from('vendor_profiles').select('vendor_profile_id, business_name').in('vendor_profile_id', ids);
    if (error) logQueryError('ServiceRequestsAdminPage (vendor_profiles)', error);
    shopName = new Map(((data ?? []) as Array<{ vendor_profile_id: string; business_name: string | null }>).map((v) => [v.vendor_profile_id, v.business_name ?? 'a shop']));
  }
  const nameOf = (id: string) => shopName.get(id) ?? 'a shop';
  const categoryOf = (tile: string | null) => (tile ? tree?.categoryLabel.get(tile) ?? 'A retired category' : 'No category picked');

  // Pending: one row per same name, oldest request first inside it (that is the one opened).
  const pendingGroups = new Map<string, Row[]>();
  for (const r of rows ?? []) {
    if (r.status !== 'pending') continue;
    const k = sameNameKey(r.proposed_label);
    pendingGroups.set(k, [...(pendingGroups.get(k) ?? []), r]);
  }
  const pending = [...pendingGroups.values()].map((g) => [...g].sort((a, b) => (a.created_at < b.created_at ? -1 : 1)));
  const decided = (rows ?? []).filter((r) => r.status !== 'pending');

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6" data-admin-service-requests="">
      <p className="sn-eye">
        <Link href="/admin/categories" className="underline-offset-2 hover:underline">
          Admin › Categories
        </Link>
      </p>
      <PageMasthead title="Service requests" />
      <p className="-mt-2 mb-4 max-w-prose text-sm text-ink/65">
        What suppliers asked us to add. Pending first. A count shows how many shops asked for the same name.
      </p>
      {sp.ok ? (
        <p role="status" className="mb-4 rounded-xl bg-success-50 px-4 py-3 text-sm text-success-800">
          ✓ {sp.ok}
        </p>
      ) : null}

      {rows === null ? (
        <div role="alert" className="rounded-2xl bg-danger-50 p-4 text-sm text-danger-800" data-requests-failed="">
          <p className="font-semibold">⚠ Couldn&rsquo;t load requests</p>
          <p className="mt-1">The list did not come back. Nothing here is “none” — the requests are still in the queue.</p>
          <Link
            href={ADMIN_SERVICE_REQUESTS_HREF}
            className="mt-3 inline-flex min-h-11 items-center rounded-full border border-danger-300 px-5 font-semibold text-danger-800"
          >
            Try again
          </Link>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl bg-ink/[0.03] p-8 text-center text-sm text-ink/60" data-requests-empty="">
          <p className="font-medium text-ink/75">✓ No requests waiting.</p>
          <p className="mt-1">When a supplier can&rsquo;t find their service and names it, it lands here.</p>
        </div>
      ) : (
        <ul className="divide-y divide-ink/10 overflow-hidden rounded-2xl bg-white shadow-sm">
          <li className="bg-ink/[0.03] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/60">
            Pending · {pending.length}
          </li>
          {pending.length === 0 ? <li className="px-4 py-3 text-sm text-ink/60">Nothing waiting on you.</li> : null}
          {pending.map((g) => {
            const first = g[0]!;
            const shops = new Set(g.map((r) => r.proposed_by_vendor_id)).size;
            return (
              <AdminRow
                key={first.request_id}
                r={first}
                shops={shops}
                sub={`${categoryOf(first.tile_id)} · ${shops > 1 ? `${nameOf(first.proposed_by_vendor_id)} +${shops - 1}` : nameOf(first.proposed_by_vendor_id)} · ${dateFmt.format(new Date(first.created_at))}`}
              />
            );
          })}
          {decided.length > 0 ? (
            <li className="bg-ink/[0.03] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/60">
              Decided · {decided.length}
            </li>
          ) : null}
          {decided.map((r) => (
            <AdminRow
              key={r.request_id}
              r={r}
              shops={1}
              sub={`${categoryOf(r.tile_id)} · ${nameOf(r.proposed_by_vendor_id)} · ${dateFmt.format(new Date(r.reviewed_at ?? r.created_at))}`}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function AdminRow({ r, shops, sub }: { r: Row; shops: number; sub: string }) {
  return (
    <li>
      <Link
        href={`${ADMIN_SERVICE_REQUESTS_HREF}/${r.request_id}`}
        className="flex min-h-12 items-center gap-3 px-4 py-3 hover:bg-ink/[0.03]"
        data-admin-request-row=""
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2 text-[15px] font-medium text-ink">
            “{r.proposed_label}”
            {shops > 1 ? (
              <span className="rounded-full bg-terracotta/10 px-2 py-0.5 text-[11px] font-semibold text-terracotta-700">{shops} shops</span>
            ) : null}
          </span>
          <span className="block truncate text-[12.5px] text-ink/60">{sub}</span>
        </span>
        <AdminStatusPill status={r.status} />
        <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-terracotta-700" strokeWidth={1.75} />
      </Link>
    </li>
  );
}
