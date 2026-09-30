/**
 * pillar-parts.ts — which PARTS each pillar page holds, and when.
 *
 * ⚖ Owner 2026-09-29 (DECISION_LOG "WHAT AN EVENT NEEDS — THE EVENT MENU
 * BECOMES FOUR PILLARS (+ HOME)"): the event menu becomes Home · Guest list ·
 * Your Team · Event Hub Maker · Our Services, the rows stay plain ("solid menu
 * with no submenus", 2026-07-15), and "each pillar's page shows its parts".
 * The controller's placements this file carries:
 *
 *   Guest list   Guests · Hosts · Check-in
 *   Your Team    Your team · Budget
 *
 * 🔑 PARTS ARE WHOLE SHIPPED SCREENS, NOT NEW ONES. Hosts is the shipped
 * `/hosts` page, Check-in the shipped check-in desk, Budget the shipped
 * `/budget` page — each rendered inside its pillar's page body. Nothing here
 * re-draws them; this file only decides which doors a pillar offers.
 *
 * 🔑 A PART IS PICKED, NOT A PILL ROW. The parts are one PickMenu dropdown
 * (owner 2026-09-28: "if there are choices, again. us drop down menu").
 *
 * PURE, so it can be executed — `pillar-parts.test.ts` runs it. The door that
 * vanishes silently is the failure this repo keeps meeting (see
 * `roster-doors.ts`'s own header), so the list is pinned where it is decided.
 *
 * ── EVERY DOOR KEEPS THE CONDITION IT HAD ──────────────────────────────────
 *   Guests      always
 *   Hosts       NOT OFFERED since the Hosts fold (owner 2026-09-30, DECISION_LOG
 *               "GUEST LIST: ACCESS + CHECK-IN BECOME COLUMNS…"): its pieces
 *               moved (the Access column, the planner's workspace, the
 *               Overview feed) and `?gview=hosts` redirects to the list. Listed
 *               only while it is the one showing, until that redirect lands.
 *               The row itself is cut after the card redesign (build F2).
 *   Check-in    from the day of the event onward: the menu row shows it on the
 *               day, and the guest list's own Check-in door shows it after.
 *               The union of the two, never earlier — a check-in desk before
 *               anybody can arrive is a screen with nothing to do.
 *   Your team   always
 *   Budget      wherever the event type has the budget surface — the same
 *               switch the Budget page itself gates on.
 */

import type { MenuLifecyclePhase } from './day-of-mode';

export type PillarPart<K extends string = string> = { key: K; label: string; href: string };

/** The Guest list's parts. `roster` is the list itself, in every view of it. */
export type GuestListPartKey = 'roster' | 'hosts' | 'checkin';

/** The `?gview=` value that renders each non-roster part in the guest list body. */
export const GUEST_LIST_PART_VIEW = { hosts: 'hosts', checkin: 'checkin' } as const;

export function guestListParts({
  eventId,
  phase,
  current,
}: {
  eventId: string;
  phase: MenuLifecyclePhase;
  /** The part on screen. A part is always listed while it is the one showing
   *  (a desk opened by its URL before the day), so the picker never shows a
   *  value it does not offer. */
  current: GuestListPartKey;
}): PillarPart<GuestListPartKey>[] {
  const base = `/dashboard/${eventId}/guests`;
  const parts: PillarPart<GuestListPartKey>[] = [{ key: 'roster', label: 'Guests', href: base }];
  if (current === 'hosts') {
    parts.push({ key: 'hosts', label: 'Hosts', href: `${base}?gview=${GUEST_LIST_PART_VIEW.hosts}` });
  }
  if (phase !== 'plan' || current === 'checkin') {
    parts.push({ key: 'checkin', label: 'Check-in', href: `${base}?gview=${GUEST_LIST_PART_VIEW.checkin}` });
  }
  return parts;
}

/** Your Team's parts. `team` is the shipped Your Team takeover. */
export type YourTeamPartKey = 'team' | 'budget';

/** The `?part=` value that renders the Budget part in the Your Team page. */
export const YOUR_TEAM_BUDGET_PART = 'budget';

/** Your Team's Budget part — the one address every budget doorway uses. */
export function yourTeamBudgetHref(eventId: string): string {
  return `/dashboard/${eventId}/vendors?part=${YOUR_TEAM_BUDGET_PART}`;
}

export function yourTeamParts({
  eventId,
  budgetEnabled,
}: {
  eventId: string;
  /** The event type's `budget` surface (`surfaceEnabled(profile, 'budget')`) —
   *  the switch the Budget page itself gates on. Off, the part is not offered,
   *  rather than offered and then sent home. */
  budgetEnabled: boolean;
}): PillarPart<YourTeamPartKey>[] {
  const parts: PillarPart<YourTeamPartKey>[] = [
    { key: 'team', label: 'Suppliers', href: `/dashboard/${eventId}/vendors` },
  ];
  if (budgetEnabled) parts.push({ key: 'budget', label: 'Budget', href: yourTeamBudgetHref(eventId) });
  return parts;
}

/**
 * Where an old standalone route's query string lands inside its pillar. Every
 * param is carried (a Hosts action redirects with `?invite_sent=1&token=…`,
 * and that banner must still show), and `extra` wins over a same-named one.
 */
export function partHref(
  path: string,
  search: Record<string, string | string[] | undefined>,
  extra: Record<string, string>,
): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(search)) {
    if (k in extra || v === undefined) continue;
    for (const one of Array.isArray(v) ? v : [v]) p.append(k, one);
  }
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  const qs = p.toString();
  return qs ? `${path}?${qs}` : path;
}
