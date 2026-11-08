/**
 * The words of the portfolio count (pure, so client components and tests share them with `lib/portfolio-count.ts`).
 *
 *   · inside the free room: "12 of 50 free photos"
 *   · past it:              "62 photos · 50 free used"   (the rest were paid once with shop credits)
 *
 * An unread count has no words here — the caller prints its own "Couldn't load", never "0 of 50".
 */
export type PortfolioCount =
  | { ok: true; photos: number; free: number; label: string }
  | { ok: false };

const n = (x: number) => x.toLocaleString('en-PH');

export function portfolioCountLabel(photos: number, free: number): string {
  const p = Math.max(0, Math.floor(photos));
  const f = Math.max(0, Math.floor(free));
  if (p <= f) return `${n(p)} of ${n(f)} free photos`;
  return `${n(p)} photos · ${n(f)} free used`;
}
