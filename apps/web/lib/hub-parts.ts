/**
 * apps/web/lib/hub-parts.ts
 *
 * 💎 EVENT HUB PRO, PART BY PART — the one table of what each part unlocks, and
 * the one piece of arithmetic that says when the parts add up to everything.
 *
 * Owner rulings, 2026-10-22 (corpus DECISION_LOG "EVENT HUB PRO, PART BY PART";
 * approved prototype `prototypes/pro_part_by_part_2026-10-22.html`; gate
 * inventory `shots-2026-10-22/pro-gates/PRO-GATES.md`, 37 gates → 11 parts):
 *
 *   · 11 parts. BIG: Reveal · Background · Photos · Style · Motion.
 *     SMALL: Logo & QR · Music · Prints · Post Event · Your own scenes ·
 *     Custom address. Each is ONE catalogue row (`COUPLE_HUB_PART_*`).
 *   · Full Pro (`COUPLE_WEBSITE_PRO`) is everything, and it is the ONLY thing
 *     that removes the "Powered by Setnayan" footer (gate 37).
 *   · THE CAP — everything paid toward an event for parts (at their web value,
 *     from the web or the app) counts; when it reaches the Full Pro price the
 *     event owns everything, footer included. Per EVENT: an unlock belongs to
 *     the event and everyone on it.
 *
 * ⛔ NO PRICE IS WRITTEN HERE, OR ANYWHERE IN PRODUCT CODE. Every figure is a
 * `platform_retail_catalog_v2` row the caller read; this file only does sums
 * and comparisons on numbers it is HANDED (`hubOwnershipFrom`, `hubApplyOffer`).
 * `hub-parts-prices-are-never-typed.test.ts` holds that.
 *
 * PURE. No I/O, no server imports — the Maker's first load, the server gates,
 * the guest page and the tests all read the same table.
 */
import type { LookChange } from '@/lib/hub-look-pro';
import type { HubDraftSummary } from '@/lib/hub-draft';

/* ── THE ELEVEN PARTS ─────────────────────────────────────────────────────── */

export const HUB_PART_IDS = [
  'reveal',
  'background',
  'photos',
  'style',
  'motion',
  'logo_qr',
  'music',
  'prints',
  'post_event',
  'own_scenes',
  'address',
] as const;
export type HubPartId = (typeof HUB_PART_IDS)[number];

/** The one Full Pro unlock — everything, and the only key to the footer. */
export const FULL_PRO_SKU = 'COUPLE_WEBSITE_PRO';

export type HubPart = {
  id: HubPartId;
  /** Its catalogue row — the price is read from there, never from here. */
  sku: string;
  /** Big parts are listed first on the parts page (owner's two price bands). */
  size: 'big' | 'small';
  /** The couple's word for it. */
  name: string;
  /** One line of what it opens (the parts page row, frame 4). */
  blurb: string;
};

