import { coupleGiftDetail, coupleGiftHeadline, supplierGiftDetail } from '@/lib/shop-gifts';

/**
 * 🎁 "Gift from <shop>" on a quote (owner 2026-11-04) — the supplier's own gift, as the couple reads it on the quote
 * page (and the supplier on their own sent quote). Promised until the couple's first payment clears; given after.
 * Says nothing at zero. Mounted by `app/proposals/[publicId]/page.tsx` and `/dev/supplier-plan-lab?s=gifts-couple`.
 */
export function QuoteShopGiftNote({
  credits,
  given,
  unlocks = [],
  unlocksGiven = 0,
  shopName,
  side,
}: {
  credits: number;
  /** Credits this shop has already given this event. */
  given: number;
  /** 💎 Event Plus / Event Pro on the quote, by title (slice 2). */
  unlocks?: string[];
  /** Event Plus / Event Pro this shop has already given this event. */
  unlocksGiven?: number;
  shopName: string | null;
  side: 'couple' | 'supplier';
}) {
  const headline = coupleGiftHeadline(credits, shopName, unlocks);
  if (!headline) return null;
  const state = given >= credits && unlocksGiven >= unlocks.length ? 'given' : 'promised';
  return (
    <div data-testid="quote-shop-gift" data-gift-state={state} className="mt-3 rounded-lg bg-mulberry-600/5 px-3 py-2.5">
      <p className="text-sm font-semibold text-mulberry-600">{headline}</p>
      <p className="mt-0.5 text-xs text-ink/60">{side === 'supplier' ? supplierGiftDetail(state) : coupleGiftDetail(state, unlocks.length > 0, credits > 0)}</p>
    </div>
  );
}
