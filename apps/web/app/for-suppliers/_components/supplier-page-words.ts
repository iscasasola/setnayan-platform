/**
 * supplier-page-words.ts — the plain facts the /for-suppliers port (4 Nov 2026 prototype) says, kept out of the
 * components so a test can read them without a stylesheet: the doors it links to, its photos, and every plan
 * allowance it puts into words.
 *
 * 🔑 NO ALLOWANCE IS TYPED. Reach, team seats, waitlists and the own web address are read off `TIER_CAPS` — the
 * table the product enforces — so when the owner's 4 Nov allowances land there (draft PR "supplier plan
 * allowances"), this page says them without an edit. Held by `supplier-page-words.test.ts`.
 */
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

/**
 * A paid plan's one line: what MOVES at this rung — its own web address (the
 * first time), reach, team seats, waitlists (the first time). A row that reads
 * the same as the rung below is not an upgrade and is not said.
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
  return parts.length ? `${capFirst(parts.join(', '))}.` : 'Everything below it.';
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
