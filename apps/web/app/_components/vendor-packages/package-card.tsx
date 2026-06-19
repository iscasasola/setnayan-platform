import { Package as PackageIcon, Check } from 'lucide-react';
import {
  formatCentavosPhp,
  type VendorPackageWithItems,
} from '@/lib/vendor-packages';

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
}: {
  pkg: VendorPackageWithItems;
  ctaSlot?: React.ReactNode;
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
          <p className="mt-1 font-mono text-lg text-ink">
            {formatCentavosPhp(pkg.total_price_centavos)}
          </p>
        </div>
      </header>

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

      {pkg.is_consumable_flexible && pkg.consumable_budget_centavos > 0 ? (
        <p className="mt-4 rounded-lg bg-success-50/60 px-3 py-2 text-xs text-success-900">
          <span className="font-semibold">
            {formatCentavosPhp(pkg.consumable_budget_centavos)} consumable
          </span>{' '}
          can flex across food, beverage, or extra services.
        </p>
      ) : null}

      {ctaSlot ? <div className="mt-5">{ctaSlot}</div> : null}
    </article>
  );
}
