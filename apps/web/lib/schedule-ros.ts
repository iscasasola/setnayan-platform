/**
 * Coordinator P2 — filtered run-of-show (Coordinator_Whats_Next_2026-07-18 §P2).
 *
 * ONE master timeline (`event_schedule_blocks`) → auto-synced per-vendor /
 * per-couple / per-guest views. The views are pure FILTERS over the master —
 * never copies — so an edit to a master row is instantly visible in every
 * derived view. This module owns:
 *
 *   1. The audience filter (`filterBlocksForAudience`) — couple = master,
 *      guest = existing is_public semantics, vendor = only rows they're
 *      tagged responsible on (plus parent rows for grouping context).
 *   2. Bulk retime (`computeRetimePatches`) — shift a contiguous span of
 *      top-level blocks (and their children) by ±N minutes in one action;
 *      the classic "ceremony ran 30 minutes late → cascade everything after".
 *   3. The best-effort responsible-party meta fetch (`fetchBlockRosMeta`) —
 *      kept SEPARATE from lib/schedule.ts' canonical SELECT so every existing
 *      surface is untouched, and so surfaces degrade gracefully before
 *      migration 20270825042743 lands in prod (missing columns → empty map,
 *      never a crashed page).
 *
 * Access model (unchanged by P2): couple + coordinator (moderator with
 * schedule 'edit') hold write via existing RLS; booked vendors keep
 * FULL-timeline read (locked D2) — their filtered slice narrows at the UI
 * layer only; guests keep is_public. Reminders/call-times remain EMAIL-ONLY
 * (no-SMS lock) and are P3's build — nothing here sends anything.
 *
 * Pure TypeScript except the one fetch helper; unit-tested in
 * schedule-ros.test.ts.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/** UI gate for the new P2 surfaces (responsible-party editor, audience lens,
 *  bulk retime, template picker). Default OFF — absent/other = today's
 *  behavior exactly. Owner flips after pushing migration 20270825042743. */
export function isScheduleRosP2Enabled(): boolean {
  return process.env.NEXT_PUBLIC_SCHEDULE_ROS_P2_ENABLED === 'true';
}

// ───────────────────────── responsible-party meta ─────────────────────────

export type BlockRosMeta = {
  responsible_party: string | null;
  responsible_vendor_ids: string[];
};

/** block_id → responsible-party meta. Empty map = feature dark or pre-migration. */
export type RosMetaMap = Map<string, BlockRosMeta>;

export const EMPTY_ROS_META: RosMetaMap = new Map();

/**
 * Best-effort fetch of the P2 columns, keyed by block_id. Deliberately a
 * SECOND query rather than widening lib/schedule.ts' canonical SELECT:
 * pre-migration (columns absent) the error is swallowed and every consumer
 * sees an empty map — existing pages keep rendering exactly as today.
 * RLS scopes rows the same as any schedule read (couple / moderator /
 * booked vendor / anon-public).
 */
export async function fetchBlockRosMeta(
  supabase: SupabaseClient,
  eventId: string,
): Promise<RosMetaMap> {
  const { data, error } = await supabase
    .from('event_schedule_blocks')
    .select('block_id, responsible_party, responsible_vendor_ids')
    .eq('event_id', eventId);
  if (error || !data) return new Map();
  const map: RosMetaMap = new Map();
  for (const row of data as Array<{
    block_id: string;
    responsible_party: string | null;
    responsible_vendor_ids: string[] | null;
  }>) {
    map.set(row.block_id, {
      responsible_party: row.responsible_party ?? null,
      responsible_vendor_ids: row.responsible_vendor_ids ?? [],
    });
  }
  return map;
}

// ───────────────────────────── audience filter ─────────────────────────────

/** The minimal block shape the filter needs — structural subset of
 *  ScheduleBlockRow so both the couple page and the vendor page rows fit. */
export type RosFilterBlock = {
  block_id: string;
  parent_block_id: string | null;
  is_public: boolean;
};

export type RosAudience =
  | { kind: 'couple' }
  | { kind: 'guest' }
  | { kind: 'vendor'; eventVendorId: string };

/** Is this block directly tagged to the given event_vendors.vendor_id? */
export function isBlockTaggedToVendor(
  meta: RosMetaMap,
  blockId: string,
  eventVendorId: string,
): boolean {
  return meta.get(blockId)?.responsible_vendor_ids.includes(eventVendorId) ?? false;
}

/**
 * Derive an audience's view of the master timeline. Preserves the caller's
 * ordering (fetchScheduleBlocks orders by start_at, sort_order).
 *
 *   couple — the master, untouched. The couple (and their coordinator, who
 *            holds couple-parity read) always sees everything.
 *   guest  — rows with is_public = TRUE: byte-identical semantics to the
 *            existing fetchPublicScheduleBlocks / anon RLS policy, expressed
 *            as a pure function so the couple page can PREVIEW the guest view.
 *   vendor — rows the vendor is tagged responsible on, expanded for
 *            coherence: a tagged PARENT pulls in its child parts (you own
 *            "Reception", you see its program), and a tagged CHILD pulls in
 *            its parent row (so the slice keeps its grouping header).
 *
 * Vendors with zero tagged rows get an EMPTY slice from this filter — the
 * calling surface decides the fallback (the vendor Brief keeps its existing
 * category-relevance lens + full timeline per locked D2).
 */
