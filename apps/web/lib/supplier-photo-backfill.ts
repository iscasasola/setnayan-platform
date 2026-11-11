/**
 * THE BACKFILL PLAN — every supplier photo that is PUBLIC today but has no
 * private clean copy, i.e. was published before the Seal and plate existed
 * (owner-approved 2026-11-04: "Existing photos are re-marked" · Build 6 Lane L).
 *
 * A photo is "paired" when `supplier_photo_originals` holds a row for its exact
 * public ref — every marked upload writes one (`photoMark('pair')` in the browser
 * door, `publishMarkedSupplierPhoto` on the server). An unpaired public ref under
 * the shop's own `vendors/<shop>/` folder is therefore an UNMARKED photo, and the
 * backfill marks it in place (same key, so no referencing column changes),
 * keeping its current bytes as the clean copy.
 *
 * Pure: the script (`scripts/remark-supplier-photos.ts`) and its guard share it.
 * Nothing here reads or writes storage.
 */

import { formatCount } from './format-number';

/** The display columns that publish a supplier photo, as the script reads them. */
export const SUPPLIER_PHOTO_COLUMNS = [
  'vendor_profiles.portfolio_r2_keys',
  'vendor_profiles.microsite_hero_photo_key',
  'vendor_services.primary_photo_r2_key',
  'vendor_services.showcase_photo_r2_keys',
  'vendor_services.showcase_video_r2_key',
  'vendor_ig_media.r2_key',
  'vendor_ig_media.thumbnail_r2_key',
] as const;
export type SupplierPhotoColumn = (typeof SUPPLIER_PHOTO_COLUMNS)[number];

export type PhotoRefRow = { vendor_profile_id: string; column: SupplierPhotoColumn; ref: string | null };

export type BackfillItem = { vendor_profile_id: string; ref: string; key: string; columns: SupplierPhotoColumn[] };

export type BackfillPlan = {
  /** Unpaired public PHOTOS in the shop's own folder — the backfill marks these. */
  photos: BackfillItem[];
  /** Unpaired public CLIPS — a clip cannot be re-burned on the server; the shop re-uploads it (reported, never touched). */
  clips: BackfillItem[];
  /** Refs already paired (marked) — nothing to do. */
  paired: number;
  /** Refs outside `r2://setnayan-media/vendors/<that shop>/` (a legacy URL, another lane) — reported, never touched. */
  foreign: number;
};

const MEDIA_PREFIX = 'r2://setnayan-media/';
const CLIP = /\.(mp4|mov|m4v|webm)$/i;

/** Plan the backfill from every display ref and the set of refs already paired. Each ref is planned ONCE. */
export function planSupplierPhotoBackfill(rows: readonly PhotoRefRow[], pairedRefs: ReadonlySet<string>): BackfillPlan {
  const byRef = new Map<string, BackfillItem>();
  let paired = 0;
  let foreign = 0;
  const seenPaired = new Set<string>();
  const seenForeign = new Set<string>();
  for (const row of rows) {
    const ref = row.ref?.trim();
    if (!ref) continue;
    if (pairedRefs.has(ref)) {
      if (!seenPaired.has(ref)) {
        seenPaired.add(ref);
        paired += 1;
      }
      continue;
    }
    const key = ref.startsWith(MEDIA_PREFIX) ? ref.slice(MEDIA_PREFIX.length) : null;
    if (!key || !key.startsWith(`vendors/${row.vendor_profile_id}/`) || key.includes('..')) {
      if (!seenForeign.has(ref)) {
        seenForeign.add(ref);
        foreign += 1;
      }
      continue;
    }
    const had = byRef.get(ref);
    if (had) {
      if (!had.columns.includes(row.column)) had.columns.push(row.column);
      continue;
    }
    byRef.set(ref, { vendor_profile_id: row.vendor_profile_id, ref, key, columns: [row.column] });
  }
  const photos: BackfillItem[] = [];
  const clips: BackfillItem[] = [];
  for (const item of byRef.values()) {
    const isClip = CLIP.test(item.key) || item.columns.includes('vendor_services.showcase_video_r2_key');
    if (isClip) clips.push(item);
    else photos.push(item);
  }
  return { photos, clips, paired, foreign };
}

/** The dry run's report: counts only, per column and per shop. */
export function describeBackfill(plan: BackfillPlan, pendingRemarks: number): string[] {
  const perColumn = new Map<string, number>();
  const perShop = new Map<string, number>();
  for (const p of plan.photos) {
    for (const c of p.columns) perColumn.set(c, (perColumn.get(c) ?? 0) + 1);
    perShop.set(p.vendor_profile_id, (perShop.get(p.vendor_profile_id) ?? 0) + 1);
  }
  return [
    `already marked (paired): ${formatCount(plan.paired)}`,
    `unmarked photos to mark: ${formatCount(plan.photos.length)}`,
    ...[...perColumn].map(([c, n]) => `  ${c}: ${formatCount(n)}`),
    ...[...perShop].map(([s, n]) => `  shop ${s}: ${formatCount(n)}`),
    `unmarked clips (need a re-upload, not touched): ${formatCount(plan.clips.length)}`,
    `refs outside the shop's own folder (not touched): ${formatCount(plan.foreign)}`,
    `marked photos whose shop changed Verified (re-mark): ${formatCount(pendingRemarks)}`,
  ];
}
