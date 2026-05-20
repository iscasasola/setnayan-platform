import { createAdminClient } from '@/lib/supabase/admin';
import { displayServiceLabel } from '@/lib/vendors';
import {
  VENDOR_PUBLIC_VISIBILITY_LABEL,
  parseVisibility,
  type VendorPublicVisibility,
} from '@/lib/vendor-visibility';

export const metadata = { title: 'Vendors · Admin' };

type VendorRow = {
  vendor_profile_id: string;
  public_id: string;
  user_id: string;
  business_name: string;
  business_slug: string | null;
  tagline: string | null;
  logo_url: string | null;
  services: string[];
  location_city: string | null;
  contact_email: string | null;
  is_published: boolean;
  public_visibility: VendorPublicVisibility;
  created_at: string;
};

type Props = { searchParams: Promise<{ q?: string; status?: string }> };

export default async function AdminVendorsPage({ searchParams }: Props) {
  const search = await searchParams;
  const q = (search.q ?? '').trim();
  const status = (search.status ?? 'all') as 'all' | 'published' | 'draft';

  const admin = createAdminClient();
  let query = admin
    .from('vendor_profiles')
    .select(
      'vendor_profile_id,public_id,user_id,business_name,business_slug,tagline,logo_url,services,location_city,contact_email,is_published,public_visibility,created_at',
    )
    .order('created_at', { ascending: false })
    .limit(200);
  if (status === 'published') query = query.eq('is_published', true);
  if (status === 'draft') query = query.eq('is_published', false);
  if (q.length > 0) {
    // PostgREST's `.or()` parses the string as comma-separated filters
    // where each is `field.operator.value`. Raw user input would let a
    // crafted `q` (containing `,`, `(`, `)`, `:`) inject additional
    // filter clauses and read rows the search wasn't meant to match.
    // Strip the structural delimiters before interpolation — admins
    // searching by business name don't legitimately need them, and
    // `%` / `_` are still allowed so ilike wildcards behave as expected.
    const safeQ = q.replace(/[,()*\\]/g, '').slice(0, 100);
    if (safeQ.length > 0) {
      query = query.or(
        `business_name.ilike.%${safeQ}%,business_slug.ilike.%${safeQ}%,contact_email.ilike.%${safeQ}%,public_id.ilike.%${safeQ}%`,
      );
    }
  }

  const { data, error } = await query;
  const vendors = (data ?? []) as VendorRow[];

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Vendors</h1>
        <p className="text-sm text-ink/60">
          Vendor profiles in the database. Use this to spot incomplete profiles or to confirm
          contact emails (the email couples use to start a thread).
        </p>
      </header>

      <form className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center" method="get">
        <input
          name="q"
          defaultValue={q}
          placeholder="name · slug · email · S89B-…"
          className="input-field flex-1"
        />
        <select
          name="status"
          defaultValue={status}
          className="input-field min-w-[12rem]"
        >
          <option value="all">All</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
        <button type="submit" className="button-secondary">Apply</button>
      </form>

      {error ? (
        <p role="alert" className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700">
          {error.message}
        </p>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {vendors.length === 0 ? (
          <li className="rounded-xl border border-dashed border-ink/20 bg-cream p-8 text-center text-sm text-ink/55 sm:col-span-2 lg:col-span-3">
            No vendor profiles match.
          </li>
        ) : (
          vendors.map((v) => (
            <li
              key={v.vendor_profile_id}
              className="flex flex-col gap-3 rounded-xl border border-ink/10 bg-cream p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar logoUrl={v.logo_url} name={v.business_name || 'Vendor'} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {v.business_name || 'Unnamed'}
                    </p>
                    {v.business_slug ? (
                      <p className="truncate font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                        /v/{v.business_slug}
                      </p>
                    ) : null}
                  </div>
                </div>
                <VisibilityBadge value={parseVisibility(v.public_visibility)} />
              </div>

              {v.tagline ? (
                <p className="text-xs text-ink/65">{v.tagline}</p>
              ) : null}

              <div className="space-y-0.5 text-xs text-ink/65">
                {v.contact_email ? <p>📧 {v.contact_email}</p> : null}
                {v.location_city ? <p>📍 {v.location_city}</p> : null}
                {v.services.length > 0 ? (
                  <p>
                    🧰{' '}
                    {v.services.slice(0, 3).map(displayServiceLabel).join(', ')}
                    {v.services.length > 3 ? ` +${v.services.length - 3}` : ''}
                  </p>
                ) : null}
              </div>

              <p className="mt-auto font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
                {v.public_id}
              </p>
            </li>
          ))
        )}
      </ul>
    </div>
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
