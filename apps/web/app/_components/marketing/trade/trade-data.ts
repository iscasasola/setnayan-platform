/**
 * trade-data.ts — the facts behind the five shared marketing widgets on /for-suppliers and /for-coordinators
 * (controller's prototype, artifact WAh2zYfLCurgknopQBf9WV v3, owner-approved 5 Nov 2026; DECISION_LOG 2026-11-05
 * "THE SHARED MARKETING WIDGETS ARE BUILT IN FOR SUPPLIERS (#7268); FOR COORDINATORS (#7269) REUSES THEM").
 *
 * Pure: no I/O, no `server-only`, no stylesheet — so a test reads every sentence the widgets say.
 *
 * 🔑 WHAT IS READ, NOT TYPED
 *   · plan tools ............ `VENDOR_TIER_SECTIONS` (via `planTools()`), the one list the matrix also draws
 *   · plan limits ........... `TIER_CAPS` (reach · categories · cards · seats · branches · waitlist · own address)
 *   · the free Helper ....... `FREE_HELPER_SEATS`
 *   · QR jobs ............... `SUPPLIER_QR_MODES` (+ the review QR)
 *   · medal names + steps ... `TIERS` (lib/badge-tiers.ts)
 *   · prices ................ passed in from `getVendorPrices()` by the page — never here
 * ⚠ TYPED, from owner rulings, until their code lands: the reward each badge pays (DECISION_LOG 2026-11-05
 * "BADGE REWARDS"; code in PR #7298 `lib/badge-rewards.ts`) — switch `LADDER_REWARD` / `BADGE_REWARDS` to it when
 * that PR merges. The gift NAMES come from `giftProducts()`; no gift price is said anywhere.
 */
import { FREE_HELPER_SEATS } from '@/lib/vendor-free-helper';
import { SUPPLIER_QR_MODES, type SupplierQrMode } from '@/lib/supplier-qr-codes';
import { TIERS } from '@/lib/badge-tiers';
import { TIER_CAPS, TIER_LABEL, canBuyExtraBranches, type VendorTier } from '@/lib/vendor-tier-caps';
import { formatCount } from '@/lib/format-number';
import { planTools, planAdds, type PlanGroup } from '@/app/for-suppliers/_components/supplier-page-words';

/* ── 1 · ONE EVENT, EVERYONE CONNECTED ─────────────────────────────────────────────────────────────── */

export type Role = 'supplier' | 'coordinator' | 'host' | 'guest';
export const ROLE_LABEL: Readonly<Record<Role, string>> = {
  supplier: 'Supplier',
  coordinator: 'Coordinator',
  host: 'Host',
  guest: 'Guest',
};

/** Nine real flows, each touching the roles it lists (the prototype's, as approved). */
export const FLOWS: readonly { who: readonly Role[]; steps: readonly string[] }[] = [
  { who: ['guest', 'supplier'], steps: ['A guest RSVPs', 'the caterer’s headcount updates itself'] },
  {
    who: ['supplier', 'coordinator', 'host', 'guest'],
    steps: ['A supplier adds their times', 'the coordinator or host approves', 'guests see it on their schedule'],
  },
  {
    who: ['coordinator', 'guest', 'host', 'supplier'],
    steps: ['The coordinator cues the next part', 'every open screen, the guests’ now and next included, updates at once'],
  },
  {
    who: ['host', 'guest', 'coordinator'],
    steps: ['The host publishes the seat plan', 'each guest finds their table', 'the coordinator scans a guest’s QR to find their seat'],
  },
  { who: ['guest', 'coordinator'], steps: ['A guest checks in at the door', 'the live headcount updates for the coordinator'] },
  {
    who: ['supplier', 'host'],
    steps: ['A supplier suggests a mood-board photo', 'the host keeps it', 'it shows on that supplier’s own page'],
  },
  {
    who: ['host', 'coordinator', 'supplier'],
    steps: ['The couple marks the first payment', 'the coordinator is invited to the event and the booking is tracked for the supplier'],
  },
  { who: ['supplier', 'host', 'guest'], steps: ['A supplier gives their client a Papic gift', 'it lands on the client’s event for their guests'] },
  {
    who: ['guest', 'supplier'],
    steps: ['On the day, guests see the suppliers credited', 'they scan the review QR', 'the review lands on the supplier’s page'],
  },
];

