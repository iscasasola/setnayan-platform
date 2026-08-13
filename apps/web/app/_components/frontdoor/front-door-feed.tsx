/**
 * front-door-feed.tsx — the uniform four-across grid.
 *
 * PORTED from `prototypes/front_door_and_seam_2026-08-12.html` (rev 3).
 *
 * ─── WHY A UNIFORM GRID AND NOT A HERO ───────────────────────────────────
 * The reference is a uniform four-across grid of equal cards — no lead story,
 * no feature block. That matters most on launch day: a uniform grid is what
 * makes a page look FULL, and it is what lets the writing fill a front page
 * that would otherwise read as four apologies.
 *
 * ─── ONE SHELF, NOT TWO (owner 2026-08-12) ───────────────────────────────
 * Articles and storytellers' pieces share ONE shelf, and the CARD says which
 * kind it is so the shelf does not have to. Two shelves where one is
 * permanently empty is a page that apologises; combined, it is full from day
 * one and simply gets richer as real weddings arrive, instead of a second
 * empty row appearing broken.
 *
 * ─── EVERY RAIL'S SHAPE IS A THRESHOLD, NOT A SNAPSHOT ───────────────────
 * Nothing here is hardcoded to "launch day". Each rail asks the data what
 * shape to take, so the page composes itself correctly on the day the second
 * wedding publishes or the twelfth shop opens — without anybody remembering
 * to come back and change it.
 */
import Image from 'next/image';
import Link from 'next/link';

import {
  composeFrontDoor,
  selectShelf,
  splitShelfRows,
  FRONT_DOOR_CHIPS as CHIPS,
} from '@/lib/front-door-composition';

import { type FrontDoorData } from './data';

// The chip vocabulary and the rule for what each chip admits live in
// `lib/front-door-composition.ts` beside the rail thresholds — a rule written
// inside this file's JSX could not be tested, and "With video" quietly showing
// nothing looks exactly like a quiet week. Re-exported so existing callers
// keep importing them from the component they render.
export { isChip, type ChipKey } from '@/lib/front-door-composition';
import { type ChipKey } from '@/lib/front-door-composition';

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'SN'
  );
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

function StoryCard({ s }: { s: FrontDoorData['stories'][number] }) {
  return (
    <Link href={s.href} className="fd-item">
      <div className="fd-thumb">
        {/* TWO GRAMMARS, decided by what the chapter actually IS — ported from
            the shipped `StorytellerTile` on /realstories, which already made
            this call: a poster when there is one, otherwise the opening line
            as a typographic hero. A story told in writing is not a video with
            a missing image, so it never renders an empty box.

            This replaced the literal words "THEIR STORY" printed where the
            picture goes — the same placeholder defect the SHOP card was
            corrected for in #4400, on the card beside it on the same shelf.

            🪤 A PLAIN <img>, NOT `next/image`, AND THE REASON IS LOAD-BEARING.
            `youtubeThumbFromEmbedUrl` returns `https://i.ytimg.com/...`, and
            `i.ytimg.com` is NOT in `remoteImagePatterns` in next.config.ts —
            so `/_next/image?url=…` answers 400 and the poster silently never
            appears. That is exactly how the R2 remotePattern shipped broken.
            Measured: the ENFORCED CSP carries no `img-src` at all (only
            frame-ancestors + frame-src), and the report-only policy already
            lists `i.ytimg.com`, so a direct <img> is allowed now AND after
            that policy is enforced. Do not "upgrade" this to next/image
            without adding the host to BOTH lists first. */}
        {s.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.thumbUrl} alt="" loading="lazy" decoding="async" />
        ) : (
          <p className="fd-thumb-read">
            {/* TERMINAL FALLBACK. A chapter can legitimately have neither a
                poster nor an excerpt (a very short story, or one whose first
                paragraph is whitespace) — the kind is the floor, never an
                empty box. Same fallback the shipped tile uses. */}
            {s.excerpt ?? `A ${s.kindLabel.toLowerCase()} story`}
          </p>
        )}
        {/* A written chapter legitimately has no video. The card leads with
            the READ and marks a video as an extra, never as the whole point —
            which is the entire reason the storyteller shelf was empty.

            ⚠ This comment used to end "No minutes badge: we do not have the
            body, and a reading time guessed from an excerpt is an invented
            number." The badge was added directly beneath it and the sentence
            was left standing, so the file told the next reader the opposite
            of what the two lines under it do. The minutes are REAL now —
            computed at the loader from the full body — and stay null-able,
            which is why the badge is conditional rather than always drawn. */}
        {s.readingMinutes !== null ? (
          <span className="fd-dur">{s.readingMinutes} min</span>
        ) : null}
        {s.hasVideo ? <span className="fd-hasvid">▶ with video</span> : null}
      </div>
      <div className="fd-imeta">
        <span className="fd-ava" aria-hidden="true">
          {initialsOf(s.ownerName)}
        </span>
        <div className="fd-itxt">
          <p className="fd-ttl">{s.title}</p>
          <p className="fd-by">
            <span className="fd-kindtag fd-kindtag-w">Their story</span>{' '}
            {s.ownerName}
          </p>
          <p className="fd-by">{s.kindLabel}</p>
        </div>
      </div>
    </Link>
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

