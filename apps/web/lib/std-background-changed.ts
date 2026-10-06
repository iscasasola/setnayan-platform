/**
 * Did a Save the Date studio save actually CHANGE the film's background?
 *
 * The studio posts `background` on every save, so `std_background` sits in the
 * patch even when the couple only edited the venue. A drafted "Same as theme"
 * (Maker › Theme step) may only be forgotten when the live value really moved —
 * otherwise an untouched save would silently delete the couple's drafted choice
 * (review of #6358, 2026-10-05). Compared canonically: Postgres returns JSONB
 * with its own key order, so a plain JSON.stringify would call equal values
 * different.
 */
function canonical(v: unknown): string {
  if (v === undefined || v === null) return 'null';
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v);
}

export function stdBackgroundChanged(before: unknown, after: unknown): boolean {
  return canonical(before) !== canonical(after);
}
