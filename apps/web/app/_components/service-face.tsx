import Link from 'next/link';
import { AlertCircle, BadgeCheck, Gift, Star } from 'lucide-react';
import type { ReactNode } from 'react';

import { DemoOnlyMarker } from '@/app/_components/sample-marker';
import { ServiceFaceDoorButton } from '@/app/_components/service-face-door';
import { formatCount } from '@/lib/format-number';

/**
 * service-face.tsx — THE ONE SERVICE CARD FACE. Every service card in the app is drawn here.
 *
 * Owner, 12 Nov 2026: *"service cards needs to stay and look consistent all throughout the app"* — asked whether the
 * text-first cards on the shop page were the template: *"Something else"* — then, on the Now-beside-Proposed prototype
 * (corpus `prototypes/service_cards_one_template_2026-11-12/`): *"Yes, build it"*. The template is the card couples
 * meet in Suppliers › Find (DECISION_LOG 9 Nov: *"a service card looks exactly like it does in Suppliers › Find"*):
 * the cover on the left, the facts beside it.
 *
 *   · cover 80 × 112 (5 : 7), initials when there is none
 *   · name (+ the best offer pill) · path line · the shop line (only away from the shop) · city / rating
 *   · the price, in the app's font · ONE "Includes:" line (words only — 11 Nov "INCLUDED LINES HAVE NO PRICE")
 *   · ONE "Not included:" line (crew meal is said once, here) · the gift line
 *
 * Photos, the clip, looks, couples' photos, reviews, Serves and the card record are NOT on the face — they live in the
 * Service card grown, which the face opens.
 *
 * 🔒 THE CALLER OWNS ONLY WHAT IS AROUND THE FACE: the door (where a tap goes) and the footer (Find's verbs, the
 * maker's "Request a quote" drawing, nothing in a thread). The supplier's Edit · Share · Online row sits UNDER the
 * card, outside its frame (11 Nov row ruling). Adapters map their data in — `ServiceCardView` (the marketplace / shop
 * model), `ServiceCardFace` (the maker's Snapshot) and Find's `InlineMoreCard` — and none of them draws a card of its
 * own. `lib/one-service-card-face.test.ts` fails if one starts to.
 */

export type ServiceFaceShop = {
  name: string;
  /** The shop's public address. null → the line renders unlinked. */
  href: string | null;
  /** An ALREADY-RESOLVED display URL (never `r2://…`). null → initials. */
  logoUrl: string | null;
  verified?: boolean;
  isDemo?: boolean;
};

/** Where a tap on the face goes. A LINK when the caller has an address, a BUTTON when it has a callback. */
export type ServiceFaceDoor =
  | { href: string; label: string }
  | { onOpen: (from: HTMLElement | null) => void; label: string; hasPopup?: boolean };

/** "Includes: a · b · c +2" — the ONE wording of the includes line (the maker's Snapshot builds the same string). */
export function includesLineOf(words: readonly string[], more = 0): string | null {
  if (words.length === 0) return null;
  const shown = words.slice(0, 3);
  const hidden = words.length - shown.length + Math.max(0, more);
  return `Includes: ${shown.join(' · ')}${hidden > 0 ? ` +${hidden}` : ''}`;
}

/**
 * "Crew meal not included" → "crew meal". The marketplace model pre-words each flag as a sentence; the face says
 * "Not included:" once and lists the things, which is how the crew meal stops being said twice.
 */
export function notIncludedWord(line: string): string {
  const word = line.replace(/\s+not included\.?$/i, '').trim();
  return word.charAt(0).toLowerCase() + word.slice(1);
}

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('') || '?'
  );
}

