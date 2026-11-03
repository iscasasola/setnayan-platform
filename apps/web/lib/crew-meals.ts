/**
 * 🍱 THE CREW MEALS A CATERER PLATES — per booked supplier, the number the host set (owner 2026-11-02, DECISION_LOG
 * "SCHEDULE FITS THE COORDINATOR'S TIMELINE AS WRITTEN: 4 ADDITIONS" (4); migration 20271303132255).
 *
 * The host's number is the EXISTING couple-side field: `event_vendors.crew_size` on a supplier marked
 * `crew_meal_covered` ("Crew fed by your caterer"), blank = the supplier's own listing. The caterer reads it through
 * `get_vendor_crew_meals` (names and counts only). Pure: rows in, lines and a total out.
 */
export type CrewMealLine = { name: string; category: string; meals: number; fromListing: boolean };

/** RPC rows → lines, dropping anything malformed or zero (a crew of 0 is not a meal). */
export function crewMealLines(rows: readonly Record<string, unknown>[] | null | undefined): CrewMealLine[] {
  const out: CrewMealLine[] = [];
  for (const r of rows ?? []) {
    const meals = typeof r.meals === 'number' ? r.meals : Number(r.meals);
    if (typeof r.vendor_name !== 'string' || !Number.isInteger(meals) || meals <= 0) continue;
    out.push({ name: r.vendor_name, category: typeof r.category === 'string' ? r.category : '', meals, fromListing: r.from_listing === true });
  }
  return out;
}

export function crewMealTotal(lines: readonly CrewMealLine[]): number {
  return lines.reduce((sum, l) => sum + l.meals, 0);
}

/** "4 meals" · "1 meal". */
export function mealsWords(n: number): string {
  return `${n} meal${n === 1 ? '' : 's'}`;
}

/**
 * The categories whose booking feeds the other suppliers' crews: the dedicated crew-meal provider, and the caterer.
 * On the couple side, "Crew fed by your caterer" is offered on every other supplier once one of these is booked.
 */
export const CREW_MEAL_FEEDERS = ['crew_meals', 'catering'] as const;

export function feedsCrews(category: string | null | undefined): boolean {
  return (CREW_MEAL_FEEDERS as readonly string[]).includes(category ?? '');
}
