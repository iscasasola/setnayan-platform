/**
 * delegate-areas.ts — WHAT a host-delegate may touch, and at what level.
 *
 * 🔑 SPLIT OUT OF `event-moderators.ts` ON PURPOSE (2026-08-06). That module
 * starts with `import 'server-only'`, so nothing in it can be imported by a unit
 * test — the existing tests can only take TYPES from it, which are erased at
 * compile time. The permission RULE was therefore untestable, and it is the one
 * thing here that must never be wrong.
 *
 * That mattered immediately: `resolveAreaLevel` FAILS OPEN at its tail, so
 * adding a new area to the union without an explicit branch silently grants it
 * to every delegate carrying `edit_all`. A test now proves it does not.
 *
 * Same posture as `lib/admin/queue-partition.ts`: no imports, so it can be
 * exercised directly rather than by rendering something.
 *
 * ⚠ THIS IS A MIRROR OF `public.moderator_area_level`. The two must agree. Where
 * they differ the database wins at runtime, and the screen has already told the
 * person otherwise — which is worse than either answer alone.
 */

export type DelegateArea =
  | 'guest_list'
  | 'seat_plan'
  | 'schedule'
  | 'vendors'
  | 'invitations'
  | 'mood_board'
  | 'budget'
  | 'photos';

export type AreaLevel = 'edit' | 'view' | null;

export type ModeratorPermissions = {
  edit_all: boolean;
  checkout: boolean;
  invite_hosts: boolean;
  remove_hosts: boolean;
  areas?: Partial<Record<DelegateArea, AreaLevel>>;
};

export const DELEGATE_AREAS: readonly DelegateArea[] = [
  'guest_list',
  'seat_plan',
  'schedule',
  'vendors',
  'invitations',
  'mood_board',
  'budget',
  'photos',
] as const;

export const DELEGATE_AREA_LABEL: Readonly<Record<DelegateArea, string>> = {
  guest_list: 'Guest list',
  seat_plan: 'Seat plan',
  schedule: 'Schedule',
  vendors: 'Vendors',
  invitations: 'Invitations',
  mood_board: 'Mood board',
  budget: 'Budget',
  photos: 'Event photos',
};

// The coordinator's default grants — locked § 3 table: planning areas Edit,
// mood board View (aesthetic direction stays the couple's), budget OFF
// (locked D1 — couple-raiseable to View, never Edit in V1). Seat-plan
// publish + first invitation deploy remain couple-confirmed regardless
// (DB trigger + locked D4).
export const COORDINATOR_AREAS: Readonly<Partial<Record<DelegateArea, AreaLevel>>> = {
  guest_list: 'edit',
  seat_plan: 'edit',
  schedule: 'edit',
  vendors: 'edit',
  invitations: 'edit',
  mood_board: 'view',
  budget: null,
  // Photos are OFF by default and the couple raises them per coordinator
  // (owner 2026-08-06: "they can. but only upon approval"). Written as an
  // explicit null, like budget, so the intent is visible rather than inferred
  // from absence.
  photos: null,
};

/**
 * TS mirror of public.moderator_area_level (migration 20261129000000).
 * areas[k] wins when the key is present; legacy flags fall back. Budget
 * never exceeds 'view' in V1 (locked D1).
 */
export function resolveAreaLevel(
  perms: ModeratorPermissions | null | undefined,
  area: DelegateArea,
): AreaLevel {
  if (!perms) return null;
  if (perms.areas && area in perms.areas) {
    return perms.areas[area] ?? null;
  }
  if (area === 'budget') return perms.checkout ? 'view' : null;
  if (area === 'mood_board') return 'view';
  // 🚨 NON-OPTIONAL, AND THE WHOLE REASON THIS FUNCTION NEEDED TOUCHING.
  // The tail below FAILS OPEN: any delegate with `edit_all` and no explicit key
  // gets 'edit'. Adding 'photos' to the union without this line would have
  // silently handed the couple's guest photos to every existing delegate —
  // including the accepted planner row live in production right now — with no
  // approval, no migration and nothing on screen to show it happened.
  //
  // The SQL twin (`public.moderator_area_level`) already fails CLOSED here: its
  // `ELSE NULL` covers any area not named in its explicit list. This restores
  // the mirror. The two must agree, or the database refuses a read the UI has
  // already told the coordinator they can make.
  if (area === 'photos') return null;
  return perms.edit_all ? 'edit' : 'view';
}