export const HUB_PARTS: readonly HubPart[] = [
  { id: 'reveal', sku: 'COUPLE_HUB_PART_REVEAL', size: 'big', name: 'Reveal', blurb: 'Cinematic openings and effects, your own Save-the-Date film.' },
  { id: 'background', sku: 'COUPLE_HUB_PART_BACKGROUND', size: 'big', name: 'Background', blurb: 'Your photo or video behind the page or a scene, effects, 500 MB.' },
  { id: 'photos', sku: 'COUPLE_HUB_PART_PHOTOS', size: 'big', name: 'Photos', blurb: 'Gallery, photos and clips in scenes, Love Story photos, crop and zoom.' },
  { id: 'style', sku: 'COUPLE_HUB_PART_STYLE', size: 'big', name: 'Style', blurb: "Pro themes, Candlelight, every part's font, colour and size, decorations." },
  { id: 'motion', sku: 'COUPLE_HUB_PART_MOTION', size: 'big', name: 'Motion', blurb: 'Part and scene animation, Scrub and Auto-scroll, the RSVP celebration.' },
  { id: 'logo_qr', sku: 'COUPLE_HUB_PART_LOGO_QR', size: 'small', name: 'Logo & QR', blurb: 'Your logo animated, travelling to the bar, and on every QR code.' },
  { id: 'music', sku: 'COUPLE_HUB_PART_MUSIC', size: 'small', name: 'Music', blurb: 'Your own song on the Hub and Save-the-Date. Our songs stay free.' },
  { id: 'prints', sku: 'COUPLE_HUB_PART_PRINTS', size: 'small', name: 'Prints', blurb: 'Prints in your Hub look, Pro-theme files, the whole set in one download.' },
  { id: 'post_event', sku: 'COUPLE_HUB_PART_POST_EVENT', size: 'small', name: 'Post Event', blurb: 'Presets, scene looks, chapter write-ups, columns, reviews.' },
  { id: 'own_scenes', sku: 'COUPLE_HUB_PART_OWN_SCENES', size: 'small', name: 'Your own scenes', blurb: 'A scene of your own, and the venue’s “Our drawing”.' },
  { id: 'address', sku: 'COUPLE_HUB_PART_ADDRESS', size: 'small', name: 'Custom address', blurb: 'Pick your own setnayan.com/… instead of the automatic one.' },
];

export const HUB_PART_SKUS: readonly string[] = HUB_PARTS.map((p) => p.sku);

export function hubPart(id: HubPartId): HubPart {
  return HUB_PARTS.find((p) => p.id === id)!;
}

export function isHubPartId(v: unknown): v is HubPartId {
  return typeof v === 'string' && (HUB_PART_IDS as readonly string[]).includes(v);
}

/** The part a catalogue code sells, or null. */
export function hubPartOfSku(sku: string | null | undefined): HubPartId | null {
  return HUB_PARTS.find((p) => p.sku === sku)?.id ?? null;
}

/* ── THE 37 GATES, EACH WITH EXACTLY ONE HOME ─────────────────────────────── */

/**
 * Where a gate lives: one part, `full` (Full Pro / the cap only — the footer),
 * or `free` (left the gate: every guest's ticket and the all-guests QR sheet,
 * owner 2026-10-22 + #6767).
 */
export type HubGateHome = HubPartId | 'full' | 'free';

/**
 * Every gate of PRO-GATES.md, by its row number. Where the prototype splits one
 * row between two parts (row 5's film vs photo, row 17 and 27's Style vs
 * Animate, row 36's set vs the QR sheet) the row is listed once per half with a
 * letter — so "every gate has exactly one home" stays a property, not a
 * judgement call. `hub-parts.test.ts` holds: all 37 rows are here, no id twice,
 * every home is a part, `full` or `free`, and only row 37 is `full`.
 */
