import Link from 'next/link';
import { ChevronRight, Heart, MessageCircle } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Badge } from '@/app/_components/badge';
import type { SavedVendorCard as SavedVendorCardData } from '../_data/saved-vendors';
import { formatCount } from '@/lib/format-number';

/**
 * Lighter, bespoke saved-supplier row for the Library tab (a hairline row since 2026-11-14). The marketplace
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
  const initial = vendor.displayName.trim().charAt(0).toUpperCase() || 'S';

  const inner = (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {vendor.logoUrl ? (
          // presigned/public R2 host isn't in the next/image allowlist here.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={vendor.logoUrl}
            alt=""
            className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-ink/10"
          />
        ) : (
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-terracotta/10 text-base font-semibold text-ink ring-1 ring-terracotta/15">
            {initial}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-ink">
            {vendor.displayName}
          </h3>
          {vendor.categoryLabel ? (
            <p className="mt-0.5 truncate text-xs text-ink/70">
              {vendor.categoryLabel}
            </p>
          ) : null}
          <span className="mt-1 block">
            <Badge tone="quiet">
              <Heart aria-hidden className="mr-1 h-3 w-3" strokeWidth={2} />
              Saved in {formatCount(vendor.savedInEventCount)}{' '}
              {vendor.savedInEventCount === 1 ? 'event' : 'events'}
            </Badge>
          </span>
        </div>
      </div>
    </>
  );

  // A plain hairline row (design template 2026-11-14 rule 2) — the list draws the hairlines.
  const shell = 'flex min-h-14 items-center gap-3 py-2';

  // With a public profile: the identity block links to the profile, and a
  // dedicated "Contact" link deep-links to the same profile with ?src=favorites
  // so the composer stamps inquiry_source='favorites'. Two sibling links (no
  // nested-anchor) inside one non-link card shell.
  if (vendor.businessSlug) {
    return (
      <li className={shell}>
        <Link href={`/v/${vendor.businessSlug}`} className="flex min-w-0 flex-1 items-center gap-2">
          {inner}
          <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-sn-accent" strokeWidth={1.75} />
        </Link>
        <ActionButton
          tone="info"
          icon={<MessageCircle aria-hidden />}
          label="Contact"
          name={`Contact ${vendor.displayName}`}
          href={`/v/${vendor.businessSlug}?src=favorites`}
        />
      </li>
    );
  }

  return <li className={shell}>{inner}</li>;
}
