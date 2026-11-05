import { ListPageSkeleton } from '@/components/skeletons';

/**
 * The budget screen's loading skeleton.
 *
 * 🔑 THE NUMBERS HERE ARE A PROMISE ABOUT THE PAGE. A skeleton that reserves
 * the wrong number of figures re-flows the moment the real page lands, and
 * everything under it jumps — the layout shift a skeleton exists to prevent.
 *
 * Since Budget B1 (2026-10-08) the page's summary is `BudgetSummary`: FOUR
 * figures — Target · Agreed · Paid · Owed — two by two, so this is `stats={4}`.
 * The masthead still carries its three export links until they move (plan row
 * B4), so `actions={3}`.
 *
 * 🛡 Neither file is wrong on its own; the defect lives only in the
 * RELATIONSHIP between them. `the-skeleton-matches-the-page.test.ts` reads this
 * file AND the summary component and counts the figures out of the component,
 * so changing the summary tells you to change this.
 */
export default function BudgetLoading() {
  return <ListPageSkeleton rows={6} toolbar={false} stats={4} actions={3} />;
}
