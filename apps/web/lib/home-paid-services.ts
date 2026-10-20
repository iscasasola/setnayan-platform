/**
 * lib/home-paid-services.ts — WHAT HOME KNOWS ABOUT EACH PAID SERVICE (pure, no I/O).
 *
 * 🧾 Owner 2026-10-14 (DECISION_LOG "HOME › YOUR SERVICES = THE PAID SERVICES + EVENT HUB PRO;
 * FREE TOOLS STAY OUT" + "APPROVE ALL: THE SERVICES PROTOTYPE"): Home lists Guest photos · Planner ·
 * Live stream · Music · Video booth · Event Hub Pro — owned with their state, not added as one slim
 * "· ₱<catalog> · Add" line. This module turns the page's reads into one `HomePaidFact` per row;
 * `lib/home-first-screen.ts` `homePaidState` maps each fact onto exactly one state.
 *
 * 🔑 ONE BUILDER FOR "WHICH SERVICES, AND WHERE EACH OPENS". Planner · Live stream · Music · Video booth
 * are the More menu's own cards (`buildOurServices`, `lib/our-services.ts`) — the same offered-for-this-
 * event rule, the same day-of "stop selling after the day" rule, the same door. Home never keeps a second
 * list of them. Event Hub Pro has no card there by design (owner 2026-09-30: "Event Hub Pro has its own
 * place"), so its fact is made here from the SAME catalogue entry (`website-pro`) and the same predicates.
 *
 * 🔑 OWNED IS THE FEATURE GATE'S ANSWER. `owned` is `eventSkuActive` per SKU — the read the service's own
 * page and its feature gates use — NOT `eventActiveSkus` (the menu's batch read), which does not count an
 * internal or founder-seat host. Measured 2026-10-20 on cale-ice: an internal host, so every paid feature
 * is on there; the Home row says so.
 *
 * 🔑 NO PRICE IS TYPED HERE. A price arrives in `prices` from `platform_retail_catalog_v2`; a missing one
 * is "See the price", never ₱0 (`paidSlimWords`). Held by `app/dashboard/[eventId]/home-shows-every-paid-service.test.ts`.
 */
import { buildOurServices } from '@/lib/our-services';
import type { AddOnEntry } from '@/lib/add-ons-catalog';
import { HOME_PAID_CARD, HOME_PAID_SKU, type HomePaidFact, type HomeSkuKey } from '@/lib/home-first-screen';

/** One SKU's reads — `null` = that read failed. */
export type HomeSkuRead = { active: boolean | null; pending: boolean | null };

export type HomePaidInput = {
  eventId: string;
  /** `ADD_ONS` — the catalogue entries (offer rules, doors, day-of flags). */
  catalogue: ReadonlyArray<AddOnEntry>;
  /** Per SKU code (`HOME_PAID_SKU`): is it on (`eventSkuActive`) · is a payment waiting (`eventOwnsSku`). */
  reads: Readonly<Record<string, HomeSkuRead | null | undefined>>;
  /** Per SKU code: the catalogue's price label, formatted ("₱2,500"). Missing = unknown. */
  prices: ReadonlyMap<string, string>;
  /** Offered for this event (type surface + store shell) — the layout's own predicate. */
  offered: (entry: AddOnEntry) => boolean;
  /** `addOnSellableNow` for this event's phase. */
  sellableNow: (entry: AddOnEntry) => boolean;
  /** Setnayan AI has a price for this event type (Tier E has none). */
  aiSellable: boolean;
  /** The store shell refuses this path (`isStoreShellWebOnlyPath`). */
  refusesPath: (path: string) => boolean;
  /** Setnayan AI's comeback window, in hours, while it is open. */
  comebackHoursLeft?: number | null;
};

const CARD_SKUS = (Object.keys(HOME_PAID_CARD) as Array<keyof typeof HOME_PAID_CARD>).map((k) => HOME_PAID_SKU[k]);

/**
 * The catalogue entries each SKU's card may be drawn from — Live Watch's card is `live-studio-roam`
 * (LIVE_STUDIO) while its launch flag is on, else the older `panood` tile (PANOOD_SYSTEM). Owning the
 * SKU owns whichever tile the card is drawn from, so a couple who paid never reads "Free".
 */
const SKU_TILES: Readonly<Record<string, readonly string[]>> = {
  [HOME_PAID_SKU.ai]: ['setnayan-ai'],
  [HOME_PAID_SKU.live]: ['live-studio-roam', 'panood'],
  [HOME_PAID_SKU.music]: ['pakanta'],
  [HOME_PAID_SKU.booth]: ['patiktok'],
};

/** The facts behind Home's five SKU rows. Every key of `HOME_PAID_SKU` is answered — none is skipped. */
export function homePaidFacts(input: HomePaidInput): Record<HomeSkuKey, HomePaidFact> {
  const active = new Set<string>();
  const pending = new Set<string>();
  for (const sku of [...CARD_SKUS, HOME_PAID_SKU.hub]) {
    const r = input.reads[sku];
    const tileKeys = (SKU_TILES[sku] ?? [])
      .map((k) => input.catalogue.find((a) => a.key === k)?.serviceKey)
      .filter((k): k is string => Boolean(k));
    const into = r?.active ? active : r?.pending ? pending : null;
    if (into) for (const k of [sku, ...tileKeys]) into.add(k);
  }
  const cards = buildOurServices({
    eventId: input.eventId,
    catalogue: input.catalogue,
    owned: { active, pending },
    prices: input.prices,
    offered: input.offered,
    sellableNow: input.sellableNow,
    aiSellable: input.aiSellable,
    papicOwnedBy: [],
    refusesPath: input.refusesPath,
  });
  const unread = (sku: string): boolean => {
    const r = input.reads[sku];
    return !r || r.active === null || (r.active === false && r.pending === null);
  };
  const out = {} as Record<HomeSkuKey, HomePaidFact>;
  for (const key of Object.keys(HOME_PAID_CARD) as Array<keyof typeof HOME_PAID_CARD>) {
    const sku = HOME_PAID_SKU[key];
    const card = cards.find((c) => c.key === HOME_PAID_CARD[key]) ?? null;
    out[key] = {
      card: card ? { state: card.state, stateText: card.stateText, href: card.href } : null,
      // An unread ownership read is said ("—") only where there is a row at all.
      ...(card && unread(sku) ? { unread: true } : {}),
      price: input.prices.get(sku) ?? null,
      ...(key === 'ai' ? { comebackHoursLeft: input.comebackHoursLeft ?? null } : {}),
    };
  }
  out.hub = hubProFact(input, active, pending, unread(HOME_PAID_SKU.hub));
  return out;
}

/** Event Hub Pro — the More menu has no card for it, so its card-shaped fact is made from the same entry. */
function hubProFact(input: HomePaidInput, active: Set<string>, pending: Set<string>, unread: boolean): HomePaidFact {
  const sku = HOME_PAID_SKU.hub;
  const entry = input.catalogue.find((a) => a.key === 'website-pro');
  const href = `/dashboard/${input.eventId}/studio/website-pro`;
  if (!entry || !input.offered(entry) || input.refusesPath(href)) return { card: null };
  if (unread) return { card: { state: 'added', stateText: '', href }, unread: true };
  const price = input.prices.get(sku) ?? null;
  const state = active.has(sku) ? 'added' : pending.has(sku) ? 'pending' : price ? 'price' : 'unpriced';
  return { card: { state, stateText: '', href }, price };
}
