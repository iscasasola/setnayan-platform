import { redirect } from 'next/navigation';
import { Plus, Trash2, Mail, Phone } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import {
  SERVICE_GROUPS,
  VENDOR_CATEGORY_LABEL,
  VENDOR_STATUSES,
  VENDOR_STATUS_LABEL,
  VENDOR_STATUS_TONE,
  computeVendorStats,
  fetchEventVendors,
  formatPhp,
  type EventVendorRow,
  type VendorStatus,
} from '@/lib/vendors';
import { SubmitButton } from '@/app/_components/submit-button';
import { createVendor, deleteVendor, updateVendorStatus } from './actions';

export const metadata = { title: 'Vendors' };

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ status?: string }>;
};

export default async function VendorsPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const vendors = await fetchEventVendors(supabase, eventId);
  const stats = computeVendorStats(vendors);

  const activeFilter = (search.status ?? 'all') as 'all' | VendorStatus;
  const visible =
    activeFilter === 'all' ? vendors : vendors.filter((v) => v.status === activeFilter);

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Vendors</h1>
        <p className="max-w-prose text-base text-ink/65">
          Track every vendor through the 6-stage readiness flow: considering → shortlisted →
          contracted → deposit paid → delivered → complete. Costs are in PHP.
        </p>
      </header>

      <StatsStrip stats={stats} />

      <AddVendorForm eventId={eventId} />

      <StatusFilters eventId={eventId} active={activeFilter} stats={stats} />

      {visible.length === 0 ? (
        <EmptyVendors filtered={activeFilter !== 'all'} />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {visible.map((v) => (
            <VendorCard key={v.vendor_id} eventId={eventId} vendor={v} />
          ))}
        </ul>
      )}
    </section>
  );
}

function StatsStrip({
  stats,
}: {
  stats: { count: number; totalCost: number; depositPaid: number; remaining: number };
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatTile label="Vendors" value={String(stats.count)} />
      <StatTile label="Total cost" value={formatPhp(stats.totalCost)} />
      <StatTile label="Deposits paid" value={formatPhp(stats.depositPaid)} />
      <StatTile
        label="Remaining"
        value={formatPhp(stats.remaining)}
        tone={stats.remaining > 0 ? 'warn' : 'default'}
      />
    </ul>
  );
}

function StatTile({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'warn';
}) {
  return (
    <li className="rounded-xl border border-ink/10 bg-cream p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">{label}</p>
      <p
        className={`mt-1 text-xl font-semibold tracking-tight ${
          tone === 'warn' ? 'text-terracotta-700' : 'text-ink'
        }`}
      >
        {value}
      </p>
    </li>
  );
}

