/**
 * library-views.ts — the Memories page's views, and which one a URL opens.
 *
 * ONE RULE, TWO READERS (2026-09-21). The page draws these as chips; the
 * desktop rail draws the same list as rows when you are inside Memories
 * (owner: *"when we enter an Event sidebar will collapse focusing on just
 * everything needed for that event … same concept when on memories, people,
 * shop, and admin"*). Both import `resolveLibraryView`, so the row the rail
 * lights and the view the page renders cannot disagree — including for the
 * legacy `?tab=photos` an email already in people's inboxes still sends.
 */
import { Images, Heart, Newspaper } from 'lucide-react';

/** The Alaala tile's five lenses, in the tile's own order. */
export const LENS_KEYS = ['recent', 'owned', 'attended', 'people', 'with_me'] as const;
/**
 * Reachable, deliberately NOT lenses.
 *
 * `albums` is the per-event grid this page used to answer three of the five
 * lenses with. It is a real job — opening one celebration and downloading all
 * of it — but it is a LIST OF EVENTS, and a list of events is the board's
 * answer, not Alaala's. It keeps its door; it stops being the memory.
 */
export const KEPT_KEYS = ['albums', 'editorials', 'vendors'] as const;

export type LensKey = (typeof LENS_KEYS)[number];
export type KeptKey = (typeof KEPT_KEYS)[number];
export type ViewKey = LensKey | KeptKey;

export const ALL_KEYS: readonly ViewKey[] = [...LENS_KEYS, ...KEPT_KEYS];

export function isLens(view: ViewKey): view is LensKey {
  return (LENS_KEYS as readonly string[]).includes(view);
}

/**
 * Legacy `?tab=` values, kept working forever. `?tab=photos` is still sent by
 * `lib/daily-email-jobs.ts` (a real email already in people's inboxes) and was
 * the first tab of the old hub; it is the Recent lens now.
 */
export const LEGACY_TAB: Record<string, ViewKey> = {
  photos: 'recent',
};

export const LENSES: { key: LensKey; label: string }[] = [
  { key: 'recent', label: 'Recent' },
  { key: 'owned', label: 'Owned' },
  { key: 'attended', label: 'Attended' },
  { key: 'people', label: 'People' },
  { key: 'with_me', label: 'With me' },
];

export const KEPT: { key: KeptKey; label: string; Icon: typeof Images }[] = [
  { key: 'albums', label: 'Albums by event', Icon: Images },
  { key: 'editorials', label: 'Editorials', Icon: Newspaper },
  { key: 'vendors', label: 'Saved vendors', Icon: Heart },
];

/** The view a `?tab=` value opens. Unknown or absent → Recent. */
export function resolveLibraryView(tab: string | null | undefined): ViewKey {
  const requested = LEGACY_TAB[tab ?? ''] ?? tab;
  return ALL_KEYS.includes(requested as ViewKey) ? (requested as ViewKey) : 'recent';
}
