/**
 * our-services.ts — the five cards on an event's More Services page ("Our
 * Services" until 2026-09-30).
 *
 * Owner, 2026-09-29 (DECISION_LOG "WHAT AN EVENT NEEDS — THE EVENT MENU
 * BECOMES FOUR PILLARS (+ HOME)"): *"Our Services (Papic, Live Studio,
 * Gallery, Patiktok, Music Maker)"* → *"include Setnayan AI (SAI) to our
 * services"*. Editorial folds into Gallery; the Suite becomes this page.
 *
 * Owner, 2026-09-30, trimming it further: *"gallery inside Papic"* ·
 * *"Editorial inside Post Event in Event Hub Maker"* · *"Event Hub Pro has its
 * own place too"* (the Maker's "Unlock Pro and Apply"). So Gallery is a part
 * under the Papic card, Editorial and Event Hub Pro are not drawn here at all.
 *
 * ─── NOTHING HERE IS NEW DATA ─────────────────────────────────────────────
 * Every card is a row the Suite already had. Its door is `addOnHref` — the
 * SAME page the event menu's product row opens today — its offered/closed
 * rules are the Suite's (`addOnOfferedForEvent` · `addOnSellableNow`, passed
 * in as predicates), its ownership is `eventActiveSkus`, and its price is the
 * Suite's `platform_retail_catalog_v2` read. This file only decides which six,
 * in what order, and in what words.
 *
 * 🔑 NO PRICE IS TYPED HERE. A price reaches a card only through `prices`,
 * which the page fills from the catalogue. `our-services.test.ts` fails if a
 * peso figure is ever written into this file.
 *
 * 🔑 UNKNOWN IS NOT FREE. When the price read fails, or the catalogue has no
 * live row, the card says "See the price" — never ₱0, never "Free".
 *
 * PURE — no I/O and no `server-only`, so the rules above are tested directly.
 */
import { Images, type LucideIcon } from 'lucide-react';
import { addOnHref, appStoreDetailHref, type AddOnEntry } from './add-ons-catalog';
import type { EventMenuChild, EventMenuIconName } from './customer-menu';

export type OurServiceState =
  | 'added'
  | 'pending'
  | 'free'
  | 'trial'
  | 'price'
  | 'unpriced'
  | 'closed'
  | 'soon';

/** A service's own part, shown with its card (Thank-You Video and Gallery
 *  inside Papic, Playlist inside Music Maker). `key` is the catalogue key it
 *  stands for (`gallery` for the Gallery, which has no catalogue entry). */
export type OurServicePart = { key: string; name: string; href: string; line: string };

export type OurService = {
  key: string;
  /** The name a person reads. Only Papic and Patiktok keep custom names. */
  name: string;
  /** One short, plain line about what it does. */
  line: string;
  /** Where the card goes; `null` = an inert card (see `inertReason`). */
  href: string | null;
  inertReason: string | null;
  state: OurServiceState;
  /** The state, in words — the card's one status line. */
  stateText: string;
  /** Paid and not yet on this event — drawn with the ◆. */
  pro: boolean;
  Icon: LucideIcon;
  /** The cover wash — the catalogue poster's own background. */
  gradient: string;
  parts: readonly OurServicePart[];
};

type CatalogueService = {
  key: string;
  name: string;
  line: string;
  /** Catalogue keys, first offered one wins (Live Studio's two tiles). */
  addOnKeys: readonly string[];
  /**
   * A catalogue tool that lives UNDER this card (owner "yes to all 4",
   * 2026-09-29): drawn as the card's part link, opening the same page the
   * Suite's card for it opened (`appStoreDetailHref`). Shown only when the
   * tool itself is offered for this event.
   */
  part?: { key: string; name: string; line: string };
};

/**
 * The catalogue services, in the owner's order (2026-09-30: *"Setnayan AI,
 * Papic, Live Studio, Music Maker, then Patiktok"*). Gallery is a part of Papic
 * (not a catalogue entry — see `galleryPart`); it stands as its own card, in
 * Papic's place, only where there is no Papic card, so it is never unreachable.
 *
 * `pakanta` is the catalogue KEY for Music Maker (DECISION_LOG 2026-09-29
 * "PAKANTA IS RENAMED MUSIC MAKER": identifiers stay, words change).
 */
