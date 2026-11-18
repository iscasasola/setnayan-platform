/**
 * front-door-feed.tsx — Discover's Suppliers shelf (part 2), with the two SLOTS the other parts render into:
 * `beforeShops` (the viewer's events, the upcoming shelves, then People to follow — part 1) and `afterShops`
 * (Service cards · Event stories · Articles · Inspiration — parts 3 to 6, `discover-six-parts.tsx`).
 *
 * Owner 16 Nov, DECISION_LOG "Discover in six parts" (approved 41057aae · 45fd9c21 · 448fd3c1 · a85b0260): New uploads
 * and Trending are retired — Event stories replaced both — and the shop shelf is "Suppliers", verified shops only.
 * This file still owns the cards the other parts reuse: `StoryCard` (Event stories), `ShopCard`, `ChannelLink`.
 *
 * History: the 2026-09-03 rewrite (Shops · New uploads · Trending, never chip-filtered) is in git.
 */
import { SHOP_ARRIVAL_SRC, withShopArrival } from '@/lib/shop-back';
import type { ReactNode } from 'react';
import Link from 'next/link';

import { type FrontDoorData } from './data';
import { shopInitials } from '@/lib/shop-initials';
import { isBookingFeeEnabled } from '@/lib/booking-fee-gate';
import { bookingFeeBandsLine, bookingFeeMinimumAmount } from '@/lib/booking-fee';
import { FIRST_BOOKING_FREE } from '@/lib/booking-fee-lock';
import { formatCount } from '@/lib/format-number';
import { hidesEmptyShelfInApp } from '@/lib/empty-marketplace';
import { SampleMarker } from '@/app/_components/sample-marker';
import { ImageBadge } from '@/app/_components/image-badge';
import { badgeImageOf } from '@/lib/shop-badge-row';
import { EmptyShelf } from './empty-shelf';

/**
 * The card's terminal blurb when a story has no excerpt of its own.
 *
 * ⚠ ONE DEFINITION, TWO CALL SITES. The lead grid and the trailing row both
 * render this, and this file's own `ChannelLink` note records what happens when
 * a rule is hand-written twice here. Rendered in two places, defined in one.
 *
 * 🪤 THE BUG THIS EXISTS TO PREVENT, caught before it shipped: the rule used to
 * be `A ${kindLabel.toLowerCase()} story` everywhere, which is right for a
 * CHAPTER — whose `kindLabel` is a celebration type, so "Wedding" reads "A
 * wedding story" — and wrong for an EDITORIAL, whose `kindLabel` is already the
 * noun. "Real story" through that template renders **"A real story story"**, on
 * the front page, in the fallback state nobody looks at because it only appears
 * for a card with no hero image.
 */
function cardBlurb(s: { excerpt: string | null; kindLabel: string; kind: 'chapter' | 'editorial' }): string {
  if (s.excerpt) return s.excerpt;
  return s.kind === 'editorial'
    ? `A ${s.kindLabel.toLowerCase()}`
    : `A ${s.kindLabel.toLowerCase()} story`;
}

/** Delegates to the shared shop/vendor helper (lib/shop-initials.ts). Also
 * used for the editorial/chapter card's `s.ownerName` above — that call
 * shared the identical bug (a stray symbol/bracket taking the literal first
 * character), so it is fixed by the same change. */
function initialsOf(name: string): string {
  return shopInitials(name, 2, 'SN');
}

/**
 * THE CHANNEL LINE IS A DOOR. The storyteller's name presses through to their
 * own page at `/u/{ownerSlug}` — the thing the reference this page is ported
 * from has always done, and the one part of it the port left as printed text.
 * `FRONT_DOOR_AND_SEAM_FINAL_2026-08-12.md` calls this line "the channel line"
 * for exactly that reason, so an inert name here is a defect in the PORT, not
 * a design choice anybody made.
 *
 * ⚠ THIS IS A SECOND ANCHOR ON A CARD THAT IS ITSELF A PRESS TARGET, AND THE
 * TWO MUST NEVER NEST. An `<a>` inside an `<a>` is invalid HTML; browsers
 * recover by SPLITTING the outer link, which silently breaks the card's own
 * tap target — already written down in this repo on the suite service card.
 * **Nothing in CI catches it**: `lint-nested-forms.mjs` counts `<form>` depth
 * only and does not tokenize anchors at all, so a nested one ships in silence.
 * That is why the card is a shell whose TITLE carries the stretched link and
 * whose channel line is raised above it — siblings, never descendants.
 *
 * 🔑 WHY THE TITLE CARRIES THE STRETCH AND NOT AN EMPTY OVERLAY ANCHOR. Both
 * work geometrically; only this one gets its accessible name right. An empty
 * stretched `<a aria-label={title}>` announces the title, and then the visible
 * `<p>` announces it a second time. Anchoring the real title text means the
 * accessible name IS the visible name, with nothing said twice.
 *
 * 🔑 WHY NOT THE REPO'S OTHER IDIOM. The established alternative — a sibling
 * chip in its own strip BELOW the card (`storyteller-tile.tsx`'s editorial
 * chip, the Team chips) — is right for a CHIP and wrong for a BYLINE: it lifts
 * the name out of the card's meta block. `front-door.css` opens by saying a
 * delta from the binding drawing "is a defect in the PORT, not a fresh design
 * decision"; moving the byline would be such a delta.
 */
