/**
 * THE ONE ANSWER TO "IS THIS SHOP A COORDINATOR?" (2026-10-19).
 *
 * `vendor_profiles.services` holds the COARSE category first ('planner_coordinator',
 * written by /open-shop and by a couple's claim link) and then the shop's
 * canonical LEAF ('wedding_coordination', 'day_of_coordinator', …). Every day-of
 * coordinator gate asked for the TILE key `'coordinator'` instead — a value no
 * shop writer ever puts in `services` — so the day-of inbox, Run the day, the
 * floor command and find-my-seat were closed to every real coordinator, and a
 * coordinator who joined from the couple's own link (services =
 * ['planner_coordinator']) was a "general" supplier everywhere.
 *
 * One list, three names for one trade: the tile, the coarse category, and every
 * canonical leaf the taxonomy files under the coordinator tile.
 *
 * 🔒 MIRRORED IN SQL by `public.services_make_a_coordinator(text[])` (migration
 * 20271280303462), which every coordinator gate in the database now calls.
 * `coordinator-trade-is-one-list.test.ts` fails if this list drifts from the
 * taxonomy OR from the SQL copy.
 */
export const COORDINATOR_TRADE_SERVICES: readonly string[] = [
  'coordinator',
  'planner_coordinator',
  'wedding_coordination',
  'wedding_planner_partial',
  'day_of_coordinator',
  'destination_wedding_specialist',
  'pamamanhikan_coordinator',
  'despedida_planner',
  'sponsor_coordinator',
  'gender_separated_reception_coordinator',
  'religious_venue_coordinator',
  'inc_wedding_coordinator',
  'mahr_coordination',
  'setnayan_concierge',
];

const COORDINATOR_TRADE_SET: ReadonlySet<string> = new Set(COORDINATOR_TRADE_SERVICES);

/** True when any of the shop's services is the coordinator trade, under any of its names. */
export function isCoordinatorTrade(services: readonly string[] | null | undefined): boolean {
  return (services ?? []).some((s) => COORDINATOR_TRADE_SET.has(s));
}
