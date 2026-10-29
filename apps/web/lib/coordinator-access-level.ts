/**
 * lib/coordinator-access-level.ts — 🔑 THE HOSTS PICK THEIR COORDINATOR'S ACCESS, ON HOME: LIMITED OR FULL.
 *
 * Owner, verbatim, 2026-10-29: *"Once the coordinator accepts, and connected to the event. The event should show to
 * pick what kind of access do we want to give the coordinator. On the home."* · *"So we just do the 2 limited and all
 * access. Not the guided one so nothing to build."* · *"Since our coordinator is already booked and they connected
 * already, that command should initiate"* (DECISION_LOG "ONLY TWO LEVELS — LIMITED AND FULL").
 *
 * NOTHING NEW UNDERNEATH — each level IS a seat the event already has:
 *   · LIMITED = the limited helper's grant: view every part, change nothing (`LIMITED_AREAS`, the same areas
 *     `setGuestAccess` writes for a "Limited helper"), on the coordinator's own seat (`wedding_planner_external`);
 *   · FULL    = the CO-HOST seat (`role_subtype = 'co_host'` → `sync_delegate_membership` makes her a `couple`
 *     member — Event Hub Apply, schedules, guest list, seat plan), with the co-host template.
 *
 * 🏷 "NOT CHOSEN YET" IS A RECORDED ANSWER, NEVER A GUESS. The hosts' answer is written into the seat's own
 * `permissions_json` as `access_level` ('limited' | 'full') — a key NO existing seat carries, so every connected
 * coordinator seat (the live one included, whatever narrow `areas` map it holds, e.g. `{"seat_plan":"view"}`) asks
 * ONCE. No column, no migration, no backfill. The seat's state BEFORE the answer is kept beside it (`prior`) — the
 * server's own copy, so Undo restores exactly what was there and the client never hands back a permission map.
 *
 * PURE — the write lives in `setDelegateArea` (`app/dashboard/[eventId]/hosts/actions.ts`), which this file feeds.
 */
import { DELEGATE_AREAS, type DelegateArea, type ModeratorPermissions } from './delegate-areas';

/**
 * The two seats' shipped templates (`PERMISSION_TEMPLATES` in `lib/event-moderators.ts`, a server-only module) —
 * handed in by the action, so this file stays importable by the Home card and the tests.
 */
export type LevelTemplates = { co_host: ModeratorPermissions; wedding_planner_external: ModeratorPermissions };

export const COORDINATOR_ROLE = 'wedding_planner_external';
export const COHOST_ROLE = 'co_host';

export type CoordinatorAccessLevel = 'limited' | 'full';
export const COORDINATOR_ACCESS_LEVELS: readonly CoordinatorAccessLevel[] = ['limited', 'full'];

/** The pseudo-area `setDelegateArea` takes for this answer (one existing action, no new route). */
export const ACCESS_LEVEL_AREA = 'access_level';
/** …and its third choice: put the seat back the way it was before the answer. */
export const ACCESS_LEVEL_UNDO = 'undo';

/**
 * The words — each choice's title + ONE short line (owner 2026-10-29, verbatim: *"Limited — 'Can see your event; changes
 * only what you allow'"* · *"Full access — 'Same as you: Event Hub, schedule, guests, seats'"*); the rest behind the ⓘ
 * (`LEVEL_MORE`).
 */
export const LEVEL_WORD: Readonly<Record<CoordinatorAccessLevel, string>> = { limited: 'Limited', full: 'Full access' };
export const LEVEL_LINE: Readonly<Record<CoordinatorAccessLevel, string>> = {
  limited: 'Can see your event; changes only what you allow',
  full: 'Same as you: Event Hub, schedule, guests, seats',
};
/** What each level does in full — the ⓘ, never on the row. True to `levelWrite` below. */
export const LEVEL_MORE: Readonly<Record<CoordinatorAccessLevel, string>> = {
  limited:
    'They can open every part of your event to see it and change nothing, until you allow a part in Event details › Access.',
  full:
    'They take a co-host seat: they apply Event Hub changes and edit the schedule, the guest list and the seat plan, as you do. They can’t remove a host.',
};