export const HUB_PRO_GATES: ReadonlyArray<{ id: string; gate: string; home: HubGateHome }> = [
  { id: '1', gate: 'A Cinematic Reveal opening', home: 'reveal' },
  { id: '2', gate: 'Reveal effects', home: 'reveal' },
  { id: '3', gate: 'Your own film on the Save-the-Date', home: 'reveal' },
  { id: '4', gate: 'Your own song on the Save-the-Date', home: 'music' },
  { id: '5a', gate: 'Your own film at the top of the Hub', home: 'reveal' },
  { id: '5b', gate: 'Your cover photo', home: 'background' },
  { id: '6', gate: 'Photo gallery', home: 'photos' },
  { id: '7', gate: 'Your own background music', home: 'music' },
  { id: '8', gate: 'A photo or clip behind one scene', home: 'background' },
  { id: '9', gate: 'Your photo or clip behind the whole page', home: 'background' },
  { id: '10', gate: 'Photos or clips inside a scene', home: 'photos' },
  { id: '11', gate: 'Scene layout, photo crop and zoom', home: 'photos' },
  { id: '12', gate: 'Uploads 10 MB to 500 MB', home: 'background' },
  { id: '13', gate: 'A Pro theme', home: 'style' },
  { id: '14', gate: 'Candlelight', home: 'style' },
  { id: '15', gate: 'Logo travels to the bar', home: 'logo_qr' },
  { id: '16', gate: 'Decorations', home: 'style' },
  { id: '17a', gate: "A part's Style (font, colour, size, spacing)", home: 'style' },
  { id: '17b', gate: "A part's Animate, and the fixed blocks' motion", home: 'motion' },
  { id: '18', gate: "A scene's Look, palette, Do's and Don'ts", home: 'style' },
  { id: '19', gate: 'Scene animation', home: 'motion' },
  { id: '20', gate: 'Scrub and Auto-scroll', home: 'motion' },
  { id: '21', gate: 'Main-background effects', home: 'background' },
  { id: '22', gate: 'A scene of your own', home: 'own_scenes' },
  { id: '23', gate: 'Post Event presets', home: 'post_event' },
  { id: '24', gate: 'Post Event looks and story extras', home: 'post_event' },
  { id: '25', gate: 'Love Story photos and more than 5 moments', home: 'photos' },
  { id: '26', gate: 'RSVP "When yes" celebration', home: 'motion' },
  { id: '27a', gate: 'RSVP reply-line style', home: 'style' },
  { id: '27b', gate: 'RSVP "Build in" motion', home: 'motion' },
  { id: '28', gate: 'RSVP moving backdrop', home: 'background' },
  { id: '29', gate: 'Your logo on every QR, shape, pattern, colour', home: 'logo_qr' },
  { id: '30', gate: 'Animated logo', home: 'logo_qr' },
  { id: '31', gate: 'Papic camera look', home: 'style' },
  { id: '32', gate: 'Venue "Our drawing"', home: 'own_scenes' },
  { id: '33', gate: 'Pro-theme print files', home: 'prints' },
  { id: '34', gate: 'Prints in your Hub look', home: 'prints' },
  { id: '35', gate: "Every guest's ticket download", home: 'free' },
  { id: '36a', gate: 'The whole designed set, place cards, everything PDF', home: 'prints' },
  { id: '36b', gate: 'The all-guests QR sheet', home: 'free' },
  { id: '37', gate: 'The "Powered by Setnayan" footer comes off', home: 'full' },
];

/* ── THE DRAFT'S UNITS → THEIR PART (the Maker's ✓ Apply) ─────────────────── */

/**
 * A scene canvas facet (`canvasLookFacets` in `lib/hub-draft.ts`) → its part.
 * Keyed by facet KEY first (the background's own keys travel together), then
 * by its group. Never a second list of what is Pro — only of WHOSE it is.
 */
export function canvasFacetPart(key: string, group: string): HubPartId {
  // 🖼 The ground behind a scene and everything that only exists beside it (a photo's Parallax, a clip's still, the
  // Cover's background and its movement) — gate 8 / 5b.
  if (key === 'media' || key === 'ground' || key === 'groundMotion' || key === 'mediaMotion' || key === 'poster') return 'background';
  switch (group) {
    case 'crop':
    case 'layout':
    case 'slot-media':
    case 'playback':
      return 'photos'; // gates 10, 11
    case 'motion':
    case 'transition':
    case 'part-motion':
      return 'motion'; // gates 17b, 19, 20
    default:
      return 'style'; // 'look', 'part-style', 'font' — gates 17a, 18
  }
}

/**
 * An `events` column the Maker drafts → its part, for the columns whose Pro
 * question has ONE answer. `style_preferences` and `rsvp_ask_config` hold
 * several parts at once and are split by their own readers
 * (`stylePreferencesPartOf`, `RSVP_FIELD_PART`); everything else is here.
 */