export function ChannelLink({
  slug,
  name,
  className,
}: {
  slug: string | null;
  name: string;
  className: string;
}) {
  /*
    🔴 A NULL SLUG PRINTS THE NAME AND OPENS NO DOOR — it never hides the
    byline, and it never guesses a URL.

    An EDITORIAL (a real celebration's published story) reaches this shelf
    through `users.public_summary_consent_at` — consent to be written up. That
    is NOT `public_profile_enabled`, which is what makes `/u/{slug}` render and
    which is `DEFAULT FALSE`. So a couple can consent to their editorial being
    public while having no public profile page, and linking their name would
    put a 404 on the FRONT PAGE for the first real couple who ever consents.
    `data.ts` sets `ownerSlug: null` for exactly that case; this is the other
    half of the same rule, and the two must be read together.

    ⚠ THE SPAN IS NOT COSMETIC. Returning a bare string here would drop the
    `className`, and the byline would lose its type treatment in the one state
    nobody looks at yet — silently, because a missing class throws nothing.
  */
  if (slug === null) {
    return <span className={className}>{name}</span>;
  }
  // ONE definition of where a byline goes. Two hand-written `/u/${...}` links
  // in one file do not stay equal — this file already carries a scar from
  // exactly that (the reading-time rule it deliberately imports rather than
  // re-deriving).
  return (
    <Link href={`/u/${slug}`} className={className}>
      {name}
    </Link>
  );
}

export function StoryCard({ s }: { s: FrontDoorData['stories'][number] }) {
  return (
    <div className="fd-item">
      <div className="fd-thumb">
        {/* TWO GRAMMARS, decided by what the chapter actually IS — ported from
            the shipped `StorytellerTile` on /realstories, which already made
            this call: a poster when there is one, otherwise the opening line
            as a typographic hero. A story told in writing is not a video with
            a missing image, so it never renders an empty box.

            🪤 A PLAIN <img>, NOT `next/image`, AND THE REASON IS LOAD-BEARING.
            `youtubeThumbFromEmbedUrl` returns `https://i.ytimg.com/...`, and
            `i.ytimg.com` is NOT in `remoteImagePatterns` in next.config.ts —
            so `/_next/image?url=…` answers 400 and the poster silently never
            appears. Do not "upgrade" this to next/image without adding the
            host to `remoteImagePatterns` AND the CSP `img-src` list first. */}
        {s.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.thumbUrl} alt="" loading="lazy" decoding="async" />
        ) : (
          <p className="fd-thumb-read">
            {/* TERMINAL FALLBACK. A chapter can legitimately have neither a
                poster nor an excerpt (a very short story, or one whose first
                paragraph is whitespace) — the kind is the floor, never an
                empty box. Same fallback the shipped tile uses. */}
            {cardBlurb(s)}
          </p>
        )}
        {s.readingMinutes !== null ? (
          <span className="fd-dur">{s.readingMinutes} min</span>
        ) : null}
        {s.hasVideo ? <span className="fd-hasvid">▶ with video</span> : null}
      </div>
      <div className="fd-imeta">
        {/* The avatar stays DECORATIVE on purpose. The reference links it too,
            but it is `aria-hidden` initials here, and an aria-hidden anchor is
            an accessibility fault (a focusable node hidden from the tree). The
            name beside it is the door; two doors to one room is not worth
            breaking the tree for. */}
        <span className="fd-ava" aria-hidden="true">
          {initialsOf(s.ownerName)}
        </span>
        <div className="fd-itxt">
          <p className="fd-ttl">
            {/* The card's press target. `.fd-stretch::after` covers the whole
                card, so the poster and the title still open the story. */}
            <Link href={s.href} className="fd-stretch">
              {s.title}
            </Link>
          </p>
          <p className="fd-by">
            <span className="fd-kindtag fd-kindtag-w">Their story</span>{' '}
            <ChannelLink slug={s.ownerSlug} name={s.ownerName} className="fd-chan" />
          </p>
          <p className="fd-by">
            {s.kindLabel}
            {/* Real aggregate views, chapters only — see the field's note on
                `FrontDoorStory`. Never shown for an editorial (always null). */}
            {s.viewCount !== null ? (
              <>
                {' '}
                &middot; <span className="fd-mono">{formatCount(s.viewCount)} views</span>
              </>
            ) : null}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * 🃏 THE SHOP CARD — Discover's shelf AND its search hits (`front-door-results.tsx` draws THIS, never a copy).
 * Owner 10 Nov, DECISION_LOG "DISCOVER'S SHOP CARD — APPROVED" (prototype `shop-card` v3):
 *   · big picture = the shop's COVER (`s.cover`: the shop page's own rule, resolved by the hero's own reader); none →
 *     the category's picture with the hero's "Sample photo" chip, so it never passes as their work;
 *   · circle = the LOGO, shown whole (contain, on a light ground); initials only with no logo;
 *   · line = the group (Admin › Categories) · city — the pill replaced " · verified";
 *   · up to 2 badges (`s.badges`, Verified first), drawn as the CIRCULAR image badges (`ImageBadge`, the Shop tab's
 *     own pictures via `badgeImageOf`) — owner 11 Nov: "we have the circular badges already", never the long pill.
 *
 * A plain <img>, NOT next/image, for both pictures, and that is deliberate: an r2:// logo or portfolio photo resolves
 * to a PRESIGNED url whose signature changes on every render — next/image would re-transform it each time and Vercel
 * bills per transformation, on the highest-traffic public page.
 */
