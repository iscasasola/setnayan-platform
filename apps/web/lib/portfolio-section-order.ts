/**
 * 🖼 THE PORTFOLIO'S SECTION ORDER (ruling 5940; approved prototype
 * `prototypes/shop_discounts_bundle_card_open_2026-11-09/portfolio.html` v3 — "Your best work" FIRST, then the
 * shipped sections, then More, then the "Reorder" closing row).
 *
 * The supplier's order is stored as a list of section keys (`vendor_profiles.portfolio_section_order`, migration
 * 20271342126686). This file is the ONE place that turns that list into what the page draws:
 *   · a stored key the app no longer draws is IGNORED (never an error, never a blank);
 *   · a section the stored list does not name keeps its SHIPPED place, after the named ones — so a new section ships
 *     visible, and no stored order can ever hide one;
 *   · "More" is not orderable: it always closes the list (the prototype's utilities row), then Reorder.
 * 🔒 lib/portfolio-section-order.test.ts
 */

/** Every orderable section, in the SHIPPED order (the prototype's, best work first). */
export const PORTFOLIO_SECTIONS = [
  'best',
  'page',
  'cards',
  'albums',
  'own',
  'delivered',
  'instagram',
  'moodboard',
  'songs',
  'stories',
  'video',
] as const;

export type PortfolioSectionKey = (typeof PORTFOLIO_SECTIONS)[number];

/** The longest list the column accepts (its CHECK) — a write past it is cut, never refused. */
export const PORTFOLIO_ORDER_MAX = 24;

export function isPortfolioSectionKey(k: unknown): k is PortfolioSectionKey {
  return typeof k === 'string' && (PORTFOLIO_SECTIONS as readonly string[]).includes(k);
}

/**
 * The stored list → the keys of the sections to draw, in order. `present` = the sections this shop draws at all (a
 * Song bank only for music categories, …), in any order; absent = every section.
 */
export function orderPortfolioSections(
  stored: readonly unknown[] | null | undefined,
  present: readonly PortfolioSectionKey[] = PORTFOLIO_SECTIONS,
): PortfolioSectionKey[] {
  const here = new Set(present);
  const out: PortfolioSectionKey[] = [];
  for (const k of stored ?? []) if (isPortfolioSectionKey(k) && here.has(k) && !out.includes(k)) out.push(k);
  for (const k of PORTFOLIO_SECTIONS) if (here.has(k) && !out.includes(k)) out.push(k);
  return out;
}

/** What a save writes: known keys only, each once, at most the column's cap. Unknown words are dropped, not refused. */
export function cleanPortfolioOrder(raw: readonly unknown[]): PortfolioSectionKey[] {
  const out: PortfolioSectionKey[] = [];
  for (const k of raw) if (isPortfolioSectionKey(k) && !out.includes(k)) out.push(k);
  return out.slice(0, PORTFOLIO_ORDER_MAX);
}

/** Move one key a step up (-1) or down (+1) inside an already-ordered list. Out of range = unchanged. */
export function moveSection<T>(list: readonly T[], i: number, by: -1 | 1): T[] {
  const j = i + by;
  if (i < 0 || i >= list.length || j < 0 || j >= list.length) return [...list];
  const next = [...list];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}
