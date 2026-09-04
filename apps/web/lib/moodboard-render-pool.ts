/**
 * lib/moodboard-render-pool.ts — THE INSPIRATION POOL (MB9), pure half.
 *
 * Section 01 now has THREE sources of a reference photo:
 *
 *   the couple's own upload   → event_inspiration_assets, source_kind='file_upload'
 *   a supplier's portfolio    → moodboard_library_assets  (MB10, lib/moodboard-gallery.ts)
 *   ANOTHER COUPLE'S RENDER   → event_renders             (MB9, this file)
 *
 * ── ⛔ THIS IS NOT A CACHE ────────────────────────────────────────────────
 * The original MB9 was a render cache: match a new brief against a prior
 * render's `config_digest` and serve it back FREE. **Cancelled by the owner on
 * 2026-09-03 — "no need to give free renders. always charge for renders."**
 * Nothing in this module reads `config_digest`, nothing scores similarity, and
 * nothing returns a price. If a comment, a migration docblock or another
 * session still describes matching radii or a free lane, it is stale.
 *
 * 🔑 PICKING ONE OF THESE COSTS NOTHING BECAUSE IT PRODUCES NOTHING. It is a
 * reference selection, mechanically the same act as picking a florist's
 * bouquet photo: one row in `event_inspiration_assets` and no other table
 * touched. GENERATING a render still always costs the stated credits from
 * `moodboard_render_config`, through MB8's pipeline, every single time.
 *
 * ── SHAPE COPIED FROM MB10 ON PURPOSE ─────────────────────────────────────
 * Same paging contract as `lib/moodboard-gallery.ts`: a server-clamped
 * limit/offset, an `assets` list, a `total` denominator, and a `withheld`
 * count that keeps "nobody has shared a render yet" and "we hold renders we
 * cannot show" as two different sentences. The picker component is
 * `gallery-picker.tsx`'s shape for the same reason — a second picker UI with
 * its own paging bugs helps nobody.
 */

import {
  RENDER_PARTS,
  WHOLE_LOOK_PART_ID,
  inspirationSlotsForPart,
  renderPartById,
} from './moodboard-render-parts';
import { MOODBOARD_SLOT_KEYS } from './moodboard-slots';

/** ~6 tiles a screen — the same page size the supplier gallery uses. */
export const POOL_PAGE_SIZE = 6;

/** Hard ceiling on one page, whatever the caller asks for. */
export const POOL_MAX_LIMIT = 24;

/** Hard ceiling on how deep "Show more" can walk. */
export const POOL_MAX_OFFSET = 600;

/**
 * Which render parts answer an inspiration slot — DERIVED, never listed.
 *
 * `inspirationSlotsForPart` already maps a part to its slots (the SLOT_ROLE
 * registry: a place slot is its own part, a room zone aliases a RECEPTION_PART,
 * an attire slot aliases a PaletteKey). This is that relation read backwards,
 * computed from RENDER_PARTS itself, so a reception zone added later becomes
 * browsable with no edit here and no stale IN-list in the SQL.
 *
 * `whole_look` is included for EVERY slot: a whole-look render shows the room
 * entire, which is a legitimate reference for any part of it. It is the only
 * part with no slot of its own, and dropping it would make the pool look empty
 * on a platform whose most-rendered part is the whole look.
 */
export function renderPartIdsForSlot(slot: string): string[] {
  if (!(MOODBOARD_SLOT_KEYS as readonly string[]).includes(slot)) return [];
  const out = RENDER_PARTS.filter((part) =>
    (inspirationSlotsForPart(part.id) as readonly string[]).includes(slot),
  ).map((part) => part.id);
  return [...out, WHOLE_LOOK_PART_ID];
}

/*
 * ⚠ THERE IS DELIBERATELY NO `slotHasRenderParts` GATE, unlike MB10's
 * `slotHasSupplierTrade`. The supplier gallery genuinely has slots no trade
 * answers (`palette` — a colour reference is nobody's portfolio), so a button
 * there would open an empty shelf that can never fill. Every slot, including
 * `palette`, has at least the whole-look renders as a legitimate reference, so
 * the honest gate here is the pool's own emptiness — which the picker reports
 * in words rather than as a grey grid.
 */

export type RenderPoolQuery = {
  slotKey: string;
  partIds: string[];
  limit: number;
  offset: number;
};

