import { notFound, redirect } from 'next/navigation';
import { Plus, Package as PackageIcon } from 'lucide-react';

import { ActionButton } from '@/components/action-button';
import { Badge } from '@/app/_components/badge';
import {
  TEMPLATE_MONEY,
  TemplateEmpty,
  TemplateFail,
  TemplateRow,
  TemplateRows,
  TemplateSection,
} from '@/app/_components/template-rows';

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
    <div className="mx-auto w-full max-w-3xl space-y-2 px-4 py-4 sm:px-6">
      {/* Rule 1 — the pinned row names the page; the heading stays for a screen reader only. */}
      <h1 className="sr-only">Your packages</h1>

      <ActionButton
        tone="brand"
        main
        icon={<Plus aria-hidden strokeWidth={2} />}
        label="Build a package"
        href="/vendor-dashboard/packages/new"
      />

      <TemplateSection
        label="Your packages"
        first
        tip="A bundle a couple can make their own — they swap and drop items, and you see exactly what they picked before you quote."
      >
        {!measured ? (
          <TemplateFail data="packages" retryHref="/vendor-dashboard/packages">
            We couldn&rsquo;t load your packages. This does not mean you have none, and nothing
            has been removed from your page — reload in a moment before building anything again.
          </TemplateFail>
        ) : rows.length === 0 ? (
          <TemplateEmpty data="packages">
            No packages yet. Build one and it appears on your page for couples to customize.
          </TemplateEmpty>
        ) : (
          <TemplateRows label="Your packages">
            {rows.map((p) => (
              <TemplateRow
                key={p.package_id}
                href={`/vendor-dashboard/packages/${p.package_id}`}
                lead={
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--m-paper-2)] text-terracotta">
                    <PackageIcon aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                }
                title={p.package_name}
                line={<span className={TEMPLATE_MONEY}>{formatCentavosPhp(p.total_price_centavos)}</span>}
                right={<Badge tone={p.is_active ? 'ok' : 'quiet'}>{p.is_active ? 'Live' : 'Draft'}</Badge>}
              />
            ))}
          </TemplateRows>
        )}
      </TemplateSection>
    </div>
  );
}
