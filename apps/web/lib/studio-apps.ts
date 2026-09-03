/**
 * studio-apps.ts — the ONE place the Studio products are described.
 *
 * ─── WHY THIS FILE EXISTS ────────────────────────────────────────────────
 * Owner, 2026-08-14, pointing at the rail's Studio group: *"the side menu when
 * signed out, it will be able to show demo. when logged in, it will be
 * different view."* and *"that is where we can talk about the different apps."*
 *
 * Seven bare names in a list teach a stranger nothing. But the sentences that
 * explain them were ALREADY WRITTEN — each product page carried its own
 * `const PAGE_DESCRIPTION`, the public, SEO-indexed description that feeds its
 * `<meta name="description">`, its OpenGraph card and its JSON-LD. Writing a
 * second set for the rail would have been the paid-twice mistake in miniature.
 *
 * 🔑 SO THE PAGES NOW READ FROM HERE, NOT THE OTHER WAY ROUND. That direction
 * is the whole mechanism: a description can only be changed in one place, and
 * the rail and the search result can never disagree about what a product is.
 * Lifting the strings while leaving the pages holding their own copies would
 * have been two hand-typed strings that must agree — which is not a mechanism,
 * it is a future drift, and this repo has paid for that exact shape (llms.txt
 * drifted three weeks with green CI, and its own guard compared two hand-typed
 * things).
 *
 * ─── WHY THERE ARE TWO LENGTHS AND NOT A DERIVED ONE ─────────────────────
 * A rail row wants one short line; `description` is written for a search
 * result and is far too long. The obvious trick — take the first sentence —
 * was MEASURED against all seven and fails on `/setnayan-ai`, whose opener is
 * rhetorical: *"Every other wedding AI waits for you to ask."* That is a hook,
 * not a description, and a rail row saying it would tell a stranger nothing
 * about what the thing does.
 *
 * So both lengths live here, authored together, in one record. That is NOT the
 * same defect as a second hand-typed copy elsewhere: they are different lengths
 * on purpose, they cannot drift apart unnoticed because they sit on adjacent
 * lines, and `studio-apps.test.ts` pins every page's metadata to this file.
 *
 * ─── WHAT ELSE A ROW NEEDS TO KNOW ───────────────────────────────────────
 * `demo` · `addOnKey` · `surface` are here because they answer the same
 * question the descriptions do — "what is this product" — and splitting them
 * across three files is how the rail ends up offering a demo that does not
 * exist or a door that refuses.
 */
import type { DemoOverlayId } from './demo-overlay-bus';
import type { ProfileSurface } from './event-type-profile';

