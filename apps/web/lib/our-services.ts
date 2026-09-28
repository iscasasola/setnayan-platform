/**
 * our-services.ts — the six cards on an event's Our Services page.
 *
 * Owner, 2026-09-29 (DECISION_LOG "WHAT AN EVENT NEEDS — THE EVENT MENU
 * BECOMES FOUR PILLARS (+ HOME)"): *"Our Services (Papic, Live Studio,
 * Gallery, Patiktok, Music Maker)"* → *"include Setnayan AI (SAI) to our
 * services"*. Editorial folds into Gallery; the Suite becomes this page.
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
import { addOnHref, type AddOnEntry } from './add-ons-catalog';

export type OurServiceState =
  | 'added'
  | 'pending'
  | 'free'
  | 'trial'
  | 'price'
  | 'unpriced'
  | 'closed'
  | 'soon';

/** A service's own part, shown with its card (Editorial inside Gallery). */
export type OurServicePart = { name: string; href: string; line: string };

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
  part: OurServicePart | null;
};

type CatalogueService = {
  key: string;
  name: string;
  line: string;
  /** Catalogue keys, first offered one wins (Live Studio's two tiles). */
  addOnKeys: readonly string[];
};

/**
 * The five catalogue services, in the owner's order. Gallery sits between
 * Live Studio and Patiktok — it is not a catalogue entry (see `GALLERY`).
 *
 * `pakanta` is the catalogue KEY for Music Maker (DECISION_LOG 2026-09-29
 * "PAKANTA IS RENAMED MUSIC MAKER": identifiers stay, words change).
 */
const BEFORE_GALLERY: readonly CatalogueService[] = [
  {
    key: 'papic',
    name: 'Papic',
    line: 'Your guests take the photos',
    // `papic` has no single SKU (variablePricing); the Pool and the camera
    // passes that mean "Papic is on here" arrive as `papicOwnedBy`.
    addOnKeys: ['papic'],
  },
  {
    key: 'live-studio',
    name: 'Live Studio',
    line: 'Your day, streamed live',
    // Exactly one of these passes `addOnOfferedForEvent` (the livestream
    // de-dupe lives there): the unified tile when its flag is on, else Cast.
    addOnKeys: ['live-studio-roam', 'panood'],
  },
];

const AFTER_GALLERY: readonly CatalogueService[] = [
  {
    key: 'patiktok',
    name: 'Patiktok',
    line: 'Short video reels from your day',
    addOnKeys: ['patiktok'],
  },
  {
    key: 'music-maker',
    name: 'Music Maker',
    line: 'A song written from your story',
    addOnKeys: ['pakanta'],
  },
  {
    key: 'setnayan-ai',
    name: 'Setnayan AI (SAI)',
    line: 'Watches your suppliers for you',
    addOnKeys: ['setnayan-ai'],
  },
];

/** The keys of the six cards, in order. */
export const OUR_SERVICE_KEYS = [
  ...BEFORE_GALLERY.map((s) => s.key),
  'gallery',
  ...AFTER_GALLERY.map((s) => s.key),
] as const;

/**
 * Catalogue entries the six cards stand for. The page's "More for your event"
 * lists leave these out, so a service is never shown twice on one page.
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
  'editorial',
]);

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
    part: null,
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

function galleryCard(input: OurServicesInput): OurService | null {
  const href = `/dashboard/${input.eventId}/galleries`;
  if (input.refusesPath(href)) return null;
  const editorial = `/dashboard/${input.eventId}/story`;
  return {
    key: 'gallery',
    name: 'Gallery',
    line: 'Every photo from your day',
    href,
    inertReason: null,
    state: 'free',
    stateText: 'Included',
    pro: false,
    Icon: Images,
    gradient: GALLERY_GRADIENT,
    // Editorial is PART of Gallery (owner 2026-09-29) — the story told from
    // the same photos. It keeps its own page; the Gallery card carries its door.
    part: input.refusesPath(editorial)
      ? null
      : { name: 'Editorial', href: editorial, line: 'Your story, told from your photos' },
  };
}

/** The six cards for one event, in the owner's order, minus any not offered. */
export function buildOurServices(input: OurServicesInput): OurService[] {
  const cards = [
    ...BEFORE_GALLERY.map((s) => catalogueCard(s, input)),
    galleryCard(input),
    ...AFTER_GALLERY.map((s) => catalogueCard(s, input)),
  ];
  return cards.filter((c): c is OurService => c != null);
}
