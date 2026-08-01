/**
 * YOUR RUN OF DAY — the couple's night, seen through ONE of your trades.
 *
 * Phase 2 of `Role_Scoped_Day_Of_DESIGN_2026-08-01.md` (owner concept
 * 2026-08-01): *"an emcee run of day and stylist can focus on their specific
 * tasks."*
 *
 * ── THE WHOLE TRICK IS A NARROWER INPUT ────────────────────────────────────
 *
 * `blockRelevance(block, bookedCategories)` already ranks the shared timeline
 * per trade, and `deriveCallTime` already works out when that trade has to be
 * on site. Both take the vendor's booked categories — ALL of them. For a
 * supplier who is two trades at one wedding that answers "what matters to this
 * company", which is a blur.
 *
 * Pass only the categories belonging to the role they are RUNNING and the same
 * two functions answer the sharper question: what matters to the emcee, or to
 * the stylist. **No new ranking rules, no second source of truth — the same
 * shipped functions with a narrower input.**
 *
 * ── A LENS, NEVER A GATE (locked D2) ───────────────────────────────────────
 *
 * `vendor-timeline.ts` states it: a booked vendor keeps FULL-timeline
 * visibility, and relevance only ranks. This module honours that exactly —
 * every block is returned, marked. Nothing is removed. A host who is told
 * nothing about a moment is worse off than one told it is not his.
 *
 * The caller may collapse `context` blocks behind "show the rest"; it must not
 * drop them.
 */
import {
  blockRelevance,
  deriveCallTime,
  type CallTimeSuggestion,
  type LensBlock,
  type TimelineRelevance,
} from './vendor-timeline';
import {
  VENDOR_SPECIALIZATIONS,
  type VendorSpecializationSet,
} from './vendor-specialization-gate';
import { VENDOR_CATEGORY_CANONICAL } from './vendor-category-taxonomy';

/**
 * Which of the couple's booked categories belong to this role.
 *
 * The two vocabularies do not overlap — the couple's side speaks
 * `host_emcee` / `band_dj` / `planner_coordinator`, a specialization speaks
 * tiles (`host_mc` / `live_band` / `coordinator`) — so this maps each booked
 * category through the SHIPPED `VENDOR_CATEGORY_CANONICAL` table and keeps the
 * ones whose tiles the role covers.
 *
 * Derived, never hand-listed: a taxonomy in two places drifts, and this project
 * has already paid for that once (the 2026-07-30 desk-unreachable bug, where
 * `live_band ∉ {band_dj}` made every specialization desk dark).
 *
 * Returns `[]` when none match — a correct answer, and the caller must treat it
 * as "this role has no claim on the night" rather than "show everything".
 */
export function categoriesForSpecializationSet(
  set: VendorSpecializationSet,
  bookedCategories: readonly string[] | null | undefined,
): string[] {
  const def = VENDOR_SPECIALIZATIONS.find((d) => d.id === set);
  if (!def) return [];

  const table = VENDOR_CATEGORY_CANONICAL as Record<
    string,
    { kind: 'tile'; tile: string } | { kind: 'tiles'; tiles: string[] } | { kind: 'exempt' } | undefined
  >;

  const out: string[] = [];
  for (const category of bookedCategories ?? []) {
    if (typeof category !== 'string') continue;
    const mapping = table[category];
    if (!mapping) continue;
    const tiles =
      mapping.kind === 'tile' ? [mapping.tile] : mapping.kind === 'tiles' ? mapping.tiles : [];
    if (tiles.some((t) => def.tiles.has(t))) out.push(category);
  }
  return out;
}

export type RoleRunEntry = {
  blockId: string;
  label: string;
  startAt: string | null;
  /** Ranked THROUGH THIS ROLE's categories only. */
  relevance: TimelineRelevance;
  /** `primary` or `supporting` — the moments this role actually works. */
  yours: boolean;
};

export type RoleRunOfDay = {
  entries: RoleRunEntry[];
  /** How many moments this role actually works. The honest headline number. */
  yoursCount: number;
  /**
   * When this role has to be on site — earliest primary moment minus the
   * trade's setup lead, from the shipped `deriveCallTime`. `null` when the role
   * has no timed primary moment or no known lead (a coordinator is on site
   * regardless; an emcee has no load-in).
   */
  callTime: CallTimeSuggestion | null;
  /** TRUE when this role has no claim on the night at all — the caller should
   *  say so plainly rather than render an empty list. */
  empty: boolean;
};

/**
 * A block, as this module needs it.
 *
 * `block_type` is OPTIONAL because a legacy row can lack one and the shipped
 * `RunOfShowBlock` types it that way. An absent type simply matches no rule in
 * the relevance map and lands as `context` — the honest answer, never a throw.
 */
export type RunBlock = Omit<LensBlock, 'block_type'> & {
  block_id: string;
  block_type?: string;
};

/** Normalise for the shipped lens, which types `block_type` as a plain string. */
function toLens(b: RunBlock): LensBlock {
  return { label: b.label, block_type: b.block_type ?? '', start_at: b.start_at };
}

/**
 * Build the role's run of day.
 *
 * Pure and total: no throw on an empty timeline, an unknown category, a block
 * with no start time, or a role with no matching categories.
 */
export function roleRunOfDay(input: {
  blocks: readonly RunBlock[];
  set: VendorSpecializationSet;
  bookedCategories: readonly string[] | null | undefined;
}): RoleRunOfDay {
  const categories = categoriesForSpecializationSet(input.set, input.bookedCategories);

  // No claim on the night → every block is context. Deliberately NOT "show
  // everything as primary": pretending a role owns moments it does not is how a
  // focused view becomes noise again.
  const entries: RoleRunEntry[] = input.blocks
    .slice()
    .sort((a, b) => {
      if (a.start_at === b.start_at) return a.block_id < b.block_id ? -1 : 1;
      if (!a.start_at) return 1;
      if (!b.start_at) return -1;
      return a.start_at < b.start_at ? -1 : 1;
    })
    .map((b) => {
      const relevance: TimelineRelevance =
        categories.length === 0 ? 'context' : blockRelevance(toLens(b), categories);
      return {
        blockId: b.block_id,
        label: b.label,
        startAt: b.start_at,
        relevance,
        yours: relevance === 'primary' || relevance === 'supporting',
      };
    });

  return {
    entries,
    yoursCount: entries.filter((e) => e.yours).length,
    callTime: categories.length > 0 ? deriveCallTime(input.blocks.map(toLens), categories) : null,
    empty: categories.length === 0,
  };
}