const SERVICES: readonly CatalogueService[] = [
  {
    key: 'setnayan-ai',
    name: 'Setnayan AI (SAI)',
    line: 'Watches your suppliers for you',
    addOnKeys: ['setnayan-ai'],
  },
  {
    key: 'papic',
    name: 'Papic',
    line: 'Your guests take the photos',
    // `papic` has no single SKU (variablePricing); the Pool and the camera
    // passes that mean "Papic is on here" arrive as `papicOwnedBy`.
    addOnKeys: ['papic'],
    // The keepsake film is made FROM Papic's photos (PAPIC_ADDON_THANK_YOU).
    part: { key: 'thank-you', name: 'Thank-You Video', line: 'A short film for everyone who came' },
  },
  {
    key: 'live-studio',
    name: 'Live Studio',
    line: 'Your day, streamed live',
    // Exactly one of these passes `addOnOfferedForEvent` (the livestream
    // de-dupe lives there): the unified tile when its flag is on, else Cast.
    addOnKeys: ['live-studio-roam', 'panood'],
  },
  {
    key: 'music-maker',
    name: 'Music Maker',
    line: 'A song written from your story',
    addOnKeys: ['pakanta'],
    part: { key: 'playlist', name: 'Playlist', line: 'The right song for every moment' },
  },
  {
    key: 'patiktok',
    name: 'Patiktok',
    line: 'Short video reels from your day',
    addOnKeys: ['patiktok'],
  },
  // ⛔ NO EVENT HUB PRO CARD (owner 2026-09-30, "Event Hub Pro has its own place
  // too"): Pro is unlocked where it is used — the Maker's "Unlock Pro and Apply".
  // `website-pro` stays in OUR_SERVICE_ADD_ON_KEYS so the lists below never
  // bring it back either.
];

/** The keys of the cards, in order. */
export const OUR_SERVICE_KEYS = SERVICES.map((s) => s.key);

/**
 * Catalogue entries the cards stand for — or that have a home elsewhere and so
 * are never drawn on this page (`website-pro` → the Maker's Apply, `editorial`
 * → the Maker's Post Event). The page's "More for your event" lists leave these
 * out, so a service is never shown twice, or shown away from its home.
 * (`papic-guest` is the Papic Pool — its catalogue label is also "Papic".)
 */
export const OUR_SERVICE_ADD_ON_KEYS: ReadonlySet<string> = new Set([
  'papic',
  'papic-guest',
  'live-studio-roam',
  'panood',
  'patiktok',
  'pakanta',
  'setnayan-ai',
  'website-pro',
  'editorial',
]);

/**
 * The catalogue keys a built page actually shows — every card's own keys plus
 * the parts drawn under the cards. A part is shown only when its card and the
 * tool are both offered, so the page's lower lists must ask THIS (not a fixed
 * list): a Playlist whose Music Maker card is absent (no `song` surface) stays
 * reachable further down the page.
 */
export function shownAddOnKeys(cards: readonly OurService[]): ReadonlySet<string> {
  return new Set([...OUR_SERVICE_ADD_ON_KEYS, ...cards.flatMap((c) => c.parts.map((p) => p.key))]);
}

export type OurServicesInput = {
  eventId: string;
  /** The catalogue (`ADD_ONS`). */
  catalogue: ReadonlyArray<AddOnEntry>;
  /** `eventActiveSkus` — active and awaiting-payment SKUs for this event. */
  owned: { active: ReadonlySet<string>; pending: ReadonlySet<string> };
  /** service_code → formatted live price. A code with no row (a failed read,
   *  or no active catalogue row) is UNKNOWN, and its card says so. */
  prices: ReadonlyMap<string, string>;
  /** The Suite's `surfaceOk` — offered for this event type (and shell). */
  offered: (entry: AddOnEntry) => boolean;
  /** `addOnSellableNow` for this event's phase. */
  sellableNow: (entry: AddOnEntry) => boolean;
  /** Setnayan AI has a price for this event type (Tier E has none). */
  aiSellable: boolean;
  /** SKUs that mean Papic is on for this event (`PAPIC_INCLUSIVE_SKUS`). */
  papicOwnedBy: readonly string[];
  /** The store shell refuses this path (`isStoreShellWebOnlyPath`). */
  refusesPath: (path: string) => boolean;
};

const GALLERY_GRADIENT = 'linear-gradient(135deg, #1E2A24 0%, #35503F 55%, #6E8B6A 100%)';