/* ── 2 · PLANS ──────────────────────────────────────────────────────────────────────────────────────── */

export type PlanKey = 'free' | 'verified' | 'solo' | 'pro' | 'enterprise';
export const PLAN_KEYS: readonly PlanKey[] = ['free', 'verified', 'solo', 'pro', 'enterprise'];
export const planName = (k: PlanKey) => (k === 'verified' ? 'Verified' : TIER_LABEL[k]);

/** The seven limits every card and the compare grid show, in order. `null` = this plan has none. */
export const LIMIT_LABELS = [
  'How far you reach',
  'Categories',
  'Service cards each',
  'Team seats',
  'Branches',
  'Waiting list',
  'Your own web address',
] as const;

const finite = (n: number, unlimited: string) => (Number.isFinite(n) ? formatCount(n) : unlimited);

export function planLimits(k: PlanKey): (string | null)[] {
  const c = TIER_CAPS[k];
  const helper = `${formatCount(FREE_HELPER_SEATS)} free Helper`;
  return [
    k === 'free' ? 'Not in search' : Number.isFinite(c.serviceRadiusKm) ? `${formatCount(c.serviceRadiusKm)} km` : 'Nationwide',
    finite(c.parentCategories, 'Unlimited'),
    finite(c.servicesPerLeaf, 'Unlimited'),
    c.agentAccounts > 0 ? `${finite(c.agentAccounts, 'Unlimited')} + ${helper}` : helper,
    c.branchesIncluded > 0 ? `${formatCount(c.branchesIncluded)} included${canBuyExtraBranches(k) ? ' · add more' : ''}` : null,
    c.waitlistAcceptances > 0 ? `${formatCount(c.waitlistAcceptances)} a date` : null,
    c.customWebsiteName ? 'Yes' : null,
  ];
}

const BELOW: Readonly<Record<PlanKey, PlanKey | null>> = { free: null, verified: 'free', solo: 'verified', pro: 'solo', enterprise: 'pro' };

/** Three key facts beside the preview: Free and Verified say what they are; a paid plan says what moved. */
export function planFacts(k: PlanKey): string[] {
  if (k === 'free') return ['Your Setnayan page', 'Gifts for your clients', 'Every tool to run your bookings'];
  const c = TIER_CAPS[k];
  const reach = Number.isFinite(c.serviceRadiusKm) ? `${formatCount(c.serviceRadiusKm)} km` : 'Nationwide';
  if (k === 'verified') return ['Couples can find you', reach, 'Get paid your way'];
  const was = TIER_CAPS[BELOW[k]!];
  const out: string[] = [];
  if (c.serviceRadiusKm !== was.serviceRadiusKm) out.push(reach);
  if (c.customWebsiteName && !was.customWebsiteName) out.push('Your own web address');
  if (c.agentAccounts !== was.agentAccounts) out.push(`${formatCount(c.agentAccounts)} team seat${c.agentAccounts === 1 ? '' : 's'}`);
  if (c.branchesIncluded !== was.branchesIncluded) out.push(`${formatCount(c.branchesIncluded)} branches`);
  if (c.waitlistAcceptances > 0 && was.waitlistAcceptances === 0) out.push('A waiting list');
  return out.slice(0, 3);
}

export type PlanCardData = {
  key: PlanKey;
  name: string;
  price: string | null;
  /** The bold lead and the rest of the one line. */
  lead: string;
  rest: string;
  facts: string[];
  limits: (string | null)[];
  /** "What you get · all N tools" on Free; "Everything in <below>, plus" above it. */
  plus: string;
  groups: PlanGroup[];
  /** The photo key of this plan's page screenshot (demo shop), and what it shows. */
  shot: string;
  shotNote: string;
};

