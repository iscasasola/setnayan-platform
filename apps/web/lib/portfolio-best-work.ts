/**
 * ⭐ YOUR BEST WORK — the first Portfolio section (ruling 5940; approved Portfolio v3: "Your best work · Most viewed ·
 * 212 views", empty: "Nothing yet · your most-viewed photos gather here").
 *
 * The page photos couples OPENED most, most-viewed first, from the counter that already exists — no new counter:
 * `vendor_portfolio_photo_views` (migration 20271331531509; one per viewer per photo per Manila day; the shop's own
 * people and admins never count), read by `readPortfolioPhotoViews`.
 *   · only photos still on the page (a count for a removed key is ignored), only with at least one view;
 *   · ties go to the LATER photo (the hero's rule, `mostViewedPhotoKey`);
 *   · a photo whose display URL would not sign is left out, never drawn broken;
 *   · `views === null` (the read failed) → `null`, which the section says as "Couldn't load" — never "Nothing yet".
 * 🔒 lib/portfolio-best-work.test.ts
 */
export type BestWorkPhoto = { key: string; url: string; views: number };

/** How many photos the rail holds. */
export const BEST_WORK_MAX = 9;

export function bestWorkOf(
  keys: readonly string[],
  urls: Readonly<Record<string, string>>,
  views: ReadonlyMap<string, number> | null,
): BestWorkPhoto[] | null {
  if (views === null) return null;
  const at = new Map(keys.map((k, i) => [k, i] as const));
  return keys
    .filter((k) => (views.get(k) ?? 0) > 0 && Boolean(urls[k]))
    .map((k) => ({ key: k, url: urls[k]!, views: views.get(k)! }))
    .sort((a, b) => b.views - a.views || at.get(b.key)! - at.get(a.key)!)
    .slice(0, BEST_WORK_MAX);
}

/** "Most viewed · 212 views" on the first tile, "96 views" on the rest; "1 view" said in the singular. */
export function bestWorkLine(views: number, first: boolean, fmt: (n: number) => string = (n) => n.toLocaleString('en-PH')): string {
  const n = `${fmt(views)} ${views === 1 ? 'view' : 'views'}`;
  return first ? `Most viewed · ${n}` : n;
}
