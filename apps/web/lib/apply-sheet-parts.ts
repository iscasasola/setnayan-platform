/**
 * apps/web/lib/apply-sheet-parts.ts — 💎 the ✓ Apply sheet, PART BY PART (owner 2026-10-22; prototype
 * `prototypes/pro_part_by_part_2026-10-22.html` frames 1 · 1-closer · 2 · nothing-to-pay).
 *
 * Pure. The held effects (`hubDraftProEffects`, each tagged with ITS part) are grouped under their part, in the
 * parts' own order, each group priced from the catalogue figure the bar loader read; the subtotal, the rest to
 * everything and the two buttons follow the ONE rule in `hubApplyOffer`. No second list of what is Pro, no price typed.
 */
import {
  HUB_PARTS,
  HUB_PART_IDS,
  hubApplyOffer,
  hubPart,
  hubPartsLabel,
  type HubOwnershipView,
  type HubPartId,
} from '@/lib/hub-parts';
import type { HubProEffectView } from '@/lib/hub-pro-effect-view';

/** What the sheet is handed to price — every figure a catalogue read (`HubDraftBarData`). */
export type ApplySheetPricing = {
  partPricePhp: Partial<Record<HubPartId, number>>;
  fullPricePhp: number | null;
  ownership: HubOwnershipView;
};

/** With this many parts or more, each part is ONE line that opens its effects — the sheet never scrolls past 8 lines. */
export const APPLY_SHEET_PARTS_COLLAPSE_AT = 4;

export type ApplySheetPartGroup = {
  part: HubPartId;
  name: string;
  pricePhp: number | null;
  effects: HubProEffectView[];
  /** The collapsed line's words — "Church doors · Save the Date". */
  summary: string;
};

export function applySheetParts(
  effects: readonly HubProEffectView[],
  pricing: ApplySheetPricing | null,
): { parts: ApplySheetPartGroup[]; collapsed: boolean } | null {
  if (!pricing || effects.length === 0) return null;
  const parts: ApplySheetPartGroup[] = [];
  for (const id of HUB_PART_IDS) {
    const mine = effects.filter((e) => e.part === id);
    if (mine.length === 0) continue;
    parts.push({
      part: id,
      name: hubPart(id).name,
      pricePhp: pricing.partPricePhp[id] ?? null,
      effects: mine,
      summary: mine.map((e) => `${e.what} · ${e.where}`).join(', '),
    });
  }
  return { parts, collapsed: parts.length >= APPLY_SHEET_PARTS_COLLAPSE_AT };
}

export type ApplySheetButtons = {
  lead: 'parts' | 'everything';
  showParts: boolean;
  subtotalPhp: number;
  /** Full Pro less what the event has paid — what "everything" costs now. */
  restPhp: number;
  /** What everything costs beyond these parts — the "₱X more". */
  morePhp: number;
  paidPhp: number;
  fullPhp: number;
  allParts: number;
  /** Parts neither in this draft nor owned — "the other N parts". */
  otherParts: number;
  partsWord: string;
  ownedNames: string[];
  partIds: HubPartId[];
  partsLabel: string;
};

/**
 * The buttons — null when any figure is unread (then the sheet keeps the one-unlock button: never an invented price).
 */
export function applySheetButtons(
  groups: { parts: ApplySheetPartGroup[] } | null,
  pricing: ApplySheetPricing | null,
): ApplySheetButtons | null {
  if (!groups || !pricing || pricing.fullPricePhp === null) return null;
  if (groups.parts.some((g) => g.pricePhp === null)) return null;
  const subtotal = groups.parts.reduce((sum, g) => sum + (g.pricePhp ?? 0), 0);
  const paid = pricing.ownership.paidPhp;
  const rest = Math.max(0, pricing.fullPricePhp - paid);
  const offer = hubApplyOffer(subtotal, rest);
  const owned = new Set(pricing.ownership.parts);
  const ids = groups.parts.map((g) => g.part);
  return {
    lead: offer.lead,
    showParts: offer.showParts,
    subtotalPhp: subtotal,
    restPhp: rest,
    morePhp: offer.more ?? 0,
    paidPhp: paid,
    fullPhp: pricing.fullPricePhp,
    allParts: HUB_PARTS.length,
    otherParts: HUB_PARTS.filter((p) => !owned.has(p.id) && !ids.includes(p.id)).length,
    partsWord: ids.length === 1 ? 'this one' : ids.length === 2 ? 'these two' : `these ${ids.length}`,
    ownedNames: HUB_PARTS.filter((p) => owned.has(p.id)).map((p) => p.name),
    partIds: ids,
    partsLabel: ids.length <= 2 ? hubPartsLabel(ids) : `these ${ids.length} parts`,
  };
}

/** The parts page, asked to buy these parts (or everything) and come back to finish the Apply. */
export function partsBuyHref(proHref: string, buy: readonly HubPartId[] | 'full'): string {
  const sep = proHref.includes('?') ? '&' : '?';
  return `${proHref}${sep}buy=${buy === 'full' ? 'full' : buy.join(',')}`;
}
