/**
 * 🛒 EVENT SERVICES — ONE PLACE TO BUY FOR AN EVENT (owner 2026-11-23; drawing
 * `prototypes/buy_event_services_one_place_2026-11-23/frames_v4_clean_warm/`, approved "Yes, build it").
 *
 * The pure half: what the page draws and what the one order carries, worked out from facts the server read. No I/O, no
 * React, so the page, its dev lab and the order mint (`lib/event-services-orders.ts`) cannot disagree.
 *
 *   · PACKS FIRST. Event Plus · Pro · Ultra as packages: what each holds, and "You save ₱X" — the parts' prices for THIS
 *     event less the pack's, computed here from catalogue reads, never typed. A saving that is not positive is not said.
 *   · SINGLES SECOND. Event Hub · Setnayan AI · Live Watch · photos, the quieter second choice. A picked (or held) pack
 *     turns the singles it holds into "In your plan".
 *   · THE SWITCH LINE. Ticked singles that a pack holds, costing more than that pack → one line offering the pack.
 *   · ONE CART → ONE ORDER → the shipped `/pay/[reference]`.
 *
 * ⚖ Money: every peso here is handed in (`php`), read by the server through `resolveOrderChargeCentavos` — the same
 * authority the order is billed by — so the screen and the bill agree. `null` = could not read (or not on sale): that
 * row names no price, cannot be ticked, and no saving that needs it is said.
 */

import { formatCount } from '@/lib/format-number';

/** The three packs, cheapest first — `PLAN_PRICE_CODES` (lib/event-plans.ts) is their catalogue key. */
export const PACK_KEYS = ['plus', 'pro', 'ultra'] as const;
export type PackKey = (typeof PACK_KEYS)[number];

/** The singles. Photos are their own row (the chips), not a single. */
export const SINGLE_KEYS = ['hub', 'ai', 'live'] as const;
export type SingleKey = (typeof SINGLE_KEYS)[number];

/** Each single's catalogue row. `EVENT_HUB` = `EVENT_HUB_SKU` (lib/hub-parts.ts), `LIVE_STUDIO` = Live Watch. */
export const SINGLE_CODES: Readonly<Record<SingleKey, string>> = Object.freeze({
  hub: 'EVENT_HUB',
  ai: 'SETNAYAN_AI',
  live: 'LIVE_STUDIO',
});

/**
 * What each pack HOLDS of the singles — the product's own rules, written once: every plan holds the whole Event Hub
 * (owner 20 Nov, `eventHubOwnership`), Setnayan AI comes with Pro and Ultra (`AI_PLAN_SKUS`), Live Watch with Ultra
 * (`SKU_OWNERSHIP_ALIASES.LIVE_STUDIO`). `event-services.test.ts` fails if this drifts from those two sources.
 */
export const PACK_HOLDS: Readonly<Record<PackKey, readonly SingleKey[]>> = Object.freeze({
  plus: Object.freeze(['hub'] as const),
  pro: Object.freeze(['hub', 'ai'] as const),
  ultra: Object.freeze(['hub', 'ai', 'live'] as const),
});

/** The one short line under each pack's name (drawing v4). The full list opens from ⓘ. */
export const PACK_PURPOSE: Readonly<Record<PackKey, string>> = Object.freeze({
  plus: 'Make the whole Event Hub yours to design.',
  pro: 'Let Setnayan AI watch your plan and suppliers.',
  ultra: 'Stream the day live and keep photos a year.',
});

/** The singles' names and lines (drawing v4). `brand` is the quiet product name after the name. */
export const SINGLE_WORDS: Readonly<Record<SingleKey, { name: string; brand: string | null; line: string }>> = Object.freeze({
  hub: { name: 'Event Hub', brand: null, line: 'Every theme, every part to design.' },
  ai: { name: 'Setnayan AI', brand: null, line: 'Watches your plan and suppliers.' },
  live: { name: 'Live stream', brand: 'Live Watch', line: 'Guests who can’t come watch it live.' },
});

/** The plain name of a single in the pack's "holds" line and the cart label. */
export const SINGLE_SHORT: Readonly<Record<SingleKey, string>> = Object.freeze({ hub: 'Event Hub', ai: 'Setnayan AI', live: 'Live Watch' });

/** buy — can be ticked · yours — held (approved) · review — paid, being checked. */
export type ServiceState = 'buy' | 'yours' | 'review';

