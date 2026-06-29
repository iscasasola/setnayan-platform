import Link from 'next/link';
import type { ShowcaseVendorCredit } from '@/lib/showcase-db';

/**
 * VendorCreditChip — the reusable, tappable vendor-credit pill (P0 primitive).
 *
 * A small chip that deep-links to a vendor's public marketplace profile
 * (`/v/[slug]`), showing their logo (when available) + business name. Born for
 * Style-Twin Discovery (credited vendors on a Real Story card), but designed to
 * be reused anywhere a vendor needs a tappable credit/badge — editorial
 * spotlights, off-season offers, etc.
 *
 * Type-only import of ShowcaseVendorCredit (erased at compile time) keeps this
 * safe to render inside client components without pulling in server-only
 * showcase-db code.
 */
export function VendorCreditChip({ vendor }: { vendor: ShowcaseVendorCredit }) {
  return (
    <Link
      href={`/v/${vendor.slug}`}
      className="inline-flex items-center gap-1.5 rounded-full border border-ink/12 bg-white/80 px-2.5 py-1 text-[11px] font-medium text-ink/75 transition-colors hover:border-terracotta/40 hover:bg-white hover:text-ink"
    >
      {vendor.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={vendor.logoUrl}
          alt=""
          aria-hidden
          className="h-4 w-4 shrink-0 rounded-full object-cover"
        />
      ) : null}
      <span className="max-w-[9rem] truncate">{vendor.name}</span>
    </Link>
  );
}
