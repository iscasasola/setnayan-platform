'use client';

import Image from 'next/image';
import Link from 'next/link';
import { BadgePercent, Check, ChevronRight, Info, Users } from 'lucide-react';

import {
  CardRecordSection,
  type CardRecordRating,
} from '@/app/_components/card-record-section';
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
};

/**
 * service-card-view.tsx — THE service card. The one a couple sees.
 *
 * ── WHY IT LEFT THE PUBLIC PROFILE (owner, 2026-09-08) ─────────────────────
 * *"there is already a template of how a service card looks like. all we want
 * is for that to show instead of this."* It did exist, and it was reachable
 * from exactly one place: `app/v/[slug]/_components/services-gallery.tsx`. A
 * vendor looking at their own shop saw a grey wrench glyph and one line of
 * text instead.
 *
 * Moved verbatim. Its only dependencies were lucide icons, `next/image` and
 * `CardRecordSection` — no page-local helper — so the public profile keeps
 * rendering exactly what it rendered before, and the vendor's list now renders
 * the same component from the same builder
 * (`lib/service-card-view-model.toServiceCard`).
 *
 * 🔑 ONE CARD, NOT TWO THAT LOOK ALIKE. The vendor-side preview
 * (`service-card-face.tsx`) still exists and is still an approximation — it
 * mirrors a form as you type, which this cannot do. It is deliberately NOT
 * captioned as what couples see; this component is what couples see.
 */