export const HUB_EVENT_COLUMN_PART: Readonly<Record<string, HubPartId>> = {
  invite_theme: 'style', // 13
  site_art_direction: 'style', // 14
  site_bg_color: 'style', // an ombré, while `OMBRE_IS_PRO`
  site_magic_traveller: 'logo_qr', // 15
  rsvp_backdrop: 'background', // 28
  landing_page_hero_image_url: 'background', // 5b
  landing_page_hero_video_r2_key: 'reveal', // 5a
  std_reveal_template: 'reveal', // 1
  std_reveal_effects: 'reveal', // 2
  std_media: 'reveal', // 3
  std_background: 'reveal',
  love_story: 'photos', // 25
  our_photos: 'photos', // 6
  site_bg_music_r2_key: 'music', // 7
};

/** The part of one Pro piece of `style_preferences` (`StylePreferencesProPart`). */
export function stylePreferencesPartOf(piece: 'qr' | 'accents' | 'camera' | 'blocks'): HubPartId {
  return piece === 'qr' ? 'logo_qr' : piece === 'blocks' ? 'motion' : 'style'; // 29 · 17b · 16, 31
}

/** A reply line's Pro field (`RSVP_LINE_PRO_KEYS`) → its part: c f s l are Style (27a), i v are Build in (27b). */
export function rsvpFieldPart(field: string): HubPartId {
  return field === 'i' || field === 'v' ? 'motion' : 'style';
}

/* ── OWNERSHIP, PER EVENT ─────────────────────────────────────────────────── */

/**
 * What an event holds. `full` = Full Pro, or the cap reached through parts —
 * every part AND the footer. `parts` = the parts held one by one (all of them
 * when `full`). `paidPhp` = the web value of the parts paid for (the cap's sum);
 * `fullPricePhp` = the Full Pro row's price, null when it was not read.
 */
export type HubOwnership = {
  full: boolean;
  parts: ReadonlySet<HubPartId>;
  paidPhp: number;
  fullPricePhp: number | null;
};

export const NO_HUB_PARTS: HubOwnership = Object.freeze({ full: false, parts: new Set<HubPartId>(), paidPhp: 0, fullPricePhp: null });

export function everyHubPart(fullPricePhp: number | null = null, paidPhp = 0): HubOwnership {
  return { full: true, parts: new Set(HUB_PART_IDS), paidPhp, fullPricePhp };
}

/**
 * Accepts the old boolean (`ownsPro`) wherever ownership is asked, so a caller
 * that only knows Full Pro keeps meaning exactly what it meant: true = all.
 */
export type HubOwnershipLike = HubOwnership | boolean;

export function asHubOwnership(o: HubOwnershipLike): HubOwnership {
  if (o === true) return everyHubPart();
  if (o === false) return NO_HUB_PARTS;
  return o;
}

export function ownsHubPart(o: HubOwnershipLike, part: HubPartId): boolean {
  const own = asHubOwnership(o);
  return own.full || own.parts.has(part);
}

/** Does the event hold every one of these parts? (An empty list needs nothing.) */
export function ownsHubParts(o: HubOwnershipLike, parts: Iterable<HubPartId>): boolean {
  for (const p of parts) if (!ownsHubPart(o, p)) return false;
  return true;
}

/** The look rule (`lookWriteAllowed`), asked of the parts a write needs. */
export function partsWriteAllowed(o: HubOwnershipLike, parts: Iterable<HubPartId>, change: LookChange): boolean {
  if (change === 'none' || change === 'remove') return true;
  return ownsHubParts(o, parts);
}

/**
 * THE CAP — pure. Everything the event holds, from what the caller measured:
 *
 *   · `fullHeld`   — Full Pro is held outright (an order, the onboarding basket,
 *                    a bundle, a comp, an internal or founder host…);
 *   · `partHeld`   — each part held on its own (its order, a comp);
 *   · `paidParts`  — the parts PAID for by order (web or app), each once;
 *   · `prices`     — catalogue price per part code, as read;
 *   · `fullPrice`  — the Full Pro row's price, as read.
 *
 * The parts paid count at their web value (owner: "an in-app part counts its
 * web value toward the cap"); a part bought twice counts once. Reaching the
 * Full Pro price means everything. 🔒 FAIL-CLOSED: an unread Full price, or an
 * unread part price, never reaches the cap — a cap only ever widens on a
 * measured number.
 */
