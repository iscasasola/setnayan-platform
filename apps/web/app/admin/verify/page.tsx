import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { displayServiceLabel } from '@/lib/vendors';
import {
  VENDOR_PUBLIC_VISIBILITY_LABEL,
  parseVisibility,
  type VendorPublicVisibility,
} from '@/lib/vendor-visibility';
import {
  approveVendor,
  archiveVendor,
  rejectVendor,
} from './actions';

export const metadata = { title: 'Verification queue · Admin' };

type Props = {
  searchParams: Promise<{
    status?: string;
    approved?: string;
    rejected?: string;
    archived?: string;
    error?: string;
  }>;
};

type VendorRow = {
  vendor_profile_id: string;
  public_id: string;
  business_name: string;
  business_slug: string | null;
  tagline: string | null;
  logo_url: string | null;
  services: string[];
  location_city: string | null;
  contact_email: string | null;
  public_visibility: VendorPublicVisibility;
  created_at: string;
};

/**
 * Admin Verification Queue (V1 MVP).
 *
 * Lists every vendor_profiles row with a status filter. Coming-soon is the
 * default view (the queue admins work through every day). Each row exposes
 * approve / reject / archive actions that flip `public_visibility` and
 * write an audit row to `admin_audit_log`.
 *
 * Per 0022 § 2.1c + 0023 § 3.2 + decision log 2026-05-15.
 *
 * NOT in V1 (deferred):
 *   - Service-approval queue
 *   - Custom-category review queue
 *   - Two-admin approval gate (this surface is single-admin per § 4.3)
 *   - Bulk-action UI
 */
