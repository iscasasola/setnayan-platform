/**
 * 🏷 A SUPPLIER TAGS ITS EVENT PHOTOS TO INSPIRATIONS — pure rules (DECISION_LOG 2026-11-14, "A SUPPLIER TAGS ITS EVENT
 * PHOTOS TO INSPIRATIONS"; prototype `prototypes/inspiration_tags_2026-11-14_fable.html`).
 *
 * A tag IS the shipped inspiration record (`moodboard_library_assets`, supplier_gallery, the part in asset_subtype) made
 * from a Files photo (`event_file_id`, migration 20271345380761). Plain data and words only — no client, no DOM — so the
 * Files board, the action and the tests read ONE copy of each rule.
 */
import { formatCount } from '@/lib/format-number';
import type { ShopState } from '@/lib/supplier-files';

/**
 * Where a tag stands, as the SUPPLIER reads it (the prototype's state table). Couples and visitors see the photo ONLY
 * in `shown`; every other state leaves no trace for them (frame 11).
 */
export type TagState = 'checking' | 'waiting' | 'shown' | 'refused' | 'private';

/** One tag on one Files photo — plain data, crosses to the client. */
export type FileTag = {
  assetId: string;
  fileId: string;
  slotKey: string;
  label: string;
  state: TagState;
  /** The check's reason, for `refused` only. */
  reason: string | null;
};

/** One inspiration a service card offers — plain data. */
export type OfferedPart = { slotKey: string; label: string };

/**
 * The tag's state from its row and its photo (in the table's order): refused by the check → not approved yet (Checking)
 * → the photo itself is kept private (its couple hid it, or it is outside the event's dates) → shown on the shop →
 * otherwise still waiting on the shop.
 */
export function tagStateOf(
  row: { approved_at: string | null; rejected_at: string | null },
  photo: { listed: boolean; shopState: ShopState | null },
): TagState {
  if (row.rejected_at) return 'refused';
  if (!row.approved_at) return 'checking';
  if (photo.listed) return 'shown';
  if (photo.shopState === 'hidden' || photo.shopState === 'outside' || photo.shopState === 'linked') return 'private';
  return 'waiting';
}

/** The two words on a tag's line: the short pill, and the sentence beside the part (frame 5). */
export function tagStateWords(t: Pick<FileTag, 'state' | 'reason'>): { pill: string; line: string } {
  switch (t.state) {
    case 'checking':
      return { pill: 'Checking', line: 'Setnayan is checking it' };
    case 'waiting':
      return { pill: 'Waiting', line: 'Shows when this photo is shown on your shop' };
    case 'shown':
      return { pill: 'Shown', line: 'Couples can see it' };
    case 'refused':
      return { pill: 'Not published', line: `We couldn’t publish this${t.reason ? `: ${t.reason}` : ''}` };
    case 'private':
      return { pill: 'Private', line: 'Kept private, so not in inspiration' };
  }
}

/** The line under the list (frame 5) — the photo stays in Files whatever happens to a tag. */
export const UNTAG_LINE = 'Swipe an inspiration left to remove it. Removing a tag takes the photo out of that inspiration; the photo stays in Files.';
/** Frame 3's note — the inspiration points at this same photo. */
export const BY_REFERENCE_LINE = 'The photo is not copied. The inspiration points to this same photo.';
/** Frame 4's note — one service at a time, so the list fits every picked photo. */
export const ONE_SERVICE_LINE = 'Pick photos from one service at a time, so the list of inspirations fits them all.';

/** "Tag to 2 inspirations" — the sheet's main button. */
export function tagButtonWords(parts: number): string {
  if (parts <= 0) return 'Pick an inspiration';
  return parts === 1 ? 'Tag to 1 inspiration' : `Tag to ${formatCount(parts)} inspirations`;
}

/** "none yet" · "2 picked" — the ▾'s own words. */
export function pickedWords(n: number): string {
  return n === 0 ? 'none yet' : `${formatCount(n)} picked`;
}

/** The count a tagged tile wears (frame 1): only live tags count — a retired one is gone. */
export function tagCountsByFile(tags: readonly Pick<FileTag, 'fileId'>[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of tags) out[t.fileId] = (out[t.fileId] ?? 0) + 1;
  return out;
}

/**
 * The parts a card offers that this photo is NOT already tagged to — the ▾'s choices. In the order the card offers
 * them.
 */
export function partsLeftToTag(offered: readonly OfferedPart[], tags: readonly Pick<FileTag, 'slotKey'>[]): OfferedPart[] {
  const have = new Set(tags.map((t) => t.slotKey));
  return offered.filter((p) => !have.has(p.slotKey));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/**
 * Ruling (4): the public sees the event as TYPE · VENUE · MONTH — never a name, never an id. Each part is dropped when
 * unknown rather than invented ("Wedding · Sep 2026" when the venue is not set). `null` when nothing is known.
 */
export function eventLineWords(input: { typeLabel: string | null; venue: string | null; month: string | null }): string | null {
  const m = input.month ? /^(\d{4})-(\d{2})/.exec(input.month) : null;
  const month = m ? `${MONTHS[Number(m[2]) - 1] ?? ''} ${m[1]}`.trim() : null;
  const words = [input.typeLabel?.trim() || null, input.venue?.trim() || null, month].filter((x): x is string => Boolean(x));
  return words.length ? words.join(' · ') : null;
}

/** One inspiration a tagged Files photo is in — plain data. */
export type TagPart = { slotKey: string; label: string };
/** An album's inspirations with a count (frame 6 chips · frame 7 "In inspiration" row), in first-seen order. */
export type AlbumInspiration = TagPart & { count: number };

/**
 * Frames 6–7: which inspirations an album's photos are in, with how many photos each. Only Files photos can be tagged
 * (an album photo's key is `files:<file id>`); a Papic album photo never is. Pure — the pages hand in the tags they read.
 */
export function albumInspirations(photoKeys: readonly string[], tagsByFile: ReadonlyMap<string, readonly TagPart[]>): AlbumInspiration[] {
  const out = new Map<string, AlbumInspiration>();
  for (const key of photoKeys) {
    if (!key.startsWith('files:')) continue;
    for (const t of tagsByFile.get(key.slice('files:'.length)) ?? []) {
      const cur = out.get(t.slotKey);
      if (cur) cur.count += 1;
      else out.set(t.slotKey, { ...t, count: 1 });
    }
  }
  return [...out.values()];
}

/** "Bridal bouquet · 2" — one chip's words. */
export function inspirationChipWords(i: AlbumInspiration): string {
  return `${i.label} · ${formatCount(i.count)}`;
}
