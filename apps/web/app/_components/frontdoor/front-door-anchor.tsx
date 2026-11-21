/**
 * front-door-anchor.tsx — the first screen of the signed-out front page: the photo-led opening and the picker.
 *
 * BUILT FROM `prototypes/front_page_home_2026-11-19/` v5 (owner 20 Nov: "setnayan hom, suppler and coordinator page
 * APPROVED. you can build this" — specs ef5df0b5; brief `FRONT_PAGES_BUILD_BRIEF_2026-11-20.md`). It replaces the
 * 4 Nov turning-word hero. Drawn in Discover's look: an inset photo card with a 22 px corner and the headline on it,
 * then "What are you planning? · All N kinds →", one swipe row of event types (`EventTypeShelf`), the trust line and
 * Discover's chip row.
 *
 * ─── THE TWO GOOGLE OAUTH GUARDS STILL HOLD (`app/google-can-verify-the-home-page.test.ts`) ─────────────
 *   • "Setnayan" is typed INSIDE the one <h1>. The drawing's small line over the headline reads "Set na ’yan"; here
 *     that line IS the name, typed "Setnayan" in title case and drawn in capitals by CSS — the same look, and the
 *     name Google matches against the consent screen (refused 2026-10-22).
 *   • a paragraph opens "Setnayan is …" and says what the app does. The drawing has no such line; it sits under the
 *     trust line in the small grey type, the one addition this port makes to the first screen.
 *
 * ─── WORDS ───────────────────────────────────────────────────────────────────────────────────────────────
 * "celebration" appears in exactly ONE place here: the brand headline (owner 19 Nov: brand lines say celebration,
 * every heading and button says event). `the-front-door-says-event.test.ts` lists that line by name.
 *
 * NO SAMPLE OR DEMO BUTTONS (owner, CLOUD_BOARD 5 Nov). "See it as a guest" is an in-page jump to #live, never /sample.
 * A tile goes straight to its own onboarding by the shared rule (`startHrefFor`), no sign-up in front; "All N kinds"
 * opens the public picker, /start.
 *
 * Signed in, this is not rendered at all (`front-door.tsx`).
 */
import Link from 'next/link';

import { marketingPhoto } from '@/lib/front-page-photos';
import { formatCount } from '@/lib/format-number';
import { EventTypeShelf, type EventTypeTile } from './front-door-landing';

/** The brand headline — the one place "celebration" is said on the front door (owner 19 Nov). */
export const HOME_BRAND_LINE = 'The home of every Filipino celebration.';

export function FrontDoorAnchor({
  tiles = [],
  kinds = 0,
}: {
  /** The picker's tiles, in the drawing's order (`frontPageTiles`). Empty → the row is not drawn. */
  tiles?: readonly EventTypeTile[];
  /** How many kinds the roster has — the "All N kinds" link counts the roster, never a typed number. */
  kinds?: number;
}) {
  return (
    <section className="fl-front" id="start" aria-labelledby="fd-opening-h">
      <figure className="fl-hp">
        {/* The first screen's one photo (LCP): never lazy, fetched first. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={marketingPhoto('hero-wedding')}
          alt=""
          width={1600}
          height={1200}
          fetchPriority="high"
          decoding="async"
        />
        <figcaption className="fl-fhead">
          <h1 id="fd-opening-h">
            <span className="fl-kick">Setnayan</span>
            <span className="fl-h1">{HOME_BRAND_LINE}</span>
          </h1>
          <p className="fl-sub">
            One link for your whole event: your guests, your suppliers, your photos{' '}
            <span>&mdash; from the first idea to the memories.</span>
          </p>
        </figcaption>
      </figure>

      <div className="fl-head fl-front-head">
        <h2 className="fd-sechead fl-sechead">
          <span>What are you planning?</span>
          {kinds > 0 ? (
            <Link className="fl-go" href="/start">
              All {formatCount(kinds)} kinds &rarr;
            </Link>
          ) : null}
        </h2>
        <p className="fl-lede">Tap to begin.</p>
      </div>
      {tiles.length > 0 ? <EventTypeShelf tiles={tiles} /> : null}

      <p className="fl-trust">
        <b>Free.</b> No account needed to start. Sign in only when you save.
      </p>
      <p className="fl-what fl-fine">
        Setnayan is the Filipino event app: your guests and their RSVPs, the suppliers you book, your Event Hub, and
        every photo your guests take, in one album.
      </p>
      <nav className="fd-chips fl-chips" aria-label="On this page">
        <a className="fd-chip" href="#live">
          See it as a guest
        </a>
        <a className="fd-chip" href="#plan">
          Plan it
        </a>
        <a className="fd-chip" href="#keep">
          Keep it
        </a>
        <a className="fd-chip" href="#plans">
          Plans
        </a>
      </nav>
    </section>
  );
}