export function hubOwnershipFrom(input: {
  fullHeld: boolean;
  partHeld: (part: HubPartId) => boolean;
  paidParts: Iterable<HubPartId>;
  prices: ReadonlyMap<string, number>;
  fullPrice: number | null;
}): HubOwnership {
  let paid = 0;
  for (const id of new Set(input.paidParts)) {
    const php = input.prices.get(hubPart(id).sku);
    if (typeof php === 'number' && Number.isFinite(php) && php > 0) paid += php;
  }
  const fullPrice = typeof input.fullPrice === 'number' && Number.isFinite(input.fullPrice) && input.fullPrice > 0 ? input.fullPrice : null;
  if (input.fullHeld || (fullPrice !== null && paid >= fullPrice)) return everyHubPart(fullPrice, paid);
  const parts = new Set<HubPartId>();
  for (const id of HUB_PART_IDS) if (input.partHeld(id)) parts.add(id);
  return { full: false, parts, paidPhp: paid, fullPricePhp: fullPrice };
}

/**
 * What is left to pay for everything — the Full Pro price less what the event
 * has paid for parts, never below zero. Null when the Full price is unknown.
 */
export function hubRestToEverything(o: HubOwnership): number | null {
  if (o.full) return 0;
  if (o.fullPricePhp === null) return null;
  return Math.max(0, o.fullPricePhp - o.paidPhp);
}

/**
 * ✓ APPLY'S TWO BUTTONS — the prototype's one rule (frames 1, 1-"closer", 2).
 * `restToEverything` = Full Pro − what the event has paid (`hubRestToEverything`);
 * `more` = what everything costs beyond these parts (`restToEverything − subtotal`,
 * the "₱X more" the sheet says):
 *
 *   · parts LEAD when their subtotal < the `more` (frame 1: ₱2,000 < ₱3,000);
 *   · everything LEADS when the `more` ≤ the subtotal (frame 1-closer: ₱1,500 ≤ ₱3,500);
 *   · the parts button is NOT OFFERED when the subtotal is above the rest to
 *     everything — nothing is ever charged above it (frame 2: ₱2,000 > ₱1,500).
 *
 * Every figure is a catalogue read the caller made; an unread rest (null) offers
 * the parts only — never an invented everything price.
 */
export function hubApplyOffer(
  subtotal: number,
  restToEverything: number | null,
): { lead: 'parts' | 'everything'; showParts: boolean; showEverything: boolean; more: number | null } {
  if (restToEverything === null) return { lead: 'parts', showParts: true, showEverything: false, more: null };
  const more = Math.max(0, restToEverything - subtotal);
  if (subtotal > restToEverything) return { lead: 'everything', showParts: false, showEverything: true, more };
  if (subtotal < more) return { lead: 'parts', showParts: true, showEverything: true, more };
  return { lead: 'everything', showParts: true, showEverything: true, more };
}

/* ── ON THE CLIENT ────────────────────────────────────────────────────────── */

/** `HubOwnership`, as a client prop (a Set does not cross the wire). */
export type HubOwnershipView = { full: boolean; parts: HubPartId[]; paidPhp: number; fullPricePhp: number | null };

export function hubOwnershipView(o: HubOwnership): HubOwnershipView {
  return { full: o.full, parts: [...o.parts], paidPhp: o.paidPhp, fullPricePhp: o.fullPricePhp };
}

export function hubOwnershipOfView(v: HubOwnershipView): HubOwnership {
  return { full: v.full, parts: new Set(v.parts), paidPhp: v.paidPhp, fullPricePhp: v.fullPricePhp };
}

