/**
 * event-memories-words.ts — the two lines an event's Memories says about itself (owner 2026-10-23, the approved
 * `prototypes/event_bar_memories_tab_2026-10-23.html` frame 3 / `papic_controller_one_page_2026-10-23.html`
 * `galleryCard`): the count at the top ("1,284 photos") and, in the foot line, where the cameras are
 * ("opens in 51 days" · "cameras open now" · "cameras closed"). Pure — `event-memories-words.test.ts`.
 */
import { formatCount } from '@/lib/format-number';

export function memoriesCountWords(n: number): string {
  return `${formatCount(n)} ${n === 1 ? 'photo' : 'photos'}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Where the cameras are, from the stored (or default) capture window. Null when the window cannot be read. */
export function memoriesCameraWords({
  startIso,
  endIso,
  now,
}: {
  startIso: string | null | undefined;
  endIso: string | null | undefined;
  now: number;
}): string | null {
  const start = startIso ? Date.parse(startIso) : NaN;
  const end = endIso ? Date.parse(endIso) : NaN;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (now >= end) return 'cameras closed';
  if (now >= start) return 'cameras open now';
  const days = Math.ceil((start - now) / DAY_MS);
  return days <= 1 ? 'opens tomorrow' : `opens in ${formatCount(days)} days`;
}

/**
 * 🔑 A REFUSED READ IS NEVER AN EMPTY GALLERY. The photo read answers a refusal with `[]`, so an empty page only
 * means "nothing yet" when the count beside it read 0. No count (null), or a count above zero over an empty list,
 * is "couldn't load".
 */
export function memoriesUnreadable(shown: number, total: number | null): boolean {
  return shown === 0 && (total === null || total > 0);
}