export type StudioApp = {
  /** Stable id. Also the rail row's key. */
  key: string;
  /** The product's own name, as the rail and the page both say it. */
  name: string;
  /** The PUBLIC doorway. Pinned by `doorway-invariants.test.ts` — eight public
   *  pages, deliberately. Changing where a row GOES is fine; pointing one at a
   *  page that does not exist is not. */
  href: string;
  /**
   * THE PUBLIC, SEO-INDEXED DESCRIPTION. The page's `metadata.description`,
   * its OpenGraph and Twitter cards and its JSON-LD all read this exact string.
   * Moved here VERBATIM from each page's own `PAGE_DESCRIPTION` — not reworded,
   * because rewording it would have quietly rewritten seven live search results.
   */
  description: string;
  /**
   * The rail's one line. A faithful compression of `description` — same claim,
   * fewer words. Never a NEW claim: if these two ever say different things
   * about what a product does, this file has failed at its only job.
   */
  railLine: string;
  /**
   * The product's live demo, when one EXISTS — read by BOTH the rail's "try it"
   * marker and the demo button on the product's own page.
   *
   * 🔑 ONE FIELD, TWO READERS, AND THAT IS THE POINT. For one day the page's
   * button was hand-typed on each page while the rail's marker came from here —
   * two sources that had to agree about whether a product is try-able. The rail
   * promising "try it" on a page with no demo button is a fake door, and nothing
   * would have caught the drift.
   *
   * ⚠ ONLY THREE OF THE SEVEN HAVE ONE, and that is measured, not assumed.
   * `HomeOverlays` mounts exactly four demo overlays — papic, panood, plan3d
   * and the Alaala editions — and the fourth is not a Studio product.
   * 🔑 SETNAYAN AI HAS NO DEMO. The owner named it, and its homepage pop-up is a
   * savings COMPARATOR (drag your date, compare against hiring it out), never a
   * live trial. Wiring a `demo` here for it would put a row in front of a
   * stranger that opens nothing — the fake door this page forbids and
   * `doorway-invariants.test.ts` exists to catch. Rows without a demo keep
   * today's behaviour and open their product page.
   */
  demo?: {
    /** The overlay `HomeOverlays` renders. */
    id: DemoOverlayId;
    /** The button's own words on the product page. */
    label: string;
    /** The honest cost underneath: what the person has to hand. */
    sublabel: string;
  };
  /**
   * Where a SIGNED-IN person goes instead — the add-on key, resolved through
   * `addOnHref(key, eventId)`. Absent means "no in-app home", and the row keeps
   * pointing at the public page for everyone.
   */
  addOnKey?: string;
  /**
   * The event-type surface this product needs, when it needs one.
   *
   * 🔴 THIS IS THE DEAD-CONTROL GUARD, and it is not optional. `monogram` is
   * WEDDING-ONLY — the non-wedding seed says so verbatim and `GENERIC_PROFILE`
   * omits it — and `/dashboard/[eventId]/monogram` then `redirect()`s to the
   * event home with NO message. Without this filter a birthday organiser
   * presses "Logo Maker" and is silently dumped on their event page: strictly worse
   * than the marketing page it replaced. Same for `website`/Pawebsite.
   * The couple's own Studio hub already filters on exactly this field.
   */
  surface?: ProfileSurface;
};

/**
 * The nine, in the order the rail shows them.
 *
 * ⚠ ALAALA IS NOT HERE. It is a public doorway too, but it lives in the rail's
 * ACCOUNT slot ("What is Alaala?" signed out, "Alaala" signed in), not in
 * Studio — exactly as the binding prototype has it. Adding it here would put it
 * in the list twice.
 *
 * ⚠ AND NOT EVERY ROW HERE IS SOLD. `mood-board` is free (see its entry). The
 * group is "the products a stranger should meet", not "the products with a
 * price" — and nothing in this file or in `RailTool` carries a price, a tier or
 * a lock, so a free row and a paid row render identically by construction.
 */
