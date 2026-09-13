import { ListPageSkeleton } from '@/components/skeletons';

/**
 * The budget screen's loading skeleton.
 *
 * 🔑 THE NUMBERS HERE ARE A PROMISE ABOUT THE PAGE, AND THEY WERE WRONG ONCE
 * ALREADY. It drew a FOUR-tile stat strip and NO header action while the page
 * rendered THREE stats and ONE action, so the first thing a couple saw on
 * every budget load was a tile row re-flowing a beat later, with everything
 * under it jumping — the skeleton causing the layout shift it exists to
 * prevent.
 *
 * BA4 merged the page's two separate stat rows (Target/Committed/Budget left
 * · Total to pay/Paid so far/Balance) into one four-tile row — Target ·
 * Agreed · Paid · Owed — so this promise is `stats={4}` again, for a
 * different reason than before.
 *
 * 🛡 Neither file is wrong on its own; the defect lives only in the
 * RELATIONSHIP between them, which is why `the-skeleton-matches-the-page.test.ts`
 * reads BOTH and derives these numbers from the page rather than trusting
 * either. Change the page's stat strip and that guard tells you to change this.
 */
export default function BudgetLoading() {
  return <ListPageSkeleton rows={6} toolbar={false} stats={4} actions={1} />;
}
