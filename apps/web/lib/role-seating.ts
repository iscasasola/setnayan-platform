/**
 * lib/role-seating.ts — WHO SITS TOGETHER WHEN AUTO ARRANGE SEATS THE ROOM.
 *
 * ⚖ Owner, 2026-09-30 (DECISION_LOG "AUTO-SEAT: SPONSORS TOGETHER, BOTH
 * FAMILIES TOGETHER, THEN GROUPS"): *"All principal sponsors sit in the same
 * table. same goes to immediate family. they sit together both sides. then the
 * rest will be assigned via group."*
 *
 * ⚖ And the same day ("AUTO-SEAT: THE COUPLE CHOOSES, PER ROLE, 'SIT TOGETHER'
 * OR 'SIT WITH THEIR GROUP'"): *"we also have an option to group roles. in case
 * we want all groomsmen and bridesmaid to sit together. or we let them join the
 * other seats of the same group as them"*.
 *
 * So each ROLE SET below has one two-way choice:
 *   · 'together' — everyone holding one of its roles sits at ONE table; if they
 *     outnumber a table, the fewest NEIGHBOURING tables, never scattered.
 *   · 'group'    — they are seated with their own guest group like anybody else.
 * Every set defaults to 'together' (the owner's rule for sponsors and family,
 * and his default for the crews).
 *
 * 🔑 KEYED BY ROLE, NAMED IN THE COUPLE'S WORDS. `guests.role` decides who is in
 * a set; `events.role_names` only decides what the toggle SAYS ("Bride's Crew &
 * Groom's Crew"). A rename never moves anybody.
 *
 * Stored on `event_floor_plan.role_seating` (jsonb, beside `priority_order`):
 * `{ [key]: 'together' | 'group' }`. NULL / a missing key / junk = 'together'.
 *
 * Pure. No I/O, no React, no imports — read by the server actions AND the
 * seat-plan panel.
 */
// 🔒 NO IMPORTS, deliberately. The seat-plan editor (a lazy client chunk)
// imports this file; pulling the role-word modules in from here re-shuffled
// webpack's shared split chunks and grew the always-loaded runtime past the
// 202KB shared budget (2026-09-30). The toggle LABELS need the couple's role
// words, so they live in lib/role-seating-labels.ts and are made on the server.

export type RoleSeatingKey =
  | 'principal_sponsors'
  | 'immediate_family'
  | 'wedding_party'
  | 'secondary_sponsors'
  | 'bearers_flower_girl';

export type RoleSeatingChoice = 'together' | 'group';

/** A sanitised `event_floor_plan.role_seating`: only the keys the couple set. */
export type RoleSeating = Partial<Record<RoleSeatingKey, RoleSeatingChoice>>;

/**
 * The role sets, in the order Auto Arrange seats them within a priority tier
 * (sponsors, then both families — the owner's order) and the order the panel
 * lists them. `principal_sponsor` is retired from every picker but a row that
 * still holds it must still sit with the sponsors (see role-sets.ts).
 */
export const ROLE_SEATING_SETS: ReadonlyArray<{ key: RoleSeatingKey; roles: readonly string[] }> = [
  {
    key: 'principal_sponsors',
    roles: ['principal_sponsor_ninong', 'principal_sponsor_ninang', 'principal_sponsor'],
  },
  {
    key: 'immediate_family',
    roles: ['bride_parents', 'groom_parents', 'bride_immediate_family', 'groom_immediate_family'],
  },
  {
    key: 'wedding_party',
    roles: ['maid_of_honor', 'matron_of_honor', 'bridesmaid', 'best_man', 'best_woman', 'groomsman'],
  },
  {
    key: 'secondary_sponsors',
    roles: ['candle_sponsor', 'veil_sponsor', 'cord_sponsor', 'coin_sponsor'],
  },
  {
    key: 'bearers_flower_girl',
    roles: ['ring_bearer', 'bible_bearer', 'coin_bearer', 'flower_girl'],
  },
];

const SET_OF_ROLE = new Map<string, RoleSeatingKey>(
  ROLE_SEATING_SETS.flatMap((s) => s.roles.map((r) => [r, s.key] as const)),
);
const KEYS = new Set<string>(ROLE_SEATING_SETS.map((s) => s.key));

/** Which role set a guest role belongs to, or null (seated by group). */
export function roleSeatingSetOf(role: string): RoleSeatingKey | null {
  return SET_OF_ROLE.get(role) ?? null;
}

/** The couple's choice for one set — 'together' unless they switched it. */
export function roleSeatingChoice(
  seating: RoleSeating | null | undefined,
  key: RoleSeatingKey,
): RoleSeatingChoice {
  return seating?.[key] === 'group' ? 'group' : 'together';
}

/**
 * Read a stored `role_seating` value. Stored jsonb is not a promise about
 * shape: an unknown key or a value other than the two choices is DROPPED (and
 * therefore reads as 'together'), never repaired into something else.
 */
export function parseRoleSeating(raw: unknown): RoleSeating {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: RoleSeating = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (KEYS.has(k) && (v === 'together' || v === 'group')) out[k as RoleSeatingKey] = v;
  }
  return out;
}

/**
 * The sets this event can use — those with at least one role the event's role
 * set offers (a Muslim wedding has no principal sponsors, a birthday none of
 * these). `offered` is `RoleSet.offeredRoles`.
 */
export function roleSeatingSetsFor(offered: readonly string[]): RoleSeatingKey[] {
  const has = new Set(offered);
  return ROLE_SEATING_SETS.filter((s) => s.roles.some((r) => has.has(r))).map((s) => s.key);
}
