import Link from 'next/link';
import { Heart } from 'lucide-react';
import type { SavedVendorCard as SavedVendorCardData } from '../_data/saved-vendors';

/**
 * Lighter, bespoke saved-vendor card for the Library tab. The marketplace
 * `VendorCard` (app/explore/_components/vendor-card.tsx) carries the full
 * badge/review/price machinery that this cross-event "saved" surface doesn't
 * need, so this is a v1-simple card: logo (or initial), display name, category,
 * a "Saved in N events" chip, and a link to the public profile.
 *
 * Card shell matches galleries/page.tsx: rounded-2xl border border-ink/10.
 * Uses a PLAIN <img> for the (already-public) R2/Supabase logo URL because that
 * host isn't in the next/image domain allowlist on this surface.
 */
export function SavedVendorCardItem({ vendor }: { vendor: SavedVendorCardData }) {
  const initial = vendor.displayName.trim().charAt(0).toUpperCase() || 'V';

  const inner = (
    <>
      <div className="flex min-w-0 items-start gap-3">
        {vendor.logoUrl ? (
          // presigned/public R2 host isn't in the next/image allowlist here.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={vendor.logoUrl}
            alt=""
            className="mt-0.5 h-11 w-11 shrink-0 rounded-xl object-cover ring-1 ring-ink/10"
          />
        ) : (
          <span className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-terracotta/10 text-base font-semibold text-terracotta ring-1 ring-terracotta/15">
            {initial}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-ink">
            {vendor.displayName}
          </h3>
          {vendor.categoryLabel ? (
            <p className="mt-0.5 truncate text-xs text-ink/55">
              {vendor.categoryLabel}
            </p>
          ) : null}
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-terracotta/10 px-2 py-0.5 text-[11px] font-medium text-terracotta">
            <Heart aria-hidden className="h-3 w-3" strokeWidth={2} />
            Saved in {vendor.savedInEventCount}{' '}
            {vendor.savedInEventCount === 1 ? 'event' : 'events'}
          </span>
        </div>
      </div>
    </>
  );

  const shell =
    'rounded-2xl border border-ink/10 bg-white p-4 shadow-sm transition-colors sm:p-5';

  if (vendor.businessSlug) {
    return (
      <Link
        href={`/v/${vendor.businessSlug}`}
        className={`${shell} block hover:border-ink/20`}
      >
        {inner}
      </Link>
    );
  }

  return <div className={shell}>{inner}</div>;
}
