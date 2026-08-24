import { ListPageSkeleton } from '@/components/skeletons';

/**
 * The budget screen's loading skeleton.
 *
 * 🔑 THE NUMBERS HERE ARE A PROMISE ABOUT THE PAGE, AND THEY WERE WRONG. It
 * drew a FOUR-tile stat strip and NO header action; the page renders THREE
 * stats (Target · Committed · Budget left) and ONE action (Export upcoming
 * dates). So the first thing a couple saw on every budget load was a four-tile
 * row that became a three-tile row a beat later, with everything under it
 * jumping — the skeleton causing the layout shift it exists to prevent.
 *
 * 🛡 Neither file is wrong on its own; the defect lives only in the
 * RELATIONSHIP between them, which is why `the-skeleton-matches-the-page.test.ts`
 * reads BOTH and derives these numbers from the page rather than trusting
 * either. Change the page's stat strip and that guard tells you to change this.
 */
export default function BudgetLoading() {
  return <ListPageSkeleton rows={6} toolbar={false} stats={3} actions={1} />;
}
