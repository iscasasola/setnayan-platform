import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  ArrowLeft,
  BookmarkCheck,
  Package as PackageIcon,
  MessageCircle,
  FileText,
  XCircle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import {
  formatCentavosPhp,
  resolveVendorCategory,
  type EventVendorPackageRow,
  type PackageCustomizations,
  type VendorPackageItemRow,
  type VendorPackageRow,
  type VendorPackageWithItems,
} from '@/lib/vendor-packages';
import { VENDOR_CATEGORY_LABEL } from '@/lib/vendors';
import { releasePackage, removeItemFromPackage } from '../actions';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ eventId: string; bookingId: string }>;
};

export default async function PackageBookingPage({ params }: Props) {
  const { eventId, bookingId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Booking + package + items. RLS scopes to host on the event.
  const { data: booking, error: bookingErr } = await supabase
    .from('event_vendor_packages')
    .select(
      'booking_id, event_id, package_id, primary_event_vendor_id, status, customizations_json, remaining_consumable_centavos, total_locked_centavos, locked_at, released_at, created_at, updated_at',
    )
    .eq('booking_id', bookingId)
    .eq('event_id', eventId)
    .maybeSingle();
  if (bookingErr) throw new Error(bookingErr.message);
  if (!booking) notFound();
  const typedBooking = booking as EventVendorPackageRow;

  const { data: pkgRow } = await supabase
    .from('vendor_packages')
    .select(
      'package_id, vendor_profile_id, package_name, description, total_price_centavos, consumable_budget_centavos, is_consumable_flexible, primary_canonical_service, is_active, created_at, updated_at',
    )
    .eq('package_id', typedBooking.package_id)
    .maybeSingle();
  if (!pkgRow) notFound();

  const { data: itemsRows } = await supabase
    .from('vendor_package_items')
    .select(
      'item_id, package_id, canonical_service, service_description, is_default_included, replacement_value_centavos, display_order, created_at',
    )
    .eq('package_id', typedBooking.package_id)
    .order('display_order', { ascending: true });

  const pkg: VendorPackageWithItems = {
    ...(pkgRow as VendorPackageRow),
    items: (itemsRows ?? []) as VendorPackageItemRow[],
  };

  const customizations = typedBooking.customizations_json as PackageCustomizations;
  const removedIds = new Set(customizations.removed_item_ids ?? []);

  // Vendor info for the header
  const { data: vendor } = await supabase
    .from('vendor_profiles')
    .select('vendor_profile_id, business_name, business_slug, logo_url, location_city')
    .eq('vendor_profile_id', pkg.vendor_profile_id)
    .maybeSingle();

  const vendorPublicHref =
    vendor?.business_slug ? `/v/${vendor.business_slug}` : null;
  const eventHomeHref = `/dashboard/${eventId}`;

  const keptItems = pkg.items.filter((i) => !removedIds.has(i.item_id));
  const removedItems = pkg.items.filter((i) => removedIds.has(i.item_id));

  const isLocked = typedBooking.status === 'locked';
  const isReleased = typedBooking.status === 'released';

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <Link
        href={eventHomeHref}
        className="inline-flex items-center gap-1.5 text-xs text-ink/60 transition-colors hover:text-terracotta"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        Back to event home
      </Link>

      <header className="mt-6 flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
          <PackageIcon aria-hidden className="h-6 w-6" strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
            Vendor package
          </p>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-ink sm:text-2xl">
            {pkg.package_name}
          </h1>
          {vendor ? (
            <p className="mt-1 text-sm text-ink/70">
              {vendorPublicHref ? (
                <Link
                  href={vendorPublicHref}
                  className="underline-offset-2 transition-colors hover:underline"
                >
                  {vendor.business_name}
                </Link>
              ) : (
                vendor.business_name
              )}
              {vendor.location_city ? (
                <span className="text-ink/55"> · {vendor.location_city}</span>
              ) : null}
            </p>
          ) : null}
        </div>
      </header>

      {/* Status pill */}
      <div className="mt-4 flex items-center gap-2">
        {isLocked ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-emerald-800">
            <BookmarkCheck aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Locked
          </span>
        ) : isReleased ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-ink/60">
            Released
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-amber-900">
            Considering
          </span>
        )}
      </div>

      {/* Totals */}
      <section className="mt-5 rounded-2xl border border-ink/10 bg-cream p-5">
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-ink/70">Total locked</dt>
            <dd className="font-mono text-base text-ink">
              {formatCentavosPhp(typedBooking.total_locked_centavos)}
            </dd>
          </div>
          {pkg.is_consumable_flexible &&
          (pkg.consumable_budget_centavos > 0 ||
            typedBooking.remaining_consumable_centavos > 0) ? (
            <div className="flex items-center justify-between">
              <dt className="text-ink/70">Consumable budget</dt>
              <dd className="font-mono text-base text-emerald-800">
                {formatCentavosPhp(typedBooking.remaining_consumable_centavos)}
              </dd>
            </div>
          ) : null}
        </dl>
        {pkg.is_consumable_flexible &&
        typedBooking.remaining_consumable_centavos >
          pkg.consumable_budget_centavos ? (
          <p className="mt-3 rounded-lg bg-emerald-50/60 px-3 py-2 text-xs text-emerald-900">
            You{'’'}ve freed up{' '}
            <span className="font-semibold">
              {formatCentavosPhp(
                typedBooking.remaining_consumable_centavos -
                  pkg.consumable_budget_centavos,
              )}
            </span>{' '}
            from removed items. Talk to {vendor?.business_name ?? 'the vendor'}{' '}
            about how to apply it.
          </p>
        ) : null}
      </section>

      {/* Included items */}
      {keptItems.length > 0 ? (
        <section className="mt-6">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
            Included in this booking ({keptItems.length})
          </h2>
          <ul className="mt-3 space-y-2">
            {keptItems.map((item) => {
              const category = resolveVendorCategory(item.canonical_service);
              const categoryLabel = VENDOR_CATEGORY_LABEL[category] ?? category;
              return (
                <li
                  key={item.item_id}
                  className="flex items-start gap-3 rounded-lg border border-emerald-200/50 bg-emerald-50/30 p-3"
                >
                  <BookmarkCheck
                    aria-hidden
                    className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"
                    strokeWidth={2}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45">
                      {categoryLabel}
                    </p>
                    <p className="mt-0.5 text-sm text-ink/85">
                      {item.service_description}
                    </p>
                    {item.replacement_value_centavos > 0 ? (
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-ink/45">
                        {formatCentavosPhp(item.replacement_value_centavos)} value
                      </p>
                    ) : null}
                  </div>
                  {isLocked ? (
                    <form action={removeItemFromPackage}>
                      <input type="hidden" name="event_id" value={eventId} />
                      <input
                        type="hidden"
                        name="booking_id"
                        value={typedBooking.booking_id}
                      />
                      <input type="hidden" name="item_id" value={item.item_id} />
                      <button
                        type="submit"
                        className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-ink/15 bg-cream px-2.5 py-1.5 text-xs text-ink/70 transition-colors hover:border-rose-300 hover:text-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
                      >
                        Remove
                      </button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* Removed items */}
      {removedItems.length > 0 ? (
        <section className="mt-6">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
            Removed ({removedItems.length})
          </h2>
          <ul className="mt-3 space-y-2">
            {removedItems.map((item) => (
              <li
                key={item.item_id}
                className="flex items-start gap-3 rounded-lg border border-ink/10 bg-cream/50 p-3 opacity-70"
              >
                <XCircle
                  aria-hidden
                  className="mt-0.5 h-4 w-4 shrink-0 text-ink/40"
                  strokeWidth={2}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink/55 line-through">
                    {item.service_description}
                  </p>
                  {item.replacement_value_centavos > 0 &&
                  pkg.is_consumable_flexible ? (
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-emerald-700">
                      +{formatCentavosPhp(item.replacement_value_centavos)} in
                      consumable budget
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Actions */}
      <section className="mt-8 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Link
            href={`/dashboard/${eventId}/contracts`}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-ink/15 bg-cream px-3 py-2 text-xs font-medium text-ink/80 transition-colors hover:border-terracotta/40 hover:text-terracotta focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
          >
            <FileText aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            View contracts
          </Link>
          <Link
            href={`/dashboard/${eventId}/messages`}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-ink/15 bg-cream px-3 py-2 text-xs font-medium text-ink/80 transition-colors hover:border-terracotta/40 hover:text-terracotta focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
          >
            <MessageCircle
              aria-hidden
              className="h-3.5 w-3.5"
              strokeWidth={1.75}
            />
            Open thread
          </Link>
        </div>

        {isLocked ? (
          <form action={releasePackage}>
            <input type="hidden" name="event_id" value={eventId} />
            <input
              type="hidden"
              name="booking_id"
              value={typedBooking.booking_id}
            />
            <button
              type="submit"
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border border-rose-300/60 bg-cream px-4 py-2 text-sm font-medium text-rose-800 transition-colors hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
            >
              Release this package
            </button>
          </form>
        ) : null}
      </section>
    </main>
  );
}
