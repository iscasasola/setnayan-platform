import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Plus, Package as PackageIcon } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { packageAuthoringEnabled } from '@/lib/package-authoring-flag';
import { formatCentavosPhp } from '@/lib/vendor-packages';

/**
 * /vendor-dashboard/packages — the vendor's package list.
 *
 * Reached from the "Packages" card on My Shop, which renders only while
 * `NEXT_PUBLIC_PACKAGE_AUTHORING` is on — the route and its doorway ship
 * together, per the no-orphaned-pages rule.
 */
export const dynamic = 'force-dynamic';

export default async function VendorPackagesPage() {
  if (!packageAuthoringEnabled()) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const { data: packages, error: packagesError } = await supabase
    .from('vendor_packages')
    .select('package_id, package_name, total_price_centavos, is_active, updated_at')
    .eq('vendor_profile_id', profile.vendor_profile_id as string)
    .order('updated_at', { ascending: false });

  // ⚠ THE SHOP'S OWN PACKAGES. Refused, `?? []` printed "No packages yet. Build
  // ⚠ one and it appears on your page" to a supplier who has built them — an
  // ⚠ invitation to author a second copy of work that already exists and is
  // ⚠ already live to couples.
  if (packagesError) {
    logQueryError(
      'VendorPackagesPage.packages',
      packagesError,
      { vendorProfileId: profile.vendor_profile_id as string },
      'graceful_degrade',
    );
  }
  const measured = !packagesError && packages !== null;
  const rows = packages ?? [];

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="mt-1 font-serif text-2xl text-ink/90">Your packages</h1>
        <p className="mt-2 max-w-xl text-sm text-ink/60">
          A package is a bundle a couple can make their own — they swap what they
          want, drop what they don&rsquo;t, and you see exactly what they picked
          before you quote.
        </p>
      </header>

      <Link
        href="/vendor-dashboard/packages/new"
        className="mb-5 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm text-cream"
      >
        <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
        Build a package
      </Link>

      {!measured ? (
        <p
          role="alert"
          className="rounded-2xl border-t-[3px] border-mulberry/70 bg-mulberry/5 p-4 text-sm text-ink/70"
        >
          <strong className="text-ink">We couldn&rsquo;t load your packages.</strong>{' '}
          This does not mean you have none, and nothing has been removed from
          your page &mdash; reload in a moment before building anything again.
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-ink/15 p-8 text-center text-sm text-ink/50">
          No packages yet. Build one and it appears on your page for couples to
          customize.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((p) => (
            <li key={p.package_id}>
              <Link
                href={`/vendor-dashboard/packages/${p.package_id}`}
                className="flex items-center gap-3 rounded-xl border border-ink/10 bg-cream p-4 hover:border-ink/20"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
                  <PackageIcon aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink/85">
                    {p.package_name}
                  </span>
                  <span className="block font-mono text-[11px] text-ink/45">
                    {formatCentavosPhp(p.total_price_centavos)}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] ${
                    p.is_active
                      ? 'bg-success-50 text-success-700'
                      : 'bg-ink/[0.05] text-ink/45'
                  }`}
                >
                  {p.is_active ? 'Live' : 'Draft'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
