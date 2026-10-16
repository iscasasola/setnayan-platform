import { VENDOR_CATEGORY_CANONICAL } from '@/lib/vendor-category-taxonomy';
import type { VendorCategory } from '@/lib/vendors';
import type { LeafIndex } from '@/lib/service-card-kind';
import {
  unmetPublishRequirements,
  type PublishFacts,
  type PublishRequirement,
} from '@/lib/service-publish-gate';

/**
 * service-card-maker.ts — the plain rules behind the simpler service card maker
 * (simpler supplier dashboard, step 3 · corpus `prototypes/supplier_easy_dashboard_2026-10-14_fable.html`,
 * moments "2 · Putting up a service" and "2 · The service card · every field"; DECISION_LOG 2026-10-14 ✅ APPROVE
 * and 🏷).
 *
 * Pure — no database, no React — so the server page, the maker and the tests ask the SAME function.
 *
 * Four answers live here:
 *   1. WHAT KIND OF SUPPLIER this card is for (church · caterer · studio · photographer · florist · venue ·
 *      performer · other) — read from the card's KIND, so a parish making a baptism card gets church defaults
 *      even when the shop also sells something else;
 *   2. THE DEFAULTS BY SUPPLIER TYPE that "More settings" opens with ("Filled for a caterer");
 *   3. THE STATUS LINE under the card ("Hidden until: a cover photo · a price · what's included");
 *   4. THE 🏷 QUESTION — which coverage leaf a kind would add to "what you do", if any.
 *
 * ⛔ NO PESO IS EVER A DEFAULT, AND NO PAYMENT SPLIT IS EITHER. The prototype draws sample figures (₱450 an extra
 * guest, ₱5,000 an extra hour, ₱2,000 transport, 20 % to book) for its sample shops. A figure that governs money is
 * never guessed (CLAUDE.md rule 9) and the owner ruled "no pre-filled discount" (2026-10-14). The defaults are the
 * SHAPE of the card: how its price works, how far ahead couples book, which folds apply.
 */

export type SupplierType =
  | 'church'
  | 'caterer'
  | 'studio'
  | 'photographer'
  | 'florist'
  | 'venue'
  | 'performer'
  | 'other';

/** "Common for a caterer" · "Filled for a caterer" — the prototype's TYPEWORD. */
export const SUPPLIER_TYPE_WORD: Record<SupplierType, string> = {
  church: 'a church',
  caterer: 'a caterer',
  studio: 'a photo & video studio',
  photographer: 'a photographer',
  florist: 'a florist',
  venue: 'a venue',
  performer: 'a performer',
  other: 'your shop',
};

/** Kinds that are a church's own, whatever the taxonomy calls their family. */
const CHURCH_KINDS = new Set(['religious_venue', 'ceremony_venue', 'church_fees', 'officiant']);
const PHOTOGRAPHER_KINDS = new Set(['photographer', 'pre_nup_photographer']);

/**
 * The supplier type a card's kind belongs to.
 *
 * `folder` is the kind's tier-1 family from the live taxonomy (`LeafIndex.folder`) when the kind is a coverage
 * leaf; a legacy key passes `null` and is read through its own name. Fails toward 'other' — a kind this cannot place
 * opens a maker with nothing pre-filled, never one filled for the wrong trade.
 */
export function supplierTypeForKind(kind: string, folder: string | null): SupplierType {
  const k = kind.toLowerCase();
  if (CHURCH_KINDS.has(k) || /church|parish|chapel|mass|baptism|blessing/.test(k)) return 'church';
  if (PHOTOGRAPHER_KINDS.has(k)) return 'photographer';
  const f = folder ?? familyOfLegacyKind(k);
  if (f === 'feast') return 'caterer';
  if (f === 'documentary') return 'studio';
  if (f === 'design') return 'florist';
  if (f === 'venue') return 'venue';
  if (f === 'program') return 'performer';
  return 'other';
}