/**
 * ⚡ The toolbar's count after a save, for an event that owns SOME parts — derived, never asked (a save answers
 * without reading who owns what: `hubDraftBarAfterSave`). `free` is the summary for a couple with nothing; each of its
 * held lines carries the parts it needs; a line whose parts this event owns goes live instead. Everything owned →
 * `owned` as is. The same answer the render's plan gives (`hub-parts.test.ts` holds the two equal).
 */
export function hubSummaryFor(free: HubDraftSummary, owned: HubDraftSummary, own: HubOwnershipView | HubOwnership): HubDraftSummary {
  const o = 'parts' in own && Array.isArray(own.parts) ? hubOwnershipOfView(own as HubOwnershipView) : (own as HubOwnership);
  if (o.full) return owned;
  let released = 0;
  const changes = free.changes?.map((line) => {
    const needs = line.parts ?? [];
    if (!line.held || needs.length === 0 || !ownsHubParts(o, needs)) return line;
    released += 1;
    return { ...line, held: false };
  });
  return { ...free, proCount: Math.max(0, free.proCount - released), ...(changes ? { changes } : {}) };
}

/* ── BUYING PARTS (owner 2026-10-22 — "never charge above the rest") ─────── */

/**
 * The order code for SEVERAL parts bought in one press ("Unlock Style + Motion and Apply"). One order, one payment,
 * one line per part in `onboarding_order_items` — the shape every multi-product bill already uses, so ownership reads
 * it through the basket lines the entitlement facts already carry. A single part is ordered under its own code.
 */
export const HUB_PARTS_ORDER_KEY = 'COUPLE_HUB_PARTS';

/** The `hub_parts` form field — "style,motion" — read strictly: known parts only, each once, in the table's order. */
export function parseHubPartsField(raw: unknown): HubPartId[] {
  if (typeof raw !== 'string') return [];
  const asked = new Set(raw.split(',').map((s) => s.trim()));
  return HUB_PART_IDS.filter((id) => asked.has(id));
}

/** "Style + Motion" — the parts' names, as the order and the buttons say them. */
export function hubPartsLabel(parts: readonly HubPartId[]): string {
  return parts.map((p) => hubPart(p).name).join(' + ');
}

export type HubPartsCharge =
  | { ok: true; php: number; capped: boolean }
  | { ok: false; why: 'already_owned' | 'nothing_to_buy' | 'unpriced' };

/**
 * WHAT A PURCHASE COSTS — pure, every figure handed in from the catalogue.
 *
 *   · everything (`parts` = 'full') → the rest: Full Pro less what the event has paid for parts;
 *   · one or more parts → their catalogue sum, but NEVER above the rest (owner: "never charge above the rest") —
 *     and a purchase that reaches the rest reaches the cap, so it unlocks everything anyway (`hubOwnershipFrom`).
 *
 * A part already held is refused (nobody pays twice); everything already held is refused; an unread price is
 * refused — never a guessed figure.
 */
export function hubPartsCharge(input: {
  parts: readonly HubPartId[] | 'full';
  owned: HubOwnership;
  prices: ReadonlyMap<string, number>;
  fullPrice: number | null;
}): HubPartsCharge {
  if (input.owned.full) return { ok: false, why: 'already_owned' };
  const rest = input.fullPrice === null ? null : Math.max(0, input.fullPrice - input.owned.paidPhp);
  if (rest === null) return { ok: false, why: 'unpriced' };
  if (input.parts === 'full') return { ok: true, php: rest, capped: false };
  if (input.parts.length === 0) return { ok: false, why: 'nothing_to_buy' };
  let sum = 0;
  for (const id of input.parts) {
    if (input.owned.parts.has(id)) return { ok: false, why: 'already_owned' };
    const php = input.prices.get(hubPart(id).sku);
    if (typeof php !== 'number' || !Number.isFinite(php) || php <= 0) return { ok: false, why: 'unpriced' };
    sum += php;
  }
  return sum > rest ? { ok: true, php: rest, capped: true } : { ok: true, php: sum, capped: false };
}
