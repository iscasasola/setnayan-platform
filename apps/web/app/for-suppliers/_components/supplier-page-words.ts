/**
 * supplier-page-words.ts — the plain facts the /for-suppliers port (4 Nov 2026 prototype) says, kept out of the
 * components so a test can read them without a stylesheet: the doors it links to, its photos, and every plan
 * allowance it puts into words.
 *
 * 🔑 NO ALLOWANCE IS TYPED. Reach, team seats, waitlists and the own web address are read off `TIER_CAPS` — the
 * table the product enforces — so when the owner's 4 Nov allowances land there (draft PR "supplier plan
 * allowances"), this page says them without an edit. Held by `supplier-page-words.test.ts`.
 */
import { VENDOR_TIER_SECTIONS } from '@/app/_components/home/vendor-benefits';
import { supplierCommissionShort } from '@/lib/commission-promise';
import { FEATURE_PAGES, type FeatureSlug } from '@/lib/feature-pages';
import { TIER_CAPS, TIER_LABEL, type TierCaps, type VendorTier } from '@/lib/vendor-tier-caps';

/** The owner's 4 Nov renders, shared with the front page and /for-coordinators (same file names as the corpus). */
export const MARKETING_PHOTOS = '/marketing/2026-11-04';

/** The one door into opening a shop (auth → existing shop? → limits → wizard). */
export const OPEN_SHOP_HREF = '/open-shop';

/*
 * NO DEMO / SAMPLE BUTTONS. The prototype linked "See the demo shop" and twelve "See it on the demo shop" links
 * to `/sample/supplier`, which is not built. Owner, 2026-11-04/05: *"do not add buttons now"* · *"just do not
 * add buttons"* — not hidden behind a switch, not added. So there is no demo link anywhere on this page, and
 * `supplier-page-words.test.ts` fails if one appears.
 */
/** The plans a shop climbs, in order. Free (unverified) is never searchable, so it is not a rung here. */
const RUNGS: readonly VendorTier[] = ['verified', 'solo', 'pro', 'enterprise'];
export const planName = (t: VendorTier) => (t === 'verified' ? 'Verified' : TIER_LABEL[t]);
/** "once Verified" · "from Solo" — where a feature starts. */
export const fromPlan = (t: VendorTier) => (t === 'verified' ? 'once Verified' : `from ${planName(t)}`);
/** The first rung where `has` is true, or null when no plan has it. */
export function firstRungWith(has: (c: TierCaps) => boolean): VendorTier | null {
  return RUNGS.find((t) => has(TIER_CAPS[t])) ?? null;
}
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
/** 3 → "three"; past twenty, the digits; Infinity → "unlimited". */
export function inWords(n: number): string {
  if (!Number.isFinite(n)) return 'unlimited';
  return WORDS[n] ?? String(n);
}
export const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const reachOf = (km: number) => (Number.isFinite(km) ? `${km} km reach` : 'Nationwide reach');

/** Where the own web address starts — "from Pro up" (TIER_CAPS.customWebsiteName). */
export function ownAddressFrom(): string | null {
  const t = firstRungWith((c) => c.customWebsiteName);
  return t ? `${fromPlan(t)} up` : null;
}

/** "One seat on Solo, three on Pro, ten on Ultra." — TIER_CAPS.agentAccounts. */
export function seatsLine(): string {
  const withSeats = RUNGS.filter((t) => TIER_CAPS[t].agentAccounts > 0);
  return (
    withSeats
      .map((t, i) => {
        const n = TIER_CAPS[t].agentAccounts;
        return i === 0 ? `${capFirst(inWords(n))} seat${n === 1 ? '' : 's'} on ${planName(t)}` : `${inWords(n)} on ${planName(t)}`;
      })
      .join(', ') + '.'
  );
}

/** "20 km Verified, 30 km Solo, 50 km Pro, 100 km Ultra" — TIER_CAPS.serviceRadiusKm. */
export function reachLine(): string {
  return RUNGS.map((t) => {
    const km = TIER_CAPS[t].serviceRadiusKm;
    return Number.isFinite(km) ? `${km} km ${planName(t)}` : `the whole country on ${planName(t)}`;
  }).join(', ');
}

/** The first paid plan that reaches farther than Verified. */
export function widerFrom(): VendorTier | null {
  const base = TIER_CAPS.verified.serviceRadiusKm;
  return RUNGS.find((t) => t !== 'verified' && TIER_CAPS[t].serviceRadiusKm > base) ?? null;
}

