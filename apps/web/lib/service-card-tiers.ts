/**
 * 🪜 THE TIER GRID ON THE CARD MAKER (Card Maker HYBRID, owner-approved 17 Nov 2026 — `service_card_maker_HYBRID_MAP`
 * row "Tiers (Starting · higher tiers) + 'Gold adds …'"; DECISION_LOG 16 Nov: *"tier grid will show what is added to the
 * higher tiers"*). It replaces the "What's included · details" fold.
 *
 * READ ONLY, NO NEW SCHEMA. "Starting" is THIS card (its price and its own What's included lines). Each higher tier is a
 * package the shop already linked to the card (`vendor_packages.vendor_service_id`), with its OWN typed price
 * (`total_price_centavos`) — never a price added up from priced lines (owner Q1 pick: "typed per tier"; 11 Nov "an
 * included line has no price"). A tier's lines are its `vendor_package_items` that are included by default
 * (`is_default_included`); what a tier ADDS is the lines the tier below it does not have, matched by their words.
 *
 * Authoring a tier is NOT here: "＋ Add a tier" leads to the shipped package maker. Writing tiers from the card is the
 * schema-and-save half (Good · Better · Best), listed for the owner, not built.
 */

export type TierPackage = {
  name: string;
  /** `vendor_packages.total_price_centavos` — the tier's own typed price. */
  priceCentavos: number;
  /** `vendor_package_items.service_description` of the items included by default, in display order. */
  lines: string[];
};

/** What the maker is handed: the shop's tiers for this card, or a read that failed (said, never drawn as none). */
export type MakerTiers = { status: 'ok'; tiers: TierPackage[] } | { status: 'unread' };

export type TierColumn = {
  name: string;
  /** Whole pesos, or null when the Starting card has no price yet. */
  pricePhp: number | null;
  /** The lines this column has (ticks). */
  has: ReadonlySet<string>;
  /** What this column adds over the one before it — the "Gold adds …" line. Empty for Starting. */
  adds: string[];
};

export type TierGrid = {
  columns: TierColumn[];
  /** Every line in the grid, in order: the card's own first, then each tier's new ones. */
  lines: string[];
};

const norm = (s: string): string => s.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * The grid: Starting (this card) first, then the linked tiers from the cheapest up. A line is matched across columns by
 * its words (case and spacing ignored); a tier that leaves out a Starting line simply shows a dash there.
 */
export function buildTierGrid(input: {
  startingPricePhp: number | null;
  startingLines: readonly string[];
  tiers: readonly TierPackage[];
}): TierGrid {
  const order: string[] = [];
  const shown = new Map<string, string>();
  const add = (line: string) => {
    const k = norm(line);
    if (!k || shown.has(k)) return;
    shown.set(k, line.trim().replace(/\s+/g, ' '));
    order.push(k);
  };
  input.startingLines.forEach(add);
  const tiers = [...input.tiers].sort((a, b) => a.priceCentavos - b.priceCentavos);
  tiers.forEach((t) => t.lines.forEach(add));

  const startHas = new Set(input.startingLines.map(norm).filter(Boolean));
  const columns: TierColumn[] = [{ name: 'Starting', pricePhp: input.startingPricePhp, has: startHas, adds: [] }];
  let below = startHas;
  for (const t of tiers) {
    const has = new Set(t.lines.map(norm).filter(Boolean));
    const adds = order.filter((k) => has.has(k) && !below.has(k)).map((k) => shown.get(k) ?? k);
    columns.push({ name: t.name.trim() || 'Tier', pricePhp: Math.round(t.priceCentavos / 100), has, adds });
    below = has;
  }
  return { columns, lines: order.map((k) => shown.get(k) ?? k) };
}

/** Is this grid's line in this column? (The grid keeps lines by their shown words.) */
export function tierHasLine(col: TierColumn, line: string): boolean {
  return col.has.has(norm(line));
}
