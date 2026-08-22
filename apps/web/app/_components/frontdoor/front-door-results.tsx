/**
 * front-door-results.tsx — what the top bar's search answers with, ON HOME.
 *
 * ─── WHY THIS EXISTS ─────────────────────────────────────────────────────
 * Owner, 2026-08-20, pointing at the front door's own body: *"the search bar
 * should run search results on the [main] part? this search bar will be
 * specifically for the Home."*
 *
 * He was right, and the live evidence was worse than the complaint. Every
 * search — signed in through the palette's escape row, signed out through the
 * public box — was handed to the SUPPLIER MARKETPLACE. Measured on
 * www.setnayan.com the same day, `?q=doves` rendered, in this order:
 *
 *     "No vendors match exactly. Try widening your search or clearing one
 *      filter at a time."
 *     …and below it: Stories and guides — "The release of doves: a Filipino
 *      wedding tradition"
 *
 * A box promising "suppliers, stories and guides" answered a story query with
 * a failure about suppliers, and put the thing it found underneath. Prod holds
 * two shops, so the marketplace could not lead well on anything.
 *
 * ─── WHAT CHANGED, AND WHAT DELIBERATELY DID NOT ─────────────────────────
 * The answers now render HERE, in the front door's own body, in the front
 * door's own card family — the same shelf the chips above filter. Nothing
 * about the marketplace's search changed: /explore keeps its own box, its
 * word-bridge, its filters and all 192 categories, and every results page
 * carries one row handing the typed words straight to it.
 *
 * 🔑 THE SUPPLIER SECTION HERE IS DELIBERATELY THE SMALLER ONE. It matches
 * shop names and cities over exactly the shops the front page already
 * publishes (`searchLiveShops`, which shares this page's one visibility gate).
 * It does NOT re-implement the marketplace pipeline — that would be a second
 * definition of who may be shown, and the direction it drifts in is a hidden
 * shop rendered on the front page. See `data.ts` for the full account.
 *
 * ─── PORTED, NOT REDRAWN ─────────────────────────────────────────────────
 * Every class here already exists in `front-door.css` and is already rendered
 * by `front-door-feed.tsx` — `fd-grid`, `fd-item`, `fd-thumb`, `fd-imeta`,
 * `fd-kindtag`, `fd-sechead`, `fd-invite`, `fd-go`. A results page that
 * introduced its own card would be a second design for one shelf.
 */
import 'server-only';

import Image from 'next/image';
import Link from 'next/link';

import { searchReads } from '@/lib/site-search';
import { searchLiveShops, type FrontDoorData, type FrontDoorShop } from './data';
import type { HomeCommandItem } from '@/app/dashboard/(launcher)/_components/home-command-bar';

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
 * A reading hit rendered as the shelf's own card.
 *
 * 🔑 THE COVER IS RECOVERED FROM THE PAGE'S OWN ARTICLE DATA, not carried by
 * the hit. `ReadHit` has no image — it serves a plain list on /explore — and a
 * results grid of grey rectangles beside the shelf's photographed cards reads
 * as images that failed to load. The front door already holds every published
 * article with its cover, so a `/blog/<slug>` hit is matched back to it. Help
 * pages and stories have no cover and get the text grammar the story cards
 * already use, which is a deliberate look and not a fallback.
 */
function ReadCard({
  hit,
  article,
}: {
  hit: Awaited<ReturnType<typeof searchReads>>[number];
  article: FrontDoorData['articles'][number] | undefined;
}) {
  return (
    <Link href={hit.href} className="fd-item">
      <div className="fd-thumb">
        {article ? (
          <>
            <Image
              src={article.cover}
              alt={article.coverAlt}
              fill
              sizes="(max-width: 700px) 50vw, (max-width: 1023px) 33vw, 266px"
              className="fd-cover"
            />
            <span className="fd-dur">{article.readingMinutes} min</span>
          </>
        ) : (
          <p className="fd-readblurb">{hit.blurb}</p>
        )}
      </div>
      <div className="fd-imeta">
        <span className="fd-ava" aria-hidden="true">
          SN
        </span>
        <div className="fd-itxt">
          <p className="fd-ttl">{hit.title}</p>
          <p className="fd-by">
            <span className="fd-kindtag">{hit.tag}</span>
          </p>
        </div>
      </div>
    </Link>
  );
}

