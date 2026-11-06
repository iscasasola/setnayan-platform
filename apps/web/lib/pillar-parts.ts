/**
 * pillar-parts.ts — which PARTS each pillar page holds, and when.
 *
 * ⚖ Owner 2026-09-29 (DECISION_LOG "WHAT AN EVENT NEEDS — THE EVENT MENU
 * BECOMES FOUR PILLARS (+ HOME)"): the event menu becomes Home · Guest list ·
 * Your Team · Event Hub Maker · Our Services, the rows stay plain ("solid menu
 * with no submenus", 2026-07-15), and "each pillar's page shows its parts".
 * ⚖ NO PILLAR HOLDS PARTS ANY MORE. The Guest list's parts row was cut in F2 (below); Your Team's Budget part and
 * Suppliers › Booked's Team · Budget · Schedule went on 2026-11-01/02 — Budget and Schedule are Home's own pages
 * (`budgetPageHref`, `schedulePageHref`) and Booked is just the team. What remains here is the one address of each
 * page and the forwarding of the old `?part=` values.
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
 */

export type PillarPart<K extends string = string> = { key: K; label: string; href: string };

/**
 * The OLD `?part=` value that drew the Budget inside Suppliers (2026-09-29 → 2026-11-01). Nothing links it any more;
 * `vendors/page.tsx` forwards it to the Budget page, carrying `?pay=`, so an old bookmark or notification still lands.
 */
export const YOUR_TEAM_BUDGET_PART = 'budget';

/**
 * 💰 THE BUDGET PAGE — its own page, opened from Home › Budget (owner 2026-11-01, DECISION_LOG "SCHEDULE AND BUDGET GO
 * TO HOME": *"Okay place it in home"*). ONE address for every budget door: Home's widget (its tile, each Pay face, the
 * summary), the Booked Budget block, Suppliers ⚙ Payments, Event Settings. Never a copy of the page elsewhere.
 * `pay` = a payment's `line_item_id`: the page opens that payment's Pay sheet on arrival (`payTargetVendor`).
 */
export function budgetPageHref(eventId: string, opts: { pay?: string | null } = {}): string {
  const base = `/dashboard/${eventId}/budget`;
  return opts.pay ? `${base}?pay=${encodeURIComponent(opts.pay)}` : base;
}

/**
 * 📅 THE SCHEDULE PAGE — its own page, opened from Home › Schedule (owner 2026-11-01 "SCHEDULE AND BUDGET GO TO HOME";
 * 2026-11-02 "BOOKED IS JUST THE TEAM": *"no just schedule"*). ONE address for every schedule door. `query` carries
 * the page's own params (`view` · `ros` · `note` · `host_answers` · `sheet` · `filter`) — empty values are dropped.
 */
export function schedulePageHref(eventId: string, query: Record<string, string | null | undefined> = {}): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v) q.set(k, v);
  const qs = q.toString();
  return `/dashboard/${eventId}/schedule${qs ? `?${qs}` : ''}`;
}

/**
 * The OLD `?part=` value that drew the Schedule inside Suppliers › Booked (2026-10-29 → 2026-11-02). Nothing links it
 * any more; `vendors/page.tsx` forwards it to the Schedule page with its query, so an old link still lands.
 *
 * 🧹 SUPPLIERS › BOOKED IS JUST THE TEAM (owner 2026-11-02, *"and booked-team will just be booked."*): the Team ·
 * Budget · Schedule parts, their `Team ▾` row and the frames that drew Budget and Schedule inside Suppliers are gone.
 * Suppliers' one dropdown reads Find · Build · Booked; Schedule and Budget are Home's pages.
 */
export const BOOKED_SCHEDULE_PART = 'schedule';

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
