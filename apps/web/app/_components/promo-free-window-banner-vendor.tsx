import { Notice } from '@/app/_components/notices/notices';
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

  const tier = (promo.promoted_vendor_tier ?? '').replace(/^./, (c) => c.toUpperCase());
  // 🔔 Inventory #3 · #15 — ONE offer line for both sides (one notice system, owner approved 14 Nov 2026: "Merge"):
  // ◆ the deal's own title, the rest behind the ⓘ, "Not now" (back after 30 days; the window also ends by itself).
  // Registered for the END of the page.
  return (
    <Notice
      kind="offer"
      noticeKey={`free-window:${promo.promo_window_id}`}
      title={promo.title}
      detail={
        <>
          {promo.blurb ? <span className="block">{promo.blurb}</span> : null}
          <span className="block">{`${tier} features are free through ${endsLabel} — nothing to do, it’s already on.`}</span>
        </>
      }
    />
  );
}
