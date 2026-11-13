import { Package as PackageIcon, Check, Gift } from 'lucide-react';
import {
  formatCentavosPhp,
  type VendorPackageWithItems,
} from '@/lib/vendor-packages';
import { SetnayanGiftLine } from '@/app/_components/setnayan-gift-line';
import type { CoupleBundleGift } from '@/lib/package-gift';

/**
 * Read-only summary card for a vendor package. Renders on /v/[slug]
 * public profiles + on the dashboard /vendors/packages/[bookingId]
 * detail page. The "Customize & lock" CTA is a separate client modal
 * component (lock-modal) attached via the optional `ctaSlot` prop so
 * server components can render the card statically.
 */
export function PackageCard({
  pkg,
  ctaSlot,
  ctaBesidePrice = false,
  hidePrice = false,
  gift = null,
}: {
  pkg: VendorPackageWithItems;
  /**
   * 🎁 THE BUNDLE'S GIFT (owner 2026-11-07, "where are the gifts?") — drawn the way a CARD draws its gift: the
   * Setnayan gift is the card's own `SetnayanGiftLine`, word for word; a shop pack is the quote's headline
   * (`coupleGiftHeadline`, via `coupleBundleGift`). Absent → the card is exactly as it was.
   */
  gift?: CoupleBundleGift;
  ctaSlot?: React.ReactNode;
  /**
   * 🔒 THE LOCK BESIDE ITS PRICE (prototype public_pages_three_2026-11-13, owner-approved 13 Nov): on the public shop
   * page the package's one action sits in the price row — price left, "Book this package" right, wrapping under it on
   * a narrow card — instead of at the card's foot. Off (the default) ⇒ the dashboard callers keep the foot slot.
   */
  ctaBesidePrice?: boolean;
  /**
   * Public "hide my prices" preference (Social_Share_Settings_Council_Verdict
   * 2026-07-16 #6). When true, the peso figures are suppressed — the package
   * name + included items stay visible; only the amounts disappear. Defaults
   * false so the dashboard detail-page caller is unaffected.
   */
  hidePrice?: boolean;
}) {
  const includedItems = pkg.items.filter((i) => i.is_default_included);

  return (
    <article className="rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6">
      <header className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
          <PackageIcon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold tracking-tight text-ink sm:text-lg">
            {pkg.package_name}
          </h3>
          {ctaBesidePrice && ctaSlot ? null : (
            <p className="mt-1 font-mono text-lg text-ink">
              {hidePrice ? 'Price on inquiry' : formatCentavosPhp(pkg.total_price_centavos)}
            </p>
          )}
        </div>
      </header>

      {ctaBesidePrice && ctaSlot ? (
        <div data-package-price-row="" className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="font-mono text-lg text-ink">
            {hidePrice ? 'Price on inquiry' : formatCentavosPhp(pkg.total_price_centavos)}
          </p>
          <div className="min-w-0 shrink-0">{ctaSlot}</div>
        </div>
      ) : null}

      {pkg.description ? (
        <p className="mt-3 text-sm leading-relaxed text-ink/75">
          {pkg.description}
        </p>
      ) : null}

      {includedItems.length > 0 ? (
        <div className="mt-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
            Includes ({includedItems.length}{' '}
            {includedItems.length === 1 ? 'item' : 'items'})
          </p>
          <ul className="mt-2 space-y-1.5">
            {includedItems.map((item) => (
              <li
                key={item.item_id}
                className="flex items-start gap-2 text-sm text-ink/80"
              >
                <Check
                  aria-hidden
                  className="mt-0.5 h-4 w-4 shrink-0 text-success-700"
                  strokeWidth={2}
                />
                <span>{item.service_description}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {gift ? (
        gift.setnayan ? (
          <SetnayanGiftLine className="mt-3 flex items-start gap-1.5 text-[11px] font-medium text-terracotta-700" />
        ) : (
          <p className="mt-3 flex items-start gap-1.5 text-[11px] font-medium text-terracotta-700" data-testid="bundle-shop-gift">
            <Gift aria-hidden className="h-3 w-3 shrink-0" strokeWidth={1.75} />
            <span>{gift.line}</span>
          </p>
        )
      ) : null}

      {pkg.is_consumable_flexible && pkg.consumable_budget_centavos > 0 ? (
        <p className="mt-4 rounded-lg bg-success-50/60 px-3 py-2 text-xs text-success-900">
          {hidePrice ? (
            <>
              <span className="font-semibold">Flexible consumable budget</span> can flex
              across food, beverage, or extra services.
            </>
          ) : (
            <>
              <span className="font-semibold">
                {formatCentavosPhp(pkg.consumable_budget_centavos)} consumable
              </span>{' '}
              can flex across food, beverage, or extra services.
            </>
          )}
        </p>
      ) : null}

      {ctaSlot && !ctaBesidePrice ? <div className="mt-5">{ctaSlot}</div> : null}
    </article>
  );
}
