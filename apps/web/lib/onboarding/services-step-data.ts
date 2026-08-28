/**
 * services-step-data.ts — the live view-model behind the onboarding services
 * step (`app/onboarding/_shared/services-step.tsx`).
 *
 * ⚠ CLIENT-SAFE BY CONSTRUCTION — the types + the PURE derivation only. The
 * live reader lives in its sibling `services-step-server.ts`, and the split is
 * load-bearing: the step renders inside two CLIENT wizards, which import this
 * module for `orderPapicTypes` and the view types. Keeping the reader here would
 * drag `createAdminClient` (and the whole v2-catalog + event-type-profile chain)
 * into the onboarding browser bundle — "never import this from a client
 * component", as lib/supabase/admin.ts puts it. Nothing here may import a module
 * that touches the service-role client, React `cache()`, or `next/headers`.
 *
 * It carries no 'use client' and no React either, so a Server Component may
 * import it just as freely — and the derivation is unit-testable without a DOM.
 *
 * ── WHAT THE VIEW-MODEL PROMISES ────────────────────────────────────────────
 * Every figure the card can print arrives here already resolved from a live
 * table — points from papic_pass_tiers / papic_one_tiers, prices from
 * platform_retail_catalog_v2, the two free allowances from
 * papic_event_pool_config, the photo/clip weights from the capture-path
 * constants. This module's job is to DROP anything it cannot fully resolve: a
 * rung with no live price disappears rather than rendering at ₱0, which on a
 * price ladder reads as "free". A shorter true ladder, never a fake door.
 */
import { PAPIC_FREE_ONE_CAMERA_COUNT, type PapicOneTier } from '@/lib/papic-one';
import type { PapicPassTier } from '@/lib/papic-pass-tiers';
import { papicPointCurrencyTerms } from '@/lib/papic-tier-copy';

/** One purchasable rung, fully resolved. Points from its tier table, price from the catalog. */
export type PapicRungView = {
  /** platform_retail_catalog_v2 service_code — the React key. Never displayed. */
  key: string;
  points: number;
  /** What it costs HERE — the sign-up price. This is what gets charged. */
  pricePhp: number;
  /**
   * The regular price, for the "instead of" line. Equal to `pricePhp` when this
   * rung has no sign-up discount, so a card can compare the two and show nothing
   * when they match — a "save ₱0" badge is worse than no badge.
   */
  listPricePhp: number;
};

/** One of the two Papic products, as the card reads it. */
export type PapicTypeView = {
  /** Stable id — the card keys copy + emphasis off this, never off a title. */
  id: 'pool' | 'one';
  /**
   * The onboarding inapp service key this product maps to. The bridge to
   * `style_preferences.interested_services`, whose values are exactly these keys
   * (INAPP_TO_SERVICE_CODE) — which is how the persona's derived interest can
   * order the two products without either side inventing a third vocabulary.
   */
  inappKey: string;
  /** Free points on this product. 0 ⇒ the free rung is not rendered. */
  freePoints: number;
  /**
   * Free CAMERAS on this product. `null` = not a per-camera product (the Pool is
   * unlimited cameras sharing one purse). A number = free dedicated cameras.
   */
  freeCameras: number | null;
  /** Paid rungs, cheapest first. Empty ⇒ the ladder shows only the free rung. */
  rungs: PapicRungView[];
};

export type PapicCardView = {
  /** terminology.eventWord — 'wedding' | 'event' | 'trip'. The runway noun. */
  eventWord: string;
  /** Pool first by default; the card may reorder from interested_services. */
  types: PapicTypeView[];
  /** ['1 photo = 1 pt', '10-second clip = 8 pts'] — derived, never typed. */
  currencyTerms: readonly [string, string];
};

