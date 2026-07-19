/**
 * Vendor "On the Day" console — category resolution.
 *
 * The day-of console (route /vendor-dashboard/on-the-day, Phase 7 of the
 * vendor-dashboard reorg) is CATEGORY-CONDITIONAL: what a photographer needs
 * on the wedding day (shot list + run-of-show) is different from what a
 * coordinator needs (the command center: run-of-show + vendor check-in +
 * issues + broadcast), a caterer (final pax / headcount), or a music act
 * (setlist). This module maps the vendor's `services[]` (canonical
 * `WeddingTile` keys, lib/taxonomy.ts) to ONE console kind so the page can
 * switch variants — mirroring the prototype's `odayCat` switch.
 *
 * Free surface — no money, no writes here. Purely a client-side lens over the
 * vendor's own booked events (fetchVendorPoolBookings, already RLS-scoped) +
 * the shared run-of-show timeline they can already read as a booked vendor
 * (event_schedule_blocks_booked_vendor_read, migration 20261130003000).
 *
 * Priority when a vendor carries multiple service categories:
 *   coordinator > photo > caterer > band > general
 * Coordinator wins because the command-center variant is a superset day-of
 * view (they run the whole floor); a coordinator who also shoots photos should
 * land on the command center, not the shot list.
 */

import { isMusicVendor, MUSIC_CANONICALS } from '@/lib/songs';

/** The console variant a vendor's category maps to. */
export type DayOfConsoleKind = 'coordinator' | 'photo' | 'caterer' | 'band' | 'general';

/** Photo / Video / documentary tiles → the shot-list + run-of-show console. */
const PHOTO_CANONICALS: ReadonlySet<string> = new Set([
  'photo_video',
  'editorial',
  'livestream',
]);

/** Food tiles → the pax / headcount console. */
const CATERER_CANONICALS: ReadonlySet<string> = new Set([
  'catering',
  'cake',
  'stations',
]);

/** Coordinator / planner tiles → the command center. */
const COORDINATOR_CANONICALS: ReadonlySet<string> = new Set(['coordinator']);

/**
 * Resolve the day-of console kind from a vendor's `services[]`. Deterministic
 * priority (coordinator > photo > caterer > band); anything else → 'general'.
 * Null/empty services → 'general'.
 */
export function resolveDayOfConsoleKind(
  services: readonly string[] | null | undefined,
): DayOfConsoleKind {
  const svc = services ?? [];
  if (svc.some((s) => COORDINATOR_CANONICALS.has(s))) return 'coordinator';
  if (svc.some((s) => PHOTO_CANONICALS.has(s))) return 'photo';
  if (svc.some((s) => CATERER_CANONICALS.has(s))) return 'caterer';
  if (isMusicVendor(svc)) return 'band';
  return 'general';
}

/**
 * True if a vendor's `services[]` carry a category that the given console kind
 * targets. Used to decide whether a SPECIALIST tool (e.g. the setlist link for
 * a music act, the production-sheet for a caterer) should surface — a tool only
 * shows on services in its matching category.
 */
export function servicesMatchConsoleKind(
  services: readonly string[] | null | undefined,
  kind: DayOfConsoleKind,
): boolean {
  const svc = services ?? [];
  switch (kind) {
    case 'coordinator':
      return svc.some((s) => COORDINATOR_CANONICALS.has(s));
    case 'photo':
      return svc.some((s) => PHOTO_CANONICALS.has(s));
    case 'caterer':
      return svc.some((s) => CATERER_CANONICALS.has(s));
    case 'band':
      return svc.some((s) => MUSIC_CANONICALS.has(s));
    case 'general':
      return true;
  }
}

/** Copy + label for each console variant (brand voice, no jargon). */
export const DAY_OF_CONSOLE_META: Record<
  DayOfConsoleKind,
  { eyebrow: string; blurb: string }
> = {
  coordinator: {
    eyebrow: 'Command center',
    blurb:
      'Run the floor. Follow the live run-of-show, keep the vendors moving, and keep a clean record of anything that comes up on the day.',
  },
  photo: {
    eyebrow: 'Shot list & run-of-show',
    blurb:
      'Everything you need behind the lens — your must-get shots for the day, checked off as you go, against the couple’s live timeline.',
  },
  caterer: {
    eyebrow: 'Final headcount',
    blurb:
      'The numbers that decide your prep — attending pax and meal splits, pulled live from the couple’s RSVPs.',
  },
  band: {
    eyebrow: 'Setlist',
    blurb:
      'Your set for the day — the songs you play, ready against the couple’s requests so you go on knowing the room.',
  },
  general: {
    eyebrow: 'On the day',
    blurb:
      'Your day-of view — the events you’re booked on, their live run-of-show, and a quick way into each couple’s brief.',
  },
};
