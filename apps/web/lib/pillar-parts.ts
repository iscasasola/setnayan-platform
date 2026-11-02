/**
 * pillar-parts.ts — which PARTS each pillar page holds, and when.
 *
 * ⚖ Owner 2026-09-29 (DECISION_LOG "WHAT AN EVENT NEEDS — THE EVENT MENU
 * BECOMES FOUR PILLARS (+ HOME)"): the event menu becomes Home · Guest list ·
 * Your Team · Event Hub Maker · Our Services, the rows stay plain ("solid menu
 * with no submenus", 2026-07-15), and "each pillar's page shows its parts".
 * The controller's placements this file carries:
 *
 *   Guest list   NO PARTS since F2 (2026-10-01) — see below
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
 * ⚖ THE GUEST LIST'S PARTS ROW WAS CUT LAST, IN F2 (owner 2026-09-30,
 * DECISION_LOG "GUEST LIST: ACCESS + CHECK-IN BECOME COLUMNS; HOSTS FOLDS INTO
 * THE GUEST LIST" (5)(6)). Access and Check-in are columns of the list; the
 * Hosts pieces moved (the Access column, a helper's guest card, the planner's
 * workspace, the Overview feed). `?gview=hosts` lands on `/hosts` (the Guest
 * list, or a helper's own access view) and `?gview=checkin` on the door crew's
 * standalone desk — both redirects live in `guests/page.tsx`.
 *
 * ── EVERY DOOR KEEPS THE CONDITION IT HAD ──────────────────────────────────
 *   Your team   always
 *   Budget      wherever the event type has the budget surface — the same
 *               switch the Budget page itself gates on.
 */

export type PillarPart<K extends string = string> = { key: K; label: string; href: string };

export type YourTeamPartKey = 'team' | 'budget';

/**
 * The OLD `?part=` value that drew the Budget inside Suppliers (2026-09-29 → 2026-11-01). Nothing links it any more;
 * `vendors/page.tsx` forwards it to the Budget page, carrying `?pay=`, so an old bookmark or notification still lands.
 */
export const YOUR_TEAM_BUDGET_PART = 'budget';

/**
 * 💰 THE BUDGET PAGE — its own page, opened from Home › Budget (owner 2026-11-01, DECISION_LOG "SCHEDULE AND BUDGET GO
 * TO HOME": *"Okay place it in home"*). ONE address for every budget door: Home's widget (its tile, each Pay face, the
 * summary), Suppliers › Booked's menu, the Booked Budget block, Event Settings. Never a copy of the page elsewhere.
 * `pay` = a payment's `line_item_id`: the page opens that payment's Pay sheet on arrival (`payTargetVendor`).
 */
export function budgetPageHref(eventId: string, opts: { pay?: string | null } = {}): string {
  const base = `/dashboard/${eventId}/budget`;
  return opts.pay ? `${base}?pay=${encodeURIComponent(opts.pay)}` : base;
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
  if (budgetEnabled) parts.push({ key: 'budget', label: 'Budget', href: budgetPageHref(eventId) });
  return parts;
}

/**
 * 📅 SUPPLIERS › BOOKED = TEAM · BUDGET · SCHEDULE (owner 2026-10-29, *"so booked has budget and schedule."*; the
 * approved final Suppliers design, 2026-10-30 — `carry-2026-10-29/suppliers-final-proto/`). ONE dropdown on the
 * Booked body's first row ("Team ▾ · 3 booked"), never a pill row.
 *
 *   Team      the Booked body itself (`?tab=budget` is the Booked mode's own bus key — `SUPPLIERS_MODE_TAB`)
 *   Budget    a door to the Budget page itself (`budgetPageHref`) — since 2026-11-01 the page lives under Home and
 *             is no longer drawn inside Suppliers (owner: *"Okay place it in home"*); Booked's menu keeps the door
 *   Schedule  the shipped Schedule page, rendered whole (`?part=schedule`) — moved here from Studio (2026-10-27:
 *             "rendered whole the way Budget is"); its old address forwards here (`schedule/page.tsx`)
 *
 * 🔑 Every door keeps its condition: Budget only where the event type has the budget surface.
 */
export type BookedPartKey = 'team' | 'budget' | 'schedule';

/** The `?part=` value that renders the Schedule part in the Suppliers page. */
export const BOOKED_SCHEDULE_PART = 'schedule';

/** Booked › Schedule — the one address every schedule doorway lands on. */
export function bookedScheduleHref(eventId: string): string {
  return `/dashboard/${eventId}/vendors?part=${BOOKED_SCHEDULE_PART}`;
}

/** Booked › Team — the Booked body (its bus key). */
export function bookedTeamHref(eventId: string): string {
  return `/dashboard/${eventId}/vendors?tab=budget`;
}

export function bookedParts({
  eventId,
  budgetEnabled,
}: {
  eventId: string;
  budgetEnabled: boolean;
}): PillarPart<BookedPartKey>[] {
  const parts: PillarPart<BookedPartKey>[] = [{ key: 'team', label: 'Team', href: bookedTeamHref(eventId) }];
  if (budgetEnabled) parts.push({ key: 'budget', label: 'Budget', href: budgetPageHref(eventId) });
  parts.push({ key: 'schedule', label: 'Schedule', href: bookedScheduleHref(eventId) });
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
