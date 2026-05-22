import Image from 'next/image';
import Link from 'next/link';
import { BookmarkCheck } from 'lucide-react';
import { VENDOR_CATEGORY_LABEL, type VendorCategory } from '@/lib/vendors';
import { CONFIRMED_VENDOR_STATUSES } from '@/lib/events';

// V1 pilot Home v2 — owner directive 2026-05-22.
// Quiet strip of locked-in vendors. Sits BELOW BudgetCountdownHeader and
// ABOVE the Today's-one-thing hero card so the host sees their
// commitments at a glance before scrolling into the planning grid.
//
// "Finalized" = status is at-or-past 'contracted' (per
// CONFIRMED_VENDOR_STATUSES in lib/events.ts). Considering / Shortlisted
// don't surface here — that's the planning grid's job, not the locked
// strip.
//
// Empty-state collapse (owner directive 2026-05-22, second pass): when
// nothing is locked yet, this section renders nothing — the "Nothing
// locked yet — start with your reception venue" hint moved to a subtitle
// on the Today's-one-thing hero card. Returning null here keeps the
// section above the planning grid quiet until the host actually has
// commitments to show. PRESERVED unchanged.
//
// Finalized-vendor-photo-card (2026-05-22 — owner directive PR D).
// Upgrades each chip from text-only ("Catering · La Maison") to a
// logo+name card with:
//   - 36×36 round logo (loaded from vendor_profiles.logo_url when the
//     vendor is marketplace-linked; initials-on-terracotta fallback
//     for off-platform / custom rows)
//   - Category label as small uppercase Manrope above business name
//   - Cormorant-italic-display business name (matches brand)
//   - ✓ Locked badge in small terracotta below
//   - Single tap → vendor detail at /dashboard/[eventId]/vendors
//   - NO edit pencil · NO compare button · NO un-lock affordance
//     here. The host re-enters compare flow via the locked-card
//     variant in planning-groups.tsx (which carries the Switch action).
//
// Empty-state collapse from PR #335 PRESERVED (still returns null when
// count === 0).

type FinalizedVendor = {
  vendor_id: string;
  vendor_name: string;
  category: VendorCategory;
  status: string | null;
  /**
   * Marketplace-linked vendor's canonical logo URL + business name from
   * vendor_profiles join. Null for off-platform / custom rows. See
   * EventVendorRowInput in lib/wedding-plan-groups.ts for the source.
   */
  marketplace_logo_url?: string | null;
  marketplace_business_name?: string | null;
};

type Props = {
  eventId: string;
  vendors: ReadonlyArray<FinalizedVendor>;
};

const CONFIRMED_SET = new Set<string>(CONFIRMED_VENDOR_STATUSES as readonly string[]);

function deriveInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((p) => p.charAt(0).toUpperCase())
      .filter((c) => c.length > 0)
      .slice(0, 2)
      .join('') || '?'
  );
}

function isOptimizableImageUrl(url: string): boolean {
  // next/image needs an absolute URL OR a leading-slash path. Returning
  // false on data: / blob: / relative paths sends us into the placeholder
  // branch which is the conservative default — a missing image renders as
  // initials, never as broken markup. Pattern mirrors apps/web/app/vendors.
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/');
}

function VendorAvatar({
  logoUrl,
  name,
}: {
  logoUrl: string | null;
  name: string;
}) {
  const initials = deriveInitials(name);
  if (logoUrl && isOptimizableImageUrl(logoUrl)) {
    return (
      <span className="inline-flex h-9 w-9 shrink-0 overflow-hidden rounded-full border border-ink/10 bg-cream">
        <Image
          src={logoUrl}
          alt=""
          width={36}
          height={36}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-terracotta/15 font-mono text-[11px] font-semibold text-terracotta-700"
    >
      {initials}
    </span>
  );
}

export function FinalizedChipStrip({ eventId, vendors }: Props) {
  const locked = vendors.filter(
    (v) => v.status !== null && CONFIRMED_SET.has(v.status),
  );
  const count = locked.length;

  // Empty-state collapse: nothing locked yet → render nothing. The
  // "start with your reception venue" prompt lives on the Today's-one-
  // thing hero card instead (shipped via PR #335 + #337). Returning null
  // here keeps the section quiet so the host's eye flows straight from
  // BudgetCountdownHeader into the hero card.
  if (count === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="finalized-chip-strip-heading"
      className="space-y-3"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id="finalized-chip-strip-heading"
          className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55"
        >
          {`✓ Finalized · ${count} locked`}
        </h2>
      </div>

      <ul className="flex flex-wrap gap-2 sm:gap-3">
        {locked.map((v) => {
          const categoryLabel = VENDOR_CATEGORY_LABEL[v.category] ?? 'Vendor';
          const displayName = v.marketplace_business_name ?? v.vendor_name;
          const logoUrl = v.marketplace_logo_url ?? null;
          return (
            <li key={v.vendor_id}>
              <Link
                href={`/dashboard/${eventId}/vendors`}
                className="group inline-flex min-h-[44px] items-center gap-3 rounded-xl border border-terracotta/30 bg-cream px-3 py-2 transition-colors hover:border-terracotta/60 hover:bg-terracotta/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
                aria-label={`Finalized: ${displayName} — ${categoryLabel}`}
              >
                <VendorAvatar logoUrl={logoUrl} name={displayName} />
                <span className="flex min-w-0 flex-col">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55 group-hover:text-ink/75">
                    {categoryLabel}
                  </span>
                  <span className="truncate text-sm font-medium text-ink">
                    {displayName}
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.15em] text-terracotta">
                    <BookmarkCheck
                      aria-hidden
                      className="h-2.5 w-2.5"
                      strokeWidth={2}
                    />
                    Locked
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
