import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { ArrowLeft, Check, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { formatPhp } from '@/lib/orders';
import { fetchV2BundleCatalog } from '@/lib/v2-catalog';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { InlineCheckoutDrawer } from '@/app/dashboard/[eventId]/_components/inline-checkout-drawer';

export const metadata = { title: 'Wedding Bundle · Setnayan' };

/**
 * /dashboard/[eventId]/add-ons/bundle?code=GUIDED_PACK|MEDIA_PACK
 *
 * The checkout landing for the ONBOARDING-ONLY bundle offer (owner 2026-06-08).
 * The onboarding bundle screen (app/onboarding/wedding · #screen-bundle) routes
 * Purchase Now here with ?code=<package_code> after committing the event. This
 * page resolves the package price + title SERVER-SIDE from the live admin
 * package catalog (platform_package_catalog · the SAME source /pricing and the
 * onboarding card read) and mounts the existing InlineCheckoutDrawer keyed
 * service_key=package_code at the bundle price. submitOrderAction keeps the
 * client price for flat (non-pax) SKUs, so the order lands at the catalog
 * bundle price with NO new server action and NO schema change.
 *
 * PRICE INTEGRITY: the URL carries ONLY `code` — never a price param. The price
 * comes from the catalog lookup here, so a tampered URL can't change the charge.
 *
 * FULFILLMENT NOTE (flagged to owner): a bundle order is a SINGLE orders row
 * keyed GUIDED_PACK/MEDIA_PACK at the bundle price — no member-SKU decomposition.
 * Admin reconciliation + member-service provisioning is manual/downstream.
 */

const BUNDLE_BLURB: Record<string, string> = {
  GUIDED_PACK:
    'Your curated value core — the in-app services most couples reach for, bundled at one price.',
  MEDIA_PACK:
    'Everything Setnayan makes for your day — every in-app service, bundled for the best value.',
};

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ code?: string }>;
};

export default async function BundleCheckoutPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const { code } = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  // Confirm the event exists (the couple just committed it during onboarding).
  const { data: event } = await supabase
    .from('events')
    .select('event_id, display_name')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) redirect(`/dashboard/${eventId}`);

  // Resolve the package from the LIVE admin catalog by code (price never trusted
  // from the URL). Unknown / missing code → 404 rather than a silent ₱0 order.
  const bundles = await fetchV2BundleCatalog().catch(() => []);
  const pkg = code ? bundles.find((b) => b.package_code === code) : undefined;
  if (!pkg) notFound();

  const settings = await fetchPlatformSettings(supabase);
  const blurb = BUNDLE_BLURB[pkg.package_code] ?? 'A bundle of Setnayan in-app services for your wedding.';

  return (
    <section className="space-y-6">
      <Link
        href={`/dashboard/${eventId}/add-ons`}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to add-ons
      </Link>

      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
          Your wedding bundle
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{pkg.title}</h1>
        <p className="max-w-prose text-base text-ink/65">{blurb}</p>
      </header>

      <section className="rounded-2xl border border-ink/10 bg-cream p-5">
        <header className="space-y-1">
          <p className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
            <Sparkles aria-hidden className="h-3.5 w-3.5 text-terracotta" strokeWidth={2} />
            What you get
          </p>
          <h2 className="text-xl font-semibold tracking-tight">Bundled, at one honest price</h2>
        </header>

        <ul className="mt-4 space-y-2 text-sm text-ink/70">
          <li className="flex items-start gap-2">
            <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={2} />
            A curated set of Setnayan in-app services for your wedding, bundled together.
          </li>
          <li className="flex items-start gap-2">
            <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={2} />
            One price, instead of buying each service on its own.
          </li>
          <li className="flex items-start gap-2">
            <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={2} />
            Pay only when you&rsquo;re ready — your free plan keeps everything else.
          </li>
        </ul>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink/65">
            One price for your wedding ·{' '}
            <span className="font-mono text-base text-ink">{formatPhp(pkg.retail_price_php)}</span>
          </p>
          <div className="sm:w-auto">
            <InlineCheckoutDrawer
              eventId={eventId}
              serviceKey={pkg.package_code}
              displayName={`${pkg.title}${event.display_name ? ` · ${event.display_name}` : ''}`}
              originalPriceCentavos={String(Math.round(pkg.retail_price_php * 100))}
              settings={settings}
              triggerLabel={`Buy ${pkg.title}`}
              triggerClassName="inline-flex w-full items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream hover:bg-mulberry-600 disabled:opacity-70 sm:w-auto"
            />
          </div>
        </div>
      </section>
    </section>
  );
}
