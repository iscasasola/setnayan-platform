import { TrendingUp } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { relativeTime } from '@/lib/activity';

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
 * client. Graceful-degrades to an empty state if the migration isn't applied.
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

export default async function AdminPaxChangesPage() {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('pax_change_audit')
    .select(
      'audit_id, event_id, vendor_profile_id, action, live_pax, quote_base_pax, prev_pax, rate_php, prev_surcharge_php, new_surcharge_php, prev_total_php, new_total_php, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    logQueryError('AdminPaxChangesPage', error, {}, 'graceful_degrade');
  }
  const rows = (data ?? []) as AuditRow[];

  // Resolve vendor + event display labels in two batched reads.
  const vendorIds = Array.from(
    new Set(rows.map((r) => r.vendor_profile_id).filter((v): v is string => !!v)),
  );
  const eventIds = Array.from(new Set(rows.map((r) => r.event_id)));
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
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
            Adaptive pax pricing
          </p>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <TrendingUp className="h-6 w-6 text-terracotta" strokeWidth={1.75} aria-hidden />
            Pax-driven cost changes
          </h1>
          <p className="mt-1 text-sm text-ink/60">
            Every vendor Accept/Decline of a guest-count surcharge. Read-only — for
            dispute mediation.
          </p>
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink/15 bg-cream p-8 text-center text-ink/60">
          No pax-driven cost changes yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink/10">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-ink/[0.03] text-left font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
              <tr>
                <th className="px-3 py-2.5">When</th>
                <th className="px-3 py-2.5">Vendor · Event</th>
                <th className="px-3 py-2.5">Action</th>
                <th className="px-3 py-2.5">Guests</th>
                <th className="px-3 py-2.5">Surcharge</th>
                <th className="px-3 py-2.5">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/8">
              {rows.map((r) => (
                <tr key={r.audit_id} className="align-top">
                  <td className="whitespace-nowrap px-3 py-2.5 text-ink/60">
                    {relativeTime(r.created_at)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-ink">
                      {r.vendor_profile_id ? vendorName.get(r.vendor_profile_id) ?? '—' : '—'}
                    </div>
                    <div className="text-xs text-ink/55">
                      {eventName.get(r.event_id) ?? '—'}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.action === 'accept'
                          ? 'bg-success-100 text-success-800'
                          : 'bg-ink/10 text-ink/70'
                      }`}
                    >
                      {r.action === 'accept' ? 'Accepted' : 'Held price'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-ink/70">
                    {r.prev_pax ?? '—'} → <span className="font-semibold text-ink">{r.live_pax ?? '—'}</span>
                    <span className="text-xs text-ink/45"> (quoted {r.quote_base_pax ?? '—'})</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-ink/70">
                    {peso(r.prev_surcharge_php)} → {peso(r.new_surcharge_php)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-ink/70">
                    {peso(r.prev_total_php)} → <span className="font-semibold text-ink">{peso(r.new_total_php)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
