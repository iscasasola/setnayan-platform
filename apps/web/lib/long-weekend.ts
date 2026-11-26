/**
 * Does the run of days from a candidate date to a nearby holiday (both included) touch a weekend? (A2-H13, final
 * check 25 Nov 2026.) Only then is "a long weekend gives guests time to travel" true. The old test ended in
 * `|| Math.abs(delta) <= 2`, which is always true for the ±1/±2 probe, so every date near a holiday was called a long
 * weekend — a Wednesday beside a Monday holiday included.
 */
export function spanTouchesWeekend(a: Date, b: Date): boolean {
  const start = a <= b ? a : b;
  const end = a <= b ? b : a;
  for (let d = new Date(start.getFullYear(), start.getMonth(), start.getDate()); d <= end; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    if (dow === 0 || dow === 6) return true;
  }
  return false;
}