export type AiCardView = {
  /** Display price, e.g. "₱1,499". Resolved from the type's tier SKU. */
  priceLabel: string;
  /**
   * The same figure as a NUMBER, so the running total can add it up.
   *
   * ⚠ FOR DISPLAY ONLY, like every other peso figure the step carries. Setnayan
   * AI is priced per EVENT TYPE and the authoritative charge is re-resolved
   * server-side from the event's stored type at mint time — this exists so the
   * couple can see what the tick costs while they decide, never so a client can
   * tell the server what to bill.
   */
  pricePhp: number;
  /**
   * What the planner costs if they come back for it AFTER the create flow.
   * Equal to `pricePhp` when this type carries no sign-up discount, so the card
   * and the total compare the two and show nothing when they match.
   */
  listPricePhp: number;
};

export type ServicesStepView = {
  papic: PapicCardView;
  /** null ⇒ the vendor-free gate closed it. The card does not render at all. */
  ai: AiCardView | null;
};

/** The onboarding inapp keys the two Papic products answer to (INAPP_TO_SERVICE_CODE). */
export const PAPIC_POOL_INAPP_KEY = 'papic_guest';
export const PAPIC_ONE_INAPP_KEY = 'papic_seats';

const peso = (n: number) => `₱${Math.round(n).toLocaleString('en-PH')}`;

/**
 * PURE. Resolve one tier table + a price lookup into renderable rungs.
 *
 * Both halves must answer or the rung is dropped. A tier row with no live
 * catalog price is the dangerous case — it is a real product the couple cannot
 * be quoted, and printing it with a blank or zero price reads as "free".
 */
function rungsFrom(
  tiers: ReadonlyArray<{ serviceCode: string; points: number }>,
  pricePhpByCode: ReadonlyMap<string, number>,
  listPricePhpByCode: ReadonlyMap<string, number> = new Map(),
): PapicRungView[] {
  return tiers
    .map((t) => {
      const pricePhp = pricePhpByCode.get(t.serviceCode);
      if (typeof pricePhp !== 'number' || !Number.isFinite(pricePhp) || pricePhp <= 0) {
        return null;
      }
      // A missing or nonsensical list price means "no discount to show", never
      // zero — a rung claiming it was reduced from ₱0 is worse than a silent one.
      const listed = listPricePhpByCode.get(t.serviceCode);
      const listPricePhp =
        typeof listed === 'number' && Number.isFinite(listed) && listed > pricePhp
          ? listed
          : pricePhp;
      return { key: t.serviceCode, points: t.points, pricePhp, listPricePhp };
    })
    .filter((r): r is PapicRungView => r !== null)
    .sort((a, b) => a.pricePhp - b.pricePhp);
}

/**
 * PURE. Build the whole view-model from already-fetched inputs.
 *
 * Split out from the reader below so every branch — a dead catalog, a zeroed
 * free allowance, a closed AI gate — is assertable without touching a database.
 */
