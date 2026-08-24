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
 * ⚖ NARROWED 2026-08-25 (owner: the guest list is the host's, "and coordinator
 * (by request)"). That tail is now reachable ONLY by a row carrying no `areas`
 * map.
 *
 * 🛑 AND THE SENTENCE THAT USED TO SIT HERE WAS WRONG. It called a row with no
 * `areas` map "the legacy shape, written before `areas` existed". The couple's
 * own host-invite door MINTS ONE TODAY: `hosts/actions.ts` writes a bare
 * `PERMISSION_TEMPLATES[role]` for every role except the coordinator, and not
 * one of those eighteen templates carries an `areas` key. So "no map" means
 * "invited as a host, never narrowed" — a live shape, not a fossil. The
 * fallback is right for them; the description was not, and the applied
 * migration carries the same wrong sentence where it can no longer be edited. Once a row has
 * an `areas` map it has been answered area by area, and an area missing from
 * it resolves to nothing rather than to a flag the host never set. Measured
 * before the change on the one external planner in production, granted
 * `{ seat_plan: 'view' }`: the fallback was handing them five more areas,
 * the guest list among them.
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
 * EVERY AREA THIS ROW HOLDS RIGHT NOW, WRITTEN OUT IN FULL.
 *
 * 🚨 THIS EXISTS BECAUSE A GRANT BUTTON BECAME A WITHDRAWAL ON 2026-08-25.
 * Four call sites edit one area of an existing grant by spreading
 * `{ ...(perms.areas ?? {}) }` and setting a single key. On a row that had NO
 * `areas` map that writes a map containing exactly ONE area — and since the
 * narrowing landed the same day, every area missing from a map now resolves to
 * nothing. So the couple pressing "Allow event photos" on a ninong's row, or on
 * their own partner's, silently took away the guest list, the seat plan, the
 * schedule, the suppliers, the invitations and the mood board. Before the
 * narrowing that write was harmless, which is exactly why nobody re-read it.
 *
 * 🔑 THE FIX IS TO MATERIALISE, NOT TO EXEMPT. Widening the resolver back would
 * undo the owner's ruling. Instead, before changing one area, write down what
 * the row already resolves to for ALL of them — the answer is identical to what
 * they hold today, so nothing changes hands — and then change the one line. An
 * implicit grant becomes an explicit one, and the map stops being a cliff.
 *
 * ⚖ IT FREEZES THE ROW AGAINST FUTURE AREAS, AND THAT IS THE SAFE DIRECTION. A
 * new area added later will not be inherited by a materialised row. `photos`
 * shipped exactly that way, deliberately fail-closed, for the same reason.
 */
export function materializeAreas(
  perms: ModeratorPermissions,
): Partial<Record<DelegateArea, AreaLevel>> {
  const out: Partial<Record<DelegateArea, AreaLevel>> = {};
  for (const area of DELEGATE_AREAS) out[area] = resolveAreaLevel(perms, area);
  return out;
}

/**
 * Change ONE area of a grant without disturbing the others.
 *
 * The only safe way to edit an `areas` map, and the reason it is a function
 * rather than a spread at four call sites: the four had drifted into the same
 * one-line shape and all four were wrong in the same way.
 */
export function withArea(
  perms: ModeratorPermissions,
  area: DelegateArea,
  level: AreaLevel,
): ModeratorPermissions {
  return { ...perms, areas: { ...materializeAreas(perms), [area]: level } };
}

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
  // 🔑 AN `areas` MAP THAT DOES NOT NAME THIS AREA IS A NO, NOT A GAP.
  // The host answers a coordinator's request line by line, and every grant
  // written since that door opened carries an `areas` map. An area missing
  // from it is a line the host did not grant — inheriting it from a legacy
  // flag hands over exactly what they withheld. Measured on the one external
  // planner live in production, granted `{ seat_plan: 'view' }` and nothing
  // else: the fallback below was also giving them the guest list, the
  // schedule, the suppliers and the invitations.
  //
  // ⚠ ONLY rows carrying NO `areas` map at all keep the fallback — those are
  // the couple's own host rows, written before `areas` existed. Removing it
  // for them would lock a groom out of his own wedding.
  if (perms.areas) return null;
  if (area === 'budget') return perms.checkout ? 'view' : null;
  if (area === 'mood_board') return 'view';
  // 🚨 NON-OPTIONAL. The tail below still FAILS OPEN — but only now for a row
  // with NO `areas` map at all (the couple's own host rows), because the guard
  // above returns for every row that has one. Any delegate with `edit_all` and
  // no `areas` key gets 'edit'. Adding 'photos' to the union without this line would have
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