/*
 * THE PLAN LINES CLIMB (owner, 5 Nov, on the preview: *"you did not explain what was the coverage of a Free
 * account. how they can use the app to run the business via manual importing. Verified has a range max coverage
 * of 20km can be seen by events and all the other features. Solo has all Verified + these, and so on"*).
 * Free says what it covers; every plan above it is "Everything in <the one below>, plus: …".
 */

/** Free — the whole business, run here, with your own clients brought in; not in search. */
export function freePlanLine(): string {
  return 'Run your whole business here, free: bring in your own clients, then quote, book, track payments and keep contracts in one dashboard. Not shown in search.';
}

/** Verified — Free plus being found, within Verified's reach (TIER_CAPS.verified.serviceRadiusKm). */
export function verifiedPlanLine(): string {
  const km = TIER_CAPS.verified.serviceRadiusKm;
  const where = Number.isFinite(km) ? `within ${km} km` : 'anywhere in the country';
  return `Everything in Free, plus: couples planning events ${where} can find you, with your public Setnayan page and the Verified badge. Free once your papers are approved.`;
}

/**
 * A paid plan's line: "Everything in <below>, plus: …" — what MOVES at this rung (its own web address the first
 * time, reach, team seats, waitlists the first time). A row that reads the same as the rung below is not said.
 */
export function planLine(t: VendorTier, below: VendorTier): string {
  const here = TIER_CAPS[t];
  const was = TIER_CAPS[below];
  const parts: string[] = [];
  if (here.customWebsiteName && !was.customWebsiteName) parts.push('your own web address');
  if (here.serviceRadiusKm !== was.serviceRadiusKm) parts.push(reachOf(here.serviceRadiusKm).toLowerCase());
  if (here.agentAccounts !== was.agentAccounts) {
    parts.push(`${inWords(here.agentAccounts)} team seat${here.agentAccounts === 1 ? '' : 's'}`);
  }
  if (here.waitlistAcceptances > 0 && was.waitlistAcceptances === 0) parts.push('waitlists');
  const lead = `Everything in ${planName(below)}`;
  return parts.length ? `${lead}, plus: ${parts.join(', ')}.` : `${lead}.`;
}

/** The six trade photos, in the prototype's order, each with its own right shift (`--dr`, prototype CSS). */
export const HERO_SLIDES: readonly { key: string; dr: string; alt: string }[] = [
  { key: 'supplier-florist-hero', dr: '4%', alt: 'A florist arranging orchids for a reception' },
  { key: 'supplier-caterer-hero', dr: '19%', alt: 'Chefs plating a dinner' },
  { key: 'supplier-photographer-hero', dr: '0%', alt: 'A photographer at a grand entrance' },
  { key: 'supplier-makeup-hero', dr: '22%', alt: 'A make-up artist with a bride' },
  { key: 'supplier-videographer-hero', dr: '19%', alt: 'A videographer filming the first dance' },
  { key: 'supplier-team-hero', dr: '19%', alt: 'A supplier team checking a booking together' },
];

/*
 * EVERY TOOL, PER PLAN (owner, 5 Nov: *"Free — Website. Gift Sending. list all tools · Verified — you can now be
 * seen. upgraded website · complete all the features · same as the Plans"*).
 *
 * 🔑 ONE LIST, NOT TWO. Every tool comes from `VENDOR_TIER_SECTIONS` — the list the full plan table further down
 * this page already draws — so the plan cards and the table can never disagree. The only things said here that
 * the list does not hold are the owner's two Free lines (the page, the gifts) and Verified's three (live, found,
 * badge), and each is a true statement about what ships:
 *   · the page — a shop's Setnayan page is built on Free and stays HIDDEN until Setnayan approves the shop
 *     (owner ruling 2026-07-27), so Free "builds" it and Verified puts it live;
 *   · the gifts — a supplier can put a Papic gift on a quote or a service card (`lib/papic-on-a-quote.ts`,
 *     `lib/setnayan-gift.ts`);
 *   · Verified's reach is `TIER_CAPS.verified.serviceRadiusKm`.
 * The shared list's "Get found" group, its "Verified badge" and its "public page" line move UP from Free to
 * Verified, because being seen is what Verified adds. A tool marked `soon` is not listed — a plan card sells what
 * ships. The list's own fee line (written with no schedule, so it reads "no booking fee while it is switched off")
 * is left out too: the plans' fine print says the fee from the LIVE schedule, right under the cards.
 */