export type PackFact = {
  key: PackKey;
  code: string;
  /** The catalogue row's title (RW-306) — never typed when the row was read. */
  name: string;
  /** The Papic credits the pack includes (`included_papic_credits`), null when unread. */
  credits: number | null;
  /** The photos it ADDS for this event (its credits less the plan credits already held — `activateEventPlan` tops up). */
  addsCredits: number | null;
  /** What THIS event pays (the charge authority's figure: an upgrade pays the difference). Null = unread / not on sale. */
  php: number | null;
  /** This event already paid toward a plan, so `php` is the difference. */
  upgrade: boolean;
  state: ServiceState;
  /** "You save ₱X" against its parts bought alone (`packSavingPhp`); null when unread or not positive. */
  savePhp: number | null;
  /** "Fits: 11 suppliers booked." — at most one pack carries it; null otherwise. */
  fits: string | null;
  /** The ⓘ sheet's full list. */
  info: readonly string[];
};

export type SingleFact = {
  key: SingleKey;
  code: string;
  php: number | null;
  state: ServiceState;
};

/** One photo size (a Papic pool rung on sale). */
export type PhotoFact = { code: string; points: number; php: number };

/** The plan the event holds now — the "Your plan" card. `hub` is the Event Hub single on Free. */
export type HeldPlan = 'free' | PackKey;

export type EventServicesFacts = {
  /** "Ana & Miguel · Sat 12 Dec 2026" — null when unread (the line is then not drawn). */
  eyebrow: string | null;
  /** The plan held now; null = the read failed ("Couldn't read"). */
  plan: HeldPlan | null;
  /** The held plan's name for the card (a catalogue title, or "Free"). */
  planName: string | null;
  /** Guest photos left now (the pool's remaining credits); null = could not read. */
  photosLeft: number | null;
  /** Every pack, cheapest first, with its state. What is SHOWN is `shownPacks`. */
  packs: readonly PackFact[];
  singles: readonly SingleFact[];
  /** The photo sizes on sale; null = could not read. */
  photos: readonly PhotoFact[] | null;
};

/** What the person ticked. Closed values only — the order mint re-checks every one against the same facts. */
export type EventServicesPick = {
  pack: PackKey | null;
  singles: readonly SingleKey[];
  photos: string | null;
};

export const EMPTY_PICK: EventServicesPick = Object.freeze({ pack: null, singles: Object.freeze([]), photos: null });

const rank = (k: HeldPlan): number => (k === 'free' ? 0 : PACK_KEYS.indexOf(k) + 1);

/**
 * Which packs the page shows: on Free every pack; on a plan only the NEXT one ("Next pack", drawing frame 09); on Ultra
 * none. A pack under review shows (it says so); a pack below the held plan never does.
 */
export function shownPacks(facts: Pick<EventServicesFacts, 'plan' | 'packs'>): { title: 'Pick a pack' | 'Next pack'; packs: PackFact[] } {
  const held = facts.plan ?? 'free';
  if (held === 'free') {
    const reviewing = facts.packs.find((p) => p.state === 'review');
    // A plan being checked: show it (under review) and what is above it — never sell a second plan beside it.
    const from = reviewing ? rank(reviewing.key) - 1 : 0;
    return { title: 'Pick a pack', packs: facts.packs.filter((p) => rank(p.key) - 1 >= from) };
  }
  const next = facts.packs.find((p) => rank(p.key) === rank(held) + 1);
  return { title: 'Next pack', packs: next ? [next] : [] };
}

/** The singles a held plan or a picked pack holds — they read "In your plan". */
export function singlesInPlan(held: HeldPlan | null, pack: PackKey | null): Set<SingleKey> {
  const out = new Set<SingleKey>();
  if (held && held !== 'free') for (const s of PACK_HOLDS[held]) out.add(s);
  if (pack) for (const s of PACK_HOLDS[pack]) out.add(s);
  return out;
}

/** Can this single be ticked now? Only when for sale, priced, and not in the plan. */
export function singleTickable(s: SingleFact, inPlan: ReadonlySet<SingleKey>): boolean {
  return s.state === 'buy' && s.php !== null && !inPlan.has(s.key);
}

/**
 * The cheapest way to buy EXACTLY `credits` photos from the sizes on sale — the photos part of a pack's "parts alone"
 * price (6,000 = two 3,000 packs). Null when no mix of sizes makes that number, or nothing is on sale.
 */
