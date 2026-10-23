/**
 * front-door-feed.tsx — Shops, New uploads, Trending — and, since 2026-09-29,
 * the two SLOTS Discover's new shelves render into (see `DiscoverSlots`
 * below): the event layers ABOVE the shops, People to follow right AFTER them.
 *
 * 2026-09-03 REWRITE — the chip-filtered "one shelf" (All / Your people /
 * Stories / Articles) is retired along with the group-chat hero
 * (`front-door-anchor.tsx` replaces the old opening). Three sections now,
 * always fully shown, never filtered:
 *
 *   1. SHOPS — moved from the page's tail to directly under the anchor.
 *      Researched this session: at this stage, supply liquidity (real
 *      vendors, seen) is this kind of product's survival metric, and a
 *      content-only first screen reads as "empty site" to a stranger. Still
 *      its own room — the chip-era rule "Marketplace is a different room,
 *      considered and refused twice as a filter" still holds; this is a
 *      POSITION change, not the rejected merge revisited.
 *   2. NEW UPLOADS — exactly the old "one shelf" composition
 *      (`splitShelfRows`, unchanged), just never filtered by a chip. Stories
 *      first (a real person's piece is never buried under our own writing),
 *      articles fill the rest.
 *   3. TRENDING — new. Chapters only, ranked by real view count
 *      (`selectTrendingChapters`). No new "earned" threshold was invented —
 *      every chapter here already passed the admin Feature gate that puts it
 *      in `stories` at all (see `data.ts`), so view count only decides
 *      ORDER, not admission. Editorials never appear; they carry no view
 *      count by design. Honestly empty today (prod: 0 chapters) — composed
 *      on purpose, not a gap.
 *
 * "Your people" (a signed-in narrowing to stories from people you know) is
 * retired with the chip bar — there is no filter left to attach it to.
 */
import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';

import {
  composeFrontDoor,
  selectTrendingChapters,
  splitShelfRows,
} from '@/lib/front-door-composition';

import { type FrontDoorData } from './data';
import { shopInitials } from '@/lib/shop-initials';
import { isBookingFeeEnabled } from '@/lib/booking-fee-gate';
import { bookingFeeScheduleSummary } from '@/lib/booking-fee';
import { formatCount } from '@/lib/format-number';
import { hidesEmptyShelfInApp } from '@/lib/empty-marketplace';
import { InfoTip } from '@/app/_components/info-tip';
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
 * A count the page could not read says so. It NEVER says 0 — an unknown is
 * not a nought, and "0" shown where the truth is "we could not tell" is how a
 * person stops believing the rest of the page.
 */
function CountText({ value }: { value: number | null }) {
  if (value === null) return <span className="fd-unknown">couldn&rsquo;t load</span>;
  return <span className="fd-mono">{value}</span>;
}

function ArticleCard({ a }: { a: FrontDoorData['articles'][number] }) {
  return (
    <Link href={`/blog/${a.slug}`} className="fd-item">
      <div className="fd-thumb">
        {/* `next/image` with `fill`, matching what /blog already does for the
            same covers — these are local public paths, so the optimizer works
            and the aspect-ratio box means no layout shift. */}
        <Image
          src={a.cover}
          alt={a.coverAlt}
          fill
          sizes="(max-width: 700px) 50vw, (max-width: 1023px) 33vw, 266px"
          className="fd-cover"
        />
        {/* Reading time is REAL data — the Journal already computes it — so it
            is the one number allowed on the card. */}
        <span className="fd-dur">{a.readingMinutes} min</span>
      </div>
      <div className="fd-imeta">
        <span className="fd-ava" aria-hidden="true">
          SN
        </span>
        <div className="fd-itxt">
          <p className="fd-ttl">{a.title}</p>
          <p className="fd-by">
            <span className="fd-kindtag">Article</span> Setnayan
          </p>
          <p className="fd-by">{a.category}</p>
        </div>
      </div>
    </Link>
  );
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

function StoryCard({ s }: { s: FrontDoorData['stories'][number] }) {
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

function ShopCard({ s }: { s: FrontDoorData['shops'][number] }) {
  return (
    <Link href={s.href} className="fd-item">
      <div className="fd-thumb fd-thumb-shop">
        {/*
          A plain <img>, NOT next/image, and that is deliberate. An r2:// logo
          resolves to a PRESIGNED url whose signature changes on every render —
          next/image would re-transform it each time and Vercel bills per
          transformation. A logo is small; optimising it is not worth a
          per-render charge on the highest-traffic public page.
          eslint-disable-next-line @next/next/no-img-element
        */}
        {s.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.logoUrl} alt="" className="fd-shoplogo" loading="lazy" />
        ) : (
          <span className="fd-shopmark">{initialsOf(s.name)}</span>
        )}
      </div>
      <div className="fd-imeta">
        <span className="fd-ava" aria-hidden="true">
          {initialsOf(s.name)}
        </span>
        <div className="fd-itxt">
          <p className="fd-ttl">{s.name}</p>
          <p className="fd-by">
            {s.folderLabel}
            {s.verified ? ' · verified' : ''}
          </p>
          {s.city ? <p className="fd-by">{s.city}</p> : null}
        </div>
      </div>
    </Link>
  );
}