/**
 * Clamp an untrusted page request. `null` = not a slot key at all, so the
 * caller must not query.
 *
 * 🛑 THE CAP IS SERVER-SIDE AND UNCONDITIONAL, as MB10's is. The picker never
 * sends a `limit`; this function supplies one whatever arrives — including
 * nothing, NaN, Infinity and a negative — and the RPC clamps a second time in
 * SQL. `template-gallery.tsx` shipped the opposite shape (the whole table
 * through the RSC payload) and PR #5113 had to kill it.
 */
export function normalizeRenderPoolQuery(input: {
  slotKey?: unknown;
  limit?: unknown;
  offset?: unknown;
}): RenderPoolQuery | null {
  const slotKey = input.slotKey;
  if (typeof slotKey !== 'string') return null;
  if (!(MOODBOARD_SLOT_KEYS as readonly string[]).includes(slotKey)) return null;

  const rawLimit = Number(input.limit ?? POOL_PAGE_SIZE);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(POOL_MAX_LIMIT, Math.max(1, Math.floor(rawLimit)))
    : POOL_PAGE_SIZE;

  const rawOffset = Number(input.offset ?? 0);
  const offset = Number.isFinite(rawOffset)
    ? Math.min(POOL_MAX_OFFSET, Math.max(0, Math.floor(rawOffset)))
    : 0;

  return { slotKey, partIds: renderPartIdsForSlot(slotKey), limit, offset };
}

/** One row exactly as `moodboard_inspiration_pool` returns it. */
export type RawPoolRow = {
  render_id: string;
  part_id: string;
  gallery_image_key: string | null;
  swatches: string[] | null;
  created_at: string;
  total_count: number | string;
};

/** One browsable render, already resolved to a viewable URL server-side. */
export type PoolRender = {
  renderId: string;
  /** A short-lived presigned GET of the WATERMARKED copy. Never `image_key`. */
  imageUrl: string;
  /** "Ceiling", "The whole look" — from the derived registry, never a raw id. */
  partLabel: string;
  /** The six colours the render was made from, written onto the board row. */
  swatches: string[];
};

export type RenderPoolPage = {
  renders: PoolRender[];
  /** Pool rows this slot has, before withholding. The paging denominator. */
  total: number;
  /**
   * Rows we fetched and did NOT show. Today that is one case: a render whose
   * design snapshot carries no reception palette, so there is no honest way to
   * fill the six NOT NULL `sampled_hex_*` columns a picked photo writes. The
   * template path already refuses that case ("no real color to write — skip,
   * don't invent one") and so does MB10's supplier gallery.
   *
   * `total > 0` with an empty `renders` is a real and different answer from
   * `total === 0`, and the picker says something different for each.
   */
  withheld: number;
  offset: number;
  limit: number;
  hasMore: boolean;
};

/**
 * Shape one fetched page, and count what was withheld.
 *
 * PURE — no Supabase and no R2, so every withholding rule unit-tests in
 * milliseconds. `signUrl` is passed in; a row whose URL cannot be minted is
 * withheld rather than rendered as a broken tile, because a grey square in an
 * inspiration grid says "there is nothing here", which is false.
 *
 * The six hexes are the render's own palette cycled to six (the same
 * `i % length` fill the template and supplier paths use). A row with none is
 * withheld — never padded with cream, which would write invented colour onto
 * the couple's board and look exactly like a real sample.
 */
export async function shapeRenderPoolPage(
  rows: readonly RawPoolRow[],
  signUrl: (key: string) => Promise<string | null>,
): Promise<{ renders: PoolRender[]; withheld: number; total: number }> {
  const renders: PoolRender[] = [];
  let withheld = 0;
  const total = rows.length > 0 ? Number(rows[0]!.total_count) || 0 : 0;

  for (const row of rows) {
    const hexes = (row.swatches ?? []).filter(
      (hex) => typeof hex === 'string' && /^#[0-9a-fA-F]{6}$/.test(hex),
    );
    if (!row.gallery_image_key || hexes.length === 0) {
      withheld += 1;
      continue;
    }
    const imageUrl = await signUrl(row.gallery_image_key);
    if (!imageUrl) {
      withheld += 1;
      continue;
    }
    renders.push({
      renderId: row.render_id,
      imageUrl,
      partLabel: poolPartLabel(row.part_id),
      swatches: Array.from({ length: 6 }, (_, i) => hexes[i % hexes.length]!),
    });
  }

  return { renders, withheld, total };
}

/** "The whole look" · "Ceiling" · the raw id only if the registry lost it. */
export function poolPartLabel(partId: string): string {
  if (partId === WHOLE_LOOK_PART_ID) return 'The whole look';
  return renderPartById(partId)?.label ?? partId;
}