function partFor(svc: CatalogueService, input: OurServicesInput): OurServicePart[] {
  const parts: OurServicePart[] = [];
  if (svc.part) {
    const entry = input.catalogue.find((a) => a.key === svc.part!.key);
    const href = entry ? appStoreDetailHref(entry.key, input.eventId) : null;
    if (entry && href && entry.status !== 'coming_soon' && input.offered(entry) && !input.refusesPath(href.split('?')[0]!)) {
      parts.push({ key: entry.key, name: svc.part.name, href, line: svc.part.line });
    }
  }
  // 🖼 Gallery is inside Papic (owner 2026-09-30, "gallery inside Papic").
  if (svc.key === 'papic') {
    const gallery = galleryPart(input);
    if (gallery) parts.push(gallery);
  }
  return parts;
}

const GALLERY_LINE = 'Every photo from your day';

function galleryPart(input: OurServicesInput): OurServicePart | null {
  const href = `/dashboard/${input.eventId}/galleries`;
  if (input.refusesPath(href)) return null;
  return { key: 'gallery', name: 'Gallery', href, line: GALLERY_LINE };
}

function catalogueCard(svc: CatalogueService, input: OurServicesInput): OurService | null {
  const entry = svc.addOnKeys
    .map((k) => input.catalogue.find((a) => a.key === k))
    .find((a): a is AddOnEntry => a != null && input.offered(a));
  if (!entry) return null;

  const ownKeys = [
    ...(entry.serviceKey ? [entry.serviceKey] : []),
    ...(svc.key === 'papic' ? input.papicOwnedBy : []),
  ];
  const isActive = ownKeys.some((k) => input.owned.active.has(k));
  const isPending = !isActive && ownKeys.some((k) => input.owned.pending.has(k));

  // Setnayan AI with no price for this event type can never be bought — the
  // Suite hid that card, and so does this page (unless it is already theirs).
  if (entry.key === 'setnayan-ai' && !input.aiSellable && !isActive && !isPending) return null;

  const open = addOnHref(entry.key, input.eventId);
  if (input.refusesPath(open.split('?')[0]!)) return null;

  const base = {
    key: svc.key,
    name: svc.name,
    line: svc.line,
    Icon: entry.Icon,
    gradient: entry.poster.baseBackground,
    parts: partFor(svc, input),
  };

  if (isActive) {
    return { ...base, href: open, inertReason: null, state: 'added', stateText: 'Added to your event', pro: false };
  }
  if (isPending) {
    return { ...base, href: open, inertReason: null, state: 'pending', stateText: 'Waiting for payment', pro: false };
  }
  if (entry.status === 'coming_soon') {
    return { ...base, href: null, inertReason: 'Not ready yet — coming soon.', state: 'soon', stateText: 'Coming soon', pro: false };
  }
  // STRICTLY AFTER the owned rungs — a service they paid for stays open the
  // morning after (the Suite's rule, `isClosed`).
  if (!input.sellableNow(entry)) {
    return {
      ...base,
      href: null,
      inertReason: 'This one is for the day itself, and your day has passed.',
      state: 'closed',
      stateText: 'Your day has passed',
      pro: false,
    };
  }
  if (entry.tier === 'free') {
    return { ...base, href: open, inertReason: null, state: 'free', stateText: 'Free', pro: false };
  }
  if (entry.freeTrial) {
    return { ...base, href: open, inertReason: null, state: 'trial', stateText: entry.freeTrial, pro: false };
  }
  const price = entry.serviceKey ? input.prices.get(entry.serviceKey) : undefined;
  if (price) {
    return { ...base, href: open, inertReason: null, state: 'price', stateText: `Add for ${price}`, pro: true };
  }
  return { ...base, href: open, inertReason: null, state: 'unpriced', stateText: 'See the price', pro: true };
}

/** The Gallery as its own card — drawn ONLY where there is no Papic card to
 *  carry it (see `buildOurServices`). Editorial is no part of it any more: it
 *  lives in the Maker's Post Event (owner 2026-09-30). */
function galleryCard(input: OurServicesInput): OurService | null {
  const part = galleryPart(input);
  if (!part) return null;
  return {
    key: 'gallery',
    name: 'Gallery',
    line: GALLERY_LINE,
    href: part.href,
    inertReason: null,
    state: 'free',
    stateText: 'Included',
    pro: false,
    Icon: Images,
    gradient: GALLERY_GRADIENT,
    parts: [],
  };
}

/** The cards for one event, in the owner's order, minus any not offered. */
export function buildOurServices(input: OurServicesInput): OurService[] {
  const cards = SERVICES.map((s) =>
    // No Papic card here → the Gallery stands in Papic's place on its own.
    s.key === 'papic' ? (catalogueCard(s, input) ?? galleryCard(input)) : catalogueCard(s, input),
  );
  return cards.filter((c): c is OurService => c != null);
}