const SHOT_NOTE: Readonly<Record<PlanKey, string>> = {
  free: 'The auto-built page: your services and photos, waiting to go live once you’re Verified.',
  verified: 'The same page with the Verified seal, your name, and every allowed service card live.',
  solo: 'Personalized: your accent colour, an About intro, featured services and sections, on your own web address.',
  pro: 'The premium two-column page: a cover photo, a pinned review, featured Stories, and a sticky Inquire rail.',
  enterprise: 'The flagship page: a cinematic cover with your name over your best photo, your branches, and a Films reel.',
};

export function planCards(prices: { soloMonthly: string | null; proMonthly: string | null; enterpriseMonthly: string | null }): PlanCardData[] {
  const tools = Object.fromEntries(planTools().map((t) => [t.plan, t]));
  const price: Record<PlanKey, string | null> = {
    free: '₱0',
    verified: '₱0',
    solo: prices.soloMonthly,
    pro: prices.proMonthly,
    enterprise: prices.enterpriseMonthly,
  };
  return PLAN_KEYS.map((k) => {
    const t = tools[k];
    const below = BELOW[k];
    let lead: string;
    let rest: string;
    if (k === 'free') {
      lead = 'Build your shop and run your own clients.';
      rest = 'Couples can’t find you in search until you’re Verified.';
    } else if (k === 'verified') {
      lead = 'You can now be seen.';
      rest = 'Papers approved: DTI or SEC, BIR 2303, permit, bank proof — and a short video call.';
    } else {
      lead = '';
      rest = planAdds(k, below!);
    }
    const count = t?.tools.length ?? 0;
    return {
      key: k,
      name: planName(k),
      price: price[k],
      lead,
      rest,
      facts: planFacts(k),
      limits: planLimits(k),
      plus: k === 'free' ? `What you get · all ${formatCount(count)} tools` : `Everything in ${planName(below!)}, plus`,
      groups: t?.groups ?? [],
      shot: `site-${k === 'enterprise' ? 'ultra' : k}`,
      shotNote: SHOT_NOTE[k],
    };
  });
}

/* ── 3 · SPECIAL TOOLS — the supplier's slot (For Coordinators fills its own) ─────────────────────────── */

/** Once booked, what a supplier can do inside the host's event (shipped; prototype "SUP_ACCESS"). */
export const SUPPLIER_EVENT_ACCESS: readonly string[] = [
  'See what your work needs: the date, venue, headcount, schedule, seat plan and mood board',
  'Add your own times, your part of the program and your details',
  'Suggest photos for the mood board',
  'The host approves your changes with one tap; with full access, changes to your own services need no approval',
];

/**
 * Plus your own tools. ⚠ "Send your own forms" (the prototype's first line) is LEFT OUT: opening it to every
 * supplier is PR #7248, not merged — it joins this list when that lands.
 */
export const SUPPLIER_OWN_TOOLS: readonly string[] = [
  'Your part, synced to everyone: the times and details you add go to the coordinator’s run of show, and the ones meant for guests show on their phones, once the host or coordinator approves',
];

/**
 * The supplier's three tool groups. ⚠ "Saved for offline" is LEFT OUT: the supplier's offline schedule is PR #7270,
 * not merged.
 */
export const SUPPLIER_DAY_TOOLS: readonly { title: string; tag: string; items: readonly string[] }[] = [
  {
    title: 'Your part of the run of show',
    tag: 'Free',
    items: ['The minute-by-minute schedule for your part', 'Ask the coordinator to move one of your times', 'A countdown clock: now, next, ahead or behind'],
  },
  {
    title: 'The Day',
    tag: 'Free',
    items: ['Headcount, live from the couple’s RSVPs', 'Hand over to the couple: mark your work done', 'Review QR and live reviews as they land'],
  },
  {
    title: 'Your crew',
    tag: 'Free',
    items: ['One crew QR per event; you allow each phone', `${formatCount(FREE_HELPER_SEATS)} free Helper on every plan`],
  },
];