export function ServiceCardView({
  card: c,
  detailsEnabled,
  onOpen,
  detailsHref,
  shop,
}: {
  card: ServiceCard;
  detailsEnabled: boolean;
  /**
   * Opens the details sheet. OPTIONAL, and every use of it is already behind
   * `detailsEnabled` — which is what lets a SERVER component render this card.
   *
   * The vendor's own card list is a server component and cannot hand a function
   * to a client one; it renders the card to be looked at, not opened. Making
   * this required would have forced a client wrapper whose only job was to
   * satisfy a type, or a second non-interactive copy of the card — and a second
   * copy is the exact thing moving this component out of the profile page was
   * meant to prevent.
   */
  onOpen?: () => void;
  /**
   * TWO DESTINATIONS ON ONE CARD (owner, 2026-09-09) — the BODY opens this
   * service's details; the LOGO opens the shop. This is the body's half.
   *
   * When present (and `detailsEnabled`), the stretched doorway is a `<Link>` to
   * this address instead of a `<button>` that opens the in-page sheet. The
   * marketplace is a server component and cannot hand a callback down; a card
   * there has to NAVIGATE to the details rather than open them in place.
   *
   * ⛔ THE TWO CONTROLS ARE SIBLINGS, NEVER NESTED. An `<a>` inside an `<a>` is
   * invalid HTML and browsers unnest it, which loses the inner link's keyboard
   * focus. The shop row below is lifted with `relative z-10` — the same trick
   * the showcase clip already uses — so it sits ABOVE the stretched overlay
   * while remaining its sibling in the tree.
   */
  detailsHref?: string | null;
  /** The shop this card belongs to. Omit on the shop's own surfaces. */
  shop?: ServiceCardShop;
}) {
  // The doorway is a LINK when the caller gave it an address, a BUTTON when it
  // gave a callback. One or the other, never both — two overlapping full-card
  // controls would be two tab stops onto the same rectangle.
  const doorwayHref = detailsEnabled && detailsHref ? detailsHref : null;
  return (
    <div
      className={
        detailsEnabled
          ? 'relative flex h-full flex-col rounded-xl border border-ink/10 bg-cream p-4 transition-colors hover:border-terracotta/40'
          : 'flex h-full flex-col rounded-xl border border-ink/10 bg-cream p-4'
      }
    >
      {/* THE SHOP ROW — the card carries its shop's logo, and the logo opens
          the shop (owner ruling, 2026-09-09). `relative z-10` lifts it above
          the stretched doorway below, exactly as the showcase clip is lifted,
          so it is a SIBLING of that control rather than nested inside it.
          Anchored at the top so it reads as "this card belongs to this shop"
          before the price, not as a footnote after it. */}
      {shop ? (
        <div className="relative z-10 mb-3 flex items-center gap-2">
          <ShopMark shop={shop} />
        </div>
      ) : null}

      <div className="flex items-baseline justify-between gap-3">
        <p className="font-medium text-ink">{c.label}</p>
        <p className="font-mono text-sm text-ink/80">{c.priceLabel}</p>
      </div>

      {/* Pricing-basis detail — how the anchor is computed (per-guest / per-hour).
          Right-aligned so it reads as a footnote to the "from ₱X" anchor above. */}
      {c.priceDetail ? (
        <p className="text-right font-mono text-[11px] text-ink/50">{c.priceDetail}</p>
      ) : null}

      {c.discountLabel ? (
        <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full border border-terracotta/30 bg-terracotta/10 px-2 py-0.5 text-[11px] font-medium text-terracotta-700">
          <BadgePercent className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
          {c.discountLabel}
        </span>
      ) : null}

      {/* Showcase media — the vendor's own gallery for THIS service (≤5 photos
          + one ≤30s clip). Rendered small + horizontal so the card stays a
          card; empty media renders nothing (no placeholders). */}
      {c.photos.length > 0 ? (
        <div className="mt-3 flex gap-1.5 overflow-x-auto">
          {c.photos.map((url, idx) => (
            <div
              key={url}
              className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-ink/5"
            >
              <Image
                src={url}
                alt={`${c.label} showcase ${idx + 1}`}
                fill
                sizes="64px"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      ) : null}

      {c.videoUrl ? (
        /* Poster-first: preload="metadata" shows the first frame without
           downloading the clip; muted + playsInline keep mobile behavior tame. */
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          src={c.videoUrl}
          controls
          preload="metadata"
          playsInline
          muted
          className={
            detailsEnabled
              ? 'relative z-10 mt-2 max-h-44 w-full rounded-lg bg-ink/5 object-cover'
              : 'mt-2 max-h-44 w-full rounded-lg bg-ink/5 object-cover'
          }
        />
      ) : null}

      {c.inclusions.length > 0 ? (
        <ul className="mt-2 space-y-0.5">
          {c.inclusions.map((line) => (
            <li key={line} className="flex items-start gap-1.5 text-[12px] text-ink/70">
              <Check
                className="mt-0.5 h-3 w-3 shrink-0 text-mulberry"
                strokeWidth={2.25}
                aria-hidden
              />
              <span>{line}</span>
            </li>
          ))}
          {c.inclusionsMore > 0 ? (
            <li className="pl-[18px] text-[12px] text-ink/45">
              +{c.inclusionsMore} more included
            </li>
          ) : null}
        </ul>
      ) : null}

      {c.meta ? <p className="mt-2 text-[12px] text-ink/55">{c.meta}</p> : null}

      {c.notIncluded.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {c.notIncluded.map((line) => (
            <li
              key={line}
              className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2 py-0.5 text-[11px] text-ink/55"
            >
              <Info className="h-3 w-3 shrink-0 text-ink/40" strokeWidth={2} aria-hidden />
              {line}
            </li>
          ))}
        </ul>
      ) : null}

      {/* Serves — who this service is declared for (coverage event types +
          faiths). Subtle closing line; services without a coverage row show
          nothing rather than guessing. */}
      {c.serves ? (
        <p className="mt-2 inline-flex items-start gap-1.5 text-[11px] text-ink/50">
          <Users className="mt-0.5 h-3 w-3 shrink-0 text-ink/35" strokeWidth={2} aria-hidden />
          <span>Serves: {c.serves}</span>
        </p>
      ) : null}

      {/* Card record — the compiled history this card has earned. Appended, not
          woven in: it closes the card below every claim the vendor authored, so
          the proof reads last. `mt-auto` inside the section pins it to the
          card's bottom edge across a grid row of unequal cards. Absent unless
          the flag is on AND the card has been booked at least once. */}
      {c.record ? (
        <CardRecordSection record={c.record} variant="couple" rating={c.recordRating} />
      ) : null}

      {/* The doorway. A VISIBLE affordance, because a card that silently became
          clickable is a card nobody clicks. Decorative only — the accessible
          name lives on the stretched overlay below, so this is aria-hidden to
          avoid announcing the same control twice. */}
      {detailsEnabled ? (
        <p
          aria-hidden
          className="mt-3 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta-700"
        >
          View details
          <ChevronRight className="h-3 w-3 shrink-0" strokeWidth={2} />
        </p>
      ) : null}

      {/* THE STRETCHED DOORWAY — last child, so it covers the static content
          without a z-index. The clip above carries `relative z-10` and stays
          usable in place, and so does the shop row at the top: both are
          SIBLINGS of this control, lifted above it, never nested inside it.

          A LINK when the caller gave an address (the marketplace, which has to
          navigate), a BUTTON when it gave a callback (the shop's own page,
          which opens the sheet in place). Exactly one renders. */}
      {detailsEnabled && doorwayHref ? (
        <Link
          href={doorwayHref}
          aria-label={`View details for ${c.label}`}
          className="absolute inset-0 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
        />
      ) : detailsEnabled ? (
        <button
          type="button"
          onClick={onOpen}
          aria-label={`View details for ${c.label}`}
          className="absolute inset-0 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
        />
      ) : null}
    </div>
  );
}

/**
 * The shop's logo + name, as ONE control that opens the shop.
 *
 * ⚠ THE LINK WRAPS THE LOGO **AND** THE NAME on purpose, and that is not a
 * widening of the owner's "the logo opens the shop". A bare 32px image link has
 * no accessible name and no readable label — a screen reader announces a link
 * with nothing in it, and a thumb misses it. The name is what LABELS the logo,
 * so the two are one target. It stays the logo's control: nothing else on the
 * card is inside it.
 *
 * A shop with no address (`href === null`) renders the same row with no link at
 * all rather than a dead `#` — a control that goes nowhere is worse than none.
 */
function ShopMark({ shop }: { shop: ServiceCardShop }) {
  const initials =
    shop.name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('') || '?';

  const inner = (
    <>
      {shop.logoUrl ? (
        <span className="relative block h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-ink/5">
          <Image src={shop.logoUrl} alt="" fill sizes="32px" className="object-cover" />
        </span>
      ) : (
        <span
          aria-hidden
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-terracotta/10 text-[11px] font-semibold text-terracotta-700"
        >
          {initials}
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate text-[12px] font-medium text-ink/80">{shop.name}</span>
        {shop.city ? (
          <span className="block truncate font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
            {shop.city}
          </span>
        ) : null}
      </span>
    </>
  );

  if (!shop.href) {
    return <span className="flex min-w-0 items-center gap-2">{inner}</span>;
  }

  return (
    <Link
      href={shop.href}
      aria-label={`Visit ${shop.name}`}
      className="flex min-w-0 items-center gap-2 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta hover:text-terracotta"
    >
      {inner}
    </Link>
  );
}
