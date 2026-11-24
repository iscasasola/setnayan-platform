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
