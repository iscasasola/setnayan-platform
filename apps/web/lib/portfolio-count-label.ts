/**
 * The words of the portfolio count (pure, so client components and tests share them with `lib/portfolio-count.ts`).
 * 🔓 No count limit since 2026-11-23 (owner: the 50-photo portfolio cap is dropped — storage is the only limit), so the
 * words are just the number: "12 photos". An unread count has no words here — the caller prints its own "Couldn't
 * load", never "0 photos".
 */
export type PortfolioCount = { ok: true; photos: number; label: string } | { ok: false };

export function portfolioCountLabel(photos: number): string {
  const p = Math.max(0, Math.floor(photos));
  return `${p.toLocaleString('en-PH')} ${p === 1 ? 'photo' : 'photos'}`;
}

/**
 * 🔢 THE ONE PORTFOLIO COUNT RULE (L6 · S3, walk 27 Nov 2026: Today said 8 photos, Collections said 10). The page gallery
 * is `vendor_profiles.portfolio_r2_keys`; a photo is a distinct, non-empty key — a key saved twice is one photo on the
 * page, and an empty slot is none. `getPortfolioCount` (Today, the Portfolio row), Collections and Your page's "N photos"
 * all count through here, so one shop can never be two numbers.
 * 🔒 lib/portfolio-count-is-one-rule.test.ts
 */
export function portfolioPhotoKeys(keys: readonly (string | null | undefined)[] | null | undefined): string[] {
  return [...new Set((keys ?? []).filter((k): k is string => typeof k === 'string' && k.trim() !== ''))];
}

/** How many photos the page gallery holds — `portfolioPhotoKeys(keys).length`. */
export function countPortfolioPhotos(keys: readonly (string | null | undefined)[] | null | undefined): number {
  return portfolioPhotoKeys(keys).length;
}
