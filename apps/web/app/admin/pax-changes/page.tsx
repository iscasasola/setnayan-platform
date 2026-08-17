import { TrendingUp } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { relativeTime } from '@/lib/activity';
import { PageMasthead } from '@/app/_components/page-masthead';
import { ConsoleTable } from '@/app/admin/_components/console-table';

import { requireAdmin } from '@/lib/admin/require-admin';
export const metadata = { title: 'Pax changes · Admin' };

/**
 * /admin/pax-changes — HQ trail of pax-driven vendor cost changes (Adaptive Pax
 * Pricing Phase 6). Read-only list of `public.pax_change_audit`: every time a
 * vendor Accept/Declines a surcharge after the couple's guest count moved a
 * booked cost, a row lands here. Lets a mediator answer "why did this vendor's
 * cost jump?" during a dispute (the architect-mandate admin surface).
 *
 * Read-only by design — the parties act on their own surfaces; HQ only observes.
 * Auth is enforced at the layout level (`app/admin/layout.tsx` → notFound() for
 * non-admins); the table's RLS is admin-read only and this page uses the admin
 * client.
 *
 * ⚠ IT NO LONGER "GRACEFUL-DEGRADES TO AN EMPTY STATE" — that line used to sit
 * here and describe a defect as a feature. A rejected read (unapplied
 * migration, phantom column, stale enum) resolves as `{ error }` with `data:
 * null`, and `data ?? []` turned that into "No pax-driven cost changes yet."
 * shown to a mediator asking why a vendor's cost jumped, mid-dispute. The read
 * error now reaches `ConsoleTable`, which reports it instead of counting it as
 * zero. Corrected 2026-08-17.
 */

type AuditRow = {
  audit_id: number;
  event_id: string;
  vendor_profile_id: string | null;
  action: 'accept' | 'decline';
  live_pax: number | null;
  quote_base_pax: number | null;
  prev_pax: number | null;
  rate_php: number | null;
  prev_surcharge_php: number | null;
  new_surcharge_php: number | null;
  prev_total_php: number | null;
  new_total_php: number | null;
  created_at: string;
};

const peso = (n: number | null) =>
  n == null ? '—' : `₱${Math.round(n).toLocaleString('en-PH')}`;

/** Passed to ConsoleTable as `cap` so a full page says so instead of implying it is the whole trail. */
const ROW_LIMIT = 200;

export default async function AdminPaxChangesPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('pax_change_audit')
    .select(
      'audit_id, event_id, vendor_profile_id, action, live_pax, quote_base_pax, prev_pax, rate_php, prev_surcharge_php, new_surcharge_php, prev_total_php, new_total_php, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(ROW_LIMIT);
  if (error) {
    logQueryError('AdminPaxChangesPage', error, {}, 'graceful_degrade');
  }
  // NULL, not []: a refused read must stay distinguishable from a real zero all
  // the way to the render. `?? []` here is what printed "no changes yet" over a
  // broken query.
  const rows = data as AuditRow[] | null;

  // Resolve vendor + event display labels in two batched reads.
  const listed = rows ?? [];
  const vendorIds = Array.from(
    new Set(listed.map((r) => r.vendor_profile_id).filter((v): v is string => !!v)),
  );
  const eventIds = Array.from(new Set(listed.map((r) => r.event_id)));
  const vendorName = new Map<string, string>();
  const eventName = new Map<string, string>();
  if (vendorIds.length > 0) {
    const { data: vs } = await admin
      .from('vendor_profiles')
      .select('vendor_profile_id, business_name')
      .in('vendor_profile_id', vendorIds);
    for (const v of vs ?? []) vendorName.set(v.vendor_profile_id, v.business_name ?? '—');
  }
  if (eventIds.length > 0) {
    const { data: es } = await admin
      .from('events')
      .select('event_id, display_name')
      .in('event_id', eventIds);
    for (const e of es ?? []) eventName.set(e.event_id, e.display_name ?? '—');
  }

  return (
    <section className="space-y-6">
      <PageMasthead
        title="Pax-driven cost changes"
        lede="Every vendor Accept/Decline of a guest-count surcharge. Read-only — for dispute mediation."
      />

      <ConsoleTable
        rows={rows}
        readPermitted
        readError={error}
        reads="the pax-change trail"
        cap={ROW_LIMIT}
        label="Pax-driven cost changes"
        minWidth="47.5rem"
        note="Read-only. The couple and the vendor each act on their own screen; HQ only observes, so there is deliberately nothing to press here."
        rowKey={(r) => String(r.audit_id)}
        empty={{
          Icon: TrendingUp,
          title: 'No pax-driven cost changes yet',
          blurb:
            'A row lands here the moment a vendor accepts or holds a surcharge after the couple’s guest count moved a booked cost. Nothing to do — it fills itself.',
        }}
        columns={[
          {
            header: 'When',
            mono: true,
            cell: (r) => relativeTime(r.created_at),
          },
          {
            header: 'Vendor · Event',
            cell: (r) => (
              <>
                <div className="font-medium text-ink">
                  {r.vendor_profile_id ? vendorName.get(r.vendor_profile_id) ?? '—' : '—'}
                </div>
                <div className="text-xs text-ink/70">{eventName.get(r.event_id) ?? '—'}</div>
              </>
            ),
          },
          {
            header: 'Action',
            cell: (r) => (
              <span
                className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
                  r.action === 'accept'
                    ? 'bg-success-100 text-success-800'
                    : 'bg-ink/10 text-ink/70'
                }`}
              >
                {r.action === 'accept' ? 'Accepted' : 'Held price'}
              </span>
            ),
          },
          {
            header: 'Guests',
            hideBelow: 'md',
            cell: (r) => (
              <span className="whitespace-nowrap text-ink/70">
                {r.prev_pax ?? '—'} →{' '}
                <span className="font-semibold text-ink">{r.live_pax ?? '—'}</span>
                <span className="text-xs text-ink/70"> (quoted {r.quote_base_pax ?? '—'})</span>
              </span>
            ),
          },
          {
            header: 'Surcharge',
            hideBelow: 'lg',
            mono: true,
            cell: (r) => (
              <span className="whitespace-nowrap text-ink/70">
                {peso(r.prev_surcharge_php)} → {peso(r.new_surcharge_php)}
              </span>
            ),
          },
          {
            header: 'Total',
            mono: true,
            align: 'right',
            cell: (r) => (
              <span className="whitespace-nowrap text-ink/70">
                {peso(r.prev_total_php)} →{' '}
                <span className="font-semibold text-ink">{peso(r.new_total_php)}</span>
              </span>
            ),
          },
        ]}
      />
    </section>
  );
}
