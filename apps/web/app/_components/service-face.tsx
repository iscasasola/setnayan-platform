import Link from 'next/link';
import { AlertCircle, BadgeCheck, Check, Gift, MapPin, Star } from 'lucide-react';
import type { ReactNode } from 'react';

import { DemoOnlyMarker } from '@/app/_components/sample-marker';
import { ServiceFaceCoverShow } from '@/app/_components/service-face-cover-show';
import { ServiceFaceDoorButton } from '@/app/_components/service-face-door';
import { formatCount } from '@/lib/format-number';
import { coverPhotoList, type CoverPhoto } from '@/lib/service-cover-show';
import { SET_YOUR_VENUE_LINE, type MallPrice } from '@/lib/mall-card';

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
 * The clip, looks, couples' photos, reviews, Serves and the card record are NOT on the face — they live in the
 * Service card grown, which the face opens.
 *
 * 🎞 THE COVER PLAYS (owner 12 Nov, "Yes, build it"): given `photos`, the cover crossfades through the cover + the
 * showcase photos (≤6), and a swipe on the photo turns it — `service-face-cover-show.tsx`, rules in
 * `lib/service-cover-show.ts`. One photo → the still cover, exactly as before. A bundle passes its services' photos.
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
  photos,
  cover,
  coverCorner,
  discount = null,
  path = null,
  pathLead = null,
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
  layout = 'row',
  mallPrice = null,
  medals = null,
  distance = null,
  askVenue = false,
  coverAction = null,
}: {
  name: string;
  /** Plain display URL of the cover. Ignored when `cover` is given. */
  coverUrl?: string | null;
  /**
   * The card's other photos (already-resolved display URLs; a bundle passes `CoverPhoto`s named by service). With the
   * cover they make ≥2 → the cover plays and swipes. Wins over `cover`, which is the single still picture.
   */
  photos?: ReadonlyArray<string | CoverPhoto> | null;
  /** A ready cover node (the maker passes its framed image). */
  cover?: ReactNode;
  /** A small pill ON the cover ("Featured"). */
  coverCorner?: ReactNode;
  discount?: string | null;
  /** "Mobile Bar · Booths, carts & bars" — what the service is. */
  path?: string | null;
  /**
   * 📸 PHOTOS BY SERVICE (owner 2026-11-14, way in Ⓐ): the SERVICE named at the head of the path line, pressable —
   * "Lights & Sound · Reception", where "Lights & Sound" opens every photo of that service. Lifted above the door
   * (z-10) and its sibling, never inside it — the same rule as the shop line. Absent → the path line as it was.
   */
  pathLead?: { label: string; onPress: () => void; ariaLabel: string } | null;
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
  /**
   * 🃏 CARD 14, "THE MALL CARD" (owner 20 Nov 2026, "card 14 approved" · "Do it") — the BROWSE face on Find and
   * Discover: square photo with the "Verified shop" pill, shop line, two-line name, the price band, the medal row, then
   * the date fit and the distance. 'row' (the default) is the face as it was — the shop's own page and the maker.
   * The mall face drops the path line, city, rating, Includes, Not included and the gift line: they live in the opened
   * card (DECISION_LOG "LOOK CALLS ARE THE DRAWING SESSION'S", picks 1 and 2).
   */
  layout?: 'row' | 'mall';
  /** The mall face's price band (`lib/mall-card.ts` `mallPrice`). Null → `price` / `priceNote` as they are. */
  mallPrice?: MallPrice | null;
  /** The card's medal row (`CardBadgeRow`), where a star rating would sit. */
  medals?: ReactNode;
  /** "about 12 km from your venue" (`aboutKmLine`). Null → no line. */
  distance?: string | null;
  /** The event has no venue yet → the line asks for one instead. */
  askVenue?: boolean;
  /**
   * 🔖 A press that sits ON the photo, top-right, above the card's door (the mall face only). Discover hands it the
   * shipped Save bookmark (`SaveVendorButton`); Find hands nothing (owner 20 Nov: Save on browse, not in Find).
   */
  coverAction?: ReactNode;
}) {
  const show = coverPhotoList(cover ? null : coverUrl, photos);
  const plays = show.length >= 2;
  const coverNode = plays ? (
    <ServiceFaceCoverShow photos={show} cornerAbove={Boolean(coverCorner)} />
  ) : (
    cover ??
    (coverUrl ? (
      // eslint-disable-next-line @next/next/no-img-element -- an already-resolved display URL, like Find's cover
      <img src={coverUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
    ) : (
      <span aria-hidden className="font-serif text-[22px] italic text-[var(--m-paper)]">
        {initialsOf(shop?.name ?? name)}
      </span>
    ))
  );

  if (layout === 'mall') {
    return (
      <div
        id={id}
        data-service-face=""
        data-service-face-layout="mall"
        className={
          framed
            ? 'sn-frame sn-frame-flush relative flex h-full w-full min-w-0 flex-col overflow-hidden transition-shadow hover:shadow-m-lg'
            : 'relative flex h-full min-w-0 flex-col'
        }
      >
        <MallFaceBody
          cover={coverNode}
          coverCorner={coverCorner}
          plays={plays}
          verified={shop?.verified === true}
          shop={shop ?? null}
          name={name}
          discount={discount}
          price={mallPrice ?? (price ? { big: price, you: null, note: priceNote } : null)}
          priceMissing={priceMissing}
          city={city}
          rating={
            rating ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-[var(--m-slate-2)]">
                <Star aria-hidden className="h-3 w-3 text-[var(--m-orange-2)]" strokeWidth={1.75} />
                {rating.avg.toFixed(1)}
                {rating.count ? ` · ${formatCount(rating.count)}` : ''}
              </span>
            ) : null
          }
          medals={medals}
          lines={lines}
          distance={distance}
          askVenue={askVenue}
        />
        {footer ? <div className="relative z-10 px-2.5 pb-2.5">{footer}</div> : null}
        {door && 'href' in door ? (
          <Link
            href={door.href}
            aria-label={door.label}
            data-service-face-door=""
            className="absolute inset-0 rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
          />
        ) : door ? (
          <ServiceFaceDoorButton label={door.label} hasPopup={door.hasPopup} onOpen={door.onOpen} />
        ) : null}
        {coverAction ? (
          <div className="absolute right-0 top-0 z-20" data-mall-cover-action="">
            {coverAction}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      id={id}
      data-service-face=""
      className={
        framed
          ? 'sn-frame relative flex h-full w-full flex-col gap-2 p-3 transition-shadow hover:shadow-m-lg' // ✨ the frame (16 Nov 2026): white, the token lift, no line — pressable, it opens the Service card grown; 11 Nov "the card is the only frame"
          : 'relative flex flex-col gap-2'
      }
    >
      <div className="grid grid-cols-[80px_minmax(0,1fr)] items-start gap-x-3 gap-y-1">
        {/* data-service-face-cover: the grown card's hero morphs out of THIS box (`heroClipFrom`). */}
        <span className="relative flex h-28 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--m-slate)]" data-service-face-cover="">
          {coverNode}
          {coverCorner ? (
            <span className={`absolute inset-x-1.5 bottom-1.5 text-center${plays ? ' pointer-events-none z-20' : ''}`}>{coverCorner}</span>
          ) : null}
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
          {pathLead ? (
            <span className="relative z-10 truncate text-[11px] leading-snug text-[var(--m-slate-2)]" data-service-face-path="">
              <button
                type="button"
                onClick={pathLead.onPress}
                aria-label={pathLead.ariaLabel}
                className="font-medium text-link underline-offset-2 hover:underline"
                data-photos-by-service-open=""
              >
                {pathLead.label}
              </button>
              {path ? ` · ${path}` : null}
            </span>
          ) : path ? (
            <span className="truncate text-[11px] leading-snug text-[var(--m-slate-2)]">{path}</span>
          ) : null}
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
          data-service-face-door=""
          className="absolute inset-0 rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
        />
      ) : door ? (
        <ServiceFaceDoorButton label={door.label} hasPopup={door.hasPopup} onOpen={door.onOpen} />
      ) : null}
    </div>
  );
}

/** The shop line: a round logo + the name (one control that opens the shop), then Verified. */
function ShopLine({ shop, mall = false }: { shop: ServiceFaceShop; mall?: boolean }) {
  const logo = shop.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- an already-resolved logo URL; a pasted legacy host must not 400 through next/image
    <img src={shop.logoUrl} alt="" className={`${mall ? 'h-[18px] w-[18px]' : 'h-5 w-5'} shrink-0 rounded-full object-cover`} loading="lazy" />
  ) : (
    <span
      aria-hidden
      className={`flex ${mall ? 'h-[18px] w-[18px] text-[7.5px]' : 'h-5 w-5 text-[8px]'} shrink-0 items-center justify-center rounded-full bg-[var(--m-orange-4)] font-bold text-[var(--m-orange-deep)]`}
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
    <span
      className={
        mall
          ? 'relative z-10 flex min-h-[18px] min-w-0 items-center gap-1.5 text-[11.5px] font-medium leading-tight text-[var(--m-slate-2)]'
          : 'relative z-10 flex min-w-0 items-center gap-1.5 text-[12px] font-medium text-[var(--m-slate-2)]'
      }
      data-service-face-shop=""
    >
      {shop.href ? (
        <Link href={shop.href} aria-label={`Visit ${shop.name}`} className="flex min-w-0 items-center gap-1.5 hover:text-terracotta">
          {inner}
        </Link>
      ) : (
        <span className="flex min-w-0 items-center gap-1.5">{inner}</span>
      )}
      {shop.verified && !mall ? (
        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-[rgb(var(--color-ok)/0.12)] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[rgb(var(--color-ok))]">
          <BadgeCheck aria-hidden className="h-2.5 w-2.5" strokeWidth={2} /> Verified
        </span>
      ) : null}
      {shop.isDemo ? <DemoOnlyMarker /> : null}
    </span>
  );
}

