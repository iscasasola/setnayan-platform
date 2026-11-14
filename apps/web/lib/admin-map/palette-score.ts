/**
 * THE ⌘K BOX'S SCORER — how well one destination matches one needle. Moved here out of `admin-command-palette.tsx`
 * (2026-11-14, ASK-BRAIN) so the box, the phrase-bank simulator and the guards all score with the SHIPPED function
 * instead of hand-kept copies. The palette imports it as `score`; nothing about the bands changed.
 *
 * Bands: the curated menu at full strength, a scanned page at half, a row inside a page at a third. A row must never
 * outrank the page that holds it for a vague query — it wins only when its own words are what you typed. An exact name
 * match on an unlisted page (50) still beats a vague description hit on a menu page (15), and never beats the menu
 * page with the same name (100).
 */
export type Scorable = { label: string; hay: string; source: string };

export function paletteScore(d: Scorable, needle: string): number {
  if (!needle) return 1;
  const l = d.label.toLowerCase();
  let raw = 0;
  const i = l.indexOf(needle);
  if (i === 0) raw = 100;
  else if (i > 0) raw = Math.max(20, 60 - i);
  else if (d.hay.includes(needle)) raw = 15;
  else {
    let p = 0;
    for (let c = 0; c < l.length && p < needle.length; c++) if (l[c] === needle[p]) p++;
    raw = p === needle.length ? 8 : 0;
  }
  if (d.source === 'map') return raw / 2;
  if (d.source === 'row') return raw / 3;
  return raw;
}