/* ── 4 · FREE MARKETING TOOLS ─────────────────────────────────────────────────────────────────────────── */

/** The five print formats (sizes per DECISION_LOG 2026-10-28 "BANNERS FOLLOW THE SHOP'S CARD DESIGN"). */
export const PRINT_FORMATS: readonly { key: string; label: string; shot: string; ratio: string }[] = [
  { key: 'card', label: 'Calling card', shot: 'mock-card', ratio: '7 / 4' },
  { key: 'tarp', label: 'Tarpaulin 6 × 3 ft', shot: 'mock-tarp-6x3', ratio: '2 / 1' },
  { key: 'back', label: 'Booth backdrop 8 × 8 ft', shot: 'mock-backdrop-8x8', ratio: '1 / 1' },
  { key: 'roll', label: 'Roll-up 80 × 200 cm', shot: 'mock-rollup', ratio: '2 / 5' },
  { key: 'tf', label: 'Table-front 6 × 2.5 ft', shot: 'mock-table-front', ratio: '12 / 5' },
];

export const PRINT_SCENES: readonly { shot: string; label: string; alt: string }[] = [
  { shot: 'scene-booth', label: 'At the fair', alt: 'A supplier’s booth: backdrop, roll-up and table-front banner in their shop design' },
  { shot: 'scene-card-handover', label: 'Handing it over', alt: 'A supplier hands their calling card to a couple' },
  { shot: 'marketing-booth', label: 'The set', alt: 'The supplier’s calling cards and tarpaulin laid out together' },
];

/** Each shipped QR job, in the words a supplier reads; the review QR is its own (it is not a SUPPLIER_QR_MODE). */
const QR_JOB: Readonly<Record<SupplierQrMode, { tile: string; line: string }>> = {
  shortlist: { tile: 'Inquiry', line: 'Inquiry: a couple scans and you’re on their shortlist' },
  locked: { tile: 'Booking', line: 'Booking: a one-use code for a booked couple, with the deal and first payment' },
  dates: { tile: 'Check a date', line: 'Check a date: they pick a date, your services and their event on one sheet' },
  page: { tile: 'My page', line: 'My page: opens your shop page' },
  crew: { tile: 'Crew', line: 'Crew: one code per event for your crew' },
};
export function qrJobs(): { tile: string; line: string }[] {
  return [
    ...SUPPLIER_QR_MODES.map((m) => QR_JOB[m]),
    { tile: 'Review', line: 'Review: guests and couples review you on the day' },
  ];
}

/* ── 5 · BADGES AND REWARDS ───────────────────────────────────────────────────────────────────────────── */

export const REWARD_KINDS: readonly { mark: string; name: string; line: string }[] = [
  { mark: 'P', name: 'Papic 150', line: 'Photo credits for your client’s guests on the day.' },
  { mark: '+', name: 'Event Plus', line: 'Your client’s event, upgraded to Event Plus.' },
  { mark: '★', name: 'Event Pro', line: 'Your client’s event, upgraded to Event Pro.' },
  { mark: '₱0', name: 'Free booking fee', line: 'No Setnayan fee on your next booking.' },
];

/** The reward at each Events-on-Setnayan step (owner ruling 2026-11-05; code lands with PR #7298). */
const LADDER_REWARD: Readonly<Record<number, string>> = {
  10: '2 × Papic 150',
  50: 'Event Plus',
  100: '2 × Event Plus',
  500: 'Event Pro',
  1000: 'Free booking fee',
  5000: 'Free booking fee',
  10000: 'Free booking fee',
};

/** The medal ladder: steps and names READ from `TIERS`; the reward per step from the ruling above. */
export function rewardLadder(): { step: string; medal: string; reward: string }[] {
  return TIERS.map((t) => ({ step: formatCount(t.step), medal: t.name, reward: LADDER_REWARD[t.step] ?? '' })).filter((r) => r.reward);
}

