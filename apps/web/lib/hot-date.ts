/**
 * lib/hot-date.ts — THE HOT-DATE RULE, one copy. Moved here from `app/onboarding/_shared/date-calendar.tsx`
 * (SHOP-02 v7, 14 Nov 2026): the event-setup calendar paints it as five shades; the shop's Check a date shows its
 * top two tiers ("In demand" · "Hottest") as a shine. Moved, not re-invented — the body is unchanged.
 */

/* ── predicted demand "heat" (deterministic · cold-start-safe · spec Date-Aligner §L.1).
   Stacks the calendar signals (peak month · weekday ·
   repeating/symbolic) into a 0–4 tier driving the cell colour ramp. This is the PREDICTED half only — the observed
   inquiry/relative-to-supply escalation (§L.2) is deferred until the marketplace has
   inquiry data (founder-only today → it would be dead code). Mirrors the verified
   prototype Hot_Date_Heat_Calendar_Prototype_2026-06-09.html. */
const HEAT_PEAK: Record<number, number> = { 11: 2, 0: 2, 1: 2, 10: 2, 3: 1, 4: 1, 9: 1 }; // getMonth() idx: Dec/Jan/Feb/Nov=2 · Apr/May/Oct=1
/**
 * 🗓 A MONTH's own demand — the same table the day shades start from, without the day-of-week lift: 0 quiet ·
 * 1 popular · 2 in demand (owner 2026-11-17, the "Some months" list: "Busy and quiet months come from the calendar's
 * own demand rule").
 */
export function monthDemand(monthIndex: number): 0 | 1 | 2 {
  return (HEAT_PEAK[monthIndex] ?? 0) as 0 | 1 | 2;
}

export function heatTier(d: Date): 0 | 1 | 2 | 3 | 4 {
  const m = d.getMonth();
  const dow = d.getDay();
  const n = d.getDate();
  let s = HEAT_PEAK[m] ?? 0;
  if (dow === 6) s += 2; // Saturday — the prime wedding day
  else if (dow === 5 || dow === 0) s += 1; // Friday / Sunday
  if (m + 1 === n) s += 2; // repeating MM·DD (12/12, 11/11…)
  if (m === 1 && n === 14) s += 2; // Valentine's
  if (dow === 6 && m + 1 === n) s += 1; // Saturday + repeating combo
  return s <= 0 ? 0 : s <= 2 ? 1 : s === 3 ? 2 : s <= 5 ? 3 : 4;
}

/** The tiers Check a date shines: In demand (3) and Hottest (4). Quiet and Popular stay plain. */
export const SHINING_TIERS: readonly number[] = [3, 4];

/**
 * A calendar day ("YYYY-MM-DD") read as a LOCAL date — never `new Date('2026-12-12')`, which is midnight UTC and
 * the 11th west of Greenwich.
 */
export function heatTierOfDay(day: string): 0 | 1 | 2 | 3 | 4 {
  const [y, m, d] = day.split('-').map(Number);
  return heatTier(new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1));
}

export function dayShines(day: string): boolean {
  return SHINING_TIERS.includes(heatTierOfDay(day));
}