export function filterBlocksForAudience<T extends RosFilterBlock>(
  blocks: readonly T[],
  audience: RosAudience,
  meta: RosMetaMap = EMPTY_ROS_META,
): T[] {
  switch (audience.kind) {
    case 'couple':
      return [...blocks];
    case 'guest':
      return blocks.filter((b) => b.is_public);
    case 'vendor': {
      const tagged = new Set<string>();
      for (const b of blocks) {
        if (isBlockTaggedToVendor(meta, b.block_id, audience.eventVendorId)) {
          tagged.add(b.block_id);
        }
      }
      if (tagged.size === 0) return [];
      const included = new Set<string>();
      for (const b of blocks) {
        const selfTagged = tagged.has(b.block_id);
        const parentTagged = b.parent_block_id !== null && tagged.has(b.parent_block_id);
        if (selfTagged || parentTagged) {
          included.add(b.block_id);
          // A tagged child keeps its parent header for context.
          if (b.parent_block_id !== null) included.add(b.parent_block_id);
        }
      }
      return blocks.filter((b) => included.has(b.block_id));
    }
  }
}

/** Count of rows DIRECTLY tagged to a vendor (no parent/child expansion) —
 *  drives "N rows assigned to you" chrome without re-running the filter. */
export function countVendorTaggedBlocks(
  blocks: readonly RosFilterBlock[],
  eventVendorId: string,
  meta: RosMetaMap,
): number {
  let n = 0;
  for (const b of blocks) {
    if (isBlockTaggedToVendor(meta, b.block_id, eventVendorId)) n += 1;
  }
  return n;
}

// ─────────────────────────────── bulk retime ───────────────────────────────

/** Hard bound on a single shift: ±12 hours. A wedding-day cascade is minutes,
 *  not half a day — anything larger is a typo we refuse to apply. */
export const MAX_RETIME_MINUTES = 12 * 60;

export type RetimeBlock = {
  block_id: string;
  parent_block_id: string | null;
  start_at: string;
  end_at: string | null;
  sort_order: number;
};

export type RetimePatch = {
  block_id: string;
  start_at: string;
  end_at: string | null;
};

/** Top-level rows ordered the way every schedule surface orders them:
 *  start_at ascending, then sort_order. */
function orderedTopLevel<T extends RetimeBlock>(blocks: readonly T[]): T[] {
  return blocks
    .filter((b) => b.parent_block_id === null)
    .sort((a, b) => {
      const at = new Date(a.start_at).getTime();
      const bt = new Date(b.start_at).getTime();
      if (at !== bt) return at - bt;
      return a.sort_order - b.sort_order;
    });
}

/**
 * Select the contiguous span a bulk retime applies to: the anchor top-level
 * block and every top-level block after it (optionally stopping at
 * `toBlockId`, inclusive), plus all children of the selected parents.
 *
 * A child anchor resolves to its parent — you retime the run-of-show at the
 * headline level; parts always travel with their parent. Unknown anchor, or
 * a `toBlockId` that sits BEFORE the anchor, selects nothing (the caller
 * treats an empty span as "nothing to do", never a partial shift).
 */
export function selectRetimeSpan<T extends RetimeBlock>(
  blocks: readonly T[],
  fromBlockId: string,
  toBlockId?: string | null,
): T[] {
  const byId = new Map(blocks.map((b) => [b.block_id, b]));

  const resolveTop = (id: string): string | null => {
    const row = byId.get(id);
    if (!row) return null;
    return row.parent_block_id === null ? row.block_id : (row.parent_block_id ?? null);
  };

  const fromTopId = resolveTop(fromBlockId);
  if (!fromTopId) return [];

  const top = orderedTopLevel(blocks);
  const fromIdx = top.findIndex((b) => b.block_id === fromTopId);
  if (fromIdx === -1) return [];

  let toIdx = top.length - 1;
  if (toBlockId) {
    const toTopId = resolveTop(toBlockId);
    if (!toTopId) return [];
    toIdx = top.findIndex((b) => b.block_id === toTopId);
    if (toIdx === -1 || toIdx < fromIdx) return [];
  }

  const parentIds = new Set(top.slice(fromIdx, toIdx + 1).map((b) => b.block_id));
  // Master order preserved: parents + their children as the caller ordered them.
  return blocks.filter(
    (b) =>
      parentIds.has(b.block_id) ||
      (b.parent_block_id !== null && parentIds.has(b.parent_block_id)),
  );
}

function shiftIso(iso: string, deltaMinutes: number): string {
  return new Date(new Date(iso).getTime() + deltaMinutes * 60_000).toISOString();
}

/**
 * Compute the UPDATE patches for one bulk retime. Both start_at and end_at
 * shift by the same delta, so durations (and the end_at > start_at CHECK)
 * are preserved by construction. Throws on an invalid delta (non-integer,
 * zero, or beyond ±MAX_RETIME_MINUTES); returns [] when the span is empty.
 */
export function computeRetimePatches(
  blocks: readonly RetimeBlock[],
  fromBlockId: string,
  deltaMinutes: number,
  toBlockId?: string | null,
): RetimePatch[] {
  if (!Number.isInteger(deltaMinutes)) {
    throw new Error('Shift must be a whole number of minutes');
  }
  if (deltaMinutes === 0) {
    throw new Error('Shift must be non-zero');
  }
  if (Math.abs(deltaMinutes) > MAX_RETIME_MINUTES) {
    throw new Error(`Shift is capped at ±${MAX_RETIME_MINUTES} minutes`);
  }
  const span = selectRetimeSpan(blocks, fromBlockId, toBlockId);
  return span.map((b) => ({
    block_id: b.block_id,
    start_at: shiftIso(b.start_at, deltaMinutes),
    end_at: b.end_at === null ? null : shiftIso(b.end_at, deltaMinutes),
  }));
}
