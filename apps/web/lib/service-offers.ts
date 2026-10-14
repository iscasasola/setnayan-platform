/**
 * lib/service-offers.ts — WHAT EACH "ADD" / "BUY MORE" SHEET SAYS, and which
 * catalog code it bills (pure; safe in a client component).
 *
 * ✅ Owner "approve all", 2026-10-14 — services prototype `OFFER` (one sheet
 * shape, its fillings): the title, one line under it, what it costs (the shipped
 * counter box), what comes with it, "After this", Continue to payment. The PRICE
 * is never here: the sheet is handed the catalog's figure and the server action
 * re-reads it (`resolveOrderChargeCentavos`).
 *
 * 🔒 ONE UNIT PER ORDER. The prototype draws − / + on the hosted channel (days)
 * and "Another song" (songs). Nothing in the product counts a quantity on these
 * orders — the hosted channel is one day per order today
 * (`HostedChannelUpsell`), a song is one PAKANTA order — so a counter here would
 * charge for days or songs nothing would ever deliver. Each press buys ONE; the
 * sheet says "add another any time". Flagged to the owner (handover).
 */

/** The sheets — the five services' Add, plus the two "buy more" of Live and Music. */
export const SERVICE_OFFER_KINDS = ['ai', 'live', 'music', 'booth', 'hub', 'more-screen', 'more-song'] as const;
export type ServiceOfferKind = (typeof SERVICE_OFFER_KINDS)[number];

export function isServiceOfferKind(v: unknown): v is ServiceOfferKind {
  return typeof v === 'string' && (SERVICE_OFFER_KINDS as readonly string[]).includes(v);
}

export type ServiceOffer = {
  /** The catalog code the order bills. */
  sku: string;
  title: string;
  sub: string;
  /** Under the price in the counter box. */
  unit: string;
  inc: readonly string[];
  /** "After this" — what the couple will have. */
  after: string;
  /**
   * The order's description — FIXED per offer: the one-press-one-order guard
   * matches a second press on it (`lib/one-press-one-order.ts`).
   */
  description: string;
  /** A thing that only happens ON the day — no sale once it is over (`addOnSellableNow`). */
  dayOfOnly: boolean;
  /** An unlock (bought once) — a second order for it is refused; a "more" is not. */
  unlock: boolean;
};

export const SERVICE_OFFERS: Readonly<Record<ServiceOfferKind, ServiceOffer>> = {
  ai: {
    sku: 'SETNAYAN_AI',
    title: 'Add the Planner',
    sub: 'One-time · never expires · for this event',
    unit: 'Setnayan AI · one-time',
    inc: ['Ranks every supplier you shortlist', 'Watches payments and deadlines', 'Never expires for this event'],
    after: 'Planner on',
    description: 'Setnayan AI — the Planner for this event',
    dayOfOnly: false,
    unlock: true,
  },
  live: {
    sku: 'LIVE_STUDIO',
    title: 'Add more cameras',
    sub: 'One-time · more cameras and venue screens · one camera stays free',
    unit: 'Live Watch · one-time',
    inc: ['More cameras, phones or DSLRs', 'Venue screens · a recording to keep', 'Buy 2 days before your day at the latest'],
    after: 'More cameras on',
    description: 'Live Watch — more cameras and venue screens for this event',
    dayOfOnly: true,
    unlock: true,
  },
  music: {
    sku: 'PAKANTA',
    title: 'Add Music Maker',
    sub: 'One original song, written and produced from your story',
    unit: 'Music Maker · one song',
    inc: ['Three questions, then we write it', 'Plays on your Event Hub when ready', 'No clock — you will see Ready on Home'],
    after: '1 song in production',
    description: 'Music Maker — one original song',
    dayOfOnly: false,
    unlock: true,
  },
  booth: {
    sku: 'PATIKTOK_COMPILER',
    title: 'Save & share your reels',
    sub: 'Per event · every reel, no watermark',
    unit: 'Patiktok · per event',
    inc: ['Download and share every reel', 'Recording stays free for guests', 'Post to TikTok when it is set up'],
    after: 'Save & share on',
    description: 'Patiktok — save & share every reel of this event',
    dayOfOnly: true,
    unlock: true,
  },
  hub: {
    sku: 'COUPLE_WEBSITE_PRO',
    title: 'Add Event Hub Pro',
    sub: 'One-time · never expires · for this event',
    unit: 'Event Hub Pro · one-time',
    inc: ['Every ◆ theme for your Event Hub', 'Photo and video backgrounds', 'Never expires for this event'],
    after: 'Pro on',
    description: 'Event Hub Pro — every ◆ theme, photo and video backgrounds',
    dayOfOnly: false,
    unlock: true,
  },
  'more-screen': {
    sku: 'LIVE_STUDIO_HOSTED_CHANNEL',
    // Named for what it is: Setnayan supplies and runs the YouTube channel your broadcast goes
    // to (the prototype's "venue screen" was not this product — flagged to the owner).
    title: 'Have Setnayan run the channel',
    sub: 'Your broadcast goes out on a Setnayan YouTube channel — no channel of your own needed',
    unit: '1 day · add another any time',
    inc: ['Setnayan supplies and runs the channel', 'Charged for each day it is used', 'Cameras, cutting and guest-pick are unchanged'],
    after: '1 day on a Setnayan channel',
    description: 'Live Watch — hosted channel (Setnayan runs it), one day',
    dayOfOnly: true,
    unlock: false,
  },
  'more-song': {
    sku: 'PAKANTA',
    title: 'Another song',
    sub: 'A second original song · the same price each',
    unit: '1 more song · add another any time',
    inc: ['Written and produced from your story', 'No clock — you will see Ready on Home'],
    after: 'Another song in production',
    description: 'Music Maker — another original song',
    dayOfOnly: false,
    unlock: false,
  },
};

/** The sheet a row's buy door opens. */
export function offerForDoor(row: 'ai' | 'live' | 'music' | 'booth' | 'hub', door: 'add' | 'more-screen' | 'more-song'): ServiceOfferKind {
  return door === 'add' ? row : door;
}
