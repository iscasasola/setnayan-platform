/**
 * lib/coordinator-access-level.ts — 🔁 LIMITED · FULL IS RETIRED (owner 2026-11-21).
 *
 * From 2026-10-29 Home asked the hosts to pick their coordinator's access — Limited (view everything, change nothing)
 * or Full (a CO-HOST seat: a `couple` member, who therefore opened Memories, logged payments and booked suppliers).
 * The owner has ruled (DECISION_LOG 2026-11-21 "COORDINATOR: DUE PAYMENTS VIEWABLE + 'REMIND THE HOSTS', NOT
 * LOGGABLE; ACCESS IS AUTOMATIC", controller call (1), and "BOOKED COORDINATOR — WHAT THEY MAY EDIT VS ONLY VIEW"):
 *
 *   · BOOKED = THE RULED ACCESS, automatically (`COORDINATOR_AREAS`, written by `autoInviteCoordinator`);
 *   · the Limited / Full choice retires — the hosts keep ONE off switch (People with access, `coordinatorSwitchWrites`);
 *   · Memories, paying and booking are never the coordinator's (`coordinatorSeatRefusal` below ·
 *     `coordinatorMoneyScopeAllowed` · `memoriesManagerRoleOf`).
 *
 * Every seat the old choice wrote is put back by migration 20271357113669 (`the_booked_coordinator_is_automatic`):
 * Full → the ruled grant on the coordinator's own seat, Limited → the switch Off. What is left here is the READER of a
 * recorded answer (`levelOf`), kept so a row written before that migration lands is still read the way it was meant,
 * and the one door's retired answer.
 *
 * PURE — no imports beyond the area model. Also home to `LIMITED_AREAS`, the limited helper's grant.
 */
import { DELEGATE_AREAS, type AreaChoice, type DelegateArea, type ModeratorPermissions } from './delegate-areas';

export const COORDINATOR_ROLE = 'wedding_planner_external';

export type CoordinatorAccessLevel = 'limited' | 'full';

/** The pseudo-area the retired answer came through (`setDelegateArea`) — now answered with {@link LEVEL_CHOICE_RETIRED}. */
export const ACCESS_LEVEL_AREA = 'access_level';

/** What the retired door says, and writes nothing. */
export const LEVEL_CHOICE_RETIRED =
  'Limited and Full access are retired. Your booked coordinator has their access automatically; you can switch it off in People with access.';

/** The view-only grant, every part — the LIMITED HELPER's (`setGuestAccess`'s VIEW_ONLY areas). Not a coordinator's. */
export const LIMITED_AREAS: Readonly<Partial<Record<DelegateArea, 'view'>>> = Object.fromEntries(
  DELEGATE_AREAS.map((a) => [a, 'view' as const]),
) as Partial<Record<DelegateArea, 'view'>>;

/** `permissions_json` as the retired answer wrote it. */
export type LevelledPermissions = ModeratorPermissions & { access_level?: CoordinatorAccessLevel; prior?: unknown };

/** An answer recorded before the retirement, or null (none — every seat once the migration has run). */
export function levelOf(seat: { permissions_json: LevelledPermissions | null }): CoordinatorAccessLevel | null {
  const v = seat.permissions_json?.access_level;
  return v === 'limited' || v === 'full' ? v : null;
}

/**
 * 🔒 THE COORDINATOR'S CAP, for the hosts' per-part write (`setDelegateArea`): on the coordinator's seat, Memories
 * (`photos`) stays shut and Budget / Payments go no higher than View. Null = allowed. Every other seat answers null
 * here (its own rules are `areaChoices`).
 */
export function coordinatorSeatRefusal(roleSubtype: string | null | undefined, area: DelegateArea, choice: AreaChoice): string | null {
  if (roleSubtype !== COORDINATOR_ROLE) return null;
  if (area === 'photos' && choice !== 'off') return 'Memories stay with the hosts — a coordinator does not open them.';
  if ((area === 'budget' || area === 'payments') && choice === 'edit') return 'A coordinator can view this, never change it.';
  return null;
}