function AddVendorForm({ eventId }: { eventId: string }) {
  return (
    <details className="rounded-xl border border-ink/10 bg-cream">
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium">
        <Plus aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={2} />
        Add a vendor
      </summary>
      <form action={createVendor} className="space-y-4 border-t border-ink/10 p-4">
        <input type="hidden" name="event_id" value={eventId} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Vendor name" htmlFor="vendor_name">
            <input
              id="vendor_name"
              name="vendor_name"
              required
              maxLength={128}
              placeholder="e.g. Bistro Ramos"
              className="input-field"
            />
          </Field>
          <Field label="Category" htmlFor="category">
            <select
              id="category"
              name="category"
              defaultValue="catering"
              className="input-field"
            >
              {SERVICE_GROUPS.map((g) => (
                <optgroup key={g.key} label={g.label}>
                  {g.members.map((c) => (
                    <option key={c} value={c}>
                      {VENDOR_CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
          <Field label="Email" htmlFor="contact_email">
            <input
              id="contact_email"
              name="contact_email"
              type="email"
              className="input-field"
              placeholder="hello@vendor.ph"
            />
          </Field>
          <Field label="Phone" htmlFor="contact_phone">
            <input
              id="contact_phone"
              name="contact_phone"
              className="input-field"
              placeholder="+63 917 …"
            />
          </Field>
          <Field label="Total cost (PHP)" htmlFor="total_cost_php">
            <input
              id="total_cost_php"
              name="total_cost_php"
              type="number"
              min={0}
              step="0.01"
              className="input-field"
              placeholder="0"
            />
          </Field>
          <Field label="Deposit paid (PHP)" htmlFor="deposit_paid_php">
            <input
              id="deposit_paid_php"
              name="deposit_paid_php"
              type="number"
              min={0}
              step="0.01"
              className="input-field"
              placeholder="0"
            />
          </Field>
        </div>
        <Field label="Notes" htmlFor="notes">
          <textarea
            id="notes"
            name="notes"
            rows={3}
            className="input-field min-h-[80px] py-2"
            placeholder="Inclusions, follow-ups, contract dates…"
          />
        </Field>
        <SubmitButton className="button-primary" pendingLabel="Adding…">
          Add vendor
        </SubmitButton>
      </form>
    </details>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block space-y-1">
      <span className="block font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
        {label}
      </span>
      {children}
    </label>
  );
}

function StatusFilters({
  eventId,
  active,
  stats,
}: {
  eventId: string;
  active: 'all' | VendorStatus;
  stats: { count: number; byStatus: Partial<Record<VendorStatus, number>> };
}) {
  return (
    <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
      <FilterChip
        eventId={eventId}
        statusKey="all"
        label="All"
        count={stats.count}
        active={active === 'all'}
      />
      {VENDOR_STATUSES.map((s) => (
        <FilterChip
          key={s}
          eventId={eventId}
          statusKey={s}
          label={VENDOR_STATUS_LABEL[s]}
          count={stats.byStatus[s] ?? 0}
          active={active === s}
        />
      ))}
    </nav>
  );
}

function FilterChip({
  eventId,
  statusKey,
  label,
  count,
  active,
}: {
  eventId: string;
  statusKey: 'all' | VendorStatus;
  label: string;
  count: number;
  active: boolean;
}) {
  const href =
    statusKey === 'all'
      ? `/dashboard/${eventId}/vendors`
      : `/dashboard/${eventId}/vendors?status=${statusKey}`;
  return (
    <a
      href={href}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
        active ? 'bg-terracotta text-cream' : 'bg-ink/5 text-ink/70 hover:bg-ink/10'
      }`}
    >
      {label}
      <span
        className={`rounded-full px-1.5 text-[10px] ${
          active ? 'bg-cream/20 text-cream' : 'bg-ink/5 text-ink/55'
        }`}
      >
        {count}
      </span>
    </a>
  );
}

function EmptyVendors({ filtered }: { filtered: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-ink/20 bg-cream p-8 text-center text-sm text-ink/55">
      {filtered
        ? 'No vendors in this status. Switch filter to All to see everyone.'
        : 'No vendors yet — open the Add a vendor section above to track your first one.'}
    </div>
  );
}

function VendorCard({ eventId, vendor }: { eventId: string; vendor: EventVendorRow }) {
  const remaining =
    vendor.total_cost_php !== null
      ? Number(vendor.total_cost_php) - Number(vendor.deposit_paid_php ?? 0)
      : null;

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-ink/10 bg-cream p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-base font-semibold text-ink">{vendor.vendor_name}</p>
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
            {VENDOR_CATEGORY_LABEL[vendor.category]}
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${
            VENDOR_STATUS_TONE[vendor.status]
          }`}
        >
          {VENDOR_STATUS_LABEL[vendor.status]}
        </span>
      </div>

      {vendor.contact_email || vendor.contact_phone ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/65">
          {vendor.contact_email ? (
            <a
              href={`mailto:${vendor.contact_email}`}
              className="inline-flex items-center gap-1 hover:text-terracotta"
            >
              <Mail className="h-3.5 w-3.5" strokeWidth={1.75} />
              {vendor.contact_email}
            </a>
          ) : null}
          {vendor.contact_phone ? (
            <a
              href={`tel:${vendor.contact_phone.replace(/\s/g, '')}`}
              className="inline-flex items-center gap-1 hover:text-terracotta"
            >
              <Phone className="h-3.5 w-3.5" strokeWidth={1.75} />
              {vendor.contact_phone}
            </a>
          ) : null}
        </div>
      ) : null}

      {vendor.total_cost_php !== null ? (
        <dl className="grid grid-cols-3 gap-2 text-xs">
          <Money label="Total" value={formatPhp(vendor.total_cost_php)} />
          <Money
            label="Deposit"
            value={formatPhp(vendor.deposit_paid_php ?? 0)}
            tone="muted"
          />
          <Money
            label="Remaining"
            value={formatPhp(remaining ?? 0)}
            tone={remaining && remaining > 0 ? 'warn' : 'good'}
          />
        </dl>
      ) : null}

      {vendor.notes ? (
        <p className="rounded-md bg-ink/[0.03] p-2 text-xs text-ink/75">{vendor.notes}</p>
      ) : null}

      <div className="flex items-center justify-between gap-2 border-t border-ink/10 pt-3">
        <form action={updateVendorStatus} className="flex items-center gap-2">
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="vendor_id" value={vendor.vendor_id} />
          <label className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            Status
          </label>
          <select
            name="status"
            defaultValue={vendor.status}
            className="input-field h-9 py-0 text-xs"
          >
            {VENDOR_STATUSES.map((s) => (
              <option key={s} value={s}>
                {VENDOR_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <SubmitButton
            className="rounded-md bg-ink/[0.05] px-2 py-1 text-xs font-medium text-ink/70 hover:bg-ink/10 disabled:opacity-60"
            pendingLabel="…"
          >
            Update
          </SubmitButton>
        </form>
        <form action={deleteVendor}>
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="vendor_id" value={vendor.vendor_id} />
          <SubmitButton
            aria-label="Delete vendor"
            pendingLabel=""
            className="rounded-md p-1.5 text-ink/40 hover:bg-ink/5 hover:text-rose-700 disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
          </SubmitButton>
        </form>
      </div>
    </li>
  );
}

function Money({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'muted' | 'warn' | 'good';
}) {
  return (
    <div className="rounded-md bg-ink/[0.03] p-2">
      <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">{label}</dt>
      <dd
        className={`mt-0.5 text-sm font-semibold ${
          tone === 'warn'
            ? 'text-terracotta-700'
            : tone === 'good'
              ? 'text-emerald-700'
              : tone === 'muted'
                ? 'text-ink/65'
                : 'text-ink'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