export const BADGE_REWARDS: readonly { badge: string; how: string; reward: string }[] = [
  { badge: 'Setnayan Verified', how: 'Your documents are approved', reward: 'Papic 150' },
  { badge: 'Firsts', how: 'Your first booking through Setnayan', reward: 'Papic 150' },
  { badge: '1st Pick', how: 'Couples book you after Setnayan recommends you first: 1 · 5 · 10 · 25 · 50 · 100 · 250', reward: 'Papic 150, then 2 ×, then Event Plus' },
  { badge: 'Reviews', how: 'Each step of trusted reviews', reward: 'Papic 150' },
  { badge: 'Booked Loop', how: 'Your couple books other suppliers on Setnayan', reward: 'Event Plus' },
  { badge: 'Most Booked of the month', how: 'Once a month', reward: 'Event Plus' },
  { badge: 'Setnayan’s Top Pick of the month', how: 'Once a month', reward: 'Event Plus' },
  { badge: 'Rising of the month', how: 'Once a month', reward: '2 × Papic 150' },
  { badge: 'Service cards', how: 'A card’s first booking', reward: 'Papic 150' },
  { badge: 'Branches', how: 'Each new branch', reward: 'Papic 150' },
  { badge: 'Inspiration box', how: 'Its top steps', reward: 'Papic 150' },
];

/** Re-exported so a widget imports its words from one place. */
export type { PlanGroup, VendorTier };

/* ── PHOTOS — owner 5 Nov: placeholders now, the real files swapped in as they land ───────────────────────
 * Every key the widgets draw a picture for. `null` = not made yet: the widget draws a quiet stand-in with the
 * picture's description. When a file lands, put it under public/marketing/2026-11-05/<key>.webp and set its path
 * here — `trade-data.test.ts` fails if a path is set and the file is not on disk.
 *   · site-<plan> — a TRUE screenshot of the demo shop "Setnayan Productions" (owner Juan dela Cruz) on that plan
 *     (DECISION_LOG 2026-11-05 "PLAN PREVIEWS ARE REAL SCREENSHOTS…"; another cloud session builds the demo shop)
 *   · scene-* / marketing-* / mock-* — Higgsfield photos with the shop's design laid on
 *     (prompts: build-sessions/HIGGSFIELD-PLANS-WIDGET-2026-11-05.md)
 */
export const TRADE_PHOTOS: Readonly<Record<string, string | null>> = {
  'site-free': null,
  'site-verified': null,
  'site-solo': null,
  'site-pro': null,
  'site-ultra': null,
  'scene-booth': null,
  'scene-card-handover': null,
  'marketing-booth': null,
  'marketing-qr': null,
  'mock-card': null,
  'mock-tarp-6x3': null,
  'mock-backdrop-8x8': null,
  'mock-rollup': null,
  'mock-table-front': null,
  'scene-your-part': null,
};

/** A drawn QR — three finder squares and a seeded field. A PICTURE of a code, never a code that scans. */
export function drawnQrPath(seed: number): string {
  const n = 25;
  let s = seed * 7919 + 13;
  let out = '';
  const r = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  const finder = (x: number, y: number) => {
    out += `M${x} ${y}h7v7h-7z M${x + 1} ${y + 1}h5v5h-5z M${x + 2} ${y + 2}h3v3h-3z`;
  };
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      if ((x < 8 && y < 8) || (x >= n - 8 && y < 8) || (x < 8 && y >= n - 8)) continue;
      if (y === 6 || x === 6) {
        if (x % 2 === 0) out += `M${x} ${y}h1v1h-1z`;
        continue;
      }
      if (r() < 0.44) out += `M${x} ${y}h1v1h-1z`;
    }
  finder(0, 0);
  finder(n - 7, 0);
  finder(0, n - 7);
  return out;
}