/** The family a LEGACY kind files under, through its anchor tile (the same bridge the family cap uses). */
function familyOfLegacyKind(kind: string): string | null {
  if (!(kind in VENDOR_CATEGORY_CANONICAL)) return null;
  const m = VENDOR_CATEGORY_CANONICAL[kind as VendorCategory];
  const tile = m.kind === 'tile' ? m.tile : m.kind === 'tiles' ? (m.tiles[0] ?? null) : null;
  if (!tile) return null;
  return LEGACY_TILE_FAMILY[tile] ?? null;
}

/** Tile → family for the tiles a legacy kind anchors to. Only the families a supplier type is read from. */
const LEGACY_TILE_FAMILY: Record<string, string> = {
  catering: 'feast',
  crew_meals: 'feast',
  cake: 'feast',
  photo_video: 'documentary',
  florist: 'design',
  reception: 'venue',
  ceremony_venue: 'venue',
  host_mc: 'program',
  choir: 'program',
  live_band: 'program',
  dj: 'program',
};

/**
 * The shop's type for the kind sheet's heading ("Common for a caterer") — the type most of what it already covers
 * belongs to. The first covered kind breaks a tie; a shop with nothing yet is 'other' ("Common for your shop").
 */
export function supplierTypeForShop(
  coveredKinds: readonly { kind: string; folder: string | null }[],
): SupplierType {
  const tally = new Map<SupplierType, number>();
  for (const c of coveredKinds) {
    const t = supplierTypeForKind(c.kind, c.folder);
    tally.set(t, (tally.get(t) ?? 0) + 1);
  }
  let best: SupplierType = 'other';
  let bestN = 0;
  for (const [t, n] of tally) {
    if (t !== 'other' && n > bestN) {
      best = t;
      bestN = n;
    }
  }
  return best;
}

export type MakerDefaults = {
  /** How the "from" price works. */
  pricingBasis: 'fixed' | 'per_pax' | 'per_hour';
  /** Book ahead (months) — only where the approved prototype draws one for this type; else blank. */
  leadMonths: number | null;
  /** Crew and transport apply at all (a church has nothing to feed or move). */
  crewApplies: boolean;
  /** The fold summaries "More settings" shows before anything is typed. */
  summary: {
    price: string;
    crew: string;
    terms: string;
  };
};

/**
 * The defaults "More settings" opens with, by supplier type (owner 2026-10-14 🗓: "create a service with the fewest
 * questions + defaults by supplier type"). Book-ahead months are the prototype's own three (church 6 · caterer 1 ·
 * studio 3, a photographer reads as a studio); every other type opens blank.
 */
export function makerDefaultsFor(type: SupplierType, kind = ''): MakerDefaults {
  const perMeal = kind === 'crew_meals';
  switch (type) {
    case 'church':
      return {
        pricingBasis: 'fixed',
        leadMonths: 6,
        crewApplies: false,
        summary: { price: 'One price · the whole fee', crew: 'Not needed for a church', terms: 'Book 6 months ahead' },
      };
    case 'caterer':
      return {
        pricingBasis: 'per_pax',
        leadMonths: 1,
        crewApplies: true,
        summary: {
          price: perMeal ? 'Per meal · set a minimum' : 'Per guest · set a minimum',
          crew: 'Crew · meal · transport',
          terms: 'Book 1 month ahead',
        },
      };
    case 'studio':
    case 'photographer':
      return {
        pricingBasis: 'fixed',
        leadMonths: 3,
        crewApplies: true,
        summary: { price: 'One price · extra hours if you like', crew: 'Crew · meal · transport', terms: 'Book 3 months ahead' },
      };
    default:
      return {
        pricingBasis: perMeal ? 'per_pax' : 'fixed',
        leadMonths: null,
        crewApplies: true,
        summary: { price: 'One price, per guest or per hour', crew: 'Crew · meal · transport', terms: 'How far ahead · last-minute' },
      };
  }
}

