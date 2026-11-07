/**
 * 🖼 TODAY'S PORTFOLIO STAT — "N of 50 · free photos" (THE ONE BUILD A4, spec §4: "Portfolio stat = 'N of 50 free
 * photos' while storage purchase is off").
 *
 * ⏳ TYPED STUB (spec §9 #17): lane C4's first push exposes `getPortfolioCount(vendorId)` in `lib/portfolio-count.ts`.
 * Until it lands this answers `undefined` — the stat then draws its label with NO figure (never a guessed count, and
 * never "couldn't load" for a read that was simply not built yet). The swap is one line: return C4's count, mapped to
 * `{ used, free }` (or `null` when its read was refused).
 */
export type TodayPortfolioCount = { used: number; free: number } | null | undefined;

export async function getPortfolioCountStub(vendorProfileId: string): Promise<TodayPortfolioCount> {
  void vendorProfileId;
  return undefined;
}