export function FrontDoorFeed({
  data,
  chip,
}: {
  data: FrontDoorData;
  chip: ChipKey;
}) {
  const { articles, articleTotal, stories, storyCount, shops, liveShopCount, realWeddingCount } =
    data;

  // The chip decides which KINDS are in the shelf. It never changes the page's
  // structure — only what the one shelf contains. The rule itself lives in the
  // shared composer so it is reachable from a test.
  const {
    articles: shownArticles,
    stories: shownStories,
    empty: nothingUnderChip,
  } = selectShelf(chip, articles, stories);

  // Where the lead grid stops and the rest of the writing starts — from the
  // shared composer, because that boundary MOVES with the story count and
  // hard-coding it silently drops articles (see splitShelfRows).
  const { leadStories, leadArticles, trailingArticles } = splitShelfRows(
    shownStories,
    shownArticles,
  );

  /*
    Every rail's shape comes from the shared composer, not from `if`s written
    here. A threshold inside a JSX branch is unreachable from any test, so its
    only symptom when it regresses is a customer seeing something wrong.

    ⚠ `null` (a failed read) is passed as 0 ON PURPOSE. The composer floors
    unknowns so a read that failed can never PROMOTE a rail — an uncountable
    shelf must not be able to call itself "Trending". The nulls are kept
    separately below for the COUNT TEXT, which says "couldn't load" rather
    than "0". Shape fails safe; wording stays honest.
  */
  const shape = composeFrontDoor({
    chapters: stories.length,
    articles: articleTotal,
    stories: realWeddingCount,
    liveShops: liveShopCount ?? 0,
  });

  const shopsHeading =
    shape.shopsHeading === 'trending' ? 'Trending shops' : 'The first shops';
  const realWeddingsEarnedGrid = shape.stories === 'grid';

  return (
    <>
      <div className="fd-chipbar">
        <div className="fd-chips">
          {CHIPS.map((c) => (
            <Link
              key={c}
              href={c === 'All' ? '/' : `/?c=${encodeURIComponent(c)}`}
              className="fd-chip"
              data-on={chip === c ? 'true' : 'false'}
              scroll={false}
            >
              {c}
            </Link>
          ))}
        </div>
      </div>

      {nothingUnderChip ? (
        <div className="fd-invite fd-invite-full">
          <h2>Nothing under &ldquo;{chip}&rdquo; yet.</h2>
          <p>
            There are <CountText value={articleTotal} /> pieces and growing
            most weeks — try another chip, or clear the filter.
          </p>
          <Link href="/" className="fd-go">
            Show everything &rarr;
          </Link>
        </div>
      ) : (
        <>
          {/* The grid leads with real cards — stories first when there are
              any, so a real couple's piece is never buried under our own
              writing. */}
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
            <span>Stories</span>
            <span className="fd-meta">
              {/* THE ARCHIVE's size, and a story count that can say it does
                  not know — not the length of what this page happens to
                  render. */}
              <CountText value={articleTotal} /> ours ·{' '}
              <CountText value={storyCount} /> theirs — some with video, some
              without
            </span>
            <span className="fd-rule">
              one shelf — the card says which kind it is
            </span>
          </h2>

          <div className="fd-storyrow">
            {shownStories.slice(0, 6).map((s) => (
              <Link key={s.href} href={s.href} className="fd-story">
                <div className="fd-sthumb">
                  {/* The same two grammars as the big card. This box used to
                      render NOTHING but a badge — a bare gradient rectangle
                      beside article cards that all carry their cover, which
                      reads as an image that failed to load rather than as a
                      story told in writing. Plain <img> for the same reason
                      as the big card: `i.ytimg.com` is not in
                      `remoteImagePatterns`, so next/image would 400. */}
                  {s.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.thumbUrl} alt="" loading="lazy" decoding="async" />
                  ) : (
                    <p className="fd-sread">
                      {s.excerpt ?? `A ${s.kindLabel.toLowerCase()} story`}
                    </p>
                  )}
                  {s.readingMinutes !== null ? (
                    <span className="fd-min">{s.readingMinutes} MIN</span>
                  ) : s.hasVideo ? (
                    <span className="fd-min">▶</span>
                  ) : null}
                </div>
                <p className="fd-sttl">{s.title}</p>
                <p className="fd-sby">Their story · {s.ownerName}</p>
              </Link>
            ))}
            {shownArticles
              .slice(0, Math.max(0, 6 - shownStories.slice(0, 6).length))
              .map((a) => (
                <Link key={a.slug} href={`/blog/${a.slug}`} className="fd-story">
                  <div className="fd-sthumb">
                    <Image
                      src={a.cover}
                      alt={a.coverAlt}
                      fill
                      sizes="(max-width: 700px) 50vw, (max-width: 1023px) 33vw, 170px"
                      className="fd-cover"
                    />
                    <span className="fd-min">{a.readingMinutes} MIN</span>
                  </div>
                  <p className="fd-sttl">{a.title}</p>
                  <p className="fd-sby">Article · {a.category}</p>
                </Link>
              ))}
          </div>
        </>
      )}

      {/* REAL WEDDINGS.
          Below the threshold this is ONE WRITTEN INVITATION, not an empty
          shelf — "the shelf is not empty; it is simply all reading". */}
      {realWeddingsEarnedGrid ? null : (
        <div className="fd-grid">
          <div className="fd-invite fd-invite-full">
            <h3>
              The first real weddings will land right here, beside the reading.
            </h3>
            <p>
              When a couple decides to share their day it joins this same shelf
              — their photos, their suppliers, their timeline, in their own
              words. Nothing is staged, and nothing appears without them saying
              yes.
            </p>
            <Link href="/realstories" className="fd-go">
              See how sharing works &rarr;
            </Link>
          </div>
        </div>
      )}

      <h2 className="fd-sechead">
        <span>{shopsHeading}</span>
        {shape.shopsHeading === 'first-shops' ? (
          <span className="fd-rule">
            not &ldquo;trending&rdquo; — one shop cannot trend
          </span>
        ) : null}
      </h2>

      <div className="fd-grid">
        {shops.map((s) => (
          <ShopCard key={s.href} s={s} />
        ))}
        <div className="fd-invite fd-invite-wide">
          <h3>Open your shop — free while we&rsquo;re new.</h3>
          <p>
            No commission on your bookings, ever. Your own web address, a
            calendar couples can see, and enquiries that arrive as real
            messages.
          </p>
          <Link href="/open-shop" className="fd-go">
            Open your shop &rarr;
          </Link>
        </div>
      </div>

      {/* The rest of the writing. This is what actually fills the page today. */}
      {trailingArticles.length > 0 ? (
        <div className="fd-grid">
          {trailingArticles.map((a) => (
            <ArticleCard key={a.slug} a={a} />
          ))}
        </div>
      ) : null}
    </>
  );
}