export function buildServicesStepView(input: {
  eventWord: string;
  poolTiers: readonly PapicPassTier[];
  oneTiers: readonly PapicOneTier[];
  /**
   * service_code → what this costs HERE (pesos), from the ACTIVE customer
   * catalog only. This is the SIGN-UP price where the row has one — owner
   * 2026-08-28, *"10% for all purchase on onboarding"* — and it is also what
   * gets charged, because the mint reads the same column.
   */
  pricePhpByCode: ReadonlyMap<string, number>;
  /**
   * service_code → the regular price, for the "instead of" line. Optional: a row
   * with no sign-up discount simply does not appear here and its rung shows one
   * price, which is the truth for that rung.
   */
  listPricePhpByCode?: ReadonlyMap<string, number>;
  freePoolPoints: number;
  freeOnePoints: number;
  /** null ⇒ the gate closed. Never 0-as-a-signal — 0 is a price, not an absence. */
  aiPricePhp: number | null;
  /** The planner's regular price, for the "later" comparison. Defaults to the
   *  sign-up one, which is the truth for a type with no discount. */
  aiListPricePhp?: number | null;
}): ServicesStepView {
  const {
    eventWord,
    poolTiers,
    oneTiers,
    pricePhpByCode,
    listPricePhpByCode,
    freePoolPoints,
    freeOnePoints,
    aiPricePhp,
    aiListPricePhp,
  } = input;

  const types: PapicTypeView[] = [
    {
      id: 'pool',
      inappKey: PAPIC_POOL_INAPP_KEY,
      freePoints: Math.max(0, freePoolPoints),
      // The Pool is deliberately camera-less: any guest phone that scans the
      // event QR shoots from it, so there is no seat to count and no seat to
      // sell. Rendering a number here would re-import the per-seat model the
      // two-type lock retired.
      freeCameras: null,
      // The repeatable top-up rung is excluded, exactly as /pricing excludes it:
      // it is a re-buy for an event that already holds a big pool, not a base
      // pick, and listing it beside the three buckets reads as a fourth product.
      rungs: rungsFrom(
        poolTiers.filter((t) => !t.isTopup),
        pricePhpByCode,
        listPricePhpByCode,
      ),
    },
    // ⚠ NO 'one' ENTRY (owner 2026-08-11). Papic One is retired: there is one
    // product, and a dedicated camera is made in the studio by handing it shots
    // the couple already owns.
    //
    // 🔑 REMOVED RATHER THAN LEFT TO EMPTY ITSELF. It would have emptied on its
    // own — free_one_camera_points is 0 and no One rung is active, so the view
    // resolves to zero free shots, zero cameras and an empty ladder. But
    // "renders as an empty card" is not "is not offered": the couple would still
    // meet a product heading on the screen where they choose what to pay for,
    // with nothing underneath it. That reads as a broken page, not a retirement.
  ];

  return {
    papic: { eventWord, types, currencyTerms: papicPointCurrencyTerms() },
    ai:
      aiPricePhp != null && aiPricePhp > 0
        ? {
            priceLabel: peso(aiPricePhp),
            pricePhp: aiPricePhp,
            // Never below what they pay: bad data must not print "save -₱600".
            listPricePhp:
              typeof aiListPricePhp === 'number' &&
              Number.isFinite(aiListPricePhp) &&
              aiListPricePhp > aiPricePhp
                ? aiListPricePhp
                : aiPricePhp,
          }
        : null,
  };
}

/**
 * PURE. Order the two Papic products by what the persona actually asked for.
 *
 * ── THIS IS `interested_services`' FIRST READER (BUILD SPEC § 1.3) ───────────
 * `style_preferences.interested_services` has been WRITTEN by three onboarding
 * files and read by ZERO since PR #2137 (2026-06-25). The persona packs derive a
 * per-type, per-persona service list — `papic_guest` (Pool) leads for the
 * big-celebration personas, `papic_seats` (One) for the keepsake ones — and then
 * that judgement was thrown away.
 *
 * Deliberately the LIGHTEST possible touch: it changes ORDER and nothing else.
 * Both products always render, at their real prices, with their real free tiers —
 * a couple whose persona leaned one way is never shown less. Anything stronger
 * (hiding a product, pre-selecting one, discounting one) would turn a derived
 * guess into a decision the couple never made, on a screen that deliberately
 * takes no money.
 *
 * Stable: a named product sorts ahead of an unnamed one, ties keep the incoming
 * order (Pool first), so an empty or unrecognised list is a no-op.
 */
export function orderPapicTypes(
  types: readonly PapicTypeView[],
  interestedServices: readonly string[] | null | undefined,
): PapicTypeView[] {
  const wanted = interestedServices ?? [];
  if (wanted.length === 0) return [...types];
  const rank = (t: PapicTypeView) => {
    const i = wanted.indexOf(t.inappKey);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return types
    .map((t, i) => ({ t, i }))
    .sort((a, b) => rank(a.t) - rank(b.t) || a.i - b.i)
    .map(({ t }) => t);
}
