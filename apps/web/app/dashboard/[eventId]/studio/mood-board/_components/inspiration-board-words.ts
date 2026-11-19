/**
 * The inspiration board's words and counts (owner 2026-11-18, the one-+ drawing) — plain functions, so the test runs
 * them without a browser. The board is `inspiration-board.tsx`.
 */
import { formatCount } from '@/lib/format-number';
import { MOODBOARD_MAX_PHOTOS_PER_SLOT } from '@/lib/moodboard-slots';

export const CAP = MOODBOARD_MAX_PHOTOS_PER_SLOT;

/** The fold that opens by itself (owner pick 2, 18 Nov): Venue & feel open; Palette and Dress codes folded, with counts. */
export const INSPIRATION_OPEN_GROUP = 'Venue & feel';

/**
 * The words under a part's name. "Add photos" · "1 of 3" · "3 of 3 · full" · "· 1 from Bloom & Co." —
 * the count is what is SAVED; a photo still going up is said as "Adding 2 photos…", never counted as saved.
 */
export function partLine(saved: number, uploading: number, credits: readonly string[]): { text: string; full: boolean } {
  if (uploading > 0) return { text: `Adding ${formatCount(uploading)} photo${uploading === 1 ? '' : 's'}…`, full: false };
  if (saved === 0) return { text: 'Add photos', full: false };
  const full = saved >= CAP;
  let text = full ? `${formatCount(CAP)} of ${formatCount(CAP)} · full` : `${formatCount(saved)} of ${formatCount(CAP)}`;
  if (credits.length > 0) {
    const shops = new Set(credits.map((c) => c.split(' · ')[0]));
    text += ` · ${formatCount(credits.length)} from ${shops.size === 1 ? [...shops][0] : 'suppliers'}`;
  }
  return { text, full };
}

/** A group's fold count — "0 of 18" while nothing is in it, then "5 of 18 have photos". */
export function groupCount(withPhotos: number, parts: number): string {
  return withPhotos === 0 ? `0 of ${formatCount(parts)}` : `${formatCount(withPhotos)} of ${formatCount(parts)} have photos`;
}

/** Picked more than the part has room for: the first ones go up, and the row says so. */
export function cutWords(picked: number, added: number): string {
  return `You picked ${formatCount(picked)}. ${formatCount(CAP)} is the most for one part, so we added the first ${formatCount(added)}. Remove one to add another.`;
}