/** Each card's icon, as a NAME from the menu's own vocabulary
 *  (`EVENT_MENU_ICONS`) — the same glyphs these products wore as rail rows. */
const MENU_ICON: Readonly<Record<string, EventMenuIconName>> = {
  'setnayan-ai': 'ai',
  papic: 'papic',
  'live-studio': 'live',
  'music-maker': 'pakanta',
  patiktok: 'patiktok',
  gallery: 'galleries',
};

/**
 * 📂 THE MORE SERVICES ROW'S CHILDREN (owner 2026-09-30: *"the sidebar will
 * expand and collapse to show these"*) — the built cards, in their order, as
 * plain menu data. A card with no door (coming soon, or its day has passed)
 * opens the More Services page, where its dimmed card says why.
 * Called in `layout.tsx`; the rail and the phone's "More" chooser draw it.
 */
export function ourServicesMenuChildren(
  cards: readonly OurService[],
  pageHref: string,
): EventMenuChild[] {
  return cards.map((c) => ({
    key: c.key,
    label: c.name,
    href: c.href ?? pageHref,
    icon: MENU_ICON[c.key] ?? 'product',
  }));
}

/*
  ─── EVERYTHING ELSE GOES HOME (owner "yes", 2026-09-29) ─────────────────────
  The Suite's leftovers — the tools under "More for your event" — each move to
  the place that already carries them, and leave this page. A tool leaves ONLY
  when that home exists on main today and offers it; a tool with no home yet
  stays on this page, so nothing becomes unreachable. When every tool has gone
  home, the section is gone too.

  Each entry names the home a person reaches it from. `needsWebsite`: the home
  is the Event Hub Maker, whose menu row exists only where the event type has
  the website surface — anywhere else the tool stays here.

  Owner "yes to all 4" (2026-09-29) homed the last four:
    · Playlist         → a part under the Music Maker card (above)
    · Thank-You Video  → a part under the Papic card (above)
    · Indoor Blueprint → Details › Seat plan (below, with its proof)
    · Find your date   → Details › Date (owner 2026-09-30: "find your date is
                          inside event hub maker. so we don't need it here")
*/
export type ToolHome = { home: string; needsWebsite?: true };

export const TOOL_HOMES: Readonly<Record<string, ToolHome>> = {
  // Free planning tools (the Suite's FREE_TOOLS) — each is its own menu row,
  // or a door on a page that is one.
  // Stage D (2026-09-29): the menu is five rows. Budget is a part of Your
  // Team; Schedule and the Mood Board are Details items of the Maker.
  guests: { home: 'the Guest list menu row' },
  budget: { home: 'Your Team — its Budget part' },
  schedule: { home: 'the Event Hub Maker — Your info › Schedule', needsWebsite: true },
  checklist: { home: 'Overview — "View your full checklist"' },
  compare: { home: 'Your Team — its Compare tab' },
  // Catalogue tools.
  'mood-board': { home: 'the Event Hub Maker — Your info › Mood Board', needsWebsite: true },
  // Train n (2026-09-29): the Seat plan row left the menu — its home is
  // Details › Your event › Seat plan, and its old page lands there.
  seating: { home: 'the Event Hub Maker — Your info › Your event › Seat plan', needsWebsite: true },
  'landing-page': { home: 'the Event Hub Maker menu row', needsWebsite: true },
  'save-the-date': { home: 'the Event Hub Maker — Save the Date', needsWebsite: true },
  rsvp: { home: 'the Event Hub Maker — the invitation editor', needsWebsite: true },
  'animated-monogram': { home: 'the Event Hub Maker — Logo', needsWebsite: true },
  // 🗺 Owner-approved 2026-09-29: "it's the same room" — the Indoor Blueprint is
  // a piece of Details › Seat plan (the shipped studio, drawn in its right part);
  // its old address lands there for the couple of an Event Hub event.
  'indoor-blueprint': { home: "the Event Hub Maker — Your info › Seat plan › Guests' map", needsWebsite: true },
  // 📅 Details › Date draws the date finder beside the date row
  // (`details-date-finder.tsx`, owner 2026-09-29 "THE DATE FINDER LIVES IN STEP 2").
  'find-date': { home: 'the Event Hub Maker — Your info › Date', needsWebsite: true },
};

/** Has this tool (a catalogue key or a free-tool key) gone home for this event? */
export function toolHasGoneHome(key: string, websiteEnabled: boolean): boolean {
  const h = TOOL_HOMES[key];
  if (!h) return false;
  return !h.needsWebsite || websiteEnabled;
}