export type PlanTools = { plan: string; tools: string[] };

const VERIFIED_FROM_FREE_GROUPS = new Set(['Get found']);
const VERIFIED_FROM_FREE_ITEMS = new Set(['Verified badge, free', 'Your public page, auto-built']);

function shipped(tier: VendorTier): { group: string | undefined; name: string }[] {
  const section = VENDOR_TIER_SECTIONS.find((x) => x.tier === tier);
  if (!section) return [];
  const feeLine = supplierCommissionShort(null);
  return section.groups.flatMap((g) =>
    g.items.filter((i) => !i.soon && i.n !== feeLine).map((i) => ({ group: g.h, name: i.n })),
  );
}

export function planTools(): PlanTools[] {
  const freeAll = shipped('free');
  const movesUp = (t: { group: string | undefined; name: string }) =>
    (t.group !== undefined && VERIFIED_FROM_FREE_GROUPS.has(t.group)) || VERIFIED_FROM_FREE_ITEMS.has(t.name);
  const km = TIER_CAPS.verified.serviceRadiusKm;
  return [
    {
      plan: 'free',
      tools: [
        'Build your own Setnayan page — ready to go live the day you’re Verified',
        'Send gifts to your couples — Papic photos on your quotes and service cards',
        ...freeAll.filter((t) => !movesUp(t)).map((t) => t.name),
      ],
    },
    {
      plan: 'verified',
      tools: [
        `Seen by couples planning events ${Number.isFinite(km) ? `within ${km} km` : 'anywhere in the country'}`,
        ...freeAll.filter(movesUp).map((t) => t.name),
      ],
    },
    { plan: 'solo', tools: shipped('solo').map((t) => t.name) },
    { plan: 'pro', tools: shipped('pro').map((t) => t.name) },
    { plan: 'enterprise', tools: shipped('enterprise').map((t) => t.name) },
  ];
}

/*
 * WHAT A SUPPLIER CAN PUT IN THEIR PACKAGE (owner, 5 Nov: *"also a dedicated widget on what they can add to their
 * packages when they promote. Guestlist, RSVP, Website, Budget Planner, (all features of Setnayan) · And also
 * their gifts. they can give gifts to the user's event like event plus, event pro, papic, etc"*).
 *
 * 🔑 THE TOOLS ARE THE FEATURES PAGES' OWN LIST (`FEATURE_PAGES`) — every couple tool whose price kind is `free`
 * or `free-plus`, i.e. what a couple who books the supplier gets free. The three supplier-finding entries
 * (marketplace · compare · suppliers) are the couple's way TO the supplier, not something a package carries.
 * A paid tool is not listed as included — it is what a GIFT is for.
 */
const NOT_A_PACKAGE_TOOL: ReadonlySet<FeatureSlug> = new Set<FeatureSlug>(['marketplace', 'compare', 'suppliers']);

export function packageTools(): { slug: FeatureSlug; name: string; line: string }[] {
  return FEATURE_PAGES.filter(
    (f) => f.group !== 'suppliers' && f.price.kind !== 'paid' && !NOT_A_PACKAGE_TOOL.has(f.slug),
  ).map((f) => ({ slug: f.slug, name: f.name.en, line: f.line.en }));
}

/*
 * THE GIFTS — the owner's gift list, DECISION_LOG 2026-11-04 "GIFT PRICES": Papic · Event Plus · Event Pro ·
 * Live Watch · Music Maker · Patiktok. Bought ahead as stock, offered only on a service card or a quote, the couple
 * receives the full product (2026-11-04 "SUPPLIER GIFTS: BOUGHT IN QUANTITY…"). Names only — never a price here;
 * the gift prices live in the catalogue. Names that have a Features page are read from it.
 * ⚠ Today the Papic gift ships (`lib/setnayan-gift.ts`, `lib/papic-on-a-quote.ts`); the gift stock for the rest is
 * the supplier-gifts build (PR #7279) — this list follows the owner's ruling, not that branch.
 */
const featureName = (slug: FeatureSlug) => FEATURE_PAGES.find((f) => f.slug === slug)?.name.en ?? slug;

export function giftProducts(): string[] {
  return [featureName('papic'), 'Event Plus', 'Event Pro', featureName('live-watch'), featureName('music-maker'), featureName('patiktok')];
}
