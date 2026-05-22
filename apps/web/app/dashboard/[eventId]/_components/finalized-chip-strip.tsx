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
//   - 36×36 round avatar
//   - Category label as small uppercase Manrope above business name
//   - Cormorant-italic-display business name (matches brand)
//   - ✓ Locked badge in small terracotta below
//   - Single tap → vendor detail at /dashboard/[eventId]/vendors
//   - NO edit pencil · NO compare button · NO un-lock affordance
//     here. The host re-enters compare flow via the locked-card
//     variant in planning-groups.tsx (which carries the Switch action).
//
// Finalized-card-service-photo refinement (2026-05-22, follow-up).
// The 36×36 avatar now resolves via a 3-tier fallback:
//   PRIORITY 1: service_primary_photo_url — the booked vendor_services
//               row's primary photo. Strongest signal because it shows
//               the SERVICE the host actually selected (a band's hero
//               photo, a caterer's signature dish, a coordinator's
//               flagship event spread).
//   PRIORITY 2: marketplace_logo_url — the vendor's overall logo from
//               vendor_profiles. PR #341 baseline. Use when the service
//               hasn't uploaded its own photo OR when service_id is
//               null (off-platform / pre-2026-05-22 rows).
//   PRIORITY 3: initials-on-terracotta — when both photo sources are
//               null. Off-platform / custom rows where the host typed
//               the vendor name themselves land here.
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
  /**
   * PRIORITY 1 avatar source. Resolved public URL for the booked
   * service's primary photo (vendor_services.primary_photo_r2_key →
   * r2PublicUrl). Null when no service photo exists or the row has no
   * service_id (off-platform / pre-2026-05-22 rows). See
   * EventVendorRowInput.service_primary_photo_url for the source-side
   * doc.
   */
  service_primary_photo_url?: string | null;
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
  servicePhotoUrl,
  vendorLogoUrl,
  name,
}: {
  /**
   * PRIORITY 1 — the booked service's primary photo. Wins when present
   * + optimizable. See parent component doc-block for the full ladder.
   */
  servicePhotoUrl: string | null;
  /**
   * PRIORITY 2 — the vendor's overall logo. Falls through when service
   * photo is absent OR not optimizable. PR #341 baseline.
   */
  vendorLogoUrl: string | null;
  name: string;
}) {
  const initials = deriveInitials(name);
  // Resolve in fallback order: service photo → vendor logo → initials.
  // We re-run isOptimizableImageUrl on the chosen URL so a malformed
  // service photo URL still falls through to the logo instead of
  // rendering broken markup.
  const chosen =
    servicePhotoUrl && isOptimizableImageUrl(servicePhotoUrl)
      ? servicePhotoUrl
      : vendorLogoUrl && isOptimizableImageUrl(vendorLogoUrl)
        ? vendorLogoUrl
        : null;
  if (chosen) {
    return (
      <span className="inline-flex h-9 w-9 shrink-0 overflow-hidden rounded-full border border-ink/10 bg-cream">
        <Image
          src={chosen}
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
          // 3-tier avatar resolution (2026-05-22 refinement on PR #341):
          //   1. service primary photo · vendor_services row the host booked
          //   2. vendor logo · vendor_profiles.logo_url (PR #341 baseline)
          //   3. initials placeholder · handled inside VendorAvatar
          const servicePhotoUrl = v.service_primary_photo_url ?? null;
          const vendorLogoUrl = v.marketplace_logo_url ?? null;
          return (
            <li key={v.vendor_id}>
              <Link
                href={`/dashboard/${eventId}/vendors`}
                className="group inline-flex min-h-[44px] items-center gap-3 rounded-xl border border-terracotta/30 bg-cream px-3 py-2 transition-colors hover:border-terracotta/60 hover:bg-terracotta/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
                aria-label={`Finalized: ${displayName} — ${categoryLabel}`}
              >
                <VendorAvatar
                  servicePhotoUrl={servicePhotoUrl}
                  vendorLogoUrl={vendorLogoUrl}
                  name={displayName}
                />
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