export default async function AdminVerifyPage({ searchParams }: Props) {
  const search = await searchParams;
  const statusFilter = parseStatus(search.status);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('vendor_profiles')
    .select(
      'vendor_profile_id,public_id,business_name,business_slug,tagline,logo_url,services,location_city,contact_email,public_visibility,created_at',
    )
    .in('public_visibility', statusFilter)
    .order('created_at', { ascending: false })
    .limit(200);

  const vendors = (data ?? []) as VendorRow[];

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
          Iteration 0023 · § 3.2
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Verification queue</h1>
        <p className="max-w-2xl text-sm text-ink/65">
          Vendors land here in <span className="font-medium">Coming soon</span> when they
          register. Approve to flip them to <span className="font-medium">Verified</span>{' '}
          (publicly bookable). Reject to keep them in Coming soon (vendor can re-submit) or
          push them to Hidden. Every transition is audit-logged.
        </p>
      </header>

      <FlashBanner search={search} />

      <StatusTabs current={search.status ?? 'coming_soon'} />

      {error ? (
        <p
          role="alert"
          className="mb-4 rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {error.message}
        </p>
      ) : null}

      {vendors.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink/20 bg-cream p-10 text-center text-sm text-ink/55">
          Queue is empty for this filter. Try widening the status.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {vendors.map((v) => (
            <li key={v.vendor_profile_id}>
              <VerifyCard vendor={v} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function parseStatus(raw: string | undefined): VendorPublicVisibility[] {
  switch (raw) {
    case 'all':
      return ['hidden', 'coming_soon', 'verified', 'archived'];
    case 'verified':
      return ['verified'];
    case 'hidden':
      return ['hidden'];
    case 'archived':
      return ['archived'];
    case 'coming_soon':
    default:
      return ['coming_soon'];
  }
}

function FlashBanner({
  search,
}: {
  search: { approved?: string; rejected?: string; archived?: string; error?: string };
}) {
  if (search.error) {
    return (
      <p
        role="alert"
        className="mb-4 rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
      >
        {decodeURIComponent(search.error)}
      </p>
    );
  }
  if (search.approved === '1') {
    return (
      <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        Vendor approved — they&rsquo;re now publicly bookable.
      </p>
    );
  }
  if (search.rejected === '1') {
    return (
      <p className="mb-4 rounded-md border border-ink/15 bg-ink/5 px-4 py-3 text-sm text-ink/75">
        Vendor rejected — they stay in their current pre-verified state.
      </p>
    );
  }
  if (search.archived === '1') {
    return (
      <p className="mb-4 rounded-md border border-ink/15 bg-ink/5 px-4 py-3 text-sm text-ink/75">
        Vendor archived — they no longer appear in browse.
      </p>
    );
  }
  return null;
}

function StatusTabs({ current }: { current: string }) {
  const tabs: ReadonlyArray<{ key: string; label: string }> = [
    { key: 'coming_soon', label: 'Coming soon' },
    { key: 'verified', label: 'Verified' },
    { key: 'hidden', label: 'Hidden' },
    { key: 'archived', label: 'Archived' },
    { key: 'all', label: 'All' },
  ];
  return (
    <nav className="mb-4 flex flex-wrap gap-2" aria-label="Verification status">
      {tabs.map((t) => {
        const active = current === t.key;
        return (
          <Link
            key={t.key}
            href={`/admin/verify?status=${t.key}`}
            aria-pressed={active}
            className={
              active
                ? 'inline-flex items-center rounded-full bg-ink px-3 py-1 text-xs font-medium text-cream'
                : 'inline-flex items-center rounded-full border border-ink/20 bg-cream px-3 py-1 text-xs text-ink/70 hover:bg-ink/5'
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

function VerifyCard({ vendor }: { vendor: VendorRow }) {
  const visibility = parseVisibility(vendor.public_visibility);
  const slug = vendor.business_slug ?? null;
  return (
    <article className="flex h-full flex-col gap-3 rounded-xl border border-ink/10 bg-cream p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar logoUrl={vendor.logo_url} name={vendor.business_name || 'Vendor'} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">
              {vendor.business_name || 'Unnamed'}
            </p>
            {slug ? (
              <p className="truncate font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                /v/{slug}
              </p>
            ) : null}
          </div>
        </div>
        <VisibilityBadge value={visibility} />
      </header>

      {vendor.tagline ? <p className="text-xs text-ink/65">{vendor.tagline}</p> : null}

      <div className="space-y-0.5 text-xs text-ink/65">
        {vendor.contact_email ? <p>{vendor.contact_email}</p> : null}
        {vendor.location_city ? <p>{vendor.location_city}</p> : null}
        {vendor.services.length > 0 ? (
          <p>
            {vendor.services.slice(0, 3).map(displayServiceLabel).join(', ')}
            {vendor.services.length > 3 ? ` +${vendor.services.length - 3}` : ''}
          </p>
        ) : null}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
        {visibility !== 'verified' ? (
          <form action={approveVendor}>
            <input type="hidden" name="vendor_profile_id" value={vendor.vendor_profile_id} />
            <button type="submit" className="button-primary h-9 px-3 text-xs">
              Approve → Verified
            </button>
          </form>
        ) : null}
        {visibility !== 'hidden' ? (
          <form action={rejectVendor}>
            <input type="hidden" name="vendor_profile_id" value={vendor.vendor_profile_id} />
            <input type="hidden" name="reject_to" value="hidden" />
            <button type="submit" className="button-secondary h-9 px-3 text-xs">
              Reject → Hidden
            </button>
          </form>
        ) : null}
        {visibility !== 'archived' ? (
          <form action={archiveVendor}>
            <input type="hidden" name="vendor_profile_id" value={vendor.vendor_profile_id} />
            <button
              type="submit"
              className="inline-flex h-9 items-center rounded-md border border-ink/20 px-3 text-xs text-ink/70 hover:bg-ink/5"
            >
              Archive
            </button>
          </form>
        ) : null}
      </div>

      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
        {vendor.public_id}
      </p>
    </article>
  );
}

function VisibilityBadge({ value }: { value: VendorPublicVisibility }) {
  const tone: Record<VendorPublicVisibility, string> = {
    coming_soon: 'bg-amber-100 text-amber-900',
    verified: 'bg-emerald-100 text-emerald-800',
    hidden: 'bg-ink/8 text-ink/65',
    archived: 'bg-ink/8 text-ink/45',
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${tone[value]}`}
    >
      {VENDOR_PUBLIC_VISIBILITY_LABEL[value]}
    </span>
  );
}

function Avatar({ logoUrl, name }: { logoUrl: string | null; name: string }) {
  if (logoUrl) {
    return (
      <span className="inline-flex h-10 w-10 shrink-0 overflow-hidden rounded-full border border-ink/10 bg-cream">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt="" className="h-full w-full object-cover" />
      </span>
    );
  }
  const initials = name
    .split(/\s+/)
    .map((p) => p.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
  return (
    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-terracotta/15 font-mono text-xs font-semibold text-terracotta-700">
      {initials || '?'}
    </span>
  );
}