export function ServiceFace({
  name,
  coverUrl = null,
  cover,
  coverCorner,
  discount = null,
  path = null,
  shop,
  lines,
  city = null,
  rating = null,
  price = null,
  priceNote = null,
  priceMissing = null,
  includes = null,
  notIncluded = [],
  gift = null,
  extra = null,
  footer = null,
  door,
  framed = true,
  id,
}: {
  name: string;
  /** Plain display URL of the cover. Ignored when `cover` is given. */
  coverUrl?: string | null;
  /** A ready cover node (the maker passes its framed image). */
  cover?: ReactNode;
  /** A small pill ON the cover ("Featured"). */
  coverCorner?: ReactNode;
  discount?: string | null;
  /** "Mobile Bar · Booths, carts & bars" — what the service is. */
  path?: string | null;
  /** The shop this card belongs to. OMIT on the shop's own surfaces. */
  shop?: ServiceFaceShop;
  /** Extra short lines a surface must say about the SUPPLIER (Find: "Real name shown after they reply", date fit). */
  lines?: ReactNode;
  city?: string | null;
  /** Trusted average + review count. A count of 0 or none shows the average alone. */
  rating?: { avg: number; count?: number | null } | null;
  price?: string | null;
  /** How the anchor is computed ("₱350 / guest · min 50 guests"). */
  priceNote?: string | null;
  /** Said in place of a price when none is shown ("Price on request"). */
  priceMissing?: string | null;
  /** The "Includes: …" line — build it with `includesLineOf`. */
  includes?: string | null;
  /** The things not included, as words ("crew meal", "transport (by distance)"). */
  notIncluded?: readonly string[];
  /** The ONE gift line (`SetnayanGiftLine` or the shop's own pack). */
  gift?: ReactNode;
  /** One more quiet line the maker shows its supplier ("Add-ons from +₱…"). */
  extra?: ReactNode;
  /** Inside the frame, under the face — Find's verbs, the maker's quote drawing. */
  footer?: ReactNode;
  door?: ServiceFaceDoor;
  /** false → the caller already draws the frame (Find's `.vcw`). */
  framed?: boolean;
  id?: string;
}) {
  const coverNode =
    cover ??
    (coverUrl ? (
      // eslint-disable-next-line @next/next/no-img-element -- an already-resolved display URL, like Find's cover
      <img src={coverUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
    ) : (
      <span aria-hidden className="font-serif text-[22px] italic text-[var(--m-paper)]">
        {initialsOf(shop?.name ?? name)}
      </span>
    ));

  return (
    <div
      id={id}
      data-service-face=""
      className={
        framed
          ? 'relative flex h-full w-full flex-col gap-2 rounded-2xl border border-[var(--m-line)] bg-[var(--m-paper)] p-3 transition-colors hover:border-[var(--m-orange-2)]' // no-card-ok: the service card is pressable — the face opens the Service card grown (or the Card Maker); 11 Nov "the card is the only frame"
          : 'relative flex flex-col gap-2'
      }
    >
      <div className="grid grid-cols-[80px_minmax(0,1fr)] items-start gap-x-3 gap-y-1">
        <span className="relative flex h-28 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--m-slate)]">
          {coverNode}
          {coverCorner ? <span className="absolute inset-x-1.5 bottom-1.5 text-center">{coverCorner}</span> : null}
        </span>

        <span className="flex min-w-0 flex-col gap-[3px]">
          <span className="flex flex-wrap items-center gap-1.5 text-[14px] font-semibold leading-tight text-[var(--m-ink)] [overflow-wrap:anywhere]">
            {name}
            {discount ? (
              <span className="rounded-full bg-[rgb(var(--color-ok)/0.12)] px-2 py-0.5 text-[10px] font-medium leading-tight text-[rgb(var(--color-ok))]">
                {discount}
              </span>
            ) : null}
          </span>
          {path ? <span className="truncate text-[11px] leading-snug text-[var(--m-slate-2)]">{path}</span> : null}
          {shop ? <ShopLine shop={shop} /> : null}
          {lines}
          {city || rating ? (
            <span className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--m-slate-2)]">
              {city ? <span className="truncate">{city}</span> : null}
              {rating ? (
                <span className="inline-flex items-center gap-1">
                  <Star aria-hidden className="h-3 w-3 text-[var(--m-orange-2)]" strokeWidth={1.75} />
                  {rating.avg.toFixed(1)}
                  {rating.count ? ` · ${formatCount(rating.count)}` : ''}
                </span>
              ) : null}
            </span>
          ) : null}
          {price ? (
            <span className="text-[12.5px] font-medium text-[var(--m-orange-2)]">
              {price}
              {priceNote ? <span className="font-normal text-[var(--m-slate-2)]"> · {priceNote}</span> : null}
            </span>
          ) : priceMissing ? (
            <span className="text-[12.5px] text-[var(--m-slate-2)]">{priceMissing}</span>
          ) : null}
          {includes ? (
            <span className="flex items-start gap-1 text-[11.5px] font-medium leading-snug text-[rgb(var(--color-ok))]">
              <Gift aria-hidden className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={1.75} />
              <span>{includes}</span>
            </span>
          ) : null}
          {extra}
          {notIncluded.length > 0 ? (
            <span className="flex items-start gap-1 rounded-md bg-[var(--m-orange-4)] px-2 py-0.5 text-[11px] leading-snug text-[var(--m-orange-deep)]">
              <AlertCircle aria-hidden className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={1.75} />
              <span>Not included: {notIncluded.join(' · ')}</span>
            </span>
          ) : null}
          {gift}
        </span>
      </div>

      {footer ? <div className="relative z-10">{footer}</div> : null}

      {/* THE DOOR — last child, stretched over the face. The shop line and the footer are lifted above it (z-10) and
          stay its SIBLINGS: an <a> inside an <a> is invalid HTML. */}
      {door && 'href' in door ? (
        <Link
          href={door.href}
          aria-label={door.label}
          className="absolute inset-0 rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
        />
      ) : door ? (
        <ServiceFaceDoorButton label={door.label} hasPopup={door.hasPopup} onOpen={door.onOpen} />
      ) : null}
    </div>
  );
}

/** The shop line: a round logo + the name (one control that opens the shop), then Verified. */
function ShopLine({ shop }: { shop: ServiceFaceShop }) {
  const logo = shop.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- an already-resolved logo URL; a pasted legacy host must not 400 through next/image
    <img src={shop.logoUrl} alt="" className="h-5 w-5 shrink-0 rounded-full object-cover" loading="lazy" />
  ) : (
    <span
      aria-hidden
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--m-orange-4)] text-[8px] font-bold text-[var(--m-orange-deep)]"
    >
      {initialsOf(shop.name)}
    </span>
  );
  const inner = (
    <>
      {logo}
      <span className="truncate">{shop.name}</span>
    </>
  );
  return (
    <span className="relative z-10 flex min-w-0 items-center gap-1.5 text-[12px] font-medium text-[var(--m-slate-2)]" data-service-face-shop="">
      {shop.href ? (
        <Link href={shop.href} aria-label={`Visit ${shop.name}`} className="flex min-w-0 items-center gap-1.5 hover:text-terracotta">
          {inner}
        </Link>
      ) : (
        <span className="flex min-w-0 items-center gap-1.5">{inner}</span>
      )}
      {shop.verified ? (
        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-[rgb(var(--color-ok)/0.12)] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[rgb(var(--color-ok))]">
          <BadgeCheck aria-hidden className="h-2.5 w-2.5" strokeWidth={2} /> Verified
        </span>
      ) : null}
      {shop.isDemo ? <DemoOnlyMarker /> : null}
    </span>
  );
}