/** A matched shop, in the same card the "first shops" shelf already renders. */
function ShopHitCard({ s }: { s: FrontDoorShop }) {
  return (
    <Link href={s.href} className="fd-item">
      <div className="fd-thumb fd-thumb-shop">
        {s.logoUrl ? (
          // A plain <img> for the reason the shelf's card states: an r2:// logo
          // resolves to a presigned url whose signature changes every render,
          // and next/image bills per transformation.
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

/** One of the searcher's own events or spaces. */
function OwnCard({ item }: { item: HomeCommandItem }) {
  return (
    <Link href={item.href} className="fd-item">
      <div className="fd-thumb fd-thumb-shop">
        <span className="fd-shopmark">{initialsOf(item.label)}</span>
      </div>
      <div className="fd-imeta">
        <span className="fd-ava" aria-hidden="true">
          {initialsOf(item.label)}
        </span>
        <div className="fd-itxt">
          <p className="fd-ttl">{item.label}</p>
          <p className="fd-by">
            <span className="fd-kindtag">Yours</span> {item.sublabel}
          </p>
        </div>
      </div>
    </Link>
  );
}

export async function FrontDoorResults({
  query,
  data,
  commandItems,
}: {
  /** Already trimmed and known non-empty by the caller. */
  query: string;
  data: FrontDoorData;
  /**
   * The searcher's own events and spaces — ALREADY LOADED by the page for the
   * palette, so filtering it here costs nothing and adds no read. `[]` for a
   * stranger, which is the correct answer rather than a missing section.
   */
  commandItems: HomeCommandItem[];
}) {
  /*
    Both halves of the answer, in parallel. `searchReads` fails soft by
    contract (a database hiccup costs the stories, never the guides), and
    `searchLiveShops` returns [] on a rejected read — so a failure here is a
    thinner answer, never a broken page.
  */
  const [hits, shops] = await Promise.all([
    searchReads(query, 24),
    searchLiveShops(query, 12),
  ]);

  /*
    The searcher's own things. Filtered exactly as the palette filters them —
    the same fields, the same lowercase includes — so pressing Enter can never
    show fewer of your own things than the dropdown you pressed Enter from.
  */
  const needle = query.toLowerCase();
  const own = commandItems.filter(
    (i) =>
      i.kind !== 'action' &&
      `${i.label} ${i.sublabel}`.toLowerCase().includes(needle),
  );

  const bySlug = new Map(data.articles.map((a) => [a.slug, a]));
  const articleFor = (href: string) => {
    const slug = /^\/blog\/([^/?#]+)/.exec(href)?.[1];
    return slug ? bySlug.get(slug) : undefined;
  };

  const total = own.length + shops.length + hits.length;

  return (
    <>
      <h2 className="fd-sechead">
        <span>
          Results for &ldquo;{query}&rdquo;
        </span>
        <span className="fd-meta">
          {total === 0
            ? 'nothing here yet'
            : `${total} ${total === 1 ? 'thing' : 'things'}`}
        </span>
        {/*
          THE WAY BACK IS PART OF THE RESULTS, not something to find. A search
          that can only be left by editing the address bar is a dead end, and
          this page has no other visible control that clears the query.
        */}
        <Link href="/" className="fd-sechead-go">
          Clear
        </Link>
      </h2>

      {own.length > 0 ? (
        <div className="fd-grid">
          {own.map((i) => (
            <OwnCard key={i.id} item={i} />
          ))}
        </div>
      ) : null}

      {shops.length > 0 ? (
        <div className="fd-grid">
          {shops.map((s) => (
            <ShopHitCard key={s.href} s={s} />
          ))}
        </div>
      ) : null}

      {hits.length > 0 ? (
        <div className="fd-grid">
          {hits.map((h) => (
            <ReadCard key={h.href} hit={h} article={articleFor(h.href)} />
          ))}
        </div>
      ) : null}

      {/*
        THE MARKETPLACE ROW IS PERMANENT, NOT AN EMPTY STATE.

        🔑 It renders whether or not shops matched here, because the two
        searches are not the same search. This page matched names and cities;
        /explore resolves the word-bridge (typing "photographer" reaches the
        Photo & video folder), all 192 categories, and every filter. Showing
        the row only on zero results would hide the stronger search at exactly
        the moment two weak matches made it look answered.
      */}
      <div className="fd-grid">
        <div className="fd-invite fd-invite-full">
          <h3>
            {total === 0
              ? `Nothing on Setnayan matches “${query}” yet.`
              : 'Looking for a supplier?'}
          </h3>
          <p>
            {total === 0
              ? 'We searched our writing, the shops we publish, and anything of yours. The marketplace searches differently — by category, city and what a supplier actually does — so it is worth trying there.'
              : 'The marketplace searches by category, city and what a supplier actually does, across every shop and all 192 categories.'}
          </p>
          <Link href={`/explore?q=${encodeURIComponent(query)}`} className="fd-go">
            Search suppliers for &ldquo;{query}&rdquo; &rarr;
          </Link>
        </div>
      </div>
    </>
  );
}