/**
 * ─── DISCOVER'S LAYERS (owner 2026-09-29, "DISCOVER — UNPARKED" (e)) ──────
 * "your people → events → suppliers → public profiles ('People to follow') →
 * stories". Shops, New uploads and Trending stay exactly as they were; the two
 * new layers arrive as SLOTS so this file never imports the Discover shelves
 * (they import `ChannelLink` from here — one byline door, never two copies).
 *
 *   beforeShops — "Upcoming from people you follow" + "Upcoming on Setnayan"
 *   afterShops  — "People to follow"
 */
type DiscoverSlots = { beforeShops?: ReactNode; afterShops?: ReactNode };

export function FrontDoorFeed({
  data,
  beforeShops,
  afterShops,
  storeShell = false,
}: {
  data: FrontDoorData;
  /** Inside the App Store / Play Store shell — `isStoreShellRequest()`. */
  storeShell?: boolean;
} & DiscoverSlots) {
  const {
    articles,
    articleTotal,
    stories,
    storyCount,
    shops,
    liveShopCount,
    realWeddingCount,
  } = data;

  // Where the lead grid stops and the rest of the writing starts — from the
  // shared composer, because that boundary MOVES with the story count and
  // hard-coding it silently drops articles (see splitShelfRows). Unchanged
  // from the chip era: every story and every article is always in scope now,
  // so this runs over the full arrays rather than a chip-selected subset.
  const { leadStories, leadArticles, trailingArticles } = splitShelfRows(
    stories,
    articles,
  );

  /*
    Every rail's shape comes from the shared composer, not from `if`s written
    here. A threshold inside a JSX branch is unreachable from any test, so its
    only symptom when it regresses is a customer seeing something wrong.

    ⚠ `null` (a failed read) is passed as 0 ON PURPOSE. The composer floors
    unknowns so a read that failed can never PROMOTE a rail. The nulls are
    kept separately below for the COUNT TEXT, which says "couldn't load"
    rather than "0". Shape fails safe; wording stays honest.
  */
  const shape = composeFrontDoor({
    chapters: stories.length,
    articles: articleTotal,
    stories: realWeddingCount,
    liveShops: liveShopCount ?? 0,
  });

  // `none` = no shops to show — a real zero OR a failed read (the composer
  // floors null to 0). "The first shops" over an empty grid would name shops
  // that are not there, so it is plain "Shops"; the line under it says which.
  const shopsHeading =
    shape.shopsHeading === 'trending'
      ? 'Trending shops'
      : shape.shopsHeading === 'first-shops'
        ? 'The first shops'
        : 'Shops';
  const realWeddingsEarnedGrid = shape.stories === 'grid';
  // 📱 The app hides the whole Shops shelf while no shop is live (owner,
  // DECISION_LOG 2026-10-19 (2)); one live shop brings it back. The web keeps
  // the plain "none yet" line below.
  const hideShopsShelf = hidesEmptyShelfInApp(storeShell, liveShopCount);

  // Chapters ranked by real views — see the module docblock. Not filtered by
  // the composer above: a chapter reaching `stories` at all already passed
  // the admin Feature gate, which IS the "earned" test for this shelf.
  const trending = selectTrendingChapters(stories);

  return (
    <>
      {/* ═ DISCOVER · your people's upcoming public events, then the world ═ */}
      {beforeShops}

      {hideShopsShelf ? null : (
        <>
          {/* ═ SHOPS — the claim's proof, one scroll-line below the anchor ═ */}
          <h2 className="fd-sechead">
            <span>{shopsHeading}</span>
            {/* 🧹 "not trending — one shop cannot trend" is gone (owner 2026-10-01, NO SMALL
                EXPLAINER LABELS): the heading already says "The first shops". */}
          </h2>
          {/*
            🧪 THE EMPTY SHELF (2026-09-30). The two trial shops became `is_demo`
            (owner, DECISION_LOG 2026-09-29 "LANE 2 §2C" (1): "Discover's Shops
            shelf … show[s] nothing until a real supplier joins"), so an empty
            shelf is now the normal state. It says so in one plain line — and a
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
                <ShopCard key={s.href} s={s} />
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

                🔑 THE NUMBERS ARE DERIVED, NEVER TYPED. `bookingFeeScheduleSummary()` and
                `FIRST_BOOKING_ON_US` speak for the same rule the bill uses, and the launch
                line is gated on `isBookingFeeEnabled()` — the flag that decides whether
                anyone is billed.
              */
              <>
                Couples pay you directly — we never take a cut of it.{' '}
                {isBookingFeeEnabled() ? (
                  <>
                    Your first booking from Setnayan is on us;
                    after that a booking fee
                    {data.bookingFee ? <> of {bookingFeeScheduleSummary(data.bookingFee)}</> : null}, only
                    on couples we bring you. Your own clients stay free.{' '}
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

      {/* ═ DISCOVER · People to follow — public profiles, after the shops ═ */}
      {afterShops}

      {/* ═ NEW UPLOADS — the old one shelf, never filtered now ═ */}
      <div className="fd-grid">
        {leadStories.map((s) => (
          <StoryCard key={s.href} s={s} />
        ))}
        {leadArticles.map((a) => (
          <ArticleCard key={a.slug} a={a} />
        ))}
      </div>

      <h2 className="fd-sechead">
        <span className="fd-badge" aria-hidden="true">
          ◎
        </span>
        {/*
          THE HEADING IS THE DOOR TO THE HUB — the only PERMANENT link from
          the front page to `/realstories`, which keeps the event-type filter
          and the search box this page does not have.
        */}
        <Link href="/realstories" className="fd-sechead-go">
          New uploads
        </Link>
        <span className="fd-meta">
          <CountText value={articleTotal} /> ours ·{' '}
          <CountText value={storyCount} /> theirs
        </span>
      </h2>

      {/* REAL WEDDINGS.
          Below the threshold this is ONE WRITTEN INVITATION, not an empty
          shelf — "the shelf is not empty; it is simply all reading". */}
      {realWeddingsEarnedGrid ? null : (
        <EmptyShelf
          line="The first real weddings will land right here."
          tip="When a couple decides to share their day it joins this shelf — their photos, their suppliers, their timeline, in their own words. Nothing appears without them saying yes."
          href="/realstories"
          go="See how sharing works"
        />
      )}

      {trailingArticles.length > 0 ? (
        <div className="fd-grid">
          {trailingArticles.map((a) => (
            <ArticleCard key={a.slug} a={a} />
          ))}
        </div>
      ) : null}

      {/* THE ARCHIVE'S OWN PAGE, NOT A FAKE "LOAD MORE" BUTTON. `articles` is
          capped at 12 (see data.ts); `/blog` already lists the rest, so the
          honest door is a real link there rather than pagination this page
          does not implement. */}
      {articleTotal > articles.length ? (
        <p className="fd-more">
          <Link href="/blog" className="fd-go">
            See all <CountText value={articleTotal} /> articles &rarr;
          </Link>
        </p>
      ) : null}

      {/* ═ TRENDING — chapters ranked by real views, honestly empty today ═ */}
      <h2 className="fd-sechead">
        {/* "earned, never sold" moved into the ⓘ (owner 2026-10-01, NO SMALL EXPLAINER LABELS). */}
        <InfoTip label="Trending" align="start">
          Stories ranked by real views from real readers — never seeded, padded, or sold.
        </InfoTip>
      </h2>

      {trending.length === 0 ? (
        <EmptyShelf
          line="No story has earned a spot yet."
          tip="The first story to earn its place appears here on its own."
          href="/realstories"
          go="Browse all stories"
        />
      ) : (
        <div className="fd-grid">
          {trending.map((s) => (
            <StoryCard key={s.href} s={s} />
          ))}
        </div>
      )}
    </>
  );
}
