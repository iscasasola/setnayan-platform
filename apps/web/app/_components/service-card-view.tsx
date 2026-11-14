'use client';

import { SetnayanGiftLine } from '@/app/_components/setnayan-gift-line';
import {
  ServiceFace,
  includesLineOf,
  notIncludedWord,
  type ServiceFaceDoor,
} from '@/app/_components/service-face';
import type { ServiceCard } from '@/lib/service-card-view-model';

/**
 * The shop a marketplace card belongs to — its logo, its name, and the address
 * that logo opens. Present ONLY where the card is shown away from its own shop
 * (the marketplace). The shop's own profile and the vendor's own list omit it:
 * a shop does not need its own logo stamped on every card it authored.
 */
export type ServiceCardShop = {
  /** Display name, also the accessible label of the logo link. */
  name: string;
  /**
   * The shop's public address — the CLEAN bare-root `/{slug}` the supplier's
   * dashboard promises them as "your address for good", never the legacy
   * `/v/{slug}`. null → no address to open, so the row renders unlinked.
   */
  href: string | null;
  /**
   * An ALREADY-RESOLVED display URL. The stored column holds `r2://bucket/key`,
   * which a browser cannot fetch — resolve it server-side with `displayLogoUrl`
   * before it gets here. null → the initials tile.
   */
  logoUrl: string | null;
  /** Optional city line under the name. */
  city?: string | null;
  /**
   * 🧪 `vendor_profiles.is_demo` — the shop row wears "(DEMO ONLY)" (owner, DECISION_LOG 2026-11-06 "DEMO SHOPS + DEMO
   * EVENTS"). Beside the logo link, never inside it (the marker's ⓘ is a button).
   */
  isDemo?: boolean;
  /** The shop passed Setnayan's verification — the Verified pill on the shop line. */
  verified?: boolean;
};

/**
 * service-card-view.tsx — the marketplace / shop-page ADAPTER onto THE one service card face (`service-face.tsx`).
 *
 * It used to draw its own text-first card (name + mono price on top, a strip of 64 px photos, ✓ inclusions, looks,
 * "crew meal required" AND a "Crew meal not included" chip, Serves, VIEW DETAILS). Owner, 12 Nov 2026, asked whether
 * that was the service card template: *"Something else"* — then *"Yes, build it"* on the prototype that puts the Find
 * card everywhere (DECISION_LOG "ONE SERVICE CARD, EVERYWHERE"). This file now only maps a `ServiceCard` into
 * `ServiceFace`. The photos, the clip, looks, couples' photos, reviews, Serves and the record live in the Service card
 * grown (`service-details-sheet.tsx`), which the face opens.
 *
 * The door stays behind `detailsEnabled` (the details flag): OFF → a card to look at, no control on it.
 */
export function ServiceCardView({
  card: c,
  detailsEnabled,
  onOpen,
  detailsHref,
  shop,
  path = null,
  pathLead = null,
  coverUrl = null,
}: {
  card: ServiceCard;
  detailsEnabled: boolean;
  /** Opens the details sheet in place (the shop's own page). Handed the card's own box, so the grown card rises from it. */
  onOpen?: (from: HTMLElement | null) => void;
  /** The marketplace NAVIGATES to the details (a server component cannot hand a callback down). */
  detailsHref?: string | null;
  /** The shop this card belongs to. Omit on the shop's own surfaces. */
  shop?: ServiceCardShop;
  /** "Mobile Bar · Booths, carts & bars" — the card's category, said on the face. */
  path?: string | null;
  /** 📸 The card's service, pressable — opens photos by service (`ServiceFace` `pathLead`). */
  pathLead?: { label: string; onPress: () => void; ariaLabel: string } | null;
  /** The card's own cover (`primary_photo_r2_key`, resolved). Falls back to its first photo — Find's rule. */
  coverUrl?: string | null;
}) {
  // A LINK when the caller gave an address, a BUTTON when it gave a callback — one door, never two.
  const door: ServiceFaceDoor | undefined = !detailsEnabled
    ? undefined
    : detailsHref
      ? { href: detailsHref, label: `View details for ${c.label}` }
      : onOpen
        ? { onOpen, label: `View details for ${c.label}`, hasPopup: true }
        : undefined;
  return (
    <ServiceFace
      id={c.anchorId}
      name={c.label}
      coverUrl={coverUrl ?? c.photos[0] ?? null}
      // 🎞 The card's showcase photos play on the cover (owner 12 Nov) — the face drops the cover's repeat.
      photos={c.photos}
      discount={c.discountLabel}
      path={path}
      pathLead={pathLead}
      shop={
        shop
          ? { name: shop.name, href: shop.href, logoUrl: shop.logoUrl, verified: shop.verified, isDemo: shop.isDemo }
          : undefined
      }
      city={shop?.city ?? null}
      rating={shop ? c.recordRating : null}
      price={c.priceLabel || null}
      priceNote={c.priceDetail}
      includes={includesLineOf(c.inclusions, c.inclusionsMore)}
      notIncluded={c.notIncluded.map(notIncludedWord)}
      gift={
        c.givesSetnayanGift ? (
          <SetnayanGiftLine className="flex items-start gap-1 text-[10.5px] leading-snug text-[var(--m-orange-2)]" />
        ) : null
      }
      door={door}
    />
  );
}

/**
 * ✓ VERIFIED BOOKING — the green pill ON the photo (the approved design's `.vbm`, For Suppliers 2026-11-06): a white
 * plate with the house ok-green word (`--color-ok`, the design's `--ok`), bottom-left. The design draws it at 9.3 px; a public page's floor is 12 px (Guest
 * Legibility Floor), so it is drawn at 12 px and may wrap to two lines on a narrow tile rather than shrink.
 * Shared with the shop's own Approve grid (`couple-photos-list.tsx`) so the two can never draw two different marks.
 * Draw it ONLY where the database said the shop is booked on the photo's event — never as decoration.
 */
export function VerifiedBookingMark() {
  return (
    <span
      data-card-verified-booking=""
      className="absolute bottom-1 left-1 right-1 z-[1] w-fit max-w-full rounded-lg bg-cream/95 px-1.5 py-0.5 font-sans text-[12px] font-semibold leading-[1.2] text-[rgb(var(--color-ok))] shadow-sm"
      title="This couple booked this supplier for their event — checked by Setnayan."
    >
      ✓ Verified booking
    </span>
  );
}