/**
 * 🃏 THE MALL FACE'S BODY (card 14) — spans only, so Find's bench card can draw it INSIDE its own link
 * (`InspectorTrigger` is an <a>) and still be the one face: `ServiceFace layout="mall"` and Find's bench card both
 * draw this, and nothing else draws a mall card. The drawing: corpus `prototypes/service_card_options_round3_2026-11-20/`
 * option 14 (https://claude.ai/artifact/752FUN4BTE16bEWmpjP6r7).
 */
export function MallFaceBody({
  cover,
  coverCorner = null,
  plays = false,
  verified,
  shop,
  name,
  discount = null,
  price,
  priceSlot = null,
  priceMissing = null,
  city = null,
  rating = null,
  medals = null,
  lines = null,
  extra = null,
  distance = null,
  askVenue = false,
}: {
  cover: ReactNode;
  /** A small mark ON the photo, top-left ("★ Chosen", "Featured"). */
  coverCorner?: ReactNode;
  plays?: boolean;
  /** The shop is Setnayan Verified → the "Verified shop" pill on the photo (it leaves the medal row). */
  verified: boolean;
  shop: ServiceFaceShop | null;
  name: string;
  discount?: string | null;
  price: MallPrice | null;
  /** A surface's own price band content (Find: the price recorded with this couple, and what was agreed). Wins over
   *  `price`. */
  priceSlot?: ReactNode;
  priceMissing?: string | null;
  /** Where the shop works — said quietly after the shop name. The drawing's sample shops carry none; ours do. */
  city?: ReactNode;
  /** The trusted rating, drawn where the drawing says a rating sits: at the head of the medal row. */
  rating?: ReactNode;
  medals?: ReactNode;
  /** The date fit (and anything else a surface must say about the supplier) — the card's foot, above the distance. */
  lines?: ReactNode;
  /** Lines a surface keeps between the medals and the foot (Find's standing, unread, own record…). */
  extra?: ReactNode;
  distance?: string | null;
  askVenue?: boolean;
}) {
  const footLine = distance ?? (askVenue ? SET_YOUR_VENUE_LINE : null);
  return (
    <>
      {/* data-service-face-cover: the grown card's hero morphs out of THIS box (`heroClipFrom`). */}
      <span
        className="relative flex aspect-square w-full shrink-0 items-center justify-center overflow-hidden bg-[var(--m-orange-4)]"
        data-service-face-cover=""
      >
        {cover}
        {coverCorner ? (
          <span className={`absolute left-2 top-2 max-w-[calc(100%-16px)]${plays ? ' pointer-events-none z-20' : ''}`}>{coverCorner}</span>
        ) : null}
        {verified ? (
          <span
            data-mall-verified=""
            className={`absolute bottom-2 left-2 inline-flex h-5 items-center gap-1 rounded-md bg-[var(--sn-cb-verified-fill)] pl-[5px] pr-[7px] text-[9px] font-extrabold uppercase leading-none tracking-[.07em] text-[var(--m-paper)] shadow-[0_1px_4px_rgba(0,0,0,.25)]${
              plays ? ' pointer-events-none z-20' : ''
            }`}
          >
            <Check aria-hidden className="h-2.5 w-2.5" strokeWidth={3.2} />
            Verified shop
          </span>
        ) : null}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5 px-2.5 pb-2.5 pt-[9px]">
        {shop || city ? (
          <span className="flex min-w-0 items-center gap-1.5">
            {shop ? <ShopLine shop={shop} mall /> : null}
            {city ? (
              <span className="min-w-0 shrink truncate text-[11px] leading-tight text-[var(--m-slate-3)]" data-mall-city="">
                {city}
              </span>
            ) : null}
          </span>
        ) : null}
        <span
          className="line-clamp-2 min-h-[2.6em] text-[13.5px] font-semibold leading-[1.3] text-[var(--m-ink)] [overflow-wrap:anywhere]"
          data-mall-name=""
        >
          {name}
        </span>
        {priceSlot ? (
          <span
            data-mall-price=""
            className="-mx-2.5 mt-px flex flex-wrap items-baseline gap-x-1.5 bg-[var(--m-paper-2)] px-2.5 py-[7px] text-[11px] leading-snug text-[var(--m-slate-2)]"
          >
            {priceSlot}
          </span>
        ) : price ? (
          <span
            data-mall-price=""
            className="-mx-2.5 mt-px flex flex-wrap items-baseline gap-x-1.5 bg-[var(--m-paper-2)] px-2.5 py-[7px]"
          >
            <span
              className={`whitespace-nowrap text-[19px] font-extrabold leading-tight tracking-[-.02em] text-[var(--m-ink)] [font-variant-numeric:tabular-nums]${
                price.you ? ' basis-full' : ''
              }`}
            >
              <MallFigure text={price.big} />
            </span>
            {price.you ? <span className="text-[11px] font-semibold leading-snug text-[var(--m-ink)]">{price.you}</span> : null}
            {price.note ? <span className="text-[11px] leading-snug text-[var(--m-slate-2)]">{price.note}</span> : null}
            {discount ? (
              <span className="basis-full text-[10.5px] font-semibold leading-snug text-[rgb(var(--color-ok))]">{discount}</span>
            ) : null}
          </span>
        ) : priceMissing ? (
          <span
            data-mall-price=""
            className="-mx-2.5 mt-px bg-[var(--m-paper-2)] px-2.5 py-[7px] text-[12.5px] leading-snug text-[var(--m-slate-2)]"
          >
            {priceMissing}
          </span>
        ) : null}
        {medals || rating ? (
          <span className="relative z-10 flex min-h-[22px] min-w-0 items-center gap-2 pl-0.5" data-mall-medals="">
            {rating}
            {medals ? <span className="min-w-0 flex-1">{medals}</span> : null}
          </span>
        ) : null}
        {extra}
        {lines || footLine ? (
          <span className="mt-auto flex flex-col gap-1 border-t border-[var(--m-line)] pt-[7px]" data-mall-foot="">
            {lines}
            {footLine ? (
              <span
                data-mall-distance={distance ? '' : 'ask'}
                className={`flex items-start gap-1 text-[11px] font-medium leading-tight ${
                  distance ? 'text-[var(--m-slate-2)]' : 'text-[var(--m-slate-3)]'
                }`}
              >
                <MapPin aria-hidden className="mt-px h-3 w-3 shrink-0" strokeWidth={2} />
                <span>{footLine}</span>
              </span>
            ) : null}
          </span>
        ) : null}
      </span>
    </>
  );
}

/** "from ₱45,999" → a small "from"; "₱650 / guest" → a small "/ guest". The figure itself is untouched. */
function MallFigure({ text }: { text: string }) {
  const from = /^from\s+/i.exec(text);
  if (from) {
    return (
      <>
        <em className="text-[11px] font-semibold not-italic tracking-normal text-[var(--m-slate-2)]">from</em> {text.slice(from[0].length)}
      </>
    );
  }
  const per = /\s\/\s(guest|meal|hour|hr)$/i.exec(text);
  if (per) {
    return (
      <>
        {text.slice(0, per.index)}
        <em className="text-[11px] font-semibold not-italic tracking-normal text-[var(--m-slate-2)]"> / {per[1]}</em>
      </>
    );
  }
  return <>{text}</>;
}
