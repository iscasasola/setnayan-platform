import type { VendorCategory } from '@/lib/vendors';
import { VENDOR_CATEGORIES } from '@/lib/vendors';
import { vendorCategoryForLeaf } from '@/lib/vendor-packages';
import { categoryForBranch } from '@/lib/vendor-branch-category';

/**
 * event-vendor-category.ts — TURNING A SERVICE CARD'S KIND INTO THE COUPLE-SIDE
 * CATEGORY, WITHOUT THE DATABASE REFUSING THE ROW.
 *
 * 🔴 THE DEFECT THIS CLOSES, measured against production 2026-09-09.
 * `event_vendors.category` is the strict Postgres enum `vendor_category`
 * (58 labels) and it is NOT NULL. `vendor_services.category` is plain TEXT that
 * holds a DIFFERENT vocabulary — a coverage LEAF (`live_band`), sometimes a
 * tier-2 TILE id (`host_mc`), sometimes a legacy `VENDOR_CATEGORIES` key. The
 * two vocabularies overlap only by accident.
 *
 * Both live service cards in production carry `live_band` and `host_mc`, and
 * NEITHER is a `vendor_category` label — the twins are `band_dj` and
 * `host_emcee`. Writing the raw text into that column makes PostgREST answer
 * `22P02 invalid input value for enum vendor_category`, and **a rejected query
 * in this codebase is silent, not thrown**: the supplier simply never appeared
 * on the couple's list, and the booking step later had nothing to book.
 *
 * 🔑 NOTHING NEW IS MAPPED HERE. Every answer comes from the two maps that
 * already exist and are already guarded — `PACKAGE_CANONICAL_TO_VENDOR_CATEGORY`
 * (leaf) and `BRANCH_TO_VENDOR_CATEGORY` (branch), joined by
 * `vendorCategoryForLeaf`. A hand-kept table of 58 labels is exactly the thing
 * that fell 194 leaves behind the database once already.
 *
 * THE ORDER, and why each rung exists:
 *   1. the kind is ALREADY a coarse `vendor_category` key → keep it. A card
 *      filed under `photographer` must not be re-derived into something else.
 *      ⚠ This rung is keyed on `VENDOR_CATEGORIES` (52) and the Postgres enum
 *      carries MORE (58 — the attire labels). That is safe only because none of
 *      the extras is a choosable card kind: `parseCategory` admits
 *      `VENDOR_CATEGORIES` ∪ coverage LEAVES, and a leaf is a
 *      `canonical_service` row. The db guard asserts exactly that, so the day an
 *      admin makes one of them a leaf, CI says so instead of it being quietly
 *      re-derived here.
 *   2. the kind is a taxonomy LEAF → its leaf/branch answer, via the tile the
 *      caller resolved from the live taxonomy.
 *   3. the kind IS a tile id (`host_mc` — a branch, not a leaf, so the taxonomy
 *      map has no entry for it at all) → the branch map, keyed on the kind
 *      itself. Without this rung `host_mc` lands in `misc`.
 *   4. `misc` — a real enum label, so the row ALWAYS lands. Landing under the
 *      generic bucket is recoverable; being refused by the database is not.
 *
 * 🔒 THE RETURN VALUE IS ALWAYS A LABEL THE ENUM HAS. That is asserted against
 * the enum in the replayed schema by `tests/db/inquiry-adds-the-shop.db.test.ts`,
 * for every live leaf AND every live tile — so a taxonomy an admin edits at
 * runtime cannot reintroduce this.
 *
 * 🔒 PURE ON PURPOSE — no `@/lib/supabase/*` import, so a plain `node:test` file
 * can reach it. The caller fetches the taxonomy and hands in the tile.
 */

const COARSE: ReadonlySet<string> = new Set<string>(VENDOR_CATEGORIES);

/**
 * @param cardKind  `vendor_services.category` as stored — leaf, tile id or a
 *                  legacy coarse key. Blank/absent resolves to `misc`.
 * @param tileForKind the tile the LIVE taxonomy gives for `cardKind`
 *                  (`(await getTaxonomy()).map[cardKind]?.tile`), or null when
 *                  the taxonomy does not know it / could not be read. A missing
 *                  tile is never fatal: rung 3 then reads the kind as a tile.
 */
export function eventVendorCategoryForCardKind(
  cardKind: string | null | undefined,
  tileForKind: string | null | undefined,
): VendorCategory {
  const kind = typeof cardKind === 'string' ? cardKind.trim() : '';
  if (kind.length === 0) return 'misc';

  // 1 · already the coarse vocabulary.
  if (COARSE.has(kind)) return kind as VendorCategory;

  // 2 · a leaf: its own map, else its branch.
  const viaLeaf = vendorCategoryForLeaf(kind, tileForKind ?? null);
  if (viaLeaf !== 'misc') return viaLeaf;

  // 3 · the kind is itself a branch (tile) id.
  return categoryForBranch(kind) ?? 'misc';
}

/**
 * The tile to dual-write into `event_vendors.category_key` alongside the enum.
 *
 * Same three-rung shape, one level up: the taxonomy's tile for this leaf, else
 * the kind itself when the kind IS a tile, else null. Keeping this beside the
 * category resolver is deliberate — the two were computed independently at the
 * two write sites and disagreed (`category_key` went null for exactly the kinds
 * the category got wrong).
 */
export function eventVendorCategoryKeyForCardKind(
  cardKind: string | null | undefined,
  tileForKind: string | null | undefined,
): string | null {
  const kind = typeof cardKind === 'string' ? cardKind.trim() : '';
  const tile = typeof tileForKind === 'string' ? tileForKind.trim() : '';
  if (tile.length > 0) return tile;
  if (kind.length > 0 && categoryForBranch(kind) != null) return kind;
  return null;
}
