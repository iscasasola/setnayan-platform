import { Gift } from 'lucide-react';
import {
  getVendorFreeWindowBannersFor,
  vendorDealEndsAt,
  vendorQualifiedAt,
  type VendorDealFacts,
} from '@/lib/promo-free-windows';

/**
 * Vendor-facing announcement banner for a live vendor deal. Self-gating server
 * component: renders nothing unless PROMO_FREE_WINDOWS_ENABLED is on AND a
 * banner-enabled vendor window is granting THIS vendor right now — an
 * unverified vendor is told nothing, because the deal is not theirs (owner
 * 2026-09-05: "all vendors" means all VERIFIED vendors). Mounted once in the
 * vendor dashboard layout with the vendor's own facts. The tier upgrade itself
 * is already applied via resolveVendorTier (lib/promo-free-windows.ts) — this
 * is just how vendors find out. Note: inert while paid vendor billing is off
 * (all vendors are free then).
 */
export async function PromoFreeWindowBannerVendor({ facts }: { facts: VendorDealFacts | null }) {
  if (!facts) return null;
  const banners = await getVendorFreeWindowBannersFor(facts);
  const promo = banners[0];
  if (!promo) return null;

  // "Through <date>" is THIS vendor's own end — deal length counts from when
  // they qualified, so it can differ from the window's ends_at.
  const qualifiedAt = vendorQualifiedAt(promo, facts);
  const endsMs = qualifiedAt === null ? new Date(promo.ends_at).getTime() : vendorDealEndsAt(promo, qualifiedAt);
  const endsLabel = new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Manila',
  }).format(new Date(endsMs));

  return (
    <div
      role="status"
      className="mb-5 flex items-start gap-3 rounded-xl border border-terracotta/25 bg-terracotta/5 px-4 py-3 text-sm text-ink"
    >
      <Gift
        aria-hidden
        strokeWidth={1.75}
        className="mt-0.5 h-5 w-5 shrink-0 text-terracotta-700"
      />
      <div className="min-w-0">
        <p className="font-semibold text-terracotta-700">{promo.title}</p>
        {promo.blurb ? <p className="mt-0.5 text-ink/75">{promo.blurb}</p> : null}
        <p className="mt-0.5 text-xs capitalize text-ink/55">
          {promo.promoted_vendor_tier ?? ''} features are free through {endsLabel} —
          nothing to do, it&rsquo;s already on.
        </p>
      </div>
    </div>
  );
}
