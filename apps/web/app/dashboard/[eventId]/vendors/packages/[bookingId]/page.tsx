import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  ArrowLeft,
  BookmarkCheck,
  Circle,
  Package as PackageIcon,
  MessageCircle,
  FileText,
  XCircle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  formatCentavosPhp,
  resolveVendorCategory,
  VENDOR_PACKAGE_ITEM_SELECT,
  VENDOR_PACKAGE_SELECT,
  type EventVendorPackageRow,
  type PackageCustomizations,
  type VendorPackageItemRow,
  type VendorPackageRow,
  type VendorPackageWithItems,
} from '@/lib/vendor-packages';
import { VENDOR_CATEGORY_LABEL } from '@/lib/vendors';
import { releasePackage, removeItemFromPackage } from '../actions';
import { receiptSections } from './receipt-sections';
import {
  readPricingSnapshot,
  snapshotChargeLines,
  snapshotChargeTotalCentavos,
} from '@/lib/package-pricing-snapshot';
import { SubmitButton } from '@/app/_components/submit-button';

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
    .select(VENDOR_PACKAGE_SELECT)
    .eq('package_id', typedBooking.package_id)
    .maybeSingle();
  if (!pkgRow) notFound();

  // ⚠ THIS IS A MONEY DOCUMENT AND THESE ARE ITS LINES. Supabase RESOLVES with
  // ⚠ { error } rather than throwing, so a refused read arrives as `data: null`,
  // ⚠ `?? []` empties it, and every section below — Included, Not included,
  // ⚠ Removed — disappears at once: a booking that still shows a price and no
  // ⚠ longer shows a single thing the couple is paying for, with the "Removed"
  // ⚠ list (what they dropped, and why the total moved) gone too. Bind it.
  const { data: itemsRows, error: itemsError } = await supabase
    .from('vendor_package_items')
    .select(
      // The canonical list, not a hand-typed copy of it. `is_required` is the
      // column that was missing: `keptItems` reads it to decide that a
      // mandatory line survives a removal id, and an absent column reads as
      // `undefined` → falsy → the receipt would have printed a line the vendor
      // marked mandatory (and is still charging for) under "Removed". Both the
      // lock path and /v/[slug] already SELECT it via this same constant.
      // `parent_option_id` used to be appended here; it is inside the constant
      // now (the charge path needs it on every money read), so appending it
      // would ask PostgREST for the same column twice.
      VENDOR_PACKAGE_ITEM_SELECT,
    )
    .eq('package_id', typedBooking.package_id)
    .order('display_order', { ascending: true });
  if (itemsError) {
    logQueryError(
      'CouplePackageBookingPage.items',
      itemsError,
      { event_id: eventId, package_id: typedBooking.package_id },
      'graceful_degrade',
    );
  }
  const itemsMeasured = !itemsError && itemsRows !== null;

  const pkg: VendorPackageWithItems = {
    ...(pkgRow as VendorPackageRow),
    // FOLLOW-UPS ARE NOT PART OF THIS BOOKING'S LIST. Unlike every other
    // surface, the two lists below split on `removed_item_ids` alone and never
    // consult `is_default_included` — so a follow-up would be printed under
    // "Included in this booking", a line the couple never picked and never
    // paid for. The lock path already refuses to cascade one
    // (`keptItems` in @/lib/vendor-packages); this keeps the receipt honest
    // about it too. A PICKED follow-up gets listed here by the renderer slice,
    // which knows which option was chosen.
    items: ((itemsRows ?? []) as VendorPackageItemRow[]).filter(
      (i) => i.parent_option_id == null,
    ),
  };

  const customizations = typedBooking.customizations_json as PackageCustomizations;
  const removedItemIds = customizations.removed_item_ids ?? [];

  // 🧾 WHAT THE COUPLE ACTUALLY PAID EXTRA FOR — read from the frozen snapshot
  // already on this row, so no new query.
  //
  // The total above now includes follow-up option deltas, every pick on a
  // pick-N line, and extra hours; none of it was itemised anywhere. The three
  // lists below are LINE lists and deliberately exclude follow-ups, so a
  // charged follow-up upgrade appeared in the number and nowhere in the words —
  // and the vendor, whom this record is supposed to tell what to deliver, was
  // never shown the hours the couple bought.
  const pricingSnapshot = readPricingSnapshot(customizations.pricing_snapshot);
  const chargeLines = snapshotChargeLines(pricingSnapshot);
  const chargeTotalCentavos = snapshotChargeTotalCentavos(pricingSnapshot);

  // Vendor info for the header
  const { data: vendor, error: vendorError } = await supabase
    .from('vendor_profiles')
    .select('vendor_profile_id, business_name, business_slug, logo_url, location_city')
    .eq('vendor_profile_id', pkg.vendor_profile_id)
    .maybeSingle();
  if (vendorError) {
    logQueryError(
      'CouplePackageBookingPage.vendor',
      vendorError,
      { event_id: eventId },
      'graceful_degrade',
    );
  }

  const vendorPublicHref =
    vendor?.business_slug ? `/v/${vendor.business_slug}` : null;
  const eventHomeHref = `/dashboard/${eventId}`;

  // 🧾 THREE lists, not two — and none of them re-derives the inclusion rule
  // here. The pre-fix page split on `removed_item_ids` alone, so an optional
  // ADD-ON (never inside `total_price_centavos`, never charged) was printed
  // under "Included in this booking". The local binding was also named
  // `keptItems`, SHADOWING the imported helper of the same name, which is how
  // the two definitions drifted apart unnoticed. See ./receipt-sections.
  const {
    included: includedItems,
    notIncluded: notIncludedItems,
    removed: removedItems,
  } = receiptSections(pkg, removedItemIds);

  const isLocked = typedBooking.status === 'locked';
  const isReleased = typedBooking.status === 'released';

  // 🔑 KEEPS THE SHARED SHELL (owner, 2026-08-18: "all should keep our shell").
  // This was a second <main> INSIDE the event layout's own `<main class="sn-vt-page">`
  // — a frame within the frame. Two <main> landmarks on one page is also an
  // accessibility fault: a screen reader offers "skip to main content" twice
  // and neither is the whole page.
  //
  // The width and padding it carried are KEPT, on a <div>, because this page
  // is a narrow receipt and deliberately reads narrower than a roster. Losing
  // them would widen the page, which is a different change nobody asked for.
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <Link
        href={eventHomeHref}
        className="inline-flex items-center gap-1.5 text-xs text-ink/60 transition-colors hover:text-terracotta-700"
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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-100 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-success-800">
            <BookmarkCheck aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Locked
          </span>
        ) : isReleased ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-ink/60">
            Released
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-warn-100 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-warn-900">
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
              <dd className="font-mono text-base text-success-800">
                {formatCentavosPhp(typedBooking.remaining_consumable_centavos)}
              </dd>
            </div>
          ) : null}
        </dl>
        {pkg.is_consumable_flexible &&
        typedBooking.remaining_consumable_centavos >
          pkg.consumable_budget_centavos ? (
          <p className="mt-3 rounded-lg bg-success-50/60 px-3 py-2 text-xs text-success-900">
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

      {/* 🧾 Your choices — the itemisation behind the total */}
      {chargeLines.length > 0 ? (
        <section className="mt-6">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
            Your choices ({chargeLines.length})
          </h2>
          <ul className="mt-3 space-y-2">
            {chargeLines.map((line) => (
              <li
                key={line.key}
                className="flex items-start justify-between gap-3 rounded-xl border border-ink/10 bg-cream px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink/85">{line.label}</p>
                  {line.detail ? (
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45">
                      {line.detail}
                    </p>
                  ) : null}
                </div>
                <span className="shrink-0 font-mono text-sm text-ink/80">
                  {/* A ₱0 pick is a CHOICE the vendor must still honour, not a
                      charge — showing "+₱0" would read as a priced upgrade. */}
                  {line.amountCentavos > 0
                    ? `+${formatCentavosPhp(line.amountCentavos)}`
                    : 'Included'}
                </span>
              </li>
            ))}
          </ul>
          {chargeTotalCentavos > 0 ? (
            <p className="mt-2 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45">
              {formatCentavosPhp(chargeTotalCentavos)} of the total above
            </p>
          ) : null}
        </section>
      ) : null}

      {!itemsMeasured ? (
        <p
          role="alert"
          className="mt-6 rounded-xl border-t-[3px] border-mulberry/70 bg-mulberry/5 p-4 text-sm text-ink/70"
        >
          <strong className="text-ink">
            We couldn&rsquo;t load what&rsquo;s in this package.
          </strong>{' '}
          Nothing has changed about your booking and nothing has been removed
          &mdash; we simply can&rsquo;t list the items right now. Reload in a
          moment before you go by this page.
        </p>
      ) : null}

      {/* Included items */}
      {includedItems.length > 0 ? (
        <section className="mt-6">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
            Included in this booking ({includedItems.length})
          </h2>
          <ul className="mt-3 space-y-2">
            {includedItems.map((item) => {
              const category = resolveVendorCategory(item.canonical_service);
              const categoryLabel = VENDOR_CATEGORY_LABEL[category] ?? category;
              return (
                <li
                  key={item.item_id}
                  className="flex items-start gap-3 rounded-lg border border-success-200/50 bg-success-50/30 p-3"
                >
                  <BookmarkCheck
                    aria-hidden
                    className="mt-0.5 h-4 w-4 shrink-0 text-success-700"
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
                      <SubmitButton pendingLabel="Removing…" className="inline-flex min-h-[44px] items-center gap-1 rounded-md border border-ink/15 bg-cream px-2.5 py-1.5 text-xs text-ink/70 transition-colors hover:border-danger-300 hover:text-danger-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger-500">Remove</SubmitButton>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* Not-included items — the vendor's optional add-ons on this package.
          Shown in their OWN labelled section (owner design
          Design_Package_Credit_2026-07-26/couple_customize_and_requests.html:
          Included · add-ons · requests), never folded into Included and never
          hidden. The copy is receipt voice, not the design's configurator
          voice: there is no purchase path for add-ons yet, so "Add on if
          you'd like" would offer something the product cannot deliver. Naming
          the status is the honest version. No peso figure either —
          `replacement_value_centavos` is a replacement VALUE, and printing one
          next to a line that was never billed reads as a charge. */}
      {notIncludedItems.length > 0 ? (
        <section className="mt-6">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
            Not included in this booking ({notIncludedItems.length})
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-ink/60">
            Optional extras {vendor?.business_name ?? 'this vendor'} offers on
            this package. They weren{'’'}t part of what you booked, and nothing
            was charged for them.
          </p>
          <ul className="mt-3 space-y-2">
            {notIncludedItems.map((item) => {
              const category = resolveVendorCategory(item.canonical_service);
              const categoryLabel = VENDOR_CATEGORY_LABEL[category] ?? category;
              return (
                <li
                  key={item.item_id}
                  className="flex items-start gap-3 rounded-lg border border-ink/10 bg-cream/50 p-3"
                >
                  <Circle
                    aria-hidden
                    className="mt-0.5 h-4 w-4 shrink-0 text-ink/30"
                    strokeWidth={2}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45">
                      {categoryLabel}
                    </p>
                    <p className="mt-0.5 text-sm text-ink/70">
                      {item.service_description}
                    </p>
                  </div>
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
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-success-700">
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
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-ink/15 bg-cream px-3 py-2 text-xs font-medium text-ink/80 transition-colors hover:border-terracotta/40 hover:text-terracotta-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
          >
            <FileText aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            View contracts
          </Link>
          <Link
            href={`/dashboard/${eventId}/messages`}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-ink/15 bg-cream px-3 py-2 text-xs font-medium text-ink/80 transition-colors hover:border-terracotta/40 hover:text-terracotta-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
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
            <SubmitButton pendingLabel="Releasing…" className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border border-danger-300/60 bg-cream px-4 py-2 text-sm font-medium text-danger-800 transition-colors hover:bg-danger-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger-500">Release this package</SubmitButton>
          </form>
        ) : null}
      </section>
    </div>
  );
}
