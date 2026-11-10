import { TrendingUp } from 'lucide-react';
import { DatesRow } from '../../customers/_components/dates-row';

/** Where ONE Analytics lives — Shop › Analytics (the Shop segment `insights`, `shop-sections.ts`). */
export const ONE_ANALYTICS_HREF = '/vendor-dashboard/performance';

/**
 * 📊 SHOP › ANALYTICS ON THE SHOP TAB — ONE DOOR, NOT A SECOND ANALYTICS (Build 6 · Lane I; owner 10 Nov: *"No dupes. we
 * want graphs that will help them. tapping shows a recommendation from us on what they need to do."*; approved prototype
 * `build6_makers_analytics_2026-11-10` § Analytics, its dedupe table: *"The carousel is gone; its five pictures live on
 * as tiles."*).
 *
 * ⏮ WAS the five-card carousel (#7399: What's ahead · Quotes that turn into bookings · Where your price sits · What
 * Setnayan added · Compared with similar suppliers), each a SECOND copy of a fact ONE Analytics already draws as a tile
 * (#7439 folded all five in). Two analytics that disagree about one fact each pass their own tests — so the copies go and
 * this row is the one way in. It states NO number about the shop (so it can never disagree with the page it opens) and
 * reads nothing: the Shop tab's request count drops by the whole analytics batch.
 *
 * An unverified shop is told up front what opens where (DECISION_LOG 2026-11-10 "FREE (UNVERIFIED): THE LAST SEVEN":
 * analytics beyond simple counts open once Verified) — the lock itself is drawn on the page it opens, by the shared
 * `LockedFeature` (Build 5 Lane B), never here.
 *
 * 🔒 shop/one-analytics-not-two.test.ts
 */
export function ShopAnalyticsDoor({ verified }: { verified: boolean }) {
  return (
    <section aria-labelledby="shop-analytics-h" data-shop-analytics="" data-tour="shop-analytics" id="analytics" className="scroll-mt-24">
      <div className="flex items-baseline justify-between px-4 pb-2 pt-5">
        <h2 id="shop-analytics-h" className="sn-eye">
          Analytics
        </h2>
        <span className="text-[11.5px] text-ink/50">tap any graph · our recommendation</span>
      </div>
      <div className="px-4">
        <DatesRow
          data="shop-analytics-door"
          lead={<TrendingUp aria-hidden className="h-[18px] w-[18px] flex-none text-ink/55" strokeWidth={1.75} />}
          title="How is my business doing"
          line={verified ? 'Every graph, and what we recommend' : 'Your counts · graphs open once Verified'}
          href={ONE_ANALYTICS_HREF}
        />
      </div>
    </section>
  );
}