export function cheapestPhotosPhp(credits: number, sizes: readonly PhotoFact[] | null): number | null {
  if (!sizes || sizes.length === 0 || !Number.isInteger(credits) || credits <= 0) return null;
  const pts = sizes.map((s) => s.points).filter((p) => Number.isInteger(p) && p > 0);
  if (pts.length === 0) return null;
  const g = pts.reduce((a, b) => {
    let x = a;
    let y = b;
    while (y) [x, y] = [y, x % y];
    return x;
  });
  if (credits % g !== 0) return null;
  const n = credits / g;
  if (n > 20_000) return null;
  const best: Array<number | null> = new Array(n + 1).fill(null);
  best[0] = 0;
  for (let i = 1; i <= n; i += 1) {
    for (const s of sizes) {
      const step = s.points / g;
      if (!Number.isInteger(step) || step <= 0 || step > i) continue;
      const prev = best[i - step];
      if (prev === null || prev === undefined) continue;
      const cand = prev + s.php;
      if (best[i] === null || cand < (best[i] as number)) best[i] = cand;
    }
  }
  return best[n] ?? null;
}

/**
 * "You save ₱X" — the pack's parts bought alone (each single at what THIS event would pay, plus its photos at the
 * cheapest mix of sizes) less the pack's own catalogue figure. Null when any part is unread or the saving is not positive
 * (a saving is never said on a guess, and never as ₱0).
 */
export function packSavingPhp(
  pack: Pick<PackFact, 'key' | 'php' | 'credits' | 'upgrade'>,
  singles: readonly SingleFact[],
  sizes: readonly PhotoFact[] | null,
): number | null {
  if (pack.php === null || pack.upgrade || pack.credits === null) return null;
  let parts = 0;
  for (const key of PACK_HOLDS[pack.key]) {
    const s = singles.find((x) => x.key === key);
    if (!s || s.php === null) return null;
    parts += s.php;
  }
  const photos = cheapestPhotosPhp(pack.credits, sizes);
  if (photos === null) return null;
  const save = parts + photos - pack.php;
  return save > 0 ? Math.round(save * 100) / 100 : null;
}

export type CartLine = { code: string; label: string; php: number };

export type Cart = {
  lines: CartLine[];
  /** The total; null when nothing is picked or a picked line has no price. */
  totalPhp: number | null;
  /** "Event Pro + Live Watch + 1,000 photos". */
  label: string;
  /** Photos after this order (left now + the pack's added credits + the size picked); null when unread. */
  photosAfter: number | null;
};

const fmtCount = (n: number): string => formatCount(n);

/** A photo size's words: "1,000 photos". */
export function photosLabel(points: number): string {
  return `${fmtCount(points)} photos`;
}

/** The cart for a pick — the bar's words and total, and the ONE order's lines (same function, same answer). */
export function cartFor(facts: EventServicesFacts, pick: EventServicesPick): Cart {
  const lines: CartLine[] = [];
  let priced = true;
  const pack = pick.pack ? facts.packs.find((p) => p.key === pick.pack && p.state === 'buy') ?? null : null;
  if (pack) {
    if (pack.php === null) priced = false;
    else lines.push({ code: pack.code, label: pack.name, php: pack.php });
  }
  const inPlan = singlesInPlan(facts.plan, pack?.key ?? null);
  for (const key of SINGLE_KEYS) {
    if (!pick.singles.includes(key)) continue;
    const s = facts.singles.find((x) => x.key === key);
    if (!s || !singleTickable(s, inPlan)) continue;
    lines.push({ code: s.code, label: SINGLE_SHORT[key], php: s.php as number });
  }
  const size = pick.photos ? facts.photos?.find((p) => p.code === pick.photos) ?? null : null;
  if (size) lines.push({ code: size.code, label: photosLabel(size.points), php: size.php });
  const totalPhp = lines.length === 0 || !priced ? null : Math.round(lines.reduce((n, l) => n + l.php, 0) * 100) / 100;
  const adds = (pack?.addsCredits ?? 0) + (size?.points ?? 0);
  const photosAfter = facts.photosLeft === null || (pack && pack.addsCredits === null) ? null : facts.photosLeft + adds;
  return { lines, totalPhp, label: lines.map((l) => l.label).join(' + '), photosAfter };
}

