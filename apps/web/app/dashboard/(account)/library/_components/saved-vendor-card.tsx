import Link from 'next/link';
import { Heart, MessageCircle } from 'lucide-react';
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
 *
 * Contact (Creator Economy PR-D · owner 2026-07-17): a "Contact" link deep-links
 * to the vendor's public profile with `?src=favorites`, so the profile's own
 * InquiryComposer runs the canonical `startServiceInquiry` and stamps
 * `inquiry_source='favorites'`. Saved vendors are ACCOUNT-scoped but a thread is
 * EVENT-scoped, so we deliberately reuse the composer's existing event
 * resolution (single/primary active event; onboarding redirect when there's no
 * event yet) rather than duplicating an account-level event picker + service
 * chooser — the composer already owns the full, correct inquiry flow.
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

  // With a public profile: the identity block links to the profile, and a
  // dedicated "Contact" link deep-links to the same profile with ?src=favorites
  // so the composer stamps inquiry_source='favorites'. Two sibling links (no
  // nested-anchor) inside one non-link card shell.
  if (vendor.businessSlug) {
    return (
      <div className={`${shell} flex flex-col hover:border-ink/20`}>
        <Link href={`/v/${vendor.businessSlug}`} className="block">
          {inner}
        </Link>
        <Link
          href={`/v/${vendor.businessSlug}?src=favorites`}
          className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-md border border-terracotta/30 bg-terracotta/5 px-3 py-2 text-xs font-semibold text-terracotta transition-colors hover:bg-terracotta/10"
        >
          <MessageCircle aria-hidden className="h-3.5 w-3.5" strokeWidth={1.9} />
          Contact
        </Link>
      </div>
    );
  }

  return <div className={shell}>{inner}</div>;
}