export function ShopCard({
  s,
  href,
}: {
  s: FrontDoorData['shops'][number];
  /** The shop's address WITH its arrival (`withShopArrival`) — each caller says where the shop was opened from. */
  href: string;
}) {
  const line = [s.folderLabel, s.city].filter(Boolean).join(' · ');
  return (
    <Link href={href} className="fd-item" data-shop-card="">
      <div className="fd-thumb fd-thumb-shop">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={s.cover.url} alt="" className="fd-shopcover" loading="lazy" />
        {s.cover.sample ? <span className="fd-sample">Sample photo</span> : null}
      </div>
      <div className="fd-imeta">
        {s.logoUrl ? (
          <span className="fd-ava fd-ava-logo" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.logoUrl} alt="" loading="lazy" />
          </span>
        ) : (
          <span className="fd-ava" aria-hidden="true">
            {initialsOf(s.name)}
          </span>
        )}
        <div className="fd-itxt fd-itxt-shop">
          <p className="fd-ttl">{s.name}</p>
          {/* 🧪 A demo shop is on the shelf, marked (owner, DECISION_LOG 2026-11-06 "DEMO SHOPS + DEMO EVENTS"). The bare
              chip, not the ⓘ: this whole card is one link, and a button inside a link is not allowed. */}
          {s.isDemo ? <SampleMarker /> : null}
          {line ? <p className="fd-by">{line}</p> : null}
          {s.badges.length > 0 ? (
            <div className="fd-pills">
              {s.badges.map((b) => {
                const img = badgeImageOf(b);
                return (
                  <span key={b.key} className="fd-badge-img" title={b.label}>
                    <ImageBadge {...img} uid={`card-${s.href}-${b.key}`} size={40} label={b.label} />
                  </span>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

/**
 * ─── DISCOVER'S PARTS (owner 16 Nov, "Discover in six parts") ──────────────
 * The other parts arrive as SLOTS so this file never imports the Discover shelves
 * (they import `ChannelLink` and `StoryCard` from here — one card, never two copies).
 *
 *   beforeShops — your events · "Upcoming from people you follow" · "Upcoming on Setnayan" · People to follow (1)
 *   afterShops  — Service cards (3) · Event stories (4) · Articles (5) · Inspiration (6)
 */
type DiscoverSlots = { beforeShops?: ReactNode; afterShops?: ReactNode };

export function FrontDoorFeed({
  data,
  beforeShops,
  afterShops,
  storeShell = false,
  shopTools = null,
}: {
  data: FrontDoorData;
  /** Inside the App Store / Play Store shell — `isStoreShellRequest()`. */
  storeShell?: boolean;
  /**
   * "All categories ▾" and "Filters" under the Shops heading — the shelf's doors into Discover's supplier view
   * (2026-11-12, DECISION_LOG "DISCOVER WITH SUPPLIERS — PROTOTYPE APPROVED"). Built by `FrontDoor`.
   */
  shopTools?: ReactNode;
} & DiscoverSlots) {
  const { shops, liveShopCount } = data;
  // 📱 The app hides the whole Suppliers shelf while no shop is live (owner,
  // DECISION_LOG 2026-10-19 (2)); one live shop brings it back. The web keeps
  // the plain "none yet" line below.
  const hideShopsShelf = hidesEmptyShelfInApp(storeShell, liveShopCount);

  return (
    <>
      {/* ═ DISCOVER · your people's upcoming public events, then the world ═ */}
      {beforeShops}

      {hideShopsShelf ? null : (
        <>
          {/* ═ SHOPS — the claim's proof, one scroll-line below the anchor ═ */}
          <h2 className="fd-sechead">
            {/* 🏷 "Suppliers" — Discover's part 2 (owner 16 Nov, "Discover in six parts"); verified shops only
                (`LIVE_SHOP_GATE`, which reads `is_findable` — verified and listed). It replaced "Trending shops" / "The first shops" / "Shops". */}
            <span>Suppliers</span>
            {/* 🛒 More shops are open than the shelf shows → the door to every supplier, on this page (the
                supplier view, 2026-11-12). `liveShopCount` decides it and is never printed. */}
            {liveShopCount !== null && liveShopCount > shops.length ? (
              <Link href="/?browse=1" className="fd-sechead-go" data-discover-see-all="">
                See all suppliers →
              </Link>
            ) : null}
          </h2>
          {shops.length > 0 ? shopTools : null}
          {/*
            🧪 THE EMPTY SHELF (2026-09-30). The two trial shops became `is_demo`
            (owner, DECISION_LOG 2026-09-29 "LANE 2 §2C" (1): "Discover's Shops
            shelf … show[s] nothing until a real supplier joins"), so an empty
            shelf was the normal state — until 2026-11-06, when demo shops came
            back onto the shelf, each marked "(DEMO ONLY)" (DECISION_LOG
            "DEMO SHOPS + DEMO EVENTS"). It says so in one plain line — and a
            failed read says THAT instead, never "none" (`liveShopCount` is null
            only when the count read failed). The invite card below is the door.
          */}
          {/*
            🧪 THE EMPTY SHELF (2026-09-30) — and since 23 Oct ONE line + ONE action (owner:
            title + one short line, every detail inside the ⓘ; a frame only on what you press).
            An empty shelf is the normal state while no real supplier has joined; a failed read
            says THAT instead, never "none" (`liveShopCount` is null only when the count read
            failed). The booking-fee terms moved, word for word, into the ⓘ.
          */}
          {shops.length > 0 ? (
            <div className="fd-grid">
              {shops.map((s) => (
                /* 🧭 `?src=discover` — the shop page's "Back" returns HERE, to Discover (lib/shop-back.ts; owner
                   2026-11-07, "back to suppliers? it went to a wrong shell"). Without it the shop could not tell
                   Discover from a shared link. */
                <ShopCard key={s.href} s={s} href={withShopArrival(s.href, { src: SHOP_ARRIVAL_SRC.discover })} />
              ))}
            </div>
          ) : null}
          <EmptyShelf
            line={
              shops.length > 0
                ? 'Are you a supplier?'
                : liveShopCount === 0
                  ? 'No supplier has opened a shop yet.'
                  : 'Shops couldn’t load just now — try again in a moment.'
            }
            tip={
              /*
                🔴 THIS CARD ONCE PROMISED "No commission on your bookings, ever." — to a
                SUPPLIER, beside a real 5% booking fee (measured 2026-09-22). "No commission"
                is CORRECT (owner 2026-08-06: the couple pays the supplier directly) but true
                only when the booking-fee sentence travels with it, so both stay here.

                🔑 THE NUMBERS ARE DERIVED, NEVER TYPED. `bookingFeeBandsLine()`,
                `bookingFeeMinimumAmount()` and `FIRST_BOOKING_FREE` (the owner's
                2026-11-04 wording of the fee line) speak for the same rule the bill uses,
                and the minimum stays inline here because this is already a tip. The launch
                line is gated on `isBookingFeeEnabled()` — the flag that decides whether
                anyone is billed.
              */
              <>
                Couples pay you directly — we never take a cut of it.{' '}
                {isBookingFeeEnabled() ? (
                  <>
                    {FIRST_BOOKING_FREE} After that:{' '}
                    {data.bookingFee ? (
                      <>
                        {bookingFeeBandsLine(data.bookingFee)}, minimum{' '}
                        {bookingFeeMinimumAmount(data.bookingFee)}
                      </>
                    ) : (
                      'a booking fee'
                    )}{' '}
                    — only on couples who found you here. Your own clients stay free.{' '}
                  </>
                ) : (
                  <>No booking fee while we&rsquo;re new.{' '}</>
                )}
                Your own web address, a calendar couples can see, and enquiries that
                arrive as real messages.
              </>
            }
            href="/open-shop"
            go="Open your shop"
          />
        </>
      )}

      {/* ═ DISCOVER · Service cards · Event stories · Articles · Inspiration (parts 3–6), after the suppliers ═
          New uploads and Trending are gone (owner 16 Nov, "Discover in six parts"): Event stories replaced both. */}
      {afterShops}
    </>
  );
}