export type SwitchOffer = { pack: PackKey; name: string; lessPhp: number; extraPhotos: number | null; holds: SingleKey[] };

/**
 * The "Switch" line (drawing frame 04b): with NO pack picked and two or more singles ticked, the cheapest pack that
 * holds every ticked single and costs less than them. "Event Pro has both, plus 3,000 photos, for ₱90 less."
 */
export function switchOffer(facts: EventServicesFacts, pick: EventServicesPick): SwitchOffer | null {
  if (pick.pack || (facts.plan && facts.plan !== 'free')) return null;
  const inPlan = singlesInPlan(facts.plan, null);
  const ticked = facts.singles.filter((s) => pick.singles.includes(s.key) && singleTickable(s, inPlan));
  if (ticked.length < 2) return null;
  const singlesPhp = ticked.reduce((n, s) => n + (s.php as number), 0);
  const shown = shownPacks(facts).packs;
  for (const p of shown) {
    if (p.state !== 'buy' || p.php === null) continue;
    if (!ticked.every((s) => PACK_HOLDS[p.key].includes(s.key))) continue;
    const less = Math.round((singlesPhp - p.php) * 100) / 100;
    if (less > 0) return { pack: p.key, name: p.name, lessPhp: less, extraPhotos: p.credits, holds: ticked.map((s) => s.key) };
  }
  return null;
}

/** Take the Switch: the pack is picked and the singles it holds are unticked; photos stay picked. */
export function applySwitch(pick: EventServicesPick, offer: SwitchOffer): EventServicesPick {
  return { pack: offer.pack, singles: pick.singles.filter((s) => !PACK_HOLDS[offer.pack].includes(s)), photos: pick.photos };
}

/** The pack line under its name: "Event Hub · Setnayan AI · 3,000 photos" — or, as the next pack, what it adds. */
export function packHoldsLine(pack: PackFact, next: boolean, held: HeldPlan | null): string {
  if (next && held && held !== 'free') {
    const adds = PACK_HOLDS[pack.key].filter((s) => !PACK_HOLDS[held].includes(s)).map((s) => SINGLE_SHORT[s]);
    const photos = pack.addsCredits !== null && pack.addsCredits > 0 ? [`${fmtCount(pack.addsCredits)} more photos`] : [];
    return `Adds ${[...adds, ...photos].join(' · ')}`;
  }
  const parts: string[] = PACK_HOLDS[pack.key].map((s) => SINGLE_SHORT[s]);
  if (pack.credits !== null && pack.credits > 0) parts.push(photosLabel(pack.credits));
  return parts.join(' · ');
}

/** "Fits: …" — Plus when the Event Hub is on and no supplier is booked; Pro once one is. Ultra is never marked. */
export function packFits(key: PackKey, booked: number | null, hubOn: boolean): string | null {
  if (booked === null) return null;
  if (key === 'pro' && booked > 0) return `Fits: ${fmtCount(booked)} supplier${booked === 1 ? '' : 's'} booked.`;
  if (key === 'plus' && booked === 0 && hubOn) return 'Fits: no suppliers booked yet.';
  return null;
}

/** Parse a pick from untrusted input (the browser) — closed values only, duplicates dropped. */
export function parsePick(raw: unknown): EventServicesPick {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const pack = typeof o.pack === 'string' && (PACK_KEYS as readonly string[]).includes(o.pack) ? (o.pack as PackKey) : null;
  const singles = Array.isArray(o.singles)
    ? [...new Set(o.singles.filter((s): s is SingleKey => typeof s === 'string' && (SINGLE_KEYS as readonly string[]).includes(s)))]
    : [];
  const photos = typeof o.photos === 'string' && /^[A-Z0-9_]{1,40}$/.test(o.photos) ? o.photos : null;
  return { pack, singles, photos };
}

/**
 * 🚪 The door on Today (drawing frame 12): one "Event services" row in Your services — "Free plan · 150 photos left",
 * "Event Pro · 860 photos left". A read that failed says so, never "Free" or 0.
 */
export function eventServicesTodayLine(plan: { key: HeldPlan; name: string } | null, photosLeft: number | null): string {
  const planWords = plan === null ? 'Plan: couldn’t read' : plan.key === 'free' ? 'Free plan' : plan.name;
  const photos = photosLeft === null ? 'photos left: couldn’t read' : `${fmtCount(photosLeft)} photos left`;
  return `${planWords} · ${photos}`;
}