/** What the seat looked like before the hosts answered (kept inside the answer, for Undo). */
export type SeatSnapshot = { role_subtype: string; permissions_json: ModeratorPermissions | null };

/** `permissions_json` with the answer recorded — the shape this file reads and writes. */
export type LevelledPermissions = ModeratorPermissions & { access_level?: CoordinatorAccessLevel; prior?: SeatSnapshot };

export type LevelSeat = {
  role_subtype: string | null;
  user_id: string | null;
  accepted_at: string | null;
  removed_at: string | null;
  permissions_json: LevelledPermissions | null;
};

/** The view-only grant, every part — the limited helper's (`setGuestAccess`'s VIEW_ONLY areas). */
export const LIMITED_AREAS: Readonly<Partial<Record<DelegateArea, 'view'>>> = Object.fromEntries(
  DELEGATE_AREAS.map((a) => [a, 'view' as const]),
) as Partial<Record<DelegateArea, 'view'>>;

/** The answer recorded on this seat, or null (never asked). */
export function levelOf(seat: Pick<LevelSeat, 'permissions_json'>): CoordinatorAccessLevel | null {
  const v = seat.permissions_json?.access_level;
  return v === 'limited' || v === 'full' ? v : null;
}

/**
 * Does Home ask the hosts about THIS seat? A coordinator's seat (`wedding_planner_external`) that is CONNECTED (her
 * account on it, accepted, not removed) and carries no recorded answer. A seat still waiting for her says nothing yet.
 */
export function seatAsksForLevel(seat: LevelSeat): boolean {
  return (
    seat.role_subtype === COORDINATOR_ROLE &&
    !!seat.user_id &&
    !!seat.accepted_at &&
    !seat.removed_at &&
    levelOf(seat) === null
  );
}

/**
 * The write for an answer: the seat's new kind and grant, with the answer and the seat-as-it-was recorded. Answering
 * again (changing Limited ↔ Full) keeps the FIRST snapshot, so Undo always goes back to before the hosts were asked.
 */
export function levelWrite(level: CoordinatorAccessLevel, now: SeatSnapshot, templates: LevelTemplates): SeatSnapshot {
  const current = (now.permissions_json ?? null) as LevelledPermissions | null;
  const prior: SeatSnapshot = current?.prior ?? { role_subtype: now.role_subtype, permissions_json: stripAnswer(current) };
  if (level === 'full') {
    return {
      role_subtype: COHOST_ROLE,
      permissions_json: { ...templates.co_host, access_level: 'full', prior } as LevelledPermissions,
    };
  }
  return {
    role_subtype: COORDINATOR_ROLE,
    permissions_json: {
      ...templates.wedding_planner_external,
      edit_all: false,
      checkout: false,
      invite_hosts: false,
      remove_hosts: false,
      areas: { ...LIMITED_AREAS },
      access_level: 'limited',
      prior,
    } as LevelledPermissions,
  };
}

/** Undo: the seat exactly as it was before the hosts answered — or null when there is nothing to go back to. */
export function undoWrite(now: SeatSnapshot): SeatSnapshot | null {
  const prior = (now.permissions_json as LevelledPermissions | null)?.prior;
  return prior ? { role_subtype: prior.role_subtype, permissions_json: prior.permissions_json } : null;
}

function stripAnswer(p: LevelledPermissions | null): ModeratorPermissions | null {
  if (!p) return null;
  const { access_level: _a, prior: _p, ...rest } = p;
  void _a;
  void _p;
  return rest as ModeratorPermissions;
}

/**
 * ☀ "<shop> joined as your coordinator" — the ask's line in Home's Today list (owner 2026-10-29: *"names the
 * coordinator (their SHOP name … never the bare word 'coordinator')"*). The SHOP is the subject; only when no shop
 * name could be read at all (`coordinator-level-card.tsx` tries the seat's label, the shop, the shop's request and its
 * booking, in that order) does it fall back — and then it still says who joined, never a bare role word.
 */
export function levelTodayWords(shop: string | null | undefined): string {
  const n = shop?.trim();
  return n ? `${n} joined as your coordinator` : 'A supplier joined as your coordinator';
}