/** The words each unmet requirement takes on the status line — the prototype's own. */
const GAP_WORD: Record<PublishRequirement | 'kind', string> = {
  kind: 'what you offer',
  cover: 'a cover photo',
  price: 'a price',
  inclusions: "what's included",
};

export type MakerStatus = {
  tone: 'warn' | 'ok';
  /** "Hidden until:" — or null when ready. */
  lead: string | null;
  /** "a cover photo · a price · what's included" — or the ready sentence. */
  text: string;
};

/**
 * The ONE status line under the card. It asks the publish gate (`unmetPublishRequirements`) — never its own list —
 * so the line, the Create button and the save refuse and allow the same card.
 *
 * `live` is an existing card that is already shown (it keeps its place while a requirement is missing — the gate's
 * own rule for a live card).
 */
export function makerStatus(
  facts: PublishFacts & { hasKind: boolean },
  opts: { editing?: boolean; live?: boolean } = {},
): MakerStatus {
  const gaps = [
    ...(facts.hasKind ? [] : (['kind'] as const)),
    ...unmetPublishRequirements(facts),
  ].map((g) => GAP_WORD[g]);
  if (gaps.length > 0) {
    if (opts.live) return { tone: 'warn', lead: 'Couples can see it · still missing:', text: gaps.join(' · ') };
    return { tone: 'warn', lead: 'Hidden until:', text: gaps.join(' · ') };
  }
  if (opts.editing && opts.live === false) return { tone: 'ok', lead: null, text: 'Ready · switch it on under Live to show couples' };
  return { tone: 'ok', lead: null, text: 'Ready · couples will see it' };
}

/**
 * 🏷 THE COVERAGE LEAF A CARD'S KIND WOULD ADD TO "WHAT YOU DO" (owner 2026-10-14: "Ask once, then add it").
 *
 * `vendor_coverages.canonical_service` must be a live taxonomy leaf, so:
 *   · a kind that IS a live leaf → that leaf;
 *   · a legacy kind → its anchor tile, when that tile is itself a live leaf (catering · florist · photo_video …);
 *   · anything else (Miscellaneous, an officiant, a tile with no same-named leaf) → null: there is nothing honest to
 *     add, so nothing is asked.
 */
export function coverageLeafForKind(kind: string, leaves: LeafIndex): string | null {
  if (leaves.label.has(kind)) return kind;
  if (!(kind in VENDOR_CATEGORY_CANONICAL)) return null;
  const m = VENDOR_CATEGORY_CANONICAL[kind as VendorCategory];
  const tile = m.kind === 'tile' ? m.tile : m.kind === 'tiles' ? (m.tiles[0] ?? null) : null;
  return tile && leaves.label.has(tile) ? tile : null;
}

/**
 * Does creating a card of this kind ask the 🏷 question? Only when the kind resolves to a leaf the shop does NOT
 * already cover. Returns the leaf to add (and its label) or null.
 */
export function coverageAskFor(
  kind: string,
  leaves: LeafIndex,
  coveredLeaves: ReadonlySet<string>,
): { leaf: string; label: string } | null {
  const leaf = coverageLeafForKind(kind, leaves);
  if (!leaf || coveredLeaves.has(leaf)) return null;
  return { leaf, label: leaves.label.get(leaf) ?? leaf };
}

/** The one question, in the owner's words (DECISION_LOG 2026-10-14 🏷). */
export function coverageAskLine(kindLabel: string): string {
  return `Add ${kindLabel} to what you do? Couples will find you there.`;
}

/** The card row's line for a card whose kind is outside "what you do" (the 🏷 "Not now" answer). */
export const NOT_IN_WHAT_YOU_DO = 'not in what you do';

/** Is this stored card kind outside the shop's coverage — i.e. invisible to supplier discovery? */
export function cardIsOutsideCoverage(
  kind: string,
  leaves: LeafIndex,
  coveredLeaves: ReadonlySet<string>,
): boolean {
  return coverageAskFor(kind, leaves, coveredLeaves) !== null;
}