export const STUDIO_APPS: readonly StudioApp[] = [
  {
    key: 'setnayan-ai',
    name: 'Setnayan AI',
    href: '/setnayan-ai',
    description:
      'Every other wedding AI waits for you to ask. Setnayan AI watches the vendors you’re eyeing and the ones you’ve booked — finding your best-fit Filipino vendors, then flagging a deposit due, a price that moved, or a date about to clash before it costs you. It doesn’t chat. It watches.',
    railLine:
      'Watches your vendors and flags a deposit, a price change or a clash before it costs you.',
    addOnKey: 'setnayan-ai',
  },
  {
    key: 'pawebsite',
    // ⚠ NAME ≠ ROUTE, DELIBERATELY (owner 2026-08-15). The product is "Event
    // Hub"; the address stays `/pawebsite` so the sitemapped, indexed URL keeps
    // its search history. This is EXACTLY the shape Live Studio already ships
    // in — it is named "Live Studio" and lives at `/panood`. Do not "fix" the
    // mismatch by moving the route: that costs real search traffic and buys
    // nothing a reader can see.
    name: 'Event Hub',
    href: '/pawebsite',
    description:
      'Your Event Hub is one beautiful home for your whole event — your save-the-date, your RSVP, your event details, and your love story, told like a magazine feature. One address you share once, and everything your guests need is there.',
    railLine: 'One link for your save-the-date, RSVP, details and love story.',
    addOnKey: 'landing-page',
    surface: 'website',
  },
  {
    key: 'papic',
    name: 'Papic',
    href: '/papic',
    description:
      'Papic turns your guests into your photo crew. Everyone shoots, every photo finds the people in it, and each guest goes home with their own gallery — plus a personal video reel set to music. The candid wedding moments one photographer can’t be everywhere for, delivered to everyone. Philippines-first.',
    railLine: 'Turns your guests into your photo crew.',
    demo: {
      id: 'papic-demo',
      label: 'Try it now with a friend',
      sublabel: 'Two phones, one minute. No app, no sign-up — nothing is saved.',
    },
    addOnKey: 'papic',
  },
  {
    key: 'panood',
    name: 'Live Studio',
    href: '/panood',
    description:
      'Live Studio brings the people who can’t be in the room into your day — live. The lola overseas, the friends who couldn’t fly home, the family who couldn’t make it: they watch your wedding as it happens, right on your own Event Hub. Presence across distance, for everyone you love.',
    railLine: 'Brings the people who can’t be in the room into your day — live.',
    demo: {
      id: 'panood-demo',
      label: 'Try the control room with two phones',
      sublabel: 'Both phones scan one code and become cameras. You cut between them.',
    },
    addOnKey: 'panood',
    // S1 (owner 2026-09-01): hidden on date · hangout · travel — same surface
    // the 'panood' add-on entry carries, so the sidebar and the Suite grid
    // agree. See the `surface` doc above.
    surface: 'livestream',
  },
  {
    key: 'patiktok',
    name: 'Patiktok',
    href: '/patiktok',
    description:
      'Patiktok turns your wedding moments into short, vertical highlight reels — set to music, ready to share, no editing required. The first dance, the entrance, the toast: the moments that travel, made the moment they happen.',
    railLine: 'Turns your moments into short, vertical highlight reels.',
    addOnKey: 'patiktok',
  },
  {
    key: 'pa3d',
    name: '3D Plan',
    href: '/pa3d',
    description:
      '3D Plan lets you stand in your reception before it’s built. See the room the way your guests will — the head table, the dance floor, every seat — and know it’s right while there’s still time to change it. The free seating plan gets you there; 3D Plan lets you walk it.',
    railLine: 'Stand in your reception before it’s built.',
    demo: {
      id: 'plan3d-demo',
      label: 'Walk around a sample reception',
      sublabel: 'Seat a guest, then scan to see the room as them — no sign-up.',
    },
    addOnKey: 'seating',
    // S1 (owner 2026-09-01): hidden on date · hangout · travel — the EXISTING
    // `seating` surface those three rows already exclude (pre-2026-08-28, see
    // TRAVEL_PROFILE's note). No migration needed for this row; it was only
    // ever missing from the sidebar's OWN gate, which is why it always showed.
    surface: 'seating',
  },
  {
    /*
      ─── THE NINTH, ADDED 2026-09-03, AND THE FIRST FREE ONE ───────────────
      Owner, looking at the Studio group in the rail: *"i do not see it."*

      🔑 THIS REVERSES HALF OF THE 2026-08-21 STRUCTURE, DELIBERATELY. That
      ruling put the NAMED PRODUCTS in this group and left *"the free parts (the
      seat plan, the mood board, the day-of page)"* on the services hub — the
      "All services" row `studio-rail.ts` appends. So the mood board WAS
      reachable: Studio → All services → Mood Board. Two taps, behind a generic
      word.

      It collided with the older lock (2026-07-17/18) that names the mood board
      one of six "always free" FIRST-CLASS doorways, which must stay *directly*
      reachable rather than buried — and the collision got worse when the board
      became the thing 3D Plan reads from. The paid product sits one tap away in
      this very list; the free tool that makes it worth buying sat two taps back.
      The owner resolved it in favour of the older lock: promote it, and leave
      "All services" exactly where it is. This is an ADDITION, not a move.

      🔑 FREE CHANGES NOTHING ABOUT THIS RECORD, AND THAT IS THE POINT. `tier:
      'free'` and the absent `serviceKey` live on the `add-ons-catalog.ts` entry
      this row opens, which is where the Suite grid reads a price and paints a
      "Free" pill. The rail reads NEITHER — a `RailTool` is a name, a line, an
      href and an optional demo marker — so promoting a free tool cannot render
      an upsell or a lock here. Do not add one: a price on this row would be the
      first price the rail has ever shown, on the one product that has none.

      🔑 NO `surface`, MEASURED NOT ASSUMED. The `mood-board` catalogue entry
      carries none either, so every event type offers it and the sidebar and the
      Suite grid agree — which is exactly what `studio-menu-adapts-to-event.test.ts`
      asserts, key by key, for all four profile shapes.

      🔑 NO `demo`. `HomeOverlays` mounts no mood-board overlay, and a "try it"
      marker on a page that cannot be tried is the fake door this file forbids.

      ⚠ THE PUBLIC PAGE LANDS IN THE SAME COMMIT, and it has to:
      `front-door-invariants.test.ts` requires every signed-out Studio row to
      resolve to `app/(shell)/<href>/page.tsx`, and a signed-out stranger is
      shown `href` verbatim. Pointing this row at the in-event route
      `/dashboard/[eventId]/studio/mood-board` was the other candidate and it is
      not available: there is no eventId to substitute for a stranger, so the
      row would 404 for exactly the people the rail exists to introduce the
      product to.
    */
    key: 'mood-board',
    name: 'Mood Board',
    href: '/mood-board',
    description:
      'The Mood Board is where your wedding decides how it looks. Pick your palette, gather the rooms and details you love, and set the dress code for every role — then your save-the-date, your Event Hub, your monogram, your QR codes and your 3D Plan all dress to match, and your booked suppliers work from the same board. Free with every Setnayan account.',
    railLine: 'Pick your colors once — every piece dresses to match.',
    addOnKey: 'mood-board',
  },
  {
    /*
      ─── THE EIGHTH, ADDED 2026-08-21 ──────────────────────────────────────
      Owner: *"pakanta is paid. so add this to the studio."*

      It has been SOLD since 2026-05-14 and had no public page until today, so
      `front-door-invariants.test.ts` deliberately kept it out of the rail: a
      row for it would have been a fake door. `/pakanta` lands in the same
      commit, and that guard is inverted rather than deleted — it now fails if
      the page disappears while the row stays.

      🔑 NO `demo`. Nothing renders a Pakanta overlay — see the `demo` note
      above; a "try it" marker on a page with no demo button is the fake door
      this file forbids.

      🔄 UPDATED 2026-09-01 (S1). Pakanta IS still not wedding-only — a debut or
      an anniversary can buy a song, same as before — but it is no longer
      offered on EVERY event type either: owner ruling hides it on
      date · hangout · travel · simple_event, the same four the seeded rows
      exclude via migration 20271188752170. `surface: 'song'` below carries
      that, matching the `add-ons-catalog.ts` entry it opens.
    */
    key: 'pakanta',
    name: 'Pakanta',
    href: '/pakanta',
    description:
      'Pakanta writes your wedding its own song — an original track composed from the love story you already told us, in the kind of music the two of you actually listen to. Yours to keep, cleared to share, and it becomes the music behind every video from your day, so the whole wedding sounds like you.',
    railLine:
      'An original song from your love story — and the music behind your videos.',
    addOnKey: 'pakanta',
    surface: 'song',
  },
  {
    key: 'palogo',
    name: 'Logo Maker',
    href: '/palogo',
    description:
      'Logo Maker gives your wedding one mark of its own — your initials, drawn into a monogram that comes alive. It opens your save-the-date, signs your website, glows on the screen at the reception, and closes every video. One signature, carried beautifully across your whole day.',
    railLine: 'One monogram of your own, carried across your whole day.',
    addOnKey: 'animated-monogram',
    surface: 'monogram',
    // ⚠ /palogo IS STILL A LIVE PAGE. The LED backdrop was removed from the
    // product on 2026-08-11, but that retired the Setnayan-MADE 8K wall file —
    // not the monogram maker this page sells. Verified: the route returns 200.
  },
] as const;

/** By key, for a page that needs its own record. */
export function studioApp(key: string): StudioApp | undefined {
  return STUDIO_APPS.find((a) => a.key === key);
}

/**
 * The description for a page, by key. Throws rather than returning undefined:
 * a page whose metadata silently became `undefined` would ship with NO
 * description at all, which is invisible on screen and costs the search result
 * the string exists for.
 */
export function studioDescription(key: string): string {
  const app = studioApp(key);
  if (!app) {
    throw new Error(
      `studioDescription: no Studio app named "${key}". Its page metadata would ` +
        'have shipped with no description at all.',
    );
  }
  return app.description;
}
